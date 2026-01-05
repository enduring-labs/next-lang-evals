'use client';

import { Code, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Dynamic import to avoid SSR issues with react-markdown
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

// Chat message type for structured prompts
export interface ChatMessage {
  role: string;
  content: string;
}

// Extract text content from various prompt formats
export function extractPromptContent(prompt: string | object): {
  text: string;
  messages?: ChatMessage[];
} {
  if (typeof prompt === 'string') {
    return { text: prompt };
  }

  // Handle chat-type prompts (array of messages)
  if (Array.isArray(prompt)) {
    const messages = prompt as ChatMessage[];
    const text = messages
      .map((m) => `**[${m.role.toUpperCase()}]**\n\n${m.content}`)
      .join('\n\n---\n\n');
    return { text, messages };
  }

  // Handle object with prompt field
  if (
    'prompt' in prompt &&
    typeof (prompt as { prompt: string }).prompt === 'string'
  ) {
    return { text: (prompt as { prompt: string }).prompt };
  }

  // Fallback to JSON
  return { text: JSON.stringify(prompt, null, 2) };
}

type ViewMode = 'formatted' | 'raw';

// Markdown components configuration
export const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-bold text-slate-800 mt-3 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-bold text-slate-700 mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm text-slate-700 mb-2 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside text-sm text-slate-700 mb-2 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside text-sm text-slate-700 mb-2 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm text-slate-700">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-slate-600">{children}</em>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono text-violet-700">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto my-2">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-violet-300 pl-4 italic text-slate-600 my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-slate-200 my-4" />,
};

interface PromptContentViewerProps {
  prompt: string | object;
  defaultViewMode?: ViewMode;
}

export function PromptContentViewer({
  prompt,
  defaultViewMode = 'formatted',
}: PromptContentViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const { text, messages } = extractPromptContent(prompt);

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('formatted')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            viewMode === 'formatted'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Formatted
        </button>
        <button
          onClick={() => setViewMode('raw')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            viewMode === 'raw'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          Raw
        </button>
      </div>

      {/* Raw view */}
      {viewMode === 'raw' && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 max-h-[500px] overflow-auto">
          <pre className="text-sm text-slate-100 whitespace-pre-wrap font-mono">
            {typeof prompt === 'string'
              ? prompt
              : JSON.stringify(prompt, null, 2)}
          </pre>
        </div>
      )}

      {/* Formatted view */}
      {viewMode === 'formatted' &&
        (messages ? (
          <div className="space-y-4 max-h-[500px] overflow-auto">
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
        ) : (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-[500px] overflow-auto prose prose-sm prose-slate max-w-none">
            <ReactMarkdown components={markdownComponents as any}>
              {text}
            </ReactMarkdown>
          </div>
        ))}
    </div>
  );
}
