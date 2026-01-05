import { NextRequest, NextResponse } from 'next/server';

// GET /api/evals/schemas - Information about schema extraction
// Schemas are now extracted from observation metadata at runtime
export async function GET(request: NextRequest) {
  const promptName = request.nextUrl.searchParams.get('promptName');

  return NextResponse.json({
    message: 'Schemas are now extracted from observation metadata',
    info: {
      description: 'This eval system now reads schemas directly from Langfuse observation metadata, making it fully generic and decoupled from specific schema imports.',
      expectedMetadataStructure: {
        schema: {
          type: 'object',
          properties: {
            // ... your schema definition
          },
          required: ['field1', 'field2']
        }
      },
      alternativeFormat: {
        responseFormat: {
          json_schema: {
            schema: {
              // ... OpenAI structured output format
            }
          }
        }
      },
      toolsStructure: {
        tools: [
          {
            type: 'function',
            function: {
              name: 'toolName',
              description: 'Tool description',
              parameters: {
                // ... tool parameters
              }
            }
          }
        ]
      },
      usage: 'When logging generations to Langfuse, include the schema and/or tools in the observation metadata. The eval system will automatically extract and use them.',
    },
    ...(promptName ? { 
      promptName, 
      note: 'Schema will be extracted from observation metadata for this prompt'
    } : {}),
  });
}
