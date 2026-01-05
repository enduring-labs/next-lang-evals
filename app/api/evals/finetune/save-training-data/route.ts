import { generateTimestampPrefix } from '@/lib/utils/blob-storage';
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

// Increase max duration for large file uploads
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Use text() instead of json() to handle large payloads (>10MB)
    // Next.js has a 10MB limit for request.json() but text() can handle larger payloads
    const bodyText = await request.text();
    let body: {
      data?: string;
      method?: string;
      exampleCount?: number;
      trainSplitRatio?: number;
    };

    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: `Failed to parse request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        },
        { status: 400 },
      );
    }

    const { data, method, exampleCount, trainSplitRatio = 0.8 } = body;

    if (!data || typeof data !== 'string') {
      return NextResponse.json(
        { error: 'Training data is required' },
        { status: 400 },
      );
    }

    // Handle both compact JSONL (single line per JSON) and pretty-printed format (with --- separators)
    let blocks: string[] = [];

    // First check if it's compact JSONL (one JSON per line, no --- separators)
    if (!data.includes('\n\n---\n\n')) {
      // Compact JSONL format - split by single newlines
      blocks = data
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('---'));
    } else {
      // Pretty-printed format with separators
      blocks = data
        .trim()
        .split(/\n\n---\n\n/)
        .map((block) => block.trim())
        .filter((block) => block && !block.startsWith('---'));
    }

    if (blocks.length === 0) {
      return NextResponse.json(
        { error: 'No training examples found' },
        { status: 400 },
      );
    }

    // Validate each block is valid JSON and convert to compact format for storage
    const compactLines: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      try {
        // Try parsing as-is first (JSON.parse handles multi-line JSON)
        let parsed;
        try {
          parsed = JSON.parse(block);
        } catch (parseError) {
          // Log the error for debugging
          console.error(
            `[SaveTrainingData] Failed to parse block ${i + 1} directly:`,
            parseError instanceof Error ? parseError.message : parseError,
          );
          console.error(
            `[SaveTrainingData] Block ${i + 1} preview (first 200 chars):`,
            block.substring(0, 200),
          );
          // If that fails, try to extract JSON by finding the first { or [ and matching braces
          // This handles cases where there might be trailing content
          let jsonStart = -1;
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;

          for (let j = 0; j < block.length; j++) {
            const char = block[j];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{' || char === '[') {
                if (jsonStart === -1) {
                  jsonStart = j;
                }
                braceCount++;
              } else if (char === '}' || char === ']') {
                braceCount--;
                if (braceCount === 0 && jsonStart !== -1) {
                  // Found complete JSON object
                  const jsonStr = block.substring(jsonStart, j + 1);
                  parsed = JSON.parse(jsonStr);
                  break;
                }
              }
            }
          }

          // If we didn't find a complete JSON object, try compacting
          if (!parsed) {
            const compacted = block
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line) // Remove empty lines
              .join(' ');
            try {
              parsed = JSON.parse(compacted);
            } catch (compactError) {
              console.error(
                `[SaveTrainingData] Failed to parse compacted block ${i + 1}:`,
                compactError instanceof Error
                  ? compactError.message
                  : compactError,
              );
              throw new Error(
                `Failed to parse JSON block ${i + 1} after all attempts. Block length: ${block.length} chars. Error: ${compactError instanceof Error ? compactError.message : 'Unknown error'}`,
              );
            }
          }
        }

        if (!parsed) {
          throw new Error(
            `Could not extract valid JSON from block ${i + 1}. Block length: ${block.length} chars.`,
          );
        }

        // Store as compact single-line JSON for OpenAI fine-tuning
        compactLines.push(JSON.stringify(parsed));
      } catch (e) {
        console.error(
          `[SaveTrainingData] Error processing block ${i + 1}:`,
          e instanceof Error ? e.message : e,
        );
        return NextResponse.json(
          {
            error: `Invalid JSON on example ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`,
          },
          { status: 400 },
        );
      }
    }

    // Store in blob storage as JSONL (compact format, one JSON per line)
    const timestamp = generateTimestampPrefix();

    // Shuffle the examples for random train/validation split
    const shuffledLines = [...compactLines].sort(() => Math.random() - 0.5);

    // Split into training and validation sets
    const splitIndex = Math.round(shuffledLines.length * trainSplitRatio);
    const trainingLines = shuffledLines.slice(0, splitIndex);
    const validationLines = shuffledLines.slice(splitIndex);

    console.log(
      `[SaveTrainingData] Splitting ${shuffledLines.length} examples: ${trainingLines.length} training, ${validationLines.length} validation (ratio: ${trainSplitRatio})`,
    );

    // Save training file
    const trainingFilename = `finetune-training-${method}-${timestamp}.jsonl`;
    const trainingJsonl = trainingLines.join('\n');
    const trainingBlob = await put(trainingFilename, trainingJsonl, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType: 'application/x-ndjson',
      addRandomSuffix: true,
    });

    // Save validation file
    const validationFilename = `finetune-validation-${method}-${timestamp}.jsonl`;
    const validationJsonl = validationLines.join('\n');
    const validationBlob = await put(validationFilename, validationJsonl, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType: 'application/x-ndjson',
      addRandomSuffix: true,
    });

    // Also save a combined file for backwards compatibility
    const combinedFilename = `finetune-combined-${method}-${timestamp}.jsonl`;
    const combinedJsonl = compactLines.join('\n');
    const combinedBlob = await put(combinedFilename, combinedJsonl, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType: 'application/x-ndjson',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      success: true,
      blobUrl: combinedBlob.url, // Backwards compatible combined URL
      trainingBlobUrl: trainingBlob.url,
      validationBlobUrl: validationBlob.url,
      trainingCount: trainingLines.length,
      validationCount: validationLines.length,
      exampleCount: exampleCount || compactLines.length,
      method,
      trainSplitRatio,
    });
  } catch (error) {
    console.error('Error saving training data:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save training data',
      },
      { status: 500 },
    );
  }
}
