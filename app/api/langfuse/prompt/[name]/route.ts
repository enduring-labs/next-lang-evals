import { NextRequest, NextResponse } from 'next/server';

// API route to fetch a single Langfuse prompt with full content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
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
    // Fetch the specific prompt by name
    const response = await fetch(
      `${baseUrl}/api/public/v2/prompts/${encodeURIComponent(name)}`,
      { headers, cache: 'no-store' },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Langfuse Prompt] Failed to fetch prompt "${name}":`,
        response.status,
        errorText,
      );
      return NextResponse.json(
        { error: `Failed to fetch prompt: ${response.status}` },
        { status: response.status },
      );
    }

    const promptData = await response.json();
    return NextResponse.json(promptData);
  } catch (error) {
    console.error('[Langfuse Prompt] Error fetching prompt:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch prompt',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
