
import { getLangfuse } from '@/lib/observability/langfuse';
import {
  Content,
  createPartFromUri,
  FunctionCall,
  GoogleGenAI,
  Part,
  Schema,
  Tool,
  Type,
} from '@google/genai';
import { LangfuseTraceClient } from 'langfuse';

// Re-export utilities for convenience
export { createPartFromUri, Type };
export type { Schema };

// Singleton Gemini client
const globalForGemini = global as unknown as {
  __geminiAI?: GoogleGenAI;
};

function getGeminiClient(): GoogleGenAI {
  if (!globalForGemini.__geminiAI) {
    globalForGemini.__geminiAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return globalForGemini.__geminiAI;
}

// Export the client for advanced use cases (file uploads, etc.)
export const geminiClient = getGeminiClient();

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface LangfuseWrappedGeminiParams<T = unknown> {
  // Model configuration
  model?: string;

  // Content - supports both simple prompt string and complex multimodal content
  prompt?: string;
  contents?: Content[] | Part[] | string[];

  // Structured output schema (Gemini native schema format)
  schema?: Schema;

  // Tools for function calling (Gemini native tool format)
  tools?: Tool[];

  // Langfuse tracing params (same pattern as langfuseWrappedOpenAI)
  langfuseParams?: {
    traceId?: string;
    traceName?: string;
    trace?: LangfuseTraceClient;
    generationName?: string;
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface LangfuseWrappedGeminiResult<T = unknown> {
  text?: string;
  parsed?: T | null;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  // Function calls if model chose to call tools
  functionCalls?: FunctionCall[];
}

/**
 * Unified Gemini wrapper with automatic Langfuse logging.
 * Mirrors the langfuseWrappedOpenAI pattern for consistency.
 *
 * @example Basic structured output:
 * ```ts
 * const result = await langfuseWrappedGemini({
 *   prompt: "What is the capital of France?",
 *   schema: {
 *     type: Type.OBJECT,
 *     properties: {
 *       answer: { type: Type.STRING },
 *       confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
 *     },
 *     required: ['answer', 'confidence']
 *   },
 *   langfuseParams: {
 *     traceId: 'trace-123',
 *     generationName: 'capital-lookup'
 *   }
 * });
 * ```
 *
 * @example Multimodal with inline audio:
 * ```ts
 * const result = await langfuseWrappedGemini({
 *   contents: [{
 *     role: 'user',
 *     parts: [
 *       { text: "Transcribe this audio" },
 *       { inlineData: { mimeType: 'audio/mp3', data: base64Audio } }
 *     ]
 *   }],
 *   schema: transcriptionSchema
 * });
 * ```
 */
export async function langfuseWrappedGemini<T = unknown>({
  model = DEFAULT_MODEL,
  prompt,
  contents,
  schema,
  tools,
  langfuseParams = {},
}: LangfuseWrappedGeminiParams<T>): Promise<LangfuseWrappedGeminiResult<T> | null> {
  const ai = getGeminiClient();
  const langfuse = getLangfuse();

  // Build the input content
  const inputContent = buildContent(prompt, contents);

  // Set up Langfuse tracing
  const trace = langfuseParams.trace
    ? langfuseParams.trace.update({
        sessionId: langfuseParams.sessionId,
        userId: langfuseParams.userId,
        metadata: {
          source: 'langfuse-wrapped-gemini',
          ...langfuseParams.metadata,
        },
      })
    : langfuse?.trace({
        id: langfuseParams.traceId,
        name: langfuseParams.traceName || 'gemini-generation',
        sessionId: langfuseParams.sessionId,
        userId: langfuseParams.userId,
        metadata: {
          source: 'langfuse-wrapped-gemini',
          ...langfuseParams.metadata,
        },
      });

  // Create generation span for this LLM call
  const generation = trace?.generation({
    name: langfuseParams.generationName || 'langfuse-wrapped-gemini',
    model,
    input: getLoggableInput(prompt, contents),
    metadata: {
      hasSchema: !!schema,
      hasTools: !!tools?.length,
      toolCount: tools?.length,
      contentType: prompt ? 'text' : 'multimodal',
      ...langfuseParams.metadata,
    },
  });

  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: inputContent,
      config: {
        // Schema for structured output
        ...(schema
          ? {
              responseMimeType: 'application/json',
              responseSchema: schema,
            }
          : {}),
        // Tools for function calling
        ...(tools ? { tools } : {}),
      },
    });

    const latencyMs = Date.now() - startTime;
    const text = response.text || undefined;
    const usageMetadata = response.usageMetadata;

    // Extract function calls if model chose to call tools
    const functionCalls = response.functionCalls;

    // Parse structured output if schema was provided
    let parsed: T | null = null;
    if (schema && text) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        console.warn('[langfuse-wrapped-gemini] Failed to parse JSON response:', text);
        parsed = null;
      }
    }

    // Sanitize function calls if present
    const sanitizedFunctionCalls = functionCalls?.map((fc: FunctionCall) => ({
      name: fc.name,
      args: fc.args,
      id: fc.id,
    }));

    // Build output for Langfuse - include function calls if present
    const langfuseOutput =
      sanitizedFunctionCalls && sanitizedFunctionCalls.length > 0
        ? {
            functionCalls: sanitizedFunctionCalls,
          }
        : (parsed ?? text);

    // Log to Langfuse
    generation?.end({
      output: langfuseOutput,
      usage: usageMetadata
        ? {
            input: usageMetadata.promptTokenCount,
            output: usageMetadata.candidatesTokenCount,
            total: usageMetadata.totalTokenCount,
          }
        : undefined,
      metadata: {
        latencyMs,
        hasFunctionCalls: !!(functionCalls && functionCalls.length > 0),
        functionCallCount: functionCalls?.length ?? 0,
      },
    });

    trace?.update({
      output: langfuseOutput,
      metadata: {
        hasFunctionCalls: !!(functionCalls && functionCalls.length > 0),
      },
    });

    return {
      text: text,
      parsed: parsed,
      usageMetadata,
      functionCalls: sanitizedFunctionCalls,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[langfuse-wrapped-gemini] Error:', {
      model,
      error: errorMessage,
      hasSchema: !!schema,
    });

    generation?.end({
      output: null,
      metadata: {
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      },
      level: 'ERROR',
    });

    trace?.update({
      metadata: { error: errorMessage },
    });

    return null;
  } finally {
    // Flush Langfuse events
    await langfuse?.flushAsync();
  }
}

