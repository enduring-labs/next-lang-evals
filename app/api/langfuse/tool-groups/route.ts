import { NextResponse } from 'next/server';

/**
 * GET /api/langfuse/tool-groups
 *
 * Information about tool extraction from observation metadata
 * Query params:
 * - promptName: (optional) Check if a specific prompt uses tools
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const promptName = searchParams.get('promptName');

  // Tools are now extracted from observation metadata at runtime
  if (promptName) {
    return NextResponse.json({
      promptName,
      message: 'Tools are extracted from observation metadata',
      info: 'When logging generations to Langfuse, include tools in the observation metadata under the "tools" key.',
      hasTools: null, // Cannot determine without checking actual observation metadata
      toolGroup: null,
    });
  }

  // Return information about the new approach
  return NextResponse.json({
    message: 'Tools are now extracted from observation metadata',
    info: {
      description: 'This eval system now reads tool definitions directly from Langfuse observation metadata, making it fully generic.',
      expectedMetadataStructure: {
        tools: [
          {
            type: 'function',
            function: {
              name: 'toolName',
              description: 'Tool description',
              parameters: {
                type: 'object',
                properties: {
                  // ... tool parameter schema
                },
              },
            },
          },
        ],
      },
    },
    toolGroups: [],
    promptMappings: {},
  });
}
