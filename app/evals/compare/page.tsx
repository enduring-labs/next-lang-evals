'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface EvalResult {
  traceId: string;
  success: boolean;
  input: Record<string, any>;
  output?: string;
  originalProductionOutput?: string;
  parsed?: any;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  error?: string;
  latencyMs?: number;
  variableSource?: string;
  tokenUsage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  promptFormat?: string;
  schemaKey?: string;
  toolGroupKey?: string;
}

interface EvalMetadata {
  evalId: string;
  evalName: string;
  originalPromptName: string;
  originalPromptVersion: number;
  model: string;
  provider: string;
  toolGroupKey?: string;
  toolCount?: number;
  totalTraces: number;
  successCount: number;
  failureCount: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  langfuseTraceId: string;
}

interface EvalData {
  metadata: EvalMetadata;
  results: EvalResult[];
}

export default function EvalComparePage() {
  const [searchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  const traceId = searchParams.get('traceId');
  const resultsUrl = searchParams.get('resultsUrl');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    async function fetchResults() {
      if (!resultsUrl) {
        setError('Missing resultsUrl parameter');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(resultsUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch eval results');
        }
        const data = await response.json();
        setEvalData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load eval results',
        );
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [resultsUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
          <p className="text-slate-600">Loading eval results...</p>
        </div>
      </div>
    );
  }

  if (error || !evalData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-rose-600">
              Error Loading Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">
              {error || 'No data available'}
            </p>
            <Link href="/evals">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Evals
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metadata, results } = evalData;

  // Fetch original outputs from Langfuse traces
  // For now, we'll show the new output and note that old output needs to be fetched
  // In a real implementation, you'd fetch the original trace outputs from Langfuse

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/evals">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Evals
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">
              Eval Comparison: New vs Old Output
            </h1>
            <p className="text-slate-600 mt-1">
              {metadata.evalName} • {metadata.totalTraces} traces •{' '}
              {metadata.successCount} successful • {metadata.failureCount}{' '}
              failed
            </p>
          </div>
          {traceId && (
            <a
              href={`https://us.cloud.langfuse.com/project/cme8s6dl501fbad07hhojh4r6/traces/${traceId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Langfuse
              </Button>
            </a>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {metadata.model}
              </p>
              <Badge variant="outline" className="mt-1">
                {metadata.provider}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">
                {Math.round(
                  (metadata.successCount / metadata.totalTraces) * 100,
                )}
                %
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {metadata.successCount} / {metadata.totalTraces}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Avg Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round(
                  results.reduce((acc, r) => acc + (r.latencyMs || 0), 0) /
                    results.length,
                )}
                ms
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round(metadata.durationMs / 1000)}s
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>Output Comparison</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Click a row to expand and view full details
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Trace ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="max-w-md">New Output</TableHead>
                    <TableHead className="max-w-md">Old Output</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, idx) => (
                    <>
                      <TableRow
                        key={result.traceId}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() =>
                          setSelectedRow(selectedRow === idx ? null : idx)
                        }
                      >
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.traceId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge variant="outline" className="bg-emerald-50">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate text-sm">
                            {result.output || result.error || 'No output'}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate text-sm">
                            {result.originalProductionOutput || (
                              <span className="text-slate-400 italic">
                                Not available
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.latencyMs
                            ? `${Math.round(result.latencyMs)}ms`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.tokenUsage?.total || '-'}
                        </TableCell>
                      </TableRow>
                      {selectedRow === idx && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-slate-50 p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-emerald-700">
                                    New Output (from eval)
                                  </h4>
                                  <pre className="bg-white p-3 rounded border border-emerald-200 text-sm whitespace-pre-wrap max-h-64 overflow-auto font-mono text-xs">
                                    {result.output
                                      ? (() => {
                                          try {
                                            return JSON.stringify(
                                              JSON.parse(result.output),
                                              null,
                                              2,
                                            );
                                          } catch {
                                            return result.output;
                                          }
                                        })()
                                      : result.error || 'No output'}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-slate-700">
                                    Old Output (from production)
                                  </h4>
                                  <pre className="bg-white p-3 rounded border border-slate-200 text-sm whitespace-pre-wrap max-h-64 overflow-auto font-mono text-xs">
                                    {result.originalProductionOutput
                                      ? (() => {
                                          try {
                                            return JSON.stringify(
                                              JSON.parse(
                                                result.originalProductionOutput,
                                              ),
                                              null,
                                              2,
                                            );
                                          } catch {
                                            return result.originalProductionOutput;
                                          }
                                        })()
                                      : 'Not available'}
                                  </pre>
                                </div>
                              </div>
                              {result.toolCalls &&
                                result.toolCalls.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">
                                      Tool Calls ({result.toolCalls.length})
                                    </h4>
                                    <div className="bg-white p-3 rounded border border-slate-200 text-sm">
                                      <pre className="text-xs overflow-auto">
                                        {JSON.stringify(
                                          result.toolCalls,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              <div className="grid grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="text-slate-500">
                                    Input Tokens:
                                  </span>{' '}
                                  {result.tokenUsage?.input || '-'}
                                </div>
                                <div>
                                  <span className="text-slate-500">
                                    Output Tokens:
                                  </span>{' '}
                                  {result.tokenUsage?.output || '-'}
                                </div>
                                <div>
                                  <span className="text-slate-500">
                                    Total Tokens:
                                  </span>{' '}
                                  {result.tokenUsage?.total || '-'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