/**
 * Build content array from prompt string or complex content
 */
function buildContent(
  prompt?: string,
  contents?: Content[] | Part[] | string[],
): Content[] | string[] {
  if (prompt) {
    return [prompt];
  }

  if (contents) {
    return contents as Content[] | string[];
  }

  throw new Error('[langfuse-wrapped-gemini] Either prompt or contents must be provided');
}

/**
 * Get a loggable representation of the input (avoiding logging large binary data)
 */
function getLoggableInput(
  prompt?: string,
  contents?: Content[] | Part[] | string[],
): unknown {
  if (prompt) {
    return prompt;
  }

  if (!contents) {
    return undefined;
  }

  // For complex content, create a summary that doesn't include binary data
  return contents.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    // Content with parts
    if ('parts' in item && Array.isArray(item.parts)) {
      return {
        role: item.role,
        parts: item.parts.map(summarizePart),
      };
    }

    // Single Part
    return summarizePart(item as Part);
  });
}

/**
 * Summarize a part for logging (avoiding binary data)
 */
function summarizePart(part: Part): unknown {
  if ('text' in part) {
    return { text: part.text };
  }
  if ('inlineData' in part && part.inlineData) {
    return {
      inlineData: {
        mimeType: part.inlineData.mimeType,
        dataSize: part.inlineData.data?.length || 0,
      },
    };
  }
  if ('fileData' in part && part.fileData) {
    return {
      fileData: {
        mimeType: part.fileData.mimeType,
        fileUri: part.fileData.fileUri,
      },
    };
  }
  return { unknownPartType: true };
}

// ============================================================================
// File Management Helpers
// ============================================================================

/**
 * Upload a file buffer to Gemini for processing
 * Use this for PDFs, images, and other files that need to be processed
 *
 * @example
 * ```ts
 * const file = await uploadFileToGemini(pdfBuffer, 'invoice.pdf', 'application/pdf');
 * const result = await langfuseWrappedGemini({
 *   contents: [
 *     "Extract invoice data",
 *     createPartFromUri(file.uri!, file.mimeType!)
 *   ],
 *   schema: invoiceSchema
 * });
 * await deleteGeminiFile(file.name!);
 * ```
 */
export async function uploadFileToGemini(
  buffer: Buffer,
  displayName: string,
  mimeType: string,
): Promise<{ name?: string; uri?: string; mimeType?: string; state?: string }> {
  const ai = getGeminiClient();

  // Convert Buffer to ArrayBuffer for Blob
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  const fileBlob = new Blob([arrayBuffer], { type: mimeType });

  const file = await ai.files.upload({
    file: fileBlob,
    config: { displayName },
  });

  // Wait for file to be processed
  let getFile = await ai.files.get({ name: file.name! });
  while (getFile.state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    getFile = await ai.files.get({ name: file.name! });
    console.log(`[langfuse-wrapped-gemini] File processing status: ${getFile.state}`);
  }

  if (getFile.state === 'FAILED') {
    throw new Error(`[langfuse-wrapped-gemini] File processing failed for ${displayName}`);
  }

  return getFile;
}

/**
 * Delete a file from Gemini after processing
 */
export async function deleteGeminiFile(fileName: string): Promise<void> {
  const ai = getGeminiClient();
  await ai.files.delete({ name: fileName });
}

// ============================================================================
// Retry Helper
// ============================================================================

/**
 * Retry a Gemini operation with exponential backoff
 * Useful for handling transient 503 errors
 *
 * @example
 * ```ts
 * const result = await withGeminiRetry(
 *   () => langfuseWrappedGemini({ prompt: "Hello" }),
 *   3, // maxRetries
 *   1000 // baseDelayMs
 * );
 * ```
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('503') ||
          error.message.includes('overloaded') ||
          error.message.includes('UNAVAILABLE'));

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(
        `[langfuse-wrapped-gemini] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
