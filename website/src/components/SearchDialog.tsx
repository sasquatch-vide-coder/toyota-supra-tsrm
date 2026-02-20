"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult, FAQResult, SearchResponse } from "@/types";

type SourceFilter = "all" | "manual" | "faq";

export default function SearchDialog({ model }: { model: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [faqs, setFaqs] = useState<FAQResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SourceFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const totalItems = faqs.length + results.length;

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setResults([]);
      setFaqs([]);
      setSelectedIndex(0);
      setError(null);
      setActiveFilter("all");
    }
  }, [isOpen]);

  const fetchResults = useCallback(async (q: string, filter: SourceFilter) => {
    // Cancel any in-flight request
    abortRef.current?.abort();

    if (q.length < 2) {
      setResults([]);
      setFaqs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      let url = `/api/search?q=${encodeURIComponent(q)}&model=${model}`;
      if (filter !== "all") {
        url += `&source=${filter}`;
      }
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error("Search request failed");
      }
      const data: SearchResponse = await res.json();
      if (!controller.signal.aborted) {
        setFaqs(data.faqs ?? []);
        setResults(data.results ?? []);
        setSelectedIndex(0);
        setIsLoading(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError("Search is temporarily unavailable");
        setResults([]);
        setFaqs([]);
        setIsLoading(false);
      }
    }
  }, []);

  const search = useCallback(
    (q: string, filter?: SourceFilter) => {
      const f = filter ?? activeFilter;
      setQuery(q);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setFaqs([]);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      debounceRef.current = setTimeout(() => fetchResults(q.trim(), f), 250);
    },
    [fetchResults, activeFilter]
  );

  const handleFilterChange = (filter: SourceFilter) => {
    setActiveFilter(filter);
    if (query.trim().length >= 2) {
      search(query, filter);
    }
  };

  const navigateToPage = (section: string, page: number) => {
    setIsOpen(false);
    router.push(`/${model}/${section}/${page}`);
  };

  const handleSelect = (index: number) => {
    if (index < faqs.length) {
      const faq = faqs[index];
      navigateToPage(faq.section, faq.page);
    } else {
      const result = results[index - faqs.length];
      if (result) navigateToPage(result.section, result.page);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && totalItems > 0) {
      handleSelect(selectedIndex);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 12px",
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "#8B7355",
          background: "transparent",
          border: "1px solid #3A2A1A",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        SEARCH
        <kbd
          style={{
            padding: "1px 6px",
            fontSize: "10px",
            color: "#4A3A2A",
            background: "#2A2A2A",
            border: "1px solid #3A2A1A",
            borderRadius: "3px",
          }}
        >
          Ctrl+K
        </kbd>
      </button>
    );
  }

  const filterButtons: { key: SourceFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "manual", label: "Manual" },
    { key: "faq", label: "FAQ" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center px-4 border-b border-gray-200">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search the manual..."
            className="w-full px-3 py-3 text-sm outline-none"
          />
          {isLoading && (
            <svg className="w-4 h-4 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <kbd className="ml-2 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded">
            Esc
          </kbd>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100">
          {filterButtons.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                activeFilter === f.key
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* FAQ Results */}
          {faqs.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Quick Answers
              </div>
              <ul>
                {faqs.map((faq, i) => (
                  <li key={`faq-${faq.id}`}>
                    <button
                      onClick={() => handleSelect(i)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${
                        i === selectedIndex ? "bg-red-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-amber-500 shrink-0">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{faq.question}</div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {faq.answer}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-red-600">
                              {faq.section}-{faq.page}
                            </span>
                            {faq.section_name && (
                              <span className="text-xs text-gray-400">{faq.section_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Page Results */}
          {results.length > 0 && (
            <div className="py-2">
              {faqs.length > 0 && (
                <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100">
                  Manual Pages
                </div>
              )}
              <ul>
                {results.map((entry, i) => {
                  const itemIndex = faqs.length + i;
                  return (
                    <li key={`page-${entry.id}`}>
                      <button
                        onClick={() => handleSelect(itemIndex)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          itemIndex === selectedIndex ? "bg-red-50 text-red-900" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-red-600 shrink-0">
                            {entry.section}-{entry.page}
                          </span>
                          <span className="font-medium truncate">
                            {entry.title || entry.section_header || `Page ${entry.page}`}
                          </span>
                        </div>
                        {(entry.section_name || entry.content_text) && (
                          <div className="ml-[calc(3ch+0.5rem)] mt-0.5">
                            {entry.section_name && (
                              <span className="text-xs text-gray-400">{entry.section_name}</span>
                            )}
                            {entry.content_text && (
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                {entry.content_text}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Loading state */}
          {isLoading && totalItems === 0 && query.length >= 2 && (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">
              Searching...
            </p>
          )}

          {/* No results */}
          {!isLoading && query.length >= 2 && totalItems === 0 && !error && (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">
              No results found.
            </p>
          )}

          {/* Error state */}
          {error && (
            <p className="px-4 py-8 text-sm text-red-500 text-center">
              {error}
            </p>
          )}

          {/* View all results link */}
          {!isLoading && totalItems > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/${model}/search?q=${encodeURIComponent(query)}`);
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                View all results →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
