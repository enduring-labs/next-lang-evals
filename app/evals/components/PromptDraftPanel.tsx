'use client';

import {
  ChatMessage,
  extractPromptContent,
  markdownComponents,
} from '@/app/evals/components/PromptContentViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  Eye,
  Loader2,
  Play,
  Save,
  Sparkles,
  SpellCheck,
  Wrench,
  Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Dynamic import to avoid SSR issues with react-markdown
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

// LanguageTool API types
interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: {
    id: string;
    description: string;
    category: { id: string; name: string };
  };
  context: {
    text: string;
    offset: number;
    length: number;
  };
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

// Call LanguageTool API for spell/grammar checking
async function checkWithLanguageTool(
  text: string,
): Promise<LanguageToolMatch[]> {
  const response = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      text,
      language: 'en-US',
      enabledOnly: 'false',
    }),
  });

  if (!response.ok) throw new Error('Failed to check spelling');
  const data: LanguageToolResponse = await response.json();
  return data.matches;
}

// Preview component that matches PromptContentViewer formatting
function PreviewContent({ draftPrompt }: { draftPrompt: string }) {
  // Try to parse as JSON to detect chat format
  let messages: ChatMessage[] | null = null;

  if (draftPrompt.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(draftPrompt);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed[0].role &&
        parsed[0].content
      ) {
        messages = parsed;
      }
    } catch {
      // Not valid JSON, treat as plain text
    }
  }

  if (!draftPrompt) {
    return (
      <div className="min-h-[350px] bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-center">
        <p className="text-slate-400 italic">No content to preview</p>
      </div>
    );
  }

  // Chat format - render with message cards
  if (messages) {
    return (
      <div className="space-y-4 min-h-[350px] max-h-[500px] overflow-auto">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
          >
            <div
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                msg.role === 'system'
                  ? 'bg-violet-100 text-violet-700'
                  : msg.role === 'user'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {msg.role}
            </div>
            <div className="p-4 prose prose-sm prose-slate max-w-none">
              <ReactMarkdown components={markdownComponents as any}>
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Plain text - render as markdown
  return (
    <div className="min-h-[350px] max-h-[500px] overflow-auto bg-slate-50 rounded-xl p-4 border border-slate-200 prose prose-sm prose-slate max-w-none">
      <ReactMarkdown components={markdownComponents as any}>
        {draftPrompt}
      </ReactMarkdown>
    </div>
  );
}

interface TraceObservationPair {
  traceId: string;
  observationId: string;
  output?: any;
}

interface PromptDraftPanelProps {
  promptName: string;
  promptVersion: number;
  promptContent: string | object;
  traceIds: string[];
  traceObservationPairs?: TraceObservationPair[];
  evalReady: boolean;
}

// Detect prompt format from content
type PromptFormat = 'json-chat' | 'text-markers' | 'plain';

function detectPromptFormat(content: string | object): PromptFormat {
  if (Array.isArray(content)) {
    return 'json-chat';
  }

  const text = typeof content === 'string' ? content : JSON.stringify(content);

  // Check for JSON array format
  if (text.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed[0].role &&
        typeof parsed[0].content === 'string'
      ) {
        return 'json-chat';
      }
    } catch {
      // Not valid JSON
    }
  }

  // Check for text marker format
  if (
    text.includes('[SYSTEM]') ||
    text.includes('[USER]') ||
    text.includes('[ASSISTANT]')
  ) {
    return 'text-markers';
  }

  return 'plain';
}

const formatLabels: Record<PromptFormat, string> = {
  'json-chat': 'Chat (JSON Array)',
  'text-markers': 'Chat (Text Markers)',
  plain: 'Plain Text',
};

