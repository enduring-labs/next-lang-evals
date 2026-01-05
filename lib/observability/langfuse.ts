import { Langfuse } from 'langfuse';

type Nullable<T> = T | null;

// Re-use a singleton across hot reloads/warm starts
const globalForLangfuse = global as unknown as {
  __langfuse?: Nullable<Langfuse>;
};

function createLangfuse(): Nullable<Langfuse> {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL;

  if (!secretKey || !publicKey) {
    return null;
  }

  try {
    return new Langfuse({
      secretKey,
      publicKey,
      baseUrl,
      // Avoid throwing if ingestion endpoint is unavailable; best-effort telemetry
      sdkIntegration: 'langfuse-wrapped-openai',
    });
  } catch {
    return null;
  }
}

export function getLangfuse(): Nullable<Langfuse> {
  if (globalForLangfuse.__langfuse === undefined) {
    globalForLangfuse.__langfuse = createLangfuse();
  }
  return globalForLangfuse.__langfuse ?? null;
}
