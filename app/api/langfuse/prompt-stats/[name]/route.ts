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

// Build stats response from generations array
function buildStatsResponse(
  generations: any[],
  promptName: string,
  version: string | null,
) {
  const totalGenerations = generations.length;
  const uniqueTraces = new Set(generations.map((g: any) => g.traceId)).size;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    totalGenerations,
    uniqueTraces,
    last24h: generations.filter((g: any) => new Date(g.startTime) > oneDayAgo)
      .length,
    last7d: generations.filter((g: any) => new Date(g.startTime) > sevenDaysAgo)
      .length,
    last30d: generations.filter(
      (g: any) => new Date(g.startTime) > thirtyDaysAgo,
    ).length,
    recentGenerations: generations.slice(0, 10).map((g: any) => ({
      id: g.id,
      traceId: g.traceId,
      input: g.input,
      output: g.output,
      startTime: g.startTime,
      model: g.model,
      promptName: g.promptName,
      promptVersion: g.promptVersion,
      totalTokens: g.usage?.totalTokens || g.totalTokens,
      metadata: g.metadata,
      // Check if promptVariables exist in metadata for eval compatibility
      hasPromptVariables: !!(
        g.metadata?.promptVariables &&
        Object.keys(g.metadata.promptVariables).length > 0
      ),
    })),
    // Summary of eval readiness - at least one generation should have promptVariables
    evalReady: generations
      .slice(0, 10)
      .some(
        (g: any) =>
          g.metadata?.promptVariables &&
          Object.keys(g.metadata.promptVariables).length > 0,
      ),
    traceIds: [...new Set(generations.map((g: any) => g.traceId))],
    // Observation IDs paired with trace IDs for direct lookup during evals
    // This avoids having to match observations by name later
    traceObservationPairs: generations.map((g: any) => ({
      traceId: g.traceId,
      observationId: g.id,
      // Extract just the content from OpenAI format, not the full message wrapper
      output: extractOutputContent(g.output),
    })),
    _debug: {
      requestedPrompt: promptName,
      requestedVersion: version,
      totalCount: totalGenerations,
    },
  };
}

// Fetch usage stats for a specific prompt from Langfuse
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name: promptName } = await params;
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version');

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

  try {
    // Build filter array for the observations API
    const filters: any[] = [
      { type: 'string', column: 'type', operator: '=', value: 'GENERATION' },
      {
        type: 'string',
        column: 'promptName',
        operator: '=',
        value: promptName,
      },
    ];

    // Add version filter if provided
    if (version) {
      filters.push({
        type: 'number',
        column: 'promptVersion',
        operator: '=',
        value: parseInt(version, 10),
      });
    }

    const observationsUrl = new URL(`${baseUrl}/api/public/observations`);
    observationsUrl.searchParams.set('limit', '100');
    observationsUrl.searchParams.set('filter', JSON.stringify(filters));

    console.log(
      '[Langfuse Stats] Fetching with filter:',
      JSON.stringify(filters),
    );

    const response = await fetch(observationsUrl.toString(), {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Langfuse Stats] API failed:', response.status, errorText);
      return NextResponse.json(buildStatsResponse([], promptName, version));
    }

    const data = await response.json();
    let generations = data.data || [];

    console.log(
      '[Langfuse Stats] Got',
      generations.length,
      'generations for',
      promptName,
      'v' + version,
    );

    // Sort by startTime descending (most recent first)
    generations.sort(
      (a: any, b: any) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

    const stats = buildStatsResponse(generations, promptName, version);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Langfuse Stats] Error:', error);
    return NextResponse.json(buildStatsResponse([], promptName, version));
  }
}
