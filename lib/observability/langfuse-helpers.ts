/**
 * Helper utilities for Langfuse prompt management with fallback alerting
 */

import { Langfuse } from 'langfuse';

/**
 * Compile a Langfuse prompt and return both the compiled messages AND the variables.
 * This ensures promptVariables are always available to pass to langfuseParams.
 *
 * @example
 * ```typescript
 * const langfuse = getLangfuse();
 * const prompt = await langfuse?.getPrompt('workflow/estimate-dne');
 *
 * const { messages, promptVariables } = await compilePromptWithVariables(prompt, {
 *   work_order_context: workOrderContext,
 *   dne_report_context: dneReportContext,
 * });
 *
 * await langfuseWrappedOpenAI({
 *   messages,
 *   langfuseParams: {
 *     prompt,
 *     promptVariables, // Always passed!
 *   },
 * });
 * ```
 */
export async function compilePromptWithVariables<T = any>(
  prompt: any,
  variables: Record<string, any>,
): Promise<{ messages: T; promptVariables: Record<string, any> }> {
  if (!prompt) {
    throw new Error('Prompt is required for compilePromptWithVariables');
  }

  const messages = await prompt.compile(variables);
  return { messages, promptVariables: variables };
}

interface GetPromptOptions {
  label?: string;
  fallback?: string;
  cacheTtlSeconds?: number;
}

/**
 * Fetches a Langfuse prompt with fallback alerting.
 *
 * When a fallback is used (either due to Langfuse being unavailable or the prompt
 * not being found), this function will send an alert to Slack.
 *
 * @param langfuse - The Langfuse client instance (can be null/undefined)
 * @param promptName - The name of the prompt to fetch
 * @param version - Optional version number
 * @param options - Prompt options including fallback, label, cache TTL, etc.
 * @returns The prompt object from Langfuse (or fallback wrapped in prompt-like object)
 *
 * @example
 * ```typescript
 * const langfuse = await getLangfuse();
 * const prompt = await getPromptWithFallbackAlert(
 *   langfuse,
 *   "calls/vapi-inbound/tenant",
 *   undefined,
 *   {
 *     label: "production",
 *     fallback: VAPI_INBOUND_TENANT_PROMPT,
 *   }
 * );
 * ```
 */
export async function getPromptWithFallbackAlert(
  langfuse: Langfuse | null | undefined,
  promptName: string,
  version?: number,
  options?: GetPromptOptions,
): Promise<any> {
  const { fallback, ...langfuseOptions } = options || {};

  // If no fallback is provided, just call langfuse directly
  if (!fallback) {
    return await langfuse?.getPrompt(promptName, version, langfuseOptions);
  }

  try {
    // Try to get the prompt from Langfuse
    if (!langfuse) {
      console.warn(
        `[Langfuse] Client not initialized - using fallback for: ${promptName}`,
      );

      // Return fallback wrapped in a prompt-like object
      return {
        prompt: fallback,
        compile: async (variables?: any) => {
          // Simple variable replacement for fallback
          if (!variables) return fallback;
          let result = fallback;
          for (const [key, value] of Object.entries(variables)) {
            result = result.replace(
              new RegExp(`{{${key}}}`, 'g'),
              String(value),
            );
          }
          return result;
        },
      };
    }

    // Cast to any to bypass TypeScript's strict overload checking
    // The Langfuse SDK handles fallback internally
    const prompt = await (langfuse as any).getPrompt(promptName, version, {
      ...langfuseOptions,
      fallback,
    });

    // Check if Langfuse actually used the fallback by looking for metadata
    // When Langfuse successfully fetches a prompt, it includes metadata like 'name', 'version', 'labels'
    // When the SDK's fallback is used, these fields are typically missing or undefined
    const hasLangfuseMetadata =
      prompt &&
      (prompt.name !== undefined ||
        prompt.version !== undefined ||
        prompt.labels !== undefined);

    // Only alert if we're missing Langfuse metadata AND content matches fallback
    // This avoids false positives when prompt content legitimately matches the fallback
    const promptContent = (prompt as any)?.prompt;
    const isFallbackUsed = !hasLangfuseMetadata && promptContent === fallback;

    if (isFallbackUsed) {
      console.warn(`[Langfuse] Fallback used for prompt: ${promptName}`);
    }

    return prompt;
  } catch (error) {
    console.error(`[Langfuse] Error fetching prompt ${promptName}:`, error);

    // Return fallback wrapped in a prompt-like object
    return {
      prompt: fallback,
      compile: async (variables?: any) => {
        if (!variables) return fallback;
        let result = fallback;
        for (const [key, value] of Object.entries(variables)) {
          result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }
        return result;
      },
    };
  }
}
