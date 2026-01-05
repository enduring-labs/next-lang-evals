'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileJson,
  Loader2,
  Play,
  Search,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type TrainingMethod = 'supervised' | 'preference' | 'reinforcement';

interface TrainingExample {
  id: string;
  data: any;
  isValid: boolean;
  error?: string;
}

// Component to render a collapsible training example with highlighted messages
function TrainingExampleCard({
  example,
  index,
}: {
  example: TrainingExample;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(
    new Set(),
  );

  const toggleMessage = (idx: number) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedMessages(newExpanded);
  };

  if (!example.isValid) {
    return (
      <div className="border border-amber-200 rounded-lg bg-amber-50/50">
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Example {index + 1} - Invalid
            </span>
          </div>
          {example.error && (
            <div className="ml-6 text-xs text-amber-700">{example.error}</div>
          )}
        </div>
      </div>
    );
  }

  const messages = example.data?.messages || [];
  const hasMessages = Array.isArray(messages) && messages.length > 0;

  return (
    <div
      className={`border rounded-lg bg-white overflow-hidden border-slate-200`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 transition-colors text-left hover:bg-slate-50`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">
            Example {index + 1}
          </span>
          {hasMessages && (
            <span className="text-xs text-slate-500">
              ({messages.length} message{messages.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 p-3 space-y-2 bg-slate-50/30">
          {hasMessages ? (
            <div className="space-y-2">
              {messages.map((msg: any, idx: number) => {
                const isAssistant = msg.role === 'assistant';
                const isExpandedMsg = expandedMessages.has(idx);
                const content =
                  typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content, null, 2);
                const isLong = content.length > 200;
                const preview = isLong
                  ? content.substring(0, 200) + '...'
                  : content;

                return (
                  <div
                    key={idx}
                    className={`border rounded-lg overflow-hidden ${
                      isAssistant
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => toggleMessage(idx)}
                      className={`w-full flex items-start justify-between p-2 transition-colors text-left ${
                        isAssistant
                          ? 'hover:bg-red-100/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {isExpandedMsg ? (
                          <ChevronDown className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
                                isAssistant
                                  ? 'bg-red-200 text-red-900 border border-red-300'
                                  : msg.role === 'user'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {msg.role}
                            </span>
                          </div>
                          {!isExpandedMsg && (
                            <pre
                              className={`text-xs font-mono whitespace-pre-wrap break-words ${
                                isAssistant ? 'text-red-900' : 'text-slate-700'
                              }`}
                            >
                              {preview}
                            </pre>
                          )}
                        </div>
                      </div>
                    </button>
                    {isExpandedMsg && (
                      <div
                        className={`p-3 pt-2 border-t ${
                          isAssistant
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <pre
                          className={`text-xs font-mono whitespace-pre-wrap break-words ${
                            isAssistant ? 'text-red-900' : 'text-slate-700'
                          }`}
                        >
                          {content}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-slate-100 rounded border border-slate-200">
              <pre className="text-xs font-mono overflow-x-auto">
                {JSON.stringify(example.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LangfusePrompt {
  name: string;
  version: number;
  type: string;
  labels: string[];
  tags: string[];
}

export default function FinetunePage() {
  const [activeTab, setActiveTab] = useState<'data' | 'job'>('data');
  const [trainingMethod, setTrainingMethod] =
    useState<TrainingMethod>('supervised');
  const [trainingData, setTrainingData] = useState<string>('');
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedBlobUrl, setSavedBlobUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Langfuse trace fetching state
  const [prompts, setPrompts] = useState<LangfusePrompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [promptSearchQuery, setPromptSearchQuery] = useState<string>('');
  const [selectedPromptName, setSelectedPromptName] = useState<string>('');
  const [selectedPromptVersion, setSelectedPromptVersion] = useState<
    number | null
  >(null);
  const [traceLimit, setTraceLimit] = useState<number>(100);
  const [traceLimitInput, setTraceLimitInput] = useState<string>('100');
  const [trainSplitRatio, setTrainSplitRatio] = useState<number>(0.8); // 80% training, 20% validation
  const [fetchingTraces, setFetchingTraces] = useState(false);
  const [traceFetchError, setTraceFetchError] = useState<string | null>(null);
  const [traceFetchResult, setTraceFetchResult] = useState<{
    count: number;
    totalObservations: number;
    invalidCount?: number;
    invalidTraces?: any[];
    blobUrl?: string;
    trainingBlobUrl?: string;
    validationBlobUrl?: string;
    trainingCount?: number;
    validationCount?: number;
  } | null>(null);


  // Job kickoff state
  const [jobBlobUrl, setJobBlobUrl] = useState('');
  const [baseModel, setBaseModel] = useState('gpt-4.1-mini-2025-04-14');
  const [suffix, setSuffix] = useState('');
  const [hyperparameters, setHyperparameters] = useState({
    batchSize: 'auto',
    learningRateMultiplier: 'auto',
    nEpochs: 'auto',
  });
  const [startingJob, setStartingJob] = useState(false);
  const [jobResult, setJobResult] = useState<any>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const validateExample = (data: any, method: TrainingMethod): boolean => {
    try {
      if (method === 'supervised') {
        if (!data.messages || !Array.isArray(data.messages)) {
          return false;
        }
        // Check for valid message structure
        for (const msg of data.messages) {
          if (!msg.role || msg.content === null || msg.content === undefined) {
            return false;
          }
        }
        return true;
      } else if (method === 'preference') {
        return (
          data.input &&
          data.preferred_output &&
          data.non_preferred_output &&
          Array.isArray(data.preferred_output) &&
          Array.isArray(data.non_preferred_output)
        );
      } else if (method === 'reinforcement') {
        return data.messages && Array.isArray(data.messages);
      }
      return false;
    } catch {
      return false;
    }
  };

  const parseTrainingData = (dataToParse?: string) => {
    const data = dataToParse ?? trainingData;
    if (!data.trim()) {
      setExamples([]);
      return;
    }
    try {
      // Handle both compact JSONL (single line per JSON) and pretty-printed format (with --- separators)
      let blocks: string[] = [];

      // Check if it's pretty-printed format (has --- separators)
      if (data.includes('\n\n---\n\n')) {
        blocks = data
          .trim()
          .split(/\n\n---\n\n/)
          .map((block) => block.trim())
          .filter((block) => block && !block.startsWith('---'));
      } else {
        // Compact JSONL format - one JSON object per line
        blocks = data
          .trim()
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('---'));
      }

      const parsed: TrainingExample[] = [];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        try {
          // Try parsing as-is first (JSON.parse handles multi-line JSON)
          let parsedData;
          try {
            parsedData = JSON.parse(block);
          } catch (parseError) {
            // If that fails, try to extract JSON by finding the first { or [ and matching braces
            // This handles cases where there might be trailing content
            let jsonStart = -1;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;

            for (let j = 0; j < block.length; j++) {
              const char = block[j];

              if (escapeNext) {
                escapeNext = false;
                continue;
              }

              if (char === '\\') {
                escapeNext = true;
                continue;
              }

              if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }

              if (!inString) {
                if (char === '{' || char === '[') {
                  if (jsonStart === -1) {
                    jsonStart = j;
                  }
                  braceCount++;
                } else if (char === '}' || char === ']') {
                  braceCount--;
                  if (braceCount === 0 && jsonStart !== -1) {
                    // Found complete JSON object
                    const jsonStr = block.substring(jsonStart, j + 1);
                    parsedData = JSON.parse(jsonStr);
                    break;
                  }
                }
              }
            }

            // If we didn't find a complete JSON object, try compacting
            if (!parsedData) {
              try {
                const compacted = block
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line) // Remove empty lines
                  .join(' ');
                parsedData = JSON.parse(compacted);
              } catch (compactError) {
                // If compacting fails, mark as invalid
                parsedData = null;
              }
            }
          }

          // Skip if we couldn't parse the data
          if (!parsedData) {
            parsed.push({
              id: `example-${i}`,
              data: null,
              isValid: false,
              error: 'Failed to parse JSON',
            });
            continue;
          }

          const isValid = validateExample(parsedData, trainingMethod);

          parsed.push({
            id: `example-${i}`,
            data: parsedData,
            isValid,
            error: isValid
              ? undefined
              : 'Invalid structure for selected method',
          });
        } catch (e) {
          // Log the first 200 chars of invalid blocks for debugging
          const preview = block.substring(0, 200);
          console.warn(
            `[ParseTrainingData] Invalid JSON block ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`,
          );
          console.warn(
            `[ParseTrainingData] Block preview: ${preview}${block.length > 200 ? '...' : ''}`,
          );

          parsed.push({
            id: `example-${i}`,
            data: null,
            isValid: false,
            error: `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
          });
        }
      }

      setExamples(parsed);
    } catch (error) {
      setExamples([
        {
          id: 'error',
          data: null,
          isValid: false,
          error: error instanceof Error ? error.message : 'Failed to parse',
        },
      ]);
    }
  };

  const handleSaveToBlob = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedBlobUrl(null);

    try {
      const validExamples = examples
        .filter((ex) => ex.isValid)
        .map((ex) => ex.data);

      if (validExamples.length === 0) {
        setSaveError('No valid examples to save');
        setSaving(false);
        return;
      }

      // Format as JSONL (one JSON object per line)
      const jsonlContent = validExamples
        .map((ex) => JSON.stringify(ex))
        .join('\n');

      const response = await fetch('/api/evals/finetune/save-training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: jsonlContent,
          method: trainingMethod,
          exampleCount: validExamples.length,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save training data');
      }

      const result = await response.json();
      setSavedBlobUrl(result.blobUrl);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save training data',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStartJob = async () => {
    setStartingJob(true);
    setJobError(null);
    setJobResult(null);

    try {
      if (!jobBlobUrl.trim()) {
        setJobError('Blob URL is required');
        setStartingJob(false);
        return;
      }

      const response = await fetch('/api/evals/finetune/start-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingFile: jobBlobUrl,
          model: baseModel,
          suffix: suffix.trim() || undefined,
          hyperparameters: {
            ...(hyperparameters.batchSize !== 'auto'
              ? { batch_size: parseInt(hyperparameters.batchSize) }
              : {}),
            ...(hyperparameters.learningRateMultiplier !== 'auto'
              ? {
                  learning_rate_multiplier: parseFloat(
                    hyperparameters.learningRateMultiplier,
                  ),
                }
              : {}),
            ...(hyperparameters.nEpochs !== 'auto'
              ? { n_epochs: parseInt(hyperparameters.nEpochs) }
              : {}),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start finetuning job');
      }

      const result = await response.json();
      setJobResult(result);
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : 'Failed to start job',
      );
    } finally {
      setStartingJob(false);
    }
  };

  const getExampleTemplate = (method: TrainingMethod): string => {
    if (method === 'supervised') {
      return JSON.stringify(
        {
          messages: [
            { role: 'user', content: 'What is the weather in San Francisco?' },
            {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_id',
                  type: 'function',
                  function: {
                    name: 'get_current_weather',
                    arguments:
                      '{"location": "San Francisco, USA", "format": "celsius"}',
                  },
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_current_weather',
                description: 'Get the current weather',
                parameters: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description:
                        'The city and country, eg. San Francisco, USA',
                    },
                    format: {
                      type: 'string',
                      enum: ['celsius', 'fahrenheit'],
                    },
                  },
                  required: ['location', 'format'],
                },
              },
            },
          ],
        },
        null,
        2,
      );
    } else if (method === 'preference') {
      return JSON.stringify(
        {
          input: {
            messages: [
              {
                role: 'user',
                content: 'What is the weather in San Francisco?',
              },
            ],
          },
          preferred_output: [
            {
              role: 'assistant',
              content: 'The weather in San Francisco is 70 degrees Fahrenheit.',
            },
          ],
          non_preferred_output: [
            {
              role: 'assistant',
              content: 'The weather in San Francisco is 21 Celsius.',
            },
          ],
        },
        null,
        2,
      );
    } else {
      return JSON.stringify(
        {
          messages: [
            {
              role: 'user',
              content:
                "Your task is to take a chemical in SMILES format and predict the number of hydrobond bond donors and acceptors according to Lipinkski's rule. CCN(CC)CCC(=O)c1sc(N)nc1C",
            },
          ],
          reference_answer: {
            donor_bond_counts: 5,
            acceptor_bond_counts: 7,
          },
        },
        null,
        2,
      );
    }
  };

  // Fetch prompts from Langfuse on mount
  useEffect(() => {
    const fetchPrompts = async () => {
      setLoadingPrompts(true);
      try {
        const response = await fetch('/api/langfuse/resources');
        if (response.ok) {
          const data = await response.json();
          // Get unique prompts by name (latest version)
          const promptsByName = new Map<string, LangfusePrompt>();
          for (const prompt of data.prompts || []) {
            const existing = promptsByName.get(prompt.name);
            if (!existing || prompt.version > existing.version) {
              promptsByName.set(prompt.name, prompt);
            }
          }
          setPrompts(Array.from(promptsByName.values()));
        }
      } catch (error) {
        console.error('Error fetching prompts:', error);
      } finally {
        setLoadingPrompts(false);
      }
    };
    fetchPrompts();
  }, []);

  // Auto-populate job blob URL when available
  useEffect(() => {
    // Prefer training blob URL over combined blob URL
    if (traceFetchResult?.trainingBlobUrl) {
      setJobBlobUrl(traceFetchResult.trainingBlobUrl);
    } else if (traceFetchResult?.blobUrl) {
      setJobBlobUrl(traceFetchResult.blobUrl);
    }
  }, [traceFetchResult?.trainingBlobUrl, traceFetchResult?.blobUrl]);

  const handleFetchTraces = async () => {
    if (!selectedPromptName) {
      setTraceFetchError('Please select a prompt');
      return;
    }

    setFetchingTraces(true);
    setTraceFetchError(null);
    setTraceFetchResult(null);

    try {
      // Langfuse API has a max limit of 100, so we need to paginate
      const maxLimitPerRequest = 100;
      const totalToFetch = traceLimit;
      const numRequests = Math.ceil(totalToFetch / maxLimitPerRequest);

      let allExamples: any[] = [];
      let totalObservations = 0;
      let totalInvalidTraces: any[] = [];

      for (let i = 0; i < numRequests; i++) {
        const currentLimit = Math.min(
          maxLimitPerRequest,
          totalToFetch - i * maxLimitPerRequest,
        );
        const offset = i * maxLimitPerRequest;

        console.log(
          `[FetchTraces] Batch ${i + 1}/${numRequests}: fetching ${currentLimit} traces (offset: ${offset})`,
        );

        const response = await fetch('/api/evals/finetune/convert-traces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptName: selectedPromptName,
            version: selectedPromptVersion,
            method: trainingMethod,
            limit: currentLimit,
            offset: offset,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch traces');
        }

        const result = await response.json();
        allExamples.push(...(result.examples || []));
        totalObservations += result.totalObservations || 0;
        if (result.invalidTraces) {
          totalInvalidTraces.push(...result.invalidTraces);
        }
      }

      // Combine all results into JSONL
      const jsonl = allExamples
        .map((ex) => JSON.stringify(ex, null, 2))
        .join('\n\n---\n\n');

      // Save combined results to blob storage with train/test split
      const compactJsonl = allExamples
        .map((ex) => JSON.stringify(ex))
        .join('\n');
      const saveResponse = await fetch(
        '/api/evals/finetune/save-training-data',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: compactJsonl,
            method: trainingMethod,
            exampleCount: allExamples.length,
            trainSplitRatio: trainSplitRatio,
          }),
        },
      );

      let blobUrl: string | undefined;
      let trainingBlobUrl: string | undefined;
      let validationBlobUrl: string | undefined;
      let trainingCount: number | undefined;
      let validationCount: number | undefined;
      if (saveResponse.ok) {
        const saveResult = await saveResponse.json();
        blobUrl = saveResult.blobUrl;
        trainingBlobUrl = saveResult.trainingBlobUrl;
        validationBlobUrl = saveResult.validationBlobUrl;
        trainingCount = saveResult.trainingCount;
        validationCount = saveResult.validationCount;
      }

      setTrainingData(jsonl);
      setTraceFetchResult({
        count: allExamples.length,
        totalObservations,
        invalidCount: totalInvalidTraces.length,
        invalidTraces:
          totalInvalidTraces.length > 0 ? totalInvalidTraces : undefined,
        blobUrl,
        trainingBlobUrl,
        validationBlobUrl,
        trainingCount,
        validationCount,
      });

      // Reset overridden start index since this is fresh data
      // Automatically parse the new data - pass it directly to avoid async state issue
      parseTrainingData(jsonl);
    } catch (error) {
      setTraceFetchError(
        error instanceof Error ? error.message : 'Failed to fetch traces',
      );
    } finally {
      setFetchingTraces(false);
    }
  };

  const selectedPrompt = prompts.find((p) => p.name === selectedPromptName);

  const validCount = examples.filter((e) => e.isValid).length;
  const invalidCount = examples.filter((e) => !e.isValid).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-violet-200/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/evals">
              <Button variant="ghost" size="sm" className="mb-2">
                ← Back to Evals
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200/50">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Finetune a Model
              </h1>
              <p className="text-slate-500 text-sm">
                Create training data and start OpenAI finetuning jobs
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1.5 rounded-xl shadow-sm mb-6">
            <TabsTrigger
              value="data"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all"
            >
              <FileJson className="w-4 h-4 mr-2" />
              Construct Training Data
            </TabsTrigger>
            <TabsTrigger
              value="job"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Finetuning Job
            </TabsTrigger>
          </TabsList>

          {/* Training Data Constructor Tab */}
          <TabsContent value="data" className="space-y-6">
            {/* Langfuse Trace Fetcher */}
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Pull Traces from Langfuse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt-search">Search Prompts</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="prompt-search"
                      value={promptSearchQuery}
                      onChange={(e) => setPromptSearchQuery(e.target.value)}
                      placeholder="Type to search prompts..."
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-select">Select Prompt</Label>
                    <Select
                      value={selectedPromptName}
                      onValueChange={(value) => {
                        setSelectedPromptName(value);
                        const prompt = prompts.find((p) => p.name === value);
                        setSelectedPromptVersion(prompt?.version || null);
                      }}
                      disabled={loadingPrompts}
                    >
                      <SelectTrigger id="prompt-select">
                        <SelectValue placeholder="Select a prompt..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {prompts
                          .filter((prompt) =>
                            promptSearchQuery
                              ? prompt.name
                                  .toLowerCase()
                                  .includes(promptSearchQuery.toLowerCase())
                              : true,
                          )
                          .map((prompt) => (
                            <SelectItem key={prompt.name} value={prompt.name}>
                              {prompt.name} (v{prompt.version})
                            </SelectItem>
                          ))}
                        {prompts.filter((prompt) =>
                          promptSearchQuery
                            ? prompt.name
                                .toLowerCase()
                                .includes(promptSearchQuery.toLowerCase())
                            : true,
                        ).length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-slate-500">
                            No prompts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {loadingPrompts && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading prompts...
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Input
                      value={selectedPromptVersion || ''}
                      disabled
                      className="bg-slate-50"
                    />
                    {selectedPrompt && (
                      <p className="text-xs text-slate-500">
                        Latest version: {selectedPrompt.version}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trace-limit">Number of Traces to Pull</Label>
                  <Input
                    id="trace-limit"
                    type="text"
                    value={traceLimitInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string and any input while typing
                      setTraceLimitInput(value);
                      // Update numeric state only if valid number
                      const numValue = parseInt(value.trim(), 10);
                      if (!isNaN(numValue) && numValue > 0) {
                        setTraceLimit(Math.min(1000, Math.max(1, numValue)));
                      }
                    }}
                    onBlur={(e) => {
                      // On blur, ensure we have a valid value
                      const value = e.target.value.trim();
                      if (value === '' || isNaN(parseInt(value, 10))) {
                        setTraceLimitInput('100');
                        setTraceLimit(100);
                      } else {
                        const numValue = parseInt(value, 10);
                        const clampedValue = Math.min(
                          1000,
                          Math.max(1, numValue),
                        );
                        setTraceLimitInput(clampedValue.toString());
                        setTraceLimit(clampedValue);
                      }
                    }}
                    placeholder="100"
                  />
                  <p className="text-xs text-slate-500">
                    Maximum number of traces to fetch and convert (1-1000)
                  </p>
                </div>
                <div className="space-y-3">
                  <Label>Train/Validation Split</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[trainSplitRatio]}
                      onValueChange={(values) => setTrainSplitRatio(values[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      className="flex-1"
                    />
                    <div className="text-sm font-medium text-slate-700 w-32 text-right">
                      {Math.round(trainSplitRatio * 100)}% /{' '}
                      {Math.round((1 - trainSplitRatio) * 100)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Training: {Math.round(trainSplitRatio * 100)}%</span>
                    <span>
                      Validation: {Math.round((1 - trainSplitRatio) * 100)}%
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleFetchTraces}
                  disabled={!selectedPromptName || fetchingTraces}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {fetchingTraces ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fetching traces...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Fetch Traces & Convert to Training Data
                    </>
                  )}
                </Button>
                {traceFetchError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{traceFetchError}</AlertDescription>
                  </Alert>
                )}
                {traceFetchResult && (
                  <Alert className="bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-900">
                      Successfully Converted Traces
                    </AlertTitle>
                    <AlertDescription className="text-emerald-800">
                      <div className="space-y-2">
                        <div>
                          Converted {traceFetchResult.count} traces from{' '}
                          {traceFetchResult.totalObservations} observations.
                          Training data has been populated below.
                        </div>
                        {traceFetchResult.trainingBlobUrl &&
                          traceFetchResult.validationBlobUrl && (
                            <div className="mt-2 space-y-2">
                              <div className="p-2 bg-emerald-100 rounded text-xs break-all">
                                <strong>
                                  Training ({traceFetchResult.trainingCount}{' '}
                                  examples):
                                </strong>{' '}
                                <a
                                  href={traceFetchResult.trainingBlobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 underline hover:text-emerald-900"
                                >
                                  {traceFetchResult.trainingBlobUrl}
                                </a>
                              </div>
                              <div className="p-2 bg-amber-100 rounded text-xs break-all">
                                <strong>
                                  Validation ({traceFetchResult.validationCount}{' '}
                                  examples):
                                </strong>{' '}
                                <a
                                  href={traceFetchResult.validationBlobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-700 underline hover:text-amber-900"
                                >
                                  {traceFetchResult.validationBlobUrl}
                                </a>
                              </div>
                            </div>
                          )}
                        {traceFetchResult.blobUrl &&
                          !traceFetchResult.trainingBlobUrl && (
                            <div className="mt-2 p-2 bg-emerald-100 rounded text-xs break-all">
                              <strong>Saved to blob:</strong>{' '}
                              <a
                                href={traceFetchResult.blobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 underline hover:text-emerald-900"
                              >
                                {traceFetchResult.blobUrl}
                              </a>
                            </div>
                          )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle>Training Data Constructor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="method">Training Method</Label>
                  <Select
                    value={trainingMethod}
                    onValueChange={(v) => {
                      const newMethod = v as TrainingMethod;
                      setTrainingMethod(newMethod);
                      setExamples([]);
                      setTrainingData('');
                      // Reset model to a compatible default if current model is incompatible
                      const compatibleModels = {
                        supervised: [
                          'gpt-4.1-2025-04-14',
                          'gpt-4.1-mini-2025-04-14',
                          'gpt-4.1-nano-2025-04-14',
                        ],
                        preference: [
                          'gpt-4.1-2025-04-14',
                          'gpt-4.1-mini-2025-04-14',
                          'gpt-4.1-nano-2025-04-14',
                        ],
                        reinforcement: ['o4-mini-2025-04-16'],
                      };
                      if (!compatibleModels[newMethod].includes(baseModel)) {
                        if (newMethod === 'reinforcement') {
                          setBaseModel('o4-mini-2025-04-16');
                        } else {
                          setBaseModel('gpt-4.1-mini-2025-04-14');
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervised">
                        Supervised (Chat Models)
                      </SelectItem>
                      <SelectItem value="preference">
                        Preference (DPO)
                      </SelectItem>
                      <SelectItem value="reinforcement">
                        Reinforcement (Reasoning Models)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {trainingMethod === 'supervised' &&
                      'For chat models with messages and optional tools'}
                    {trainingMethod === 'preference' &&
                      'For preference-based fine-tuning with preferred/non-preferred outputs'}
                    {trainingMethod === 'reinforcement' &&
                      'For reasoning models with reference answers'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="data">Training Data (JSONL format)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTrainingData(getExampleTemplate(trainingMethod));
                        parseTrainingData();
                      }}
                    >
                      Load Template
                    </Button>
                  </div>
                  <Textarea
                    id="data"
                    value={trainingData}
                    onChange={(e) => {
                      setTrainingData(e.target.value);
                      if (e.target.value.trim()) {
                        parseTrainingData();
                      } else {
                        setExamples([]);
                      }
                    }}
                    placeholder="Enter one JSON object per line (JSONL format)..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Each line should be a valid JSON object matching the
                    selected training method format
                  </p>
                </div>

                {examples.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">
                          {validCount} valid
                        </span>
                      </div>
                      {invalidCount > 0 && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-700">
                            {invalidCount} invalid
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="max-h-[600px] overflow-y-auto space-y-3">
                      {examples.map((ex, idx) => (
                        <TrainingExampleCard
                          key={ex.id}
                          example={ex}
                          index={idx}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    onClick={handleSaveToBlob}
                    disabled={saving || validCount === 0}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Save to Blob Storage
                      </>
                    )}
                  </Button>
                  {savedBlobUrl && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Saved!</span>
                      <a
                        href={savedBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View file
                      </a>
                    </div>
                  )}
                </div>

                {saveError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Kickoff Tab */}
          <TabsContent value="job" className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertTitle className="text-blue-900">Training Method</AlertTitle>
              <AlertDescription className="text-blue-800">
                Current method: <strong>{trainingMethod}</strong>. Make sure the
                selected base model is compatible with this method. Switch to
                the "Construct Training Data" tab to change the method.
              </AlertDescription>
            </Alert>
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle>Start Finetuning Job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="blob-url">
                    Training File URL (Blob Storage)
                  </Label>
                  <Input
                    id="blob-url"
                    value={jobBlobUrl}
                    onChange={(e) => setJobBlobUrl(e.target.value)}
                    placeholder="https://..."
                    className={
                      jobBlobUrl ? 'border-emerald-300 bg-emerald-50/50' : ''
                    }
                  />
                  {jobBlobUrl ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Auto-populated from fetched/learned data
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      URL from blob storage where training data is stored (JSONL
                      format)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base-model">Base Model</Label>
                    <Select value={baseModel} onValueChange={setBaseModel}>
                      <SelectTrigger id="base-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {trainingMethod === 'supervised' && (
                          <>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              gpt-4.1-2025-04-14 (SFT)
                            </SelectItem>
                            <SelectItem value="gpt-4.1-mini-2025-04-14">
                              gpt-4.1-mini-2025-04-14 (SFT)
                            </SelectItem>
                            <SelectItem value="gpt-4.1-nano-2025-04-14">
                              gpt-4.1-nano-2025-04-14 (SFT)
                            </SelectItem>
                          </>
                        )}
                        {trainingMethod === 'preference' && (
                          <>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              gpt-4.1-2025-04-14 (DPO)
                            </SelectItem>
                            <SelectItem value="gpt-4.1-mini-2025-04-14">
                              gpt-4.1-mini-2025-04-14 (DPO)
                            </SelectItem>
                            <SelectItem value="gpt-4.1-nano-2025-04-14">
                              gpt-4.1-nano-2025-04-14 (DPO)
                            </SelectItem>
                          </>
                        )}
                        {trainingMethod === 'reinforcement' && (
                          <SelectItem value="o4-mini-2025-04-16">
                            o4-mini-2025-04-16 (RFT)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {trainingMethod === 'supervised' &&
                        'Available for Supervised Fine-Tuning (SFT)'}
                      {trainingMethod === 'preference' &&
                        'Available for Direct Preference Optimization (DPO)'}
                      {trainingMethod === 'reinforcement' &&
                        'Available for Reinforcement Fine-Tuning (RFT)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="suffix">Suffix (optional)</Label>
                    <Input
                      id="suffix"
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      placeholder="my-custom-model"
                    />
                    <p className="text-xs text-slate-500">
                      Custom suffix for the model name
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label>Hyperparameters (optional)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="batch-size" className="text-xs">
                        Batch Size
                      </Label>
                      <Input
                        id="batch-size"
                        value={hyperparameters.batchSize}
                        onChange={(e) =>
                          setHyperparameters({
                            ...hyperparameters,
                            batchSize: e.target.value,
                          })
                        }
                        placeholder="auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lr-multiplier" className="text-xs">
                        Learning Rate Multiplier
                      </Label>
                      <Input
                        id="lr-multiplier"
                        value={hyperparameters.learningRateMultiplier}
                        onChange={(e) =>
                          setHyperparameters({
                            ...hyperparameters,
                            learningRateMultiplier: e.target.value,
                          })
                        }
                        placeholder="auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="n-epochs" className="text-xs">
                        N Epochs
                      </Label>
                      <Input
                        id="n-epochs"
                        value={hyperparameters.nEpochs}
                        onChange={(e) =>
                          setHyperparameters({
                            ...hyperparameters,
                            nEpochs: e.target.value,
                          })
                        }
                        placeholder="auto"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    onClick={handleStartJob}
                    disabled={startingJob || !jobBlobUrl.trim()}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {startingJob ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Finetuning Job
                      </>
                    )}
                  </Button>
                </div>

                {jobError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{jobError}</AlertDescription>
                  </Alert>
                )}

                {jobResult && (
                  <Alert className="bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-900">
                      Job Started Successfully
                    </AlertTitle>
                    <AlertDescription className="text-emerald-800">
                      <div className="mt-2 space-y-1">
                        <div>
                          <strong>Job ID:</strong> {jobResult.id}
                        </div>
                        <div>
                          <strong>Status:</strong> {jobResult.status}
                        </div>
                        {jobResult.model && (
                          <div>
                            <strong>Model:</strong> {jobResult.model}
                          </div>
                        )}
                        <div className="mt-3">
                          <a
                            href={`https://platform.openai.com/finetune/${jobResult.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline"
                          >
                            View job in OpenAI Dashboard →
                          </a>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
