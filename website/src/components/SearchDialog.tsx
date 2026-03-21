"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult, SearchResponse } from "@/types";

export default function SearchDialog({ model, docType = "tsrm" }: { model: string; docType?: "tsrm" | "ewd" }) {
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
      const searchModel = docType === "ewd" ? `${model}-ewd` : model;
      const url = `/api/search?q=${encodeURIComponent(q)}&model=${searchModel}`;
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
    router.push(`/${model}/${docType}/${section}/${page}`);
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
          fontFamily: "'Manrope', var(--font-manrope), sans-serif",
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "var(--color-text-muted)",
          background: "transparent",
          border: "1px solid var(--color-surface-highest)",
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
            color: "var(--color-text-faint)",
            background: "var(--color-surface-high)",
            border: "1px solid var(--color-surface-highest)",
            borderRadius: "3px",
          }}
        >
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "20vh" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setIsOpen(false)} />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "36rem",
          overflow: "hidden",
          background: "var(--color-surface-mid)",
          borderRadius: "12px",
          border: "1px solid var(--color-surface-highest)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          margin: "0 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          <svg style={{ width: "20px", height: "20px", color: "var(--color-text-faint)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search the manual..."
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              outline: "none",
              background: "transparent",
              color: "var(--color-text)",
              fontFamily: "'Manrope', var(--font-manrope), sans-serif",
              borderBottom: "2px solid transparent",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--color-secondary)"; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
          />
          {isLoading && (
            <svg style={{ width: "16px", height: "16px", color: "var(--color-text-faint)", animation: "spin 1s linear infinite", flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <kbd
            style={{
              marginLeft: "8px",
              padding: "2px 6px",
              fontSize: "12px",
              borderRadius: "3px",
              color: "var(--color-text-faint)",
              background: "var(--color-surface-high)",
              border: "1px solid var(--color-surface-highest)",
            }}
          >
            Esc
          </kbd>
        </div>

        <div style={{ maxHeight: "24rem", overflowY: "auto" }}>
          {/* Page Results */}
          {results.length > 0 && (
            <div style={{ padding: "8px 0" }}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {results.map((entry, i) => (
                  <li key={`page-${entry.id}`}>
                    <button
                      onClick={() => handleSelect(i)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 16px",
                        fontSize: "14px",
                        cursor: "pointer",
                        border: "none",
                        background: i === selectedIndex ? "var(--color-surface-high)" : "transparent",
                        borderLeft: i === selectedIndex ? "2px solid var(--color-secondary)" : "2px solid transparent",
                        color: "var(--color-text)",
                        fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        if (i !== selectedIndex) {
                          e.currentTarget.style.background = "var(--color-surface-high)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (i !== selectedIndex) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ flexShrink: 0, fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", color: "var(--color-secondary)", fontSize: "12px" }}>
                          {entry.section}-{entry.page}
                        </span>
                        <span style={{ color: "var(--color-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.title || entry.section_header || `Page ${entry.page}`}
                        </span>
                      </div>
                      {(entry.section_name || entry.content_text) && (
                        <div style={{ marginLeft: "4ch", marginTop: "2px" }}>
                          {entry.section_name && (
                            <span style={{ fontSize: "12px", color: "var(--color-text-faint)" }}>{entry.section_name}</span>
                          )}
                          {entry.content_text && (
                            <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            <p style={{ padding: "32px 16px", fontSize: "14px", textAlign: "center", color: "var(--color-text-muted)" }}>
              Searching...
            </p>
          )}

          {/* No results */}
          {!isLoading && query.length >= 2 && totalItems === 0 && !error && (
            <p style={{ padding: "32px 16px", fontSize: "14px", textAlign: "center", color: "var(--color-text-muted)" }}>
              No results found.
            </p>
          )}

          {/* Error state */}
          {error && (
            <p style={{ padding: "32px 16px", fontSize: "14px", textAlign: "center", color: "var(--color-tertiary)" }}>
              {error}
            </p>
          )}

          {/* View all results link */}
          {!isLoading && totalItems > 0 && docType === "tsrm" && (
            <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid var(--color-surface-highest)" }}>
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/${model}/tsrm/search?q=${encodeURIComponent(query)}`);
                }}
                className="text-sm font-medium"
                style={{ color: "var(--color-secondary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-primary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-secondary)"; }}
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