export function PromptDraftPanel({
  promptName,
  promptVersion,
  promptContent,
  traceIds,
  traceObservationPairs = [],
  evalReady,
}: PromptDraftPanelProps) {
  // Draft state
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Detect original format
  const originalFormat = useMemo(
    () => detectPromptFormat(promptContent),
    [promptContent],
  );
  const currentFormat = useMemo(
    () => detectPromptFormat(draftPrompt),
    [draftPrompt],
  );
  const formatChanged = originalFormat !== currentFormat;

  // Spellcheck state
  const [spellCheckMatches, setSpellCheckMatches] = useState<
    LanguageToolMatch[]
  >([]);
  const [isChecking, setIsChecking] = useState(false);
  const [spellCheckDone, setSpellCheckDone] = useState(false);

  // Eval configuration state
  const [showEvalConfig, setShowEvalConfig] = useState(false);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    links?: { inngest: string; langfuse: string };
    langfuseTraceId?: string;
    resultsUrl?: string;
    completed?: boolean;
  } | null>(null);
  const [polling, setPolling] = useState(false);

  // Eval settings
  const [evalName, setEvalName] = useState('');
  const [selectedTraceCount, setSelectedTraceCount] = useState(10);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [customModel, setCustomModel] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini'>(
    'gemini',
  );
  const [reasoningEffort, setReasoningEffort] = useState<
    'minimal' | 'low' | 'medium' | 'high' | undefined
  >(undefined);
  const [verbosity, setVerbosity] = useState<
    'low' | 'medium' | 'high' | undefined
  >(undefined);
  // Schema for structured output (optional)
  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
    undefined,
  );
  const [availableSchemas, setAvailableSchemas] = useState<
    { key: string; description: string }[]
  >([]);
  const [toolGroupInfo, setToolGroupInfo] = useState<{
    key: string;
    description: string;
    toolCount: number;
    toolNames: string[];
  } | null>(null);

  // Initialize draft prompt from content
  useEffect(() => {
    const { text } = extractPromptContent(promptContent);
    if (typeof promptContent === 'string') {
      setDraftPrompt(promptContent);
    } else if (Array.isArray(promptContent)) {
      setDraftPrompt(JSON.stringify(promptContent, null, 2));
    } else {
      setDraftPrompt(text);
    }
    setHasChanges(false);
    setDraftSaved(false);
  }, [promptContent]);

  // Generate default eval name
  useEffect(() => {
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-');
    setEvalName(`${promptName.split('/').pop()}-eval-${timestamp}`);
  }, [promptName]);

  // Fetch available schemas and auto-detect from prompt name
  useEffect(() => {
    fetch(`/api/evals/schemas?promptName=${encodeURIComponent(promptName)}`)
      .then((res) => res.json())
      .then((data) => {
        setAvailableSchemas(data.schemas || []);

        // Auto-select detected schema if no schema is currently selected
        if (data.detectedSchema && !selectedSchema) {
          setSelectedSchema(data.detectedSchema);
        }
      })
      .catch(console.error);

    // Fetch tool group info for this prompt
    fetch(
      `/api/langfuse/tool-groups?promptName=${encodeURIComponent(promptName)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.hasTools && data.toolGroup) {
          setToolGroupInfo(data.toolGroup);
        } else {
          setToolGroupInfo(null);
        }
      })
      .catch(console.error);
  }, [promptName]);

  // Handle draft changes
  const handleDraftChange = (value: string) => {
    setDraftPrompt(value);
    setHasChanges(true);
    setDraftSaved(false);
    setSpellCheckDone(false);
    setSpellCheckMatches([]);
  };

  // Save draft (local storage for now)
  const saveDraft = () => {
    localStorage.setItem(`prompt-draft-${promptName}`, draftPrompt);
    setDraftSaved(true);
    setHasChanges(false);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  // Run spell check
  const runSpellCheck = useCallback(async () => {
    setIsChecking(true);
    setSpellCheckMatches([]);
    try {
      const matches = await checkWithLanguageTool(draftPrompt);
      setSpellCheckMatches(matches);
      setSpellCheckDone(true);
    } catch (err) {
      console.error('Spell check failed:', err);
    } finally {
      setIsChecking(false);
    }
  }, [draftPrompt]);

  // Poll for eval results
  useEffect(() => {
    if (!polling || !evalResult?.langfuseTraceId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/evals?langfuseTraceId=${evalResult.langfuseTraceId}`,
        );
        const data = await response.json();

        if (data.completed) {
          setPolling(false);
          setEvalResult((prev) => ({
            ...prev!,
            completed: true,
            resultsUrl: data.resultsUrl,
          }));
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('[EvalPolling] Error polling for results:', error);
        // Continue polling on error
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [polling, evalResult?.langfuseTraceId]);

  // Start eval run
  const startEvalRun = async () => {
    if (traceIds.length === 0) {
      setEvalResult({
        success: false,
        error: 'No trace IDs available for evaluation',
      });
      return;
    }

    setEvalRunning(true);
    setEvalResult(null);

    try {
      const traceIdsToRun = traceIds.slice(0, selectedTraceCount);

      // Filter observation pairs to match selected trace IDs
      const traceIdSet = new Set(traceIdsToRun);
      const pairsToRun = traceObservationPairs.filter((p) =>
        traceIdSet.has(p.traceId),
      );

      const response = await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftPrompt,
          traceIds: traceIdsToRun,
          // Pass observation pairs for direct output lookup (avoids name matching)
          ...(pairsToRun.length > 0
            ? { traceObservationPairs: pairsToRun }
            : {}),
          model: useCustomModel && customModel ? customModel : selectedModel,
          provider: selectedProvider,
          evalName,
          originalPromptName: promptName,
          originalPromptVersion: promptVersion,
          ...(selectedProvider === 'openai' && reasoningEffort
            ? { reasoningEffort }
            : {}),
          ...(selectedProvider === 'openai' && verbosity ? { verbosity } : {}),
          // Schema for structured output validation
          ...(selectedSchema ? { schemaKey: selectedSchema } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start eval run');
      }

      setEvalResult({
        success: true,
        message: data.message,
        links: data.links,
        langfuseTraceId: data.langfuseTraceId,
        completed: false,
      });

      // Start polling for results
      if (data.langfuseTraceId) {
        setPolling(true);
      }
    } catch (err) {
      setEvalResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setEvalRunning(false);
    }
  };

  const spellingErrors = spellCheckMatches.filter(
    (m) => m.rule.category.id === 'TYPOS' || m.rule.category.id === 'SPELLING',
  );
  const grammarErrors = spellCheckMatches.filter(
    (m) => m.rule.category.id !== 'TYPOS' && m.rule.category.id !== 'SPELLING',
  );

  return (
    <div className="space-y-4">
      {/* Draft Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Edit/Preview Toggle */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setPreviewMode(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  !previewMode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  previewMode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${
                formatChanged
                  ? 'text-amber-600 border-amber-200 bg-amber-50'
                  : 'text-slate-500 border-slate-200 bg-slate-50'
              }`}
              title={
                formatChanged
                  ? `Format changed from ${formatLabels[originalFormat]} to ${formatLabels[currentFormat]}`
                  : `Original format: ${formatLabels[originalFormat]}`
              }
            >
              {formatLabels[currentFormat]}
              {formatChanged && ' ⚠️'}
            </Badge>
            {hasChanges && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-200 bg-amber-50"
              >
                Unsaved changes
              </Badge>
            )}
            {draftSaved && (
              <Badge
                variant="outline"
                className="text-emerald-600 border-emerald-200 bg-emerald-50"
              >
                <Check className="w-3 h-3 mr-1" />
                Saved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runSpellCheck}
              disabled={isChecking || previewMode}
              className="gap-1.5"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SpellCheck className="w-4 h-4" />
              )}
              Check Spelling
            </Button>
            <Button
              size="sm"
              onClick={saveDraft}
              disabled={!hasChanges}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </Button>
          </div>
        </div>

        {/* Edit Mode */}
        {!previewMode && (
          <Textarea
            value={draftPrompt}
            onChange={(e) => handleDraftChange(e.target.value)}
            className="min-h-[350px] font-mono text-sm bg-white border-slate-200 focus:border-violet-400 focus:ring-violet-400/20"
            placeholder="Enter your prompt draft..."
            spellCheck
          />
        )}

        {/* Preview Mode */}
        {previewMode && <PreviewContent draftPrompt={draftPrompt} />}

        {/* Spell check results */}
        {spellCheckDone && !previewMode && (
          <div className="p-3 rounded-xl border bg-slate-50 border-slate-200">
            {spellCheckMatches.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  No spelling or grammar issues found!
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  {spellingErrors.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-3 h-3 bg-red-100 border-b-2 border-red-500 rounded-sm" />
                      <span className="text-red-700 font-medium">
                        {spellingErrors.length} spelling
                      </span>
                    </div>
                  )}
                  {grammarErrors.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-3 h-3 bg-amber-100 border-b-2 border-amber-500 rounded-sm" />
                      <span className="text-amber-700 font-medium">
                        {grammarErrors.length} grammar/style
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-[150px] overflow-auto">
                  {spellCheckMatches.slice(0, 10).map((match, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100 text-sm"
                    >
                      <AlertTriangle
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          match.rule.category.id === 'TYPOS' ||
                          match.rule.category.id === 'SPELLING'
                            ? 'text-red-500'
                            : 'text-amber-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700">{match.message}</p>
                        {match.replacements.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Suggestions:{' '}
                            <span className="text-emerald-600 font-medium">
                              {match.replacements
                                .slice(0, 3)
                                .map((r) => r.value)
                                .join(', ')}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {spellCheckMatches.length > 10 && (
                    <p className="text-xs text-slate-400 text-center">
                      +{spellCheckMatches.length - 10} more issues
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Eval Configuration Section */}
      <div className="border-t border-slate-200 pt-4">
        <button
          onClick={() => setShowEvalConfig(!showEvalConfig)}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-emerald-50 rounded-xl border border-violet-200/50 hover:border-violet-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-900">Configure & Run Eval</p>
              <p className="text-xs text-slate-500">
                Test this draft against {traceIds.length} historical traces
              </p>
            </div>
          </div>
          {showEvalConfig ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showEvalConfig && (
          <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* Success Result */}
            {evalResult?.success && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-3">
                  {polling ? (
                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                  ) : evalResult.completed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Check className="w-5 h-5 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      {polling
                        ? 'Eval running... Checking for results...'
                        : evalResult.completed
                          ? 'Eval completed! Results ready.'
                          : 'Eval run started!'}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {evalResult.message}
                    </p>
                  </div>
                </div>
                {evalResult.completed && evalResult.resultsUrl && (
                  <div className="pt-2 border-t border-emerald-200">
                    <a
                      href={`/evals/compare?traceId=${evalResult.langfuseTraceId}&resultsUrl=${encodeURIComponent(evalResult.resultsUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Comparison: New vs Old Output
                    </a>
                  </div>
                )}
                {evalResult.links && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
                    <a
                      href={evalResult.links.inngest}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      View Inngest Run
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={evalResult.links.langfuse}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-violet-700 text-sm font-medium rounded-lg border border-violet-200 hover:bg-violet-100 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      View Langfuse Trace
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Error Result */}
            {evalResult && !evalResult.success && (
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-200">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm font-medium text-rose-700">
                    Failed to start eval
                  </p>
                  <p className="text-xs text-rose-600">{evalResult.error}</p>
                </div>
              </div>
            )}

            {/* Tool Group Info */}
            {toolGroupInfo && (
              <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Tool-Calling Eval
                    </p>
                    <p className="text-xs text-blue-600">
                      {toolGroupInfo.toolCount} tools from{' '}
                      <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">
                        {toolGroupInfo.key}
                      </code>{' '}
                      registry
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {toolGroupInfo.toolNames.map((toolName) => (
                    <span
                      key={toolName}
                      className="text-xs bg-white/80 border border-blue-200 text-blue-700 px-2 py-1 rounded-md font-mono"
                    >
                      {toolName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Eval readiness warning */}
            {!evalReady && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    Traces missing promptVariables
                  </p>
                  <p className="text-xs text-amber-600">
                    Eval runs require promptVariables in trace metadata.
                  </p>
                </div>
              </div>
            )}

            {/* Eval Name */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Eval Run Name
              </label>
              <Input
                value={evalName}
                onChange={(e) => setEvalName(e.target.value)}
                placeholder="Enter a name for this eval run"
                className="bg-white"
              />
            </div>

            {/* Model Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Provider
                </label>
                <Select
                  value={selectedProvider}
                  onValueChange={(v: 'openai' | 'gemini') => {
                    setSelectedProvider(v);
                    if (v === 'gemini') {
                      setSelectedModel('gemini-2.5-flash');
                      setReasoningEffort(undefined);
                      setVerbosity(undefined);
                    } else {
                      setSelectedModel('gpt-5');
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
                  Model
                  <label className="flex items-center gap-1.5 text-xs font-normal text-slate-500">
                    <input
                      type="checkbox"
                      checked={useCustomModel}
                      onChange={(e) => setUseCustomModel(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Use custom
                  </label>
                </label>
                {useCustomModel ? (
                  <Input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="ft:gpt-4o-mini-2024-07-18:..."
                    className="bg-white font-mono text-sm"
                  />
                ) : (
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider === 'gemini' ? (
                        <>
                          <SelectItem value="gemini-2.5-flash">
                            Gemini 2.5 Flash
                          </SelectItem>
                          <SelectItem value="gemini-2.5-pro">
                            Gemini 2.5 Pro
                          </SelectItem>
                          <SelectItem value="gemini-2.0-flash">
                            Gemini 2.0 Flash
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="gpt-5">
                            GPT-5 (Reasoning)
                          </SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">
                            GPT-4o Mini
                          </SelectItem>
                          <SelectItem value="gpt-4-turbo">
                            GPT-4 Turbo
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Custom Model Help Text */}
            {useCustomModel && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>Finetuned Model Format:</strong> Enter the full model
                  ID from your provider (e.g.,{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded">
                    ft:gpt-4o-mini-2024-07-18:enduring-labs::CsEl1afL
                  </code>
                  )
                </p>
              </div>
            )}

            {/* OpenAI Reasoning Parameters */}
            {selectedProvider === 'openai' && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Reasoning Effort
                    <span className="text-xs text-slate-400 ml-1">
                      (optional)
                    </span>
                  </label>
                  <Select
                    value={reasoningEffort || 'none'}
                    onValueChange={(v) =>
                      setReasoningEffort(
                        v === 'none'
                          ? undefined
                          : (v as 'minimal' | 'low' | 'medium' | 'high'),
                      )
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Verbosity
                    <span className="text-xs text-slate-400 ml-1">
                      (optional)
                    </span>
                  </label>
                  <Select
                    value={verbosity || 'none'}
                    onValueChange={(v) =>
                      setVerbosity(
                        v === 'none'
                          ? undefined
                          : (v as 'low' | 'medium' | 'high'),
                      )
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Structured Output Schema */}
            {availableSchemas.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Output Schema
                  {selectedSchema && (
                    <span className="text-xs text-emerald-600 ml-2">
                      ✓ Auto-detected from prompt
                    </span>
                  )}
                </label>
                <Select
                  value={selectedSchema || 'none'}
                  onValueChange={(v) =>
                    setSelectedSchema(v === 'none' ? undefined : v)
                  }
                >
                  <SelectTrigger
                    className={
                      selectedSchema
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white'
                    }
                  >
                    <SelectValue placeholder="No structured output" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No structured output</SelectItem>
                    {availableSchemas.map(({ key, description }) => (
                      <SelectItem key={key} value={key}>
                        {key === selectedSchema ? '✓ ' : ''}
                        {description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedSchema
                    ? `Using same Zod schema as production (${selectedSchema})`
                    : 'Select a schema for validated structured outputs'}
                </p>
              </div>
            )}

            {/* Trace Count Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Number of Traces
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedTraceCount(count)}
                    disabled={count > traceIds.length}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      selectedTraceCount === count
                        ? 'bg-violet-100 border-violet-300 text-violet-700'
                        : count > traceIds.length
                          ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50'
                    }`}
                  >
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs">traces</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={startEvalRun}
              disabled={!evalReady || evalRunning || !evalName.trim()}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700"
            >
              {evalRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Eval...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Eval Run (
                  {Math.min(selectedTraceCount, traceIds.length)} traces)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
