"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SearchResult, FAQResult, ForumResult, SearchResponse } from "@/types";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [faqs, setFaqs] = useState<FAQResult[]>([]);
  const [forum, setForum] = useState<ForumResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    abortRef.current?.abort();

    if (q.length < 2) {
      setResults([]);
      setFaqs([]);
      setForum([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search request failed");
      const data: SearchResponse = await res.json();
      if (!controller.signal.aborted) {
        setFaqs(data.faqs ?? []);
        setResults(data.results ?? []);
        setForum(data.forum ?? []);
        setIsLoading(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError("Search is temporarily unavailable");
        setResults([]);
        setFaqs([]);
        setForum([]);
        setIsLoading(false);
      }
    }
  }, []);

  // Search on initial load if query param present
  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      fetchResults(initialQuery.trim());
    }
    if (initialQuery) {
      inputRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setFaqs([]);
      setForum([]);
      setIsLoading(false);
      setError(null);
      router.replace("/search");
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      router.replace(`/search?q=${encodeURIComponent(value.trim())}`);
      fetchResults(value.trim());
    }, 300);
  };

  const hasQuery = query.trim().length >= 2;
  const manualCount = faqs.length + results.length;
  const forumCount = forum.length;

  // Empty state — no query
  if (!hasQuery && !isLoading) {
    return (
      <div>
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
        />
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg">Search the TSRM manual and community forum</p>
          <p className="text-sm mt-1">Enter at least 2 characters to search</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={handleInputChange}
        isLoading={isLoading}
      />

      {error && (
        <p className="text-sm text-red-500 text-center py-8">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left column — TSRM Manual */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">TSRM Manual</h2>
            {isLoading ? (
              <Spinner />
            ) : (
              <span className="text-sm text-gray-500">
                {manualCount} result{manualCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* FAQ results */}
          {faqs.map((faq) => (
            <button
              key={`faq-${faq.id}`}
              onClick={() => router.push(`/${faq.section}/${faq.page}`)}
              className="w-full text-left border border-gray-200 rounded-lg p-4 mb-3 hover:border-red-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-500 shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{faq.question}</div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{faq.answer}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      {faq.section}-{faq.page}
                    </span>
                    {faq.section_name && (
                      <span className="text-xs text-gray-400">{faq.section_name}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* Manual page results */}
          {results.map((entry) => (
            <button
              key={`page-${entry.id}`}
              onClick={() => router.push(`/${entry.section}/${entry.page}`)}
              className="w-full text-left border border-gray-200 rounded-lg p-4 mb-3 hover:border-red-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                  {entry.section}-{entry.page}
                </span>
                <span className="font-medium text-gray-900 truncate">
                  {entry.title || entry.section_header || `Page ${entry.page}`}
                </span>
              </div>
              {entry.section_name && (
                <p className="text-xs text-gray-400 mt-1">{entry.section_name}</p>
              )}
              {entry.content_text && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{entry.content_text}</p>
              )}
            </button>
          ))}

          {/* No results */}
          {!isLoading && manualCount === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-8">No manual results found</p>
          )}

          {/* Loading placeholder */}
          {isLoading && manualCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Searching...</p>
          )}
        </div>

        {/* Right column — Community Forum */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Community Forum</h2>
            {isLoading ? (
              <Spinner />
            ) : (
              <span className="text-sm text-gray-500">
                {forumCount} result{forumCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {forum.map((thread) => (
            <a
              key={`forum-${thread.id}`}
              href={thread.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-gray-200 rounded-lg p-4 mb-3 hover:border-red-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-700 rounded shrink-0 mt-0.5">
                  Forum
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-900">{thread.title}</span>
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  {thread.issue_summary && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.issue_summary}</p>
                  )}
                  {thread.fix_summary && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                      <span className="font-medium">Fix:</span> {thread.fix_summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {thread.is_resolved && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Resolved
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{thread.reply_count} replies</span>
                    {thread.author && (
                      <span className="text-xs text-gray-400">by {thread.author}</span>
                    )}
                    {thread.thread_type && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {thread.thread_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}

          {/* No results */}
          {!isLoading && forumCount === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-8">No forum results found</p>
          )}

          {/* Loading placeholder */}
          {isLoading && forumCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Searching...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

import { forwardRef } from "react";

const SearchInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; isLoading?: boolean }
>(function SearchInput({ value, onChange, isLoading }, ref) {
  return (
    <div className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search the TSRM manual and community forum..."
        className="w-full pl-12 pr-12 py-3 text-base border border-gray-300 rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
      />
      {isLoading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Spinner />
        </div>
      )}
    </div>
  );
});

function Spinner() {
  return (
    <svg className="w-4 h-4 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// --- Page wrapper with Suspense ---

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Spinner />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
