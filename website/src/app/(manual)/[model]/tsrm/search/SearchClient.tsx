"use client";

import { useState, useEffect, useRef, useCallback, Suspense, forwardRef } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import type { SearchResult, SearchResponse } from "@/types";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams<{ model: string }>();
  const model = params.model;
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
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
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&model=${model}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search request failed");
      const data: SearchResponse = await res.json();
      if (!controller.signal.aborted) {
        setResults(data.results ?? []);
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
  }, [model]);

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
      setIsLoading(false);
      setError(null);
      router.replace(`/${model}/tsrm/search`);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      router.replace(`/${model}/tsrm/search?q=${encodeURIComponent(value.trim())}`);
      fetchResults(value.trim());
    }, 300);
  };

  const hasQuery = query.trim().length >= 2;
  const resultCount = results.length;

  // Empty state — no query
  if (!hasQuery && !isLoading) {
    return (
      <div>
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
        />
        <div className="flex flex-col items-center justify-center py-24" style={{ color: "var(--color-text-faint)" }}>
          <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg" style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}>Search the TSRM manual</p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Enter at least 2 characters to search</p>
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
        <p className="text-sm text-center py-8" style={{ color: "var(--color-tertiary)" }}>{error}</p>
      )}

      <div className="mt-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}>TSRM Manual</h2>
            {isLoading ? (
              <Spinner />
            ) : (
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {resultCount} result{resultCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Manual page results */}
          {results.map((entry) => (
            <button
              key={`page-${entry.id}`}
              onClick={() => router.push(`/${model}/tsrm/${entry.section}/${entry.page}`)}
              className="w-full text-left rounded-lg p-4 mb-3 transition-all"
              style={{
                background: "var(--color-surface-low)",
                border: "1px solid var(--color-surface-highest)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--color-secondary)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 241, 253, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--color-surface-highest)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: "var(--color-secondary)",
                    background: "rgba(0, 241, 253, 0.1)",
                  }}
                >
                  {entry.section}-{entry.page}
                </span>
                <span className="font-medium truncate" style={{ color: "var(--color-text)" }}>
                  {entry.title || entry.section_header || `Page ${entry.page}`}
                </span>
              </div>
              {entry.section_name && (
                <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>{entry.section_name}</p>
              )}
              {entry.content_text && (
                <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>{entry.content_text}</p>
              )}
            </button>
          ))}

          {/* No results */}
          {!isLoading && resultCount === 0 && !error && (
            <p className="text-sm text-center py-8" style={{ color: "var(--color-text-faint)" }}>No results found</p>
          )}

          {/* Loading placeholder */}
          {isLoading && resultCount === 0 && (
            <p className="text-sm text-center py-8" style={{ color: "var(--color-text-faint)" }}>Searching...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

const SearchInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; isLoading?: boolean }
>(function SearchInput({ value, onChange, isLoading }, ref) {
  return (
    <div className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
        style={{ color: "var(--color-text-faint)" }}
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
        placeholder="Search the TSRM manual..."
        className="w-full pl-12 pr-12 py-3 text-base rounded-lg outline-none transition-colors"
        style={{
          background: "var(--color-surface-low)",
          border: "1px solid var(--color-surface-highest)",
          borderBottom: "2px solid var(--color-surface-highest)",
          color: "var(--color-text)",
          fontFamily: "'Manrope', var(--font-manrope), sans-serif",
        }}
        onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--color-secondary)"; }}
        onBlur={(e) => { e.currentTarget.style.borderBottomColor = "var(--color-surface-highest)"; }}
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
    <svg className="w-4 h-4 animate-spin" style={{ color: "var(--color-text-faint)" }} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// --- Page wrapper with Suspense ---

export default function SearchClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24" style={{ color: "var(--color-text-faint)" }}>
          <Spinner />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
