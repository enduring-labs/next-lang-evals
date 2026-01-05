import { inngest } from '@/lib/inngest/client';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

// Langfuse project ID for deeplinks
const LANGFUSE_PROJECT_ID = 'cme8s6dl501fbad07hhojh4r6';
const LANGFUSE_BASE_URL =
  process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

// Inngest app ID for deeplinks
const INNGEST_APP_ID = 'evals-app';

// GET /api/evals?langfuseTraceId=xxx - Fetch eval results by Langfuse trace ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const langfuseTraceId = searchParams.get('langfuseTraceId');

    if (!langfuseTraceId) {
      return NextResponse.json(
        { error: 'langfuseTraceId query parameter is required' },
        { status: 400 },
      );
    }

    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

    if (!secretKey || !publicKey) {
      return NextResponse.json(
        { error: 'Langfuse credentials not configured' },
        { status: 500 },
      );
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // Fetch trace from Langfuse
    const traceResponse = await fetch(
      `${LANGFUSE_BASE_URL}/api/public/traces/${langfuseTraceId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!traceResponse.ok) {
      if (traceResponse.status === 404) {
        return NextResponse.json(
          { error: 'Trace not found', completed: false },
          { status: 404 },
        );
      }
      return NextResponse.json(
        {
          error: 'Failed to fetch trace',
          details: `Langfuse API returned ${traceResponse.status}`,
        },
        { status: 500 },
      );
    }

    const trace = await traceResponse.json();

    // Extract eval results from trace metadata
    const metadata = trace.metadata || {};
    const resultsUrl = metadata.resultsUrl;
    const completed = metadata.completed === true;

    // If not completed yet, return status
    if (!completed) {
      return NextResponse.json({
        completed: false,
        langfuseTraceId,
        message: 'Eval run is still in progress',
        trace: {
          id: trace.id,
          name: trace.name,
          metadata: {
            evalId: metadata.evalId,
            evalName: metadata.evalName,
            traceCount: metadata.traceCount,
            model: metadata.model,
            provider: metadata.provider,
          },
        },
      });
    }

    // If completed, return results URL and summary
    return NextResponse.json({
      completed: true,
      langfuseTraceId,
      resultsUrl,
      trace: {
        id: trace.id,
        name: trace.name,
        output: trace.output,
        metadata: {
          evalId: metadata.evalId,
          evalName: metadata.evalName,
          originalPromptName: metadata.originalPromptName,
          originalPromptVersion: metadata.originalPromptVersion,
          traceCount: metadata.traceCount,
          successCount: trace.output?.successCount,
          failureCount: trace.output?.failureCount,
          durationMs: trace.output?.durationMs,
          model: metadata.model,
          provider: metadata.provider,
          schemaKey: metadata.schemaKey,
          toolGroupKey: metadata.toolGroupKey,
          toolCount: metadata.toolCount,
          resultsUrl: metadata.resultsUrl,
        },
      },
    });
  } catch (error) {
    console.error('[EvalAPI] Error fetching eval results:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch eval results',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/evals - Trigger an eval run against historical traces
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      draftPrompt,
      traceIds,
      traceObservationPairs,
      model = 'gemini-2.5-flash',
      provider = 'gemini',
      evalName,
      originalPromptName,
      originalPromptVersion,
      concurrency = 10,
      // OpenAI reasoning parameters
      reasoningEffort,
      verbosity,
      // Schema key for structured output
      schemaKey,
    } = body;

    // Validate required fields
    if (!draftPrompt || typeof draftPrompt !== 'string') {
      return NextResponse.json(
        { error: 'draftPrompt is required and must be a string' },
        { status: 400 },
      );
    }

    if (!traceIds || !Array.isArray(traceIds) || traceIds.length === 0) {
      return NextResponse.json(
        { error: 'traceIds is required and must be a non-empty array' },
        { status: 400 },
      );
    }

    if (!evalName || typeof evalName !== 'string') {
      return NextResponse.json(
        { error: 'evalName is required and must be a string' },
        { status: 400 },
      );
    }

    if (!originalPromptName || typeof originalPromptName !== 'string') {
      return NextResponse.json(
        { error: 'originalPromptName is required and must be a string' },
        { status: 400 },
      );
    }

    if (typeof originalPromptVersion !== 'number') {
      return NextResponse.json(
        { error: 'originalPromptVersion is required and must be a number' },
        { status: 400 },
      );
    }

    // Validate provider
    if (provider !== 'openai' && provider !== 'gemini') {
      return NextResponse.json(
        { error: 'provider must be "openai" or "gemini"' },
        { status: 400 },
      );
    }

    // Note: schemaKey is now ignored as schemas are extracted from observation metadata
    // We keep it in the API for backward compatibility but don't validate it

    // Pre-generate the Langfuse trace ID for deeplink
    const langfuseTraceId = uuidv4();

    // Send the event to inngest
    const { ids } = await inngest.send({
      name: 'eval/run-traces.requested',
      data: {
        draftPrompt,
        traceIds,
        // Pass observation pairs for direct output lookup (avoids name matching)
        ...(traceObservationPairs ? { traceObservationPairs } : {}),
        model,
        provider,
        evalName,
        originalPromptName,
        originalPromptVersion,
        concurrency,
        langfuseTraceId,
        // OpenAI reasoning parameters
        ...(reasoningEffort ? { reasoningEffort } : {}),
        ...(verbosity ? { verbosity } : {}),
        // Schema for structured output
        ...(schemaKey ? { schemaKey } : {}),
      },
    });

    // Build Inngest search URL (works for both local and prod)
    // Detect if we're in local dev mode
    const isLocalDev =
      process.env.NODE_ENV === 'development' ||
      process.env.INNGEST_DEV_MODE === 'true';

    const inngestBaseUrl = isLocalDev
      ? 'http://localhost:8288'
      : 'https://app.inngest.com/env/production';

    // Build search query using evalName
    const searchQuery = `event.data.evalName == "${evalName}"`;
    const encodedSearch = encodeURIComponent(searchQuery);
    const inngestUrl = `${inngestBaseUrl}/runs?search=${encodedSearch}`;

    const langfuseUrl = `${LANGFUSE_BASE_URL}/project/${LANGFUSE_PROJECT_ID}/traces/${langfuseTraceId}`;

    return NextResponse.json({
      success: true,
      message: `Eval run started with ${traceIds.length} traces`,
      eventIds: ids,
      evalName,
      traceCount: traceIds.length,
      // Deeplinks for monitoring
      langfuseTraceId,
      inngestEventId: ids[0], // First event ID for reference
      links: {
        inngest: inngestUrl, // Search URL (works for local:8288 and prod)
        langfuse: langfuseUrl,
      },
      // Poll this endpoint to get results when complete:
      // GET /api/evals?langfuseTraceId=${langfuseTraceId}
      resultsEndpoint: `/api/evals?langfuseTraceId=${langfuseTraceId}`,
    });
  } catch (error) {
    console.error('[EvalAPI] Error starting eval run:', error);
    return NextResponse.json(
      {
        error: 'Failed to start eval run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
