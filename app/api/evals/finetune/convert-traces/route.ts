import { generateTimestampPrefix } from '@/lib/utils/blob-storage';
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract the actual content from a Langfuse observation output.
 * Handles both OpenAI format ({role, content, ...}) and raw content.
 */
function extractOutputContent(output: any): string | null {
  if (!output) return null;

  // If output is a string, return it directly
  if (typeof output === 'string') {
    return output;
  }

  // If output is an object with a 'content' field (OpenAI format), extract it
  if (typeof output === 'object') {
    // OpenAI chat completion format: {role: "assistant", content: "..."}
    if ('content' in output && output.content !== null) {
      return typeof output.content === 'string'
        ? output.content
        : JSON.stringify(output.content);
    }

    // If it's already structured output (no role/content wrapper), stringify it
    if (!('role' in output)) {
      return JSON.stringify(output);
    }
  }

  // Fallback: stringify the whole thing
  return JSON.stringify(output);
}

/**
 * Convert Langfuse trace data to OpenAI fine-tuning format
 */
function convertTraceToTrainingExample(
  trace: any,
  method: 'supervised' | 'preference' | 'reinforcement',
): any | null {
  try {
    if (method === 'supervised') {
      // For supervised, we need messages array
      // Try to extract from trace input/output or observations
      let messages: any[] = [];

      // Check if trace has input/output in OpenAI format
      if (trace.input) {
        // Try to parse input as messages
        let inputMessages: any[] = [];
        if (Array.isArray(trace.input)) {
          inputMessages.push(...trace.input);
        } else if (typeof trace.input === 'object' && trace.input.messages) {
          inputMessages.push(...trace.input.messages);
        } else if (typeof trace.input === 'string') {
          // Single user message
          inputMessages.push({ role: 'user', content: trace.input });
        }

        // Filter out messages without valid content
        inputMessages = inputMessages.filter((msg) => {
          if (!msg || typeof msg !== 'object') return false;
          // Allow empty string content but not null/undefined
          return msg.content !== null && msg.content !== undefined;
        });

        messages.push(...inputMessages);
      }

      // Add assistant response
      if (trace.output) {
        const outputContent = extractOutputContent(trace.output);
        if (outputContent) {
          messages.push({ role: 'assistant', content: outputContent });
        }
      }

      // If we have observations, try to extract from there (preferred source)
      if (trace.observations && Array.isArray(trace.observations)) {
        for (const obs of trace.observations) {
          if (obs.type === 'GENERATION' || !obs.type) {
            // Extract input messages from observation
            if (obs.input) {
              // Clear messages first if we're using observation data
              let obsMessages: any[] = [];

              if (Array.isArray(obs.input)) {
                // Input is already an array of messages
                obsMessages.push(...obs.input);
              } else if (typeof obs.input === 'object' && obs.input.messages) {
                // Input has messages property
                obsMessages.push(...obs.input.messages);
              } else if (typeof obs.input === 'string') {
                // Single string input - treat as user message
                obsMessages.push({ role: 'user', content: obs.input });
              }

              // Filter out messages without valid content before using them
              obsMessages = obsMessages.filter((msg) => {
                if (!msg || typeof msg !== 'object') return false;
                // Allow empty string content but not null/undefined
                return msg.content !== null && msg.content !== undefined;
              });

              // Replace messages with observation data
              messages = obsMessages;
            }

            // Extract output from observation
            if (obs.output) {
              const outputContent = extractOutputContent(obs.output);
              if (outputContent) {
                messages.push({ role: 'assistant', content: outputContent });
              }
            }

            // Break after first observation to avoid duplicates
            break;
          }
        }
      }

      if (messages.length === 0) {
        // Log why no messages were found
        const hasTraceInput = !!trace.input;
        const hasTraceOutput = !!trace.output;
        const hasObsInput = !!trace.observations?.[0]?.input;
        const hasObsOutput = !!trace.observations?.[0]?.output;
        console.log(
          `[ConvertTraces] ❌ No messages extracted from trace ${trace.id || 'unknown'}:`,
          `traceInput=${hasTraceInput}, traceOutput=${hasTraceOutput}, obsInput=${hasObsInput}, obsOutput=${hasObsOutput}`,
        );
        return null;
      }

      // Validate messages before creating example
      const validMessages = messages.filter((msg) => {
        if (!msg || typeof msg !== 'object') {
          console.log(
            `[ConvertTraces] ❌ Invalid message in trace ${trace.id || 'unknown'}: not an object`,
          );
          return false;
        }
        if (!msg.role || typeof msg.role !== 'string') {
          console.log(
            `[ConvertTraces] ❌ Invalid message in trace ${trace.id || 'unknown'}: missing or invalid role`,
            JSON.stringify(msg).substring(0, 200),
          );
          return false;
        }
        if (msg.content === undefined || msg.content === null) {
          console.log(
            `[ConvertTraces] ❌ Invalid message in trace ${trace.id || 'unknown'}: missing content`,
            JSON.stringify(msg).substring(0, 200),
          );
          return false;
        }
        return true;
      });

      if (validMessages.length === 0) {
        console.log(
          `[ConvertTraces] ❌ No valid messages after filtering in trace ${trace.id || 'unknown'}`,
        );
        return null;
      }

      // Use only valid messages
      const example: any = { messages: validMessages };

      // Add tools if available
      if (trace.metadata?.tools || trace.observations?.[0]?.metadata?.tools) {
        const tools =
          trace.metadata?.tools || trace.observations?.[0]?.metadata?.tools;
        if (Array.isArray(tools) && tools.length > 0) {
          example.tools = tools;
        }
      }

      // Add parallel_tool_calls if relevant
      if (trace.metadata?.parallel_tool_calls !== undefined) {
        example.parallel_tool_calls = trace.metadata.parallel_tool_calls;
      }

      return example;
    } else if (method === 'preference') {
      // For preference, we need input, preferred_output, non_preferred_output
      // This is harder to extract from traces - would need two traces to compare
      // For now, return null - users would need to manually create preference pairs
      return null;
    } else if (method === 'reinforcement') {
      // For reinforcement, we need messages and reference_answer
      const messages: any[] = [];

      if (trace.input) {
        if (Array.isArray(trace.input)) {
          messages.push(...trace.input);
        } else if (typeof trace.input === 'object' && trace.input.messages) {
          messages.push(...trace.input.messages);
        } else if (typeof trace.input === 'string') {
          messages.push({ role: 'user', content: trace.input });
        }
      }

      if (messages.length === 0) {
        return null;
      }

      const example: any = { messages };

      // Add reference_answer if available in metadata
      if (trace.metadata?.reference_answer) {
        example.reference_answer = trace.metadata.reference_answer;
      }

      // Add tools if available
      if (trace.metadata?.tools) {
        example.tools = trace.metadata.tools;
      }

      return example;
    }

    return null;
  } catch (error) {
    console.error('Error converting trace:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promptName, version, method, limit = 100, offset = 0 } = body;

    if (!promptName || typeof promptName !== 'string') {
      return NextResponse.json(
        { error: 'promptName is required' },
        { status: 400 },
      );
    }

    if (
      !method ||
      !['supervised', 'preference', 'reinforcement'].includes(method)
    ) {
      return NextResponse.json(
        {
          error: 'method must be one of: supervised, preference, reinforcement',
        },
        { status: 400 },
      );
    }

    // Fetch traces from Langfuse using the prompt-stats endpoint
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const baseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

    if (!secretKey || !publicKey) {
      return NextResponse.json(
        { error: 'Langfuse credentials not configured' },
        { status: 500 },
      );
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    // Fetch observations (generations) for this prompt
    const filters: any[] = [
      { type: 'string', column: 'type', operator: '=', value: 'GENERATION' },
      {
        type: 'string',
        column: 'promptName',
        operator: '=',
        value: promptName,
      },
    ];

    if (version) {
      filters.push({
        type: 'number',
        column: 'promptVersion',
        operator: '=',
        value: parseInt(version, 10),
      });
    }

    const observationsUrl = new URL(`${baseUrl}/api/public/observations`);
    observationsUrl.searchParams.set('limit', limit.toString());
    observationsUrl.searchParams.set(
      'page',
      (Math.floor(offset / limit) + 1).toString(),
    );
    observationsUrl.searchParams.set('filter', JSON.stringify(filters));

    const response = await fetch(observationsUrl.toString(), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch traces: ${response.status} ${errorText}`,
        },
        { status: 500 },
      );
    }

    const data = await response.json();
    const observations = data.data || [];

    // Convert observations directly - they already contain input/output
    // We don't need to fetch full traces since observations have what we need
    const traces: any[] = observations.map((obs: any) => ({
      id: obs.traceId,
      input: obs.input,
      output: obs.output,
      metadata: obs.metadata || {},
      observations: [obs], // Keep observation for reference
    }));

    // Convert traces to training examples
    const trainingExamples: any[] = [];
    const invalidTraces: Array<{
      index: number;
      traceId: string;
      reason: string;
    }> = [];

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      const example = convertTraceToTrainingExample(trace, method);

      if (!example) {
        // Log why this trace failed
        let reason = 'convertTraceToTrainingExample returned null';
        if (method === 'supervised') {
          // Check what's missing
          const hasInput = !!(trace.input || trace.observations?.[0]?.input);
          const hasOutput = !!(trace.output || trace.observations?.[0]?.output);
          if (!hasInput && !hasOutput) {
            reason = 'no input or output found';
          } else if (!hasInput) {
            reason = 'no input found';
          } else if (!hasOutput) {
            reason = 'no output found';
          } else {
            reason = 'failed to extract messages';
          }
        }
        invalidTraces.push({
          index: i + 1,
          traceId: trace.id || trace.traceId || 'unknown',
          reason,
        });
        continue;
      }

      // Validate the example structure
      if (method === 'supervised') {
        if (!example.messages || !Array.isArray(example.messages)) {
          invalidTraces.push({
            index: i + 1,
            traceId: trace.id || trace.traceId || 'unknown',
            reason: 'missing messages array',
          });
          continue;
        }

        // Check each message
        for (let j = 0; j < example.messages.length; j++) {
          const msg = example.messages[j];
          if (!msg || typeof msg !== 'object') {
            invalidTraces.push({
              index: i + 1,
              traceId: trace.id || trace.traceId || 'unknown',
              reason: `message ${j} is not an object`,
            });
            break;
          }
          if (!msg.role || typeof msg.role !== 'string') {
            invalidTraces.push({
              index: i + 1,
              traceId: trace.id || trace.traceId || 'unknown',
              reason: `message ${j} missing or invalid role`,
            });
            break;
          }
          if (msg.content === undefined || msg.content === null) {
            invalidTraces.push({
              index: i + 1,
              traceId: trace.id || trace.traceId || 'unknown',
              reason: `message ${j} missing content`,
            });
            break;
          }
        }

        // If we got here but example is still invalid, it means messages array is empty
        if (example.messages.length === 0) {
          invalidTraces.push({
            index: i + 1,
            traceId: trace.id || trace.traceId || 'unknown',
            reason: 'messages array is empty',
          });
          continue;
        }
      }

      trainingExamples.push(example);
    }

    // Log invalid traces for debugging - use console.log to ensure visibility
    if (invalidTraces.length > 0) {
      console.log(
        `[ConvertTraces] ⚠️  ${invalidTraces.length} invalid traces out of ${traces.length} total:`,
      );
      invalidTraces.slice(0, 20).forEach(({ index, traceId, reason }) => {
        console.log(
          `  ❌ Example ${index} (traceId: ${traceId.substring(0, 8)}...): ${reason}`,
        );
      });
      if (invalidTraces.length > 20) {
        console.log(`  ... and ${invalidTraces.length - 20} more`);
      }
    } else {
      console.log(
        `[ConvertTraces] ✅ All ${traces.length} traces converted successfully`,
      );
    }

    // Convert to JSONL format (pretty-printed for UI display)
    const jsonl = trainingExamples
      .map((ex) => JSON.stringify(ex, null, 2))
      .join('\n\n---\n\n');

    // Convert to compact JSONL format for blob storage (one JSON per line)
    const compactJsonl = trainingExamples
      .map((ex) => JSON.stringify(ex))
      .join('\n');

    // Save to blob storage
    const timestamp = generateTimestampPrefix();
    const filename = `finetune-convert-traces-${timestamp}.jsonl`;
    const blob = await put(filename, compactJsonl, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType: 'application/x-ndjson',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      success: true,
      examples: trainingExamples,
      jsonl,
      blobUrl: blob.url, // Return blob URL for direct access
      count: trainingExamples.length,
      totalObservations: observations.length,
      invalidTraces: invalidTraces.length > 0 ? invalidTraces : undefined,
      invalidCount: invalidTraces.length,
    });
  } catch (error) {
    console.error('Error converting traces:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to convert traces',
      },
      { status: 500 },
    );
  }
}
