"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult, SearchResponse } from "@/types";

export default function SearchDialog({ model }: { model: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const totalItems = results.length;

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
      setSelectedIndex(0);
      setError(null);
    }
  }, [isOpen]);

  const fetchResults = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();

    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&model=${model}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error("Search request failed");
      }
      const data: SearchResponse = await res.json();
      if (!controller.signal.aborted) {
        setResults(data.results ?? []);
        setSelectedIndex(0);
        setIsLoading(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError("Search is temporarily unavailable");
        setResults([]);
        setIsLoading(false);
      }
    }
  }, []);

  const search = useCallback(
    (q: string) => {
      setQuery(q);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      debounceRef.current = setTimeout(() => fetchResults(q.trim()), 250);
    },
    [fetchResults]
  );

  const navigateToPage = (section: string, page: number) => {
    setIsOpen(false);
    router.push(`/${model}/tsrm/${section}/${page}`);
  };

  const handleSelect = (index: number) => {
    const result = results[index];
    if (result) navigateToPage(result.section, result.page);
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
          color: "var(--color-tan)",
          background: "transparent",
          border: "1px solid var(--color-brown-dark)",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        SEARCH
        <kbd
          className="hidden md:inline"
          style={{
            padding: "1px 6px",
            fontSize: "10px",
            color: "var(--color-brown)",
            background: "var(--color-dark-border)",
            border: "1px solid var(--color-brown-dark)",
            borderRadius: "3px",
          }}
        >
          Ctrl+K
        </kbd>
      </button>
    );
  }

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

        <div className="max-h-96 overflow-y-auto">
          {/* Page Results */}
          {results.length > 0 && (
            <div className="py-2">
              <ul>
                {results.map((entry, i) => (
                  <li key={`page-${entry.id}`}>
                    <button
                      onClick={() => handleSelect(i)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        i === selectedIndex ? "bg-red-50 text-red-900" : ""
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
                ))}
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
                  router.push(`/${model}/tsrm/search?q=${encodeURIComponent(query)}`);
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
