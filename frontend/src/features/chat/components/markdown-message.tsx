"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatSource } from "../types/chat-types";

interface MarkdownMessageProps {
  content: string;
  sources?: ChatSource[];
  onSourceClick?: (source: ChatSource) => void;
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function removeInlineCitations(content: string): string {
  return content
    .replace(/\[【来源：[^】]+】\]\([^)]*\)/g, "")
    .replace(/【来源：[^】]+】/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function citedSources(content: string, sources: ChatSource[]): ChatSource[] {
  const cited = sources.filter((source) => (
    content.includes(`【来源：${source.sourceId}】`) || content.includes(`【来源：${source.fileName}】`)
  ));
  const unique = new Map<number, ChatSource>();
  cited.forEach((source) => unique.set(source.documentId, source));
  return [...unique.values()];
}

function isSafeExternalUrl(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, "https://mindbridge.invalid");
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  return (
    <div className={`mindbridge-markdown ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-bold leading-8">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold leading-7">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold leading-6">{children}</h3>,
          p: ({ children }) => <p className="my-2 leading-7">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-teal-300 bg-teal-50 px-4 py-2 text-slate-700">{children}</blockquote>,
          hr: () => <hr className="my-4 border-slate-200" />,
          table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>,
          code: ({ className: codeClassName, children }) => <code className={`mindbridge-inline-code ${codeClassName ?? ""}`}>{children}</code>,
          pre: ({ children }) => <pre className="my-3 max-w-full overflow-x-auto rounded-md bg-slate-900 p-4 text-sm leading-6 text-slate-100">{children}</pre>,
          a: ({ href, children }) => isSafeExternalUrl(href) ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline underline-offset-2">{children}</a> : <span>{children}</span>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownMessage({ content, sources = [], onSourceClick }: MarkdownMessageProps) {
  const availableSources = citedSources(content, sources);
  return (
    <>
      <MarkdownContent content={removeInlineCitations(content)} />
      {availableSources.length ? (
        <div className="mt-3 border-t border-slate-200 pt-2 text-sm">
          <span className="text-slate-500">来源：</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {availableSources.map((source) => (
              <button key={source.documentId} type="button" className="text-teal-700 underline underline-offset-2 disabled:text-slate-400" onClick={() => onSourceClick?.(source)} disabled={!onSourceClick}>
                {source.fileName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
