'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface PromptStats {
  totalGenerations: number;
  uniqueTraces: number;
  last24h: number;
  last7d: number;
  last30d: number;
  recentGenerations: {
    id: string;
    traceId: string;
    input: any;
    output: any;
    startTime: string;
    model: string;
    promptName?: string;
    promptVersion: number;
    totalTokens?: number;
    metadata?: Record<string, any>;
    hasPromptVariables?: boolean;
  }[];
  traceIds: string[];
  // Observation IDs paired with trace IDs for direct lookup during evals
  traceObservationPairs?: Array<{
    traceId: string;
    observationId: string;
    output?: any;
  }>;
  evalReady?: boolean;
}

interface PromptUsageStatsProps {
  promptName: string;
  promptVersion: number;
  onStatsLoaded?: (stats: PromptStats) => void;
}

export function PromptUsageStats({
  promptName,
  promptVersion,
  onStatsLoaded,
}: PromptUsageStatsProps) {
  const [stats, setStats] = useState<PromptStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecentTraces, setShowRecentTraces] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/langfuse/prompt-stats/${encodeURIComponent(promptName)}?version=${promptVersion}`,
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
      onStatsLoaded?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [promptName, promptVersion, onStatsLoaded]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCount = (count: number) =>
    count >= 100 ? '100+' : count.toString();

  const copyTraceIds = () => {
    if (stats?.traceIds) {
      navigator.clipboard.writeText(stats.traceIds.join('\n'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        <span className="ml-2 text-slate-500">Loading usage stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
        <AlertCircle className="w-5 h-5 text-rose-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-rose-700">
            Failed to load stats
          </p>
          <p className="text-xs text-rose-500">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          className="border-rose-200 text-rose-600 hover:bg-rose-50"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-4 border border-violet-200/50">
          <div className="flex items-center gap-2 text-violet-600 mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Total Uses
            </span>
          </div>
          <p className="text-2xl font-bold text-violet-900">
            {formatCount(stats.totalGenerations)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Database className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Unique Traces
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {formatCount(stats.uniqueTraces)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 border border-emerald-200/50">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Last 24h
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-900">
            {formatCount(stats.last24h)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-200/50">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Last 7d
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-900">
            {formatCount(stats.last7d)}
          </p>
        </div>
      </div>

      {/* Eval Readiness Check */}
      {!stats.evalReady && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700">
              Traces missing promptVariables
            </p>
            <p className="text-xs text-amber-600">
              Recent generations don&apos;t have{' '}
              <code className="bg-amber-100 px-1 rounded">promptVariables</code>{' '}
              in their metadata. Eval runs require this data to fill in template
              variables.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <Sparkles className="w-5 h-5 text-violet-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">
            {formatCount(stats.uniqueTraces)} traces available for evaluation
          </p>
          <p className="text-xs text-slate-500">
            Use these traces to test modified prompts in the Draft tab
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyTraceIds}
          className="gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy IDs
        </Button>
      </div>

      {/* Recent Traces Preview */}
      {stats.recentGenerations.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRecentTraces(!showRecentTraces)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">
              Recent Generations ({stats.recentGenerations.length})
            </span>
            {showRecentTraces ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {showRecentTraces && (
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-auto">
              {stats.recentGenerations.map((gen) => (
                <div key={gen.id} className="p-3 hover:bg-slate-50">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className="text-xs bg-violet-100 text-violet-700 border-0">
                      v{gen.promptVersion}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {gen.model || 'Unknown model'}
                    </Badge>
                    {gen.totalTokens && (
                      <Badge variant="outline" className="text-xs">
                        {gen.totalTokens} tokens
                      </Badge>
                    )}
                    {gen.hasPromptVariables ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">
                        Has Variables
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-rose-100 text-rose-600 border-0">
                        No Variables
                      </Badge>
                    )}
                    <span className="text-xs text-slate-400 ml-auto">
                      {formatDate(gen.startTime)}
                    </span>
                  </div>
                  {/* Show prompt variables if available */}
                  {gen.hasPromptVariables && gen.metadata?.promptVariables && (
                    <div className="mb-2 p-2 bg-emerald-50 rounded border border-emerald-100">
                      <p className="text-xs text-emerald-600 font-medium mb-1">
                        Prompt Variables (
                        {Object.keys(gen.metadata.promptVariables).length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(gen.metadata.promptVariables)
                          .slice(0, 5)
                          .map((key) => (
                            <Badge
                              key={key}
                              variant="outline"
                              className="text-xs bg-white"
                            >
                              {key}
                            </Badge>
                          ))}
                        {Object.keys(gen.metadata.promptVariables).length >
                          5 && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-white text-slate-400"
                          >
                            +
                            {Object.keys(gen.metadata.promptVariables).length -
                              5}{' '}
                            more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded p-2 border border-slate-100">
                      <p className="text-slate-500 mb-1 font-medium">Input</p>
                      <p className="text-slate-700 line-clamp-2 font-mono">
                        {typeof gen.input === 'string'
                          ? gen.input
                          : JSON.stringify(gen.input).slice(0, 100)}
                      </p>
                    </div>
                    <div className="bg-emerald-50/50 rounded p-2 border border-emerald-100">
                      <p className="text-emerald-600 mb-1 font-medium">
                        Output
                      </p>
                      <p className="text-slate-700 line-clamp-2 font-mono">
                        {typeof gen.output === 'string'
                          ? gen.output
                          : JSON.stringify(gen.output).slice(0, 100)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
