import { Inngest } from 'inngest';

/*
All Inngest functions need to be registered here and also exported in inngest/functions/index.ts and api/inngest/route
*/

// Define event types for type safety
export type Events = {
  /**
   * eval/run-traces.requested
   * Run a draft prompt against historical traces for evaluation
   * - draftPrompt: string (prompt template with {{variable}} placeholders)
   * - traceIds: string[] (Langfuse trace IDs to run against)
   * - model: string (model name e.g. 'gpt-5', 'gpt-4o', 'gemini-2.5-flash')
   * - provider: 'openai' | 'gemini'
   * - evalName: string (name for this eval run)
   * - originalPromptName: string (original prompt name for reference)
   * - originalPromptVersion: number (original prompt version for reference)
   * - concurrency?: number (max concurrent runs, default 10)
   * - langfuseTraceId?: string (pre-generated trace ID for deeplink)
   * - reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' (OpenAI GPT-5)
   * - verbosity?: 'low' | 'medium' | 'high' (OpenAI GPT-5)
   * - schemaKey?: string (key from schema-registry.ts for structured output)
   */
  'eval/run-traces.requested': {
    data: {
      draftPrompt: string;
      traceIds: string[];
      model: string;
      provider: 'openai' | 'gemini';
      evalName: string;
      originalPromptName: string;
      originalPromptVersion: number;
      concurrency?: number;
      langfuseTraceId?: string;
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      verbosity?: 'low' | 'medium' | 'high';
      schemaKey?: string;
    };
  };
};

// Create and export the Inngest client
export const inngest = new Inngest({
  id: 'evals-app',
});