'use client';

import { EmptyState } from '@/app/evals/components/EmptyState';
import { PromptContentViewer } from '@/app/evals/components/PromptContentViewer';
import { PromptDraftPanel } from '@/app/evals/components/PromptDraftPanel';
import { PromptUsageStats } from '@/app/evals/components/PromptUsageStats';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Brain,
  Calendar,
  ChevronRight,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Home,
  RefreshCw,
  Search,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface LangfusePrompt {
  name: string;
  version: number;
  type: string;
  labels: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  prompt?: string | object;
  config?: object;
}

interface LangfuseDataset {
  id: string;
  name: string;
  description?: string;
  metadata?: object;
  createdAt: string;
  updatedAt: string;
}

interface LangfuseResources {
  prompts: LangfusePrompt[];
  datasets: LangfuseDataset[];
}

interface FullPromptDetails extends LangfusePrompt {
  prompt: string | object;
}

interface DirectoryNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  prompt?: LangfusePrompt;
  children: Map<string, DirectoryNode>;
  promptCount: number;
}

interface ToolGroupInfo {
  key: string;
  description: string;
  toolCount: number;
  toolNames: string[];
}

export default function EvalsPage() {
  const [resources, setResources] = useState<LangfuseResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedPromptName, setSelectedPromptName] = useState<string | null>(
    null,
  );
  const [selectedPromptDetails, setSelectedPromptDetails] =
    useState<FullPromptDetails | null>(null);
  const [loadingPromptDetails, setLoadingPromptDetails] = useState(false);
  const [selectedDataset, setSelectedDataset] =
    useState<LangfuseDataset | null>(null);
  const [toolGroupMappings, setToolGroupMappings] = useState<
    Record<string, string>
  >({});
  const [selectedPromptToolGroup, setSelectedPromptToolGroup] =
    useState<ToolGroupInfo | null>(null);

  const fetchResources = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resourcesRes, toolGroupsRes] = await Promise.all([
        fetch('/api/langfuse/resources'),
        fetch('/api/langfuse/tool-groups'),
      ]);
      if (!resourcesRes.ok) throw new Error('Failed to fetch resources');
      const data = await resourcesRes.json();
      setResources(data);

      // Load tool group mappings
      if (toolGroupsRes.ok) {
        const toolData = await toolGroupsRes.json();
        setToolGroupMappings(toolData.promptMappings || {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPromptDetails = async (promptName: string) => {
    setLoadingPromptDetails(true);
    setSelectedPromptName(promptName);
    setPromptModalTab('view');
    setPromptStats(null);
    setSelectedPromptToolGroup(null);
    try {
      // Fetch prompt details and tool group info in parallel
      const [promptRes, toolGroupRes] = await Promise.all([
        fetch(`/api/langfuse/prompt/${encodeURIComponent(promptName)}`),
        fetch(
          `/api/langfuse/tool-groups?promptName=${encodeURIComponent(promptName)}`,
        ),
      ]);

      if (!promptRes.ok) throw new Error('Failed to fetch prompt details');
      const data = await promptRes.json();
      setSelectedPromptDetails(data);

      // Set tool group info if available
      if (toolGroupRes.ok) {
        const toolData = await toolGroupRes.json();
        if (toolData.hasTools && toolData.toolGroup) {
          setSelectedPromptToolGroup(toolData.toolGroup);
        }
      }

      // Also fetch stats in background for draft panel
      fetch(
        `/api/langfuse/prompt-stats/${encodeURIComponent(promptName)}?version=${data.version}`,
      )
        .then((res) => res.json())
        .then((stats) => {
          setPromptStats({
            traceIds: stats.traceIds || [],
            traceObservationPairs: stats.traceObservationPairs || [],
            evalReady: stats.evalReady ?? false,
          });
        })
        .catch(console.error);
    } catch (err) {
      console.error('Error fetching prompt details:', err);
      const basicPrompt = resources?.prompts.find((p) => p.name === promptName);
      if (basicPrompt)
        setSelectedPromptDetails(basicPrompt as FullPromptDetails);
    } finally {
      setLoadingPromptDetails(false);
    }
  };

  const closePromptModal = () => {
    setSelectedPromptName(null);
    setSelectedPromptDetails(null);
    setPromptStats(null);
    setPromptModalTab('view');
    setSelectedPromptToolGroup(null);
  };

  // Check if a prompt has tools by its name
  const promptHasTools = useCallback(
    (promptName: string): boolean => {
      return promptName in toolGroupMappings;
    },
    [toolGroupMappings],
  );

  // State for prompt modal tabs and stats
  const [promptModalTab, setPromptModalTab] = useState<
    'view' | 'draft' | 'stats'
  >('view');
  const [promptStats, setPromptStats] = useState<{
    traceIds: string[];
    traceObservationPairs?: Array<{
      traceId: string;
      observationId: string;
      output?: any;
    }>;
    evalReady: boolean;
  } | null>(null);

  const handleStatsLoaded = useCallback(
    (stats: {
      traceIds: string[];
      traceObservationPairs?: Array<{
        traceId: string;
        observationId: string;
        output?: any;
      }>;
      evalReady?: boolean;
    }) => {
      setPromptStats({
        traceIds: stats.traceIds,
        traceObservationPairs: stats.traceObservationPairs,
        evalReady: stats.evalReady ?? false,
      });
    },
    [],
  );

  useEffect(() => {
    fetchResources();
  }, []);

  const filteredPrompts = useMemo(() => {
    if (!resources?.prompts) return [];
    if (!searchQuery) return resources.prompts;
    return resources.prompts.filter(
      (prompt) =>
        prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.labels?.some((label) =>
          label.toLowerCase().includes(searchQuery.toLowerCase()),
        ) ||
        prompt.tags?.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );
  }, [resources?.prompts, searchQuery]);

  const filteredDatasets = useMemo(() => {
    if (!resources?.datasets) return [];
    if (!searchQuery) return resources.datasets;
    return resources.datasets.filter(
      (dataset) =>
        dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dataset.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [resources?.datasets, searchQuery]);

  const promptsByName = useMemo(() => {
    return filteredPrompts.reduce(
      (acc, prompt) => {
        if (!acc[prompt.name] || prompt.version > acc[prompt.name].version) {
          acc[prompt.name] = prompt;
        }
        return acc;
      },
      {} as Record<string, LangfusePrompt>,
    );
  }, [filteredPrompts]);

  const uniquePrompts = useMemo(
    () => Object.values(promptsByName),
    [promptsByName],
  );

  const directoryTree = useMemo(() => {
    const root: DirectoryNode = {
      name: 'root',
      fullPath: '',
      isFolder: true,
      children: new Map(),
      promptCount: 0,
    };

    for (const prompt of uniquePrompts) {
      const parts = prompt.name.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const fullPath = parts.slice(0, i + 1).join('/');

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            fullPath,
            isFolder: !isLast,
            prompt: isLast ? prompt : undefined,
            children: new Map(),
            promptCount: 0,
          });
        }

        const node = current.children.get(part)!;
        if (isLast && !node.isFolder) node.prompt = prompt;
        current = node;
      }
    }

    const countPrompts = (node: DirectoryNode): number => {
      if (!node.isFolder) return 1;
      let count = 0;
      for (const child of node.children.values()) {
        count += countPrompts(child);
      }
      node.promptCount = count;
      return count;
    };

    countPrompts(root);
    return root;
  }, [uniquePrompts]);

  const currentDirectory = useMemo(() => {
    let current = directoryTree;
    for (const part of currentPath) {
      const child = current.children.get(part);
      if (child && child.isFolder) current = child;
      else break;
    }
    return current;
  }, [directoryTree, currentPath]);

  const currentItems = useMemo(() => {
    const items = Array.from(currentDirectory.children.values());
    return items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentDirectory]);

  const navigateToFolder = (folderName: string) =>
    setCurrentPath([...currentPath, folderName]);
  const navigateToPath = (index: number) =>
    setCurrentPath(currentPath.slice(0, index));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const langfuseBaseUrl =
    process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL ||
    'https://us.cloud.langfuse.com';
  const langfuseProjectId = process.env.NEXT_PUBLIC_LANGFUSE_PROJECT_ID;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-12">
            <div className="h-10 w-64 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-lg animate-pulse mb-3" />
            <div className="h-5 w-96 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200/60 animate-pulse shadow-sm"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 border-rose-200/50 shadow-lg shadow-rose-100/50">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-rose-500" />
            </div>
            <CardTitle className="text-xl text-slate-800">
              Connection Error
            </CardTitle>
            <p className="text-rose-600/80 text-sm mt-1">{error}</p>
          </CardHeader>
          <div className="p-6 pt-0">
            <Button
              onClick={fetchResources}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-emerald-200/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-violet-200/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200/50">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Langfuse Resources
                </h1>
                <p className="text-slate-500 text-sm">
                  Manage your prompts and evaluation datasets
                </p>
              </div>
            </div>
            <Link href="/evals/finetune">
              <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg shadow-lg shadow-violet-200/50">
                <Brain className="w-4 h-4 mr-2" />
                Finetune a model
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search prompts and datasets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPath([]);
              }}
              className="pl-12 h-12 bg-white/80 backdrop-blur-sm border-slate-200/60 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="prompts" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1.5 rounded-xl shadow-sm">
            <TabsTrigger
              value="prompts"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all"
            >
              <FileText className="w-4 h-4 mr-2" />
              Prompts ({uniquePrompts.length})
            </TabsTrigger>
            <TabsTrigger
              value="datasets"
              className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg px-6 py-2.5 transition-all"
            >
              <Database className="w-4 h-4 mr-2" />
              Datasets ({filteredDatasets.length})
            </TabsTrigger>
          </TabsList>

          {/* Prompts Tab */}
          <TabsContent value="prompts" className="mt-6">
            {uniquePrompts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No prompts found"
                description={
                  searchQuery
                    ? 'Try adjusting your search query'
                    : 'Create your first prompt in Langfuse to get started'
                }
              />
            ) : (
              <div className="space-y-4">
                {/* Breadcrumbs */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-sm overflow-x-auto">
                    <button
                      onClick={() => setCurrentPath([])}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                        currentPath.length === 0
                          ? 'bg-violet-100 text-violet-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Home className="w-4 h-4" />
                      <span>Root</span>
                    </button>
                    {currentPath.map((part, index) => (
                      <div key={index} className="flex items-center">
                        <ChevronRight className="w-4 h-4 text-slate-400 mx-1" />
                        <button
                          onClick={() => navigateToPath(index + 1)}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${
                            index === currentPath.length - 1
                              ? 'bg-violet-100 text-violet-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {part}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Directory Contents */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                  {currentItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      This folder is empty
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {currentItems.map((item) => (
                        <div
                          key={item.fullPath}
                          onClick={() => {
                            if (item.isFolder) navigateToFolder(item.name);
                            else if (item.prompt)
                              fetchPromptDetails(item.prompt.name);
                          }}
                          className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${item.isFolder ? 'bg-amber-100' : 'bg-violet-100'}`}
                          >
                            {item.isFolder ? (
                              <FolderOpen className="w-5 h-5 text-amber-600" />
                            ) : (
                              <FileText className="w-5 h-5 text-violet-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate">
                                {item.name}
                              </span>
                              {item.isFolder && (
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {item.promptCount} prompt
                                  {item.promptCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {!item.isFolder &&
                                item.prompt &&
                                promptHasTools(item.prompt.name) && (
                                  <Badge className="text-xs font-medium border-0 bg-blue-100 text-blue-700 flex items-center gap-1">
                                    <Wrench className="w-3 h-3" />
                                    Tools
                                  </Badge>
                                )}
                            </div>
                            {!item.isFolder &&
                              item.prompt?.labels &&
                              item.prompt.labels.length > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  {item.prompt.labels
                                    .slice(0, 3)
                                    .map((label) => (
                                      <Badge
                                        key={label}
                                        className={`text-xs font-medium border-0 ${
                                          label === 'production'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : label === 'staging'
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {label}
                                      </Badge>
                                    ))}
                                </div>
                              )}
                          </div>

                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Datasets Tab */}
          <TabsContent value="datasets" className="mt-6">
            {filteredDatasets.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No datasets found"
                description={
                  searchQuery
                    ? 'Try adjusting your search query'
                    : 'Create your first dataset in Langfuse to get started'
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDatasets.map((dataset, index) => (
                  <Card
                    key={dataset.id}
                    className="group bg-white/90 backdrop-blur-sm border-slate-200/60 hover:border-emerald-300/60 hover:shadow-xl hover:shadow-emerald-100/30 transition-all duration-300 cursor-pointer rounded-xl overflow-hidden"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => setSelectedDataset(dataset)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Database className="w-5 h-5 text-emerald-600" />
                          </div>
                          <CardTitle className="text-base font-semibold text-slate-900 truncate">
                            {dataset.name}
                          </CardTitle>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {dataset.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                          {dataset.description}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {formatDate(dataset.createdAt)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Prompt Modal */}
        <Dialog open={!!selectedPromptName} onOpenChange={closePromptModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-white/95 backdrop-blur-md border-slate-200/60 rounded-2xl">
            <DialogHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-violet-200 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-violet-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl font-semibold text-slate-900 truncate">
                    {selectedPromptName}
                  </DialogTitle>
                  {selectedPromptDetails && (
                    <DialogDescription className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="bg-violet-100 text-violet-700 border-0"
                      >
                        Version {selectedPromptDetails.version}
                      </Badge>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">
                        {selectedPromptDetails.type}
                      </span>
                      {selectedPromptToolGroup && (
                        <>
                          <span className="text-slate-400">•</span>
                          <Badge className="text-xs font-medium border-0 bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {selectedPromptToolGroup.toolCount} Tools
                          </Badge>
                        </>
                      )}
                      {selectedPromptDetails.labels &&
                        selectedPromptDetails.labels.length > 0 && (
                          <>
                            <span className="text-slate-400">•</span>
                            {selectedPromptDetails.labels.map((label) => (
                              <Badge
                                key={label}
                                className={`text-xs font-medium border-0 ${
                                  label === 'production'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : label === 'staging'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {label}
                              </Badge>
                            ))}
                          </>
                        )}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>

            {loadingPromptDetails ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
              </div>
            ) : selectedPromptDetails ? (
              <>
                {/* Top-level tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mt-4">
                  <button
                    onClick={() => setPromptModalTab('view')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      promptModalTab === 'view'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    View Prompt
                  </button>
                  <button
                    onClick={() => setPromptModalTab('draft')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      promptModalTab === 'draft'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    Draft & Eval
                  </button>
                  <button
                    onClick={() => setPromptModalTab('stats')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      promptModalTab === 'stats'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Usage Stats
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto py-4">
                  {promptModalTab === 'view' && (
                    <div className="space-y-4">
                      {/* Tool Group Info Panel */}
                      {selectedPromptToolGroup && (
                        <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Wrench className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-blue-900">
                                Tool-Calling Prompt
                              </h4>
                              <p className="text-xs text-blue-600">
                                Uses {selectedPromptToolGroup.toolCount} tools
                                from registry
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-blue-800 mb-2">
                            <span className="font-medium">Tool Group:</span>{' '}
                            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">
                              {selectedPromptToolGroup.key}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPromptToolGroup.toolNames.map(
                              (toolName) => (
                                <span
                                  key={toolName}
                                  className="text-xs bg-white/80 border border-blue-200 text-blue-700 px-2 py-1 rounded-md font-mono"
                                >
                                  {toolName}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {/* Prompt Content */}
                      {selectedPromptDetails.prompt && (
                        <PromptContentViewer
                          prompt={selectedPromptDetails.prompt}
                        />
                      )}
                    </div>
                  )}

                  {promptModalTab === 'draft' && (
                    <PromptDraftPanel
                      promptName={selectedPromptDetails.name}
                      promptVersion={selectedPromptDetails.version}
                      promptContent={selectedPromptDetails.prompt || ''}
                      traceIds={promptStats?.traceIds || []}
                      traceObservationPairs={
                        promptStats?.traceObservationPairs || []
                      }
                      evalReady={promptStats?.evalReady ?? false}
                    />
                  )}

                  {promptModalTab === 'stats' && (
                    <PromptUsageStats
                      promptName={selectedPromptDetails.name}
                      promptVersion={selectedPromptDetails.version}
                      onStatsLoaded={handleStatsLoaded}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-8 text-slate-500">
                Failed to load prompt details
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={closePromptModal}
                className="rounded-lg"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (!langfuseProjectId) {
                    alert('NEXT_PUBLIC_LANGFUSE_PROJECT_ID environment variable is not set');
                    return;
                  }
                  window.open(
                    `${langfuseBaseUrl}/project/${langfuseProjectId}/prompts/${encodeURIComponent(selectedPromptName || '')}`,
                    '_blank',
                  );
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
                disabled={!langfuseProjectId}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Langfuse
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dataset Modal */}
        <Dialog
          open={!!selectedDataset}
          onOpenChange={() => setSelectedDataset(null)}
        >
          <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-md border-slate-200/60 rounded-2xl">
            <DialogHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-slate-900">
                    {selectedDataset?.name}
                  </DialogTitle>
                  {selectedDataset?.description && (
                    <DialogDescription className="text-slate-500 mt-1">
                      {selectedDataset.description}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                  Dataset ID
                </p>
                <p className="text-sm text-slate-700 font-mono">
                  {selectedDataset?.id}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Created
                  </p>
                  <p className="text-sm text-slate-700 font-medium">
                    {selectedDataset && formatDate(selectedDataset.createdAt)}
                  </p>
                </div>
                <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Updated
                  </p>
                  <p className="text-sm text-slate-700 font-medium">
                    {selectedDataset && formatDate(selectedDataset.updatedAt)}
                  </p>
                </div>
              </div>
              {selectedDataset?.metadata &&
                Object.keys(selectedDataset.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      Custom Metadata
                    </h4>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                        {JSON.stringify(selectedDataset.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedDataset(null)}
                className="rounded-lg"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (!langfuseProjectId) {
                    alert('NEXT_PUBLIC_LANGFUSE_PROJECT_ID environment variable is not set');
                    return;
                  }
                  window.open(
                    `${langfuseBaseUrl}/project/${langfuseProjectId}/datasets/${selectedDataset?.id}`,
                    '_blank',
                  );
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                disabled={!langfuseProjectId}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Langfuse
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
