import { NextResponse } from 'next/server';

// Helper to fetch all pages from a paginated Langfuse endpoint
async function fetchAllPages(
  baseUrl: string,
  endpoint: string,
  headers: Record<string, string>,
  maxPages = 10,
): Promise<any[]> {
  const allData: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const url = `${baseUrl}${endpoint}?limit=100&page=${page}`;
    const response = await fetch(url, { headers, cache: 'no-store' });

    if (!response.ok) {
      console.error(
        `[Langfuse Resources] Failed to fetch ${endpoint} page ${page}:`,
        response.status,
      );
      break;
    }

    const data = await response.json();
    const items = data.data || [];
    allData.push(...items);

    // Check if there are more pages
    const totalPages = data.meta?.totalPages || 1;
    hasMore = page < totalPages;
    page++;
  }

  return allData;
}

// API route to fetch Langfuse prompts and datasets
export async function GET() {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl =
    process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!secretKey || !publicKey) {
    console.error(
      '[Langfuse Resources] Missing credentials - secretKey:',
      !!secretKey,
      'publicKey:',
      !!publicKey,
    );
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
    // Fetch all prompts and datasets with pagination support
    const [prompts, datasets] = await Promise.all([
      fetchAllPages(baseUrl, '/api/public/v2/prompts', headers),
      fetchAllPages(baseUrl, '/api/public/v2/datasets', headers),
    ]);

    console.log(
      '[Langfuse Resources] Fetched prompts:',
      prompts.length,
      'datasets:',
      datasets.length,
    );

    return NextResponse.json({
      prompts,
      datasets,
    });
  } catch (error) {
    console.error('[Langfuse Resources] Error fetching resources:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Langfuse resources',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
