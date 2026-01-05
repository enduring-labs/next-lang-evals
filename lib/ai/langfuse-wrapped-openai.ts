import { getLangfuse } from '@/lib/observability/langfuse';
import { LangfuseTraceClient, observeOpenAI } from 'langfuse';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const DEFAULT_MODEL_NAME: string = 'gpt-5';


/**
 * Simple OpenAI wrapper with Langfuse logging.
 * - If `schema` is provided, sends a JSON schema response_format and tries to parse+validate the assistant content.
 * - Tools, tool_choice, and response_format are supported in the same code path.
 */
export async function langfuseWrappedOpenAI<T = string>({
  model = DEFAULT_MODEL_NAME,
  messages,
  temperature,
  verbosity,
  customProperties = {},
  schema,
  langfuseParams = {},
  tools,
  tool_choice,
  responseFormatName,
  reasoning_effort,
}: {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>;
  temperature?: number;
  verbosity?: 'low' | 'medium' | 'high';
  customProperties?: Record<string, any>;
  schema?: z.ZodSchema<T>;
  langfuseParams?: {
    traceId?: string;
    traceName?: string;
    trace?: LangfuseTraceClient;
    generationName?: string;
    sessionId?: string;
    userId?: string;
    prompt?: any;
    promptVariables?: any;
  };
  tools?: any[];
  tool_choice?: any;
  responseFormatName?: string;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
}): Promise<{
  text?: string;
  parsed?: T | null;
  message?: any;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
} | null> {
  // Dev warning: if a Langfuse prompt is passed without promptVariables, log a warning
  // This helps catch missing promptVariables which are needed for eval runs
  if (
    langfuseParams.prompt &&
    !langfuseParams.promptVariables &&
    process.env.NODE_ENV === 'development'
  ) {
    console.warn(
      `[langfuseWrappedOpenAI] WARNING: Langfuse prompt passed without promptVariables. ` +
        `Generation: ${langfuseParams.generationName || 'unnamed'}. ` +
        `Eval runs require promptVariables in metadata. ` +
        `Use compilePromptWithVariables() from langfuse-helpers.ts to ensure variables are tracked.`,
    );
  }

  const langfuse = getLangfuse();

  // ----- tracing -----
  const trace = langfuseParams.trace
    ? langfuseParams.trace.update({
        sessionId: langfuseParams.sessionId,
        userId: langfuseParams.userId,
        metadata: {
          source: 'langfuse-wrapped-openai',
          ...customProperties,
          promptVariables: langfuseParams.promptVariables,
        },
      })
    : langfuse?.trace({
        id: langfuseParams.traceId,
        name: langfuseParams.traceName,
        sessionId: langfuseParams.sessionId,
        userId: langfuseParams.userId,
        metadata: {
          source: 'langfuse-wrapped-openai',
          ...customProperties,
          promptVariables: langfuseParams.promptVariables,
        },
      });

  const openai = observeOpenAI(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    {
      parent: trace,
      generationName: langfuseParams.generationName || 'langfuse-wrapped-openai-prompt',
      langfusePrompt: langfuseParams.prompt,
      sessionId: langfuseParams.sessionId,
      userId: langfuseParams.userId,
      metadata: {
        source: 'langfuse-wrapped-openai',
        ...customProperties,
        promptVariables: langfuseParams.promptVariables,
      },
    },
  );

  // Build one request object. Add tools/response_format only if present.
  const request: any = {
    model,
    messages,
    temperature,
    ...(verbosity ? { verbosity: verbosity } : {}),
    ...(tools?.length ? { tools, tool_choice } : {}),
    ...(schema
      ? {
          response_format: zodResponseFormat(
            schema,
            responseFormatName || 'output',
          ),
        }
      : {}),
    ...(reasoning_effort ? { reasoning_effort: reasoning_effort } : {}),
  };

  try {
    const completion = await openai.chat.completions.create(request);
    const message = completion.choices?.[0]?.message;

    // Default text (if any)
    const text: string | undefined = message?.content ?? undefined;

    // Optional parsing if a schema was provided
    let parsed: T | null = null;
    if (schema) {
      try {
        // When tools are used, the model may choose tool_calls instead of content.
        // Only attempt parsing if we actually got content.
        if (typeof message?.content === 'string') {
          const raw = JSON.parse(message.content);
          const res = schema.safeParse(raw);
          parsed = res.success ? res.data : null;
        }
      } catch {
        parsed = null;
      }
    }

    // Extract tool calls if model chose to call tools
    const toolCalls = message?.tool_calls?.map((tc: any) => {
      // Parse arguments to sanitize them
      let sanitizedArguments = tc.function.arguments;
      try {
        const parsedArgs = JSON.parse(tc.function.arguments);
        sanitizedArguments = JSON.stringify(parsedArgs);
      } catch {
        // If parsing fails, sanitize the string directly
        sanitizedArguments = tc.function.arguments;
      }

      return {
        id: tc.id,
        type: tc.type as 'function',
        function: {
          name: tc.function.name,
          arguments: sanitizedArguments,
        },
      };
    });

    // Build output for Langfuse - include tool calls if present
    const langfuseOutput =
      toolCalls && toolCalls.length > 0
        ? {
            toolCalls: toolCalls.map((tc: any) => {
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments);
              } catch {
                parsedArgs = { raw: tc.function.arguments };
              }
              return {
                id: tc.id,
                name: tc.function.name,
                arguments: parsedArgs,
              };
            }),
          }
        : (parsed ?? message);

    // Log output once (message + parsed if available, or tool calls)
    trace?.update({
      output: langfuseOutput,
      metadata: {
        hasToolCalls: !!(toolCalls && toolCalls.length > 0),
      },
    });

    return { text: text, parsed: parsed, message, toolCalls };
  } catch (error: any) {
    console.error('langfuseWrappedOpenAI error:', {
      model,
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
      errorStatus: error.status,
      errorType: error.type,
      errorResponse: error.response?.data,
      customProperties,
      hasSchema: !!schema,
      hasTools: !!tools,
      messageCount: messages.length,
    });
    trace?.update({ metadata: { error: String(error) } });
    return null;
  } finally {
    await openai.flushAsync(); // flush wrapper-captured events
    await langfuse?.shutdownAsync();
  }
}
