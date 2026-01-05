import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({client: inngest,
    functions: [
      // Evals
      runTracesEvalFunction,
    ],
    streaming: 'force',
  });
  