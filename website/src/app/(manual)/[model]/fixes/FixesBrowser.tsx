"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import FixCard from "@/components/FixCard";
import type { FixCardData } from "@/components/FixCard";

interface FixesBrowserProps {
  model: string;
  fixes: FixCardData[];
  categories: { category: string; fix_count: number }[];
  totalFixes: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  currentCategory: string;
  currentSort: string;
  currentQuery: string;
}

export default function FixesBrowser({
  model,
  fixes,
  categories,
  totalFixes,
  totalCount,
  totalPages,
  currentPage,
  currentCategory,
  currentSort,
  currentQuery,
}: FixesBrowserProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(currentQuery);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        q: currentQuery,
        category: currentCategory,
        sort: currentSort,
        page: String(currentPage),
        ...overrides,
      };
      if (merged.q) params.set("q", merged.q);
      if (merged.category) params.set("category", merged.category);
      if (merged.sort && merged.sort !== "confidence") params.set("sort", merged.sort);
      if (merged.page !== "1") params.set("page", merged.page);
      const qs = params.toString();
      return `/${model}/fixes${qs ? `?${qs}` : ""}`;
    },
    [model, currentQuery, currentCategory, currentSort, currentPage]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ q: searchInput, page: "1" }));
  };

  const handleCategoryClick = (cat: string) => {
    router.push(buildUrl({ category: cat === currentCategory ? "" : cat, page: "1" }));
  };

  const handleSortClick = (sort: string) => {
    router.push(buildUrl({ sort, page: "1" }));
  };

  const sortOptions = [
    { key: "confidence", label: "Confidence" },
    { key: "newest", label: "Newest" },
    { key: "category", label: "Category" },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontWeight: 900, fontSize: "28px", letterSpacing: "0.05em",
          color: "var(--color-text)", marginBottom: "6px",
        }}>
          Community Fixes
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          Verified repair solutions from SupraForums &mdash;{" "}
          <span style={{
            color: "var(--color-secondary)",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
          }}>
            {totalFixes} fixes
          </span>{" "}
          extracted from MKIII threads
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        display: "flex", alignItems: "center", gap: "12px",
        marginBottom: "24px", padding: "12px 20px",
        background: "var(--color-surface-low)",
        border: "1px solid var(--color-surface-highest)", borderRadius: "2px",
      }}>
        <span style={{ color: "var(--color-text-faint)", fontSize: "18px" }}>&#x1F50D;</span>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search fixes... (e.g. 'rough idle', 'boost leak', 'no start')"
          style={{
            flex: 1, background: "none", border: "none",
            color: "var(--color-text)", fontFamily: "'Manrope', var(--font-manrope), sans-serif",
            fontSize: "14px", outline: "none",
          }}
        />
        {currentQuery && (
          <button
            type="button"
            onClick={() => { setSearchInput(""); router.push(buildUrl({ q: "", page: "1" })); }}
            style={{
              background: "none", border: "none", color: "var(--color-text-faint)",
              cursor: "pointer", fontSize: "14px", padding: "4px",
            }}
          >
            Clear
          </button>
        )}
      </form>

      <div style={{ display: "flex", gap: "28px" }}>
        {/* Category sidebar */}
        <div style={{ width: "220px", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-text-faint)", marginBottom: "12px",
          }}>
            Categories
          </div>
          {/* All Fixes */}
          <div
            onClick={() => handleCategoryClick("")}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: "2px", cursor: "pointer",
              fontSize: "13px", fontWeight: 500, marginBottom: "2px",
              color: !currentCategory ? "var(--color-secondary)" : "var(--color-text-muted)",
              background: !currentCategory ? "rgba(0, 241, 253, 0.05)" : "transparent",
              borderLeft: !currentCategory ? "3px solid var(--color-secondary)" : "3px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <span>All Fixes</span>
            <span style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontWeight: 700, fontSize: "11px",
              background: !currentCategory ? "rgba(0, 241, 253, 0.15)" : "var(--color-surface-mid)",
              color: !currentCategory ? "var(--color-secondary)" : "var(--color-text-faint)",
              padding: "2px 8px", borderRadius: "9999px",
            }}>
              {totalFixes}
            </span>
          </div>
          {categories.map((cat) => (
            <div
              key={cat.category}
              onClick={() => handleCategoryClick(cat.category)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: "2px", cursor: "pointer",
                fontSize: "13px", fontWeight: 500, marginBottom: "2px",
                color: currentCategory === cat.category ? "var(--color-secondary)" : "var(--color-text-muted)",
                background: currentCategory === cat.category ? "rgba(0, 241, 253, 0.05)" : "transparent",
                borderLeft: currentCategory === cat.category ? "3px solid var(--color-secondary)" : "3px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span>{cat.category}</span>
              <span style={{
                fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                fontWeight: 700, fontSize: "11px",
                background: currentCategory === cat.category ? "rgba(0, 241, 253, 0.15)" : "var(--color-surface-mid)",
                color: currentCategory === cat.category ? "var(--color-secondary)" : "var(--color-text-faint)",
                padding: "2px 8px", borderRadius: "9999px",
              }}>
                {cat.fix_count}
              </span>
            </div>
          ))}
        </div>

        {/* Fix cards */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Sort bar */}
          {!currentQuery && (
            <div style={{
              display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px",
              fontSize: "12px", color: "var(--color-text-faint)",
            }}>
              <span>Sort by:</span>
              {sortOptions.map((opt) => (
                <span
                  key={opt.key}
                  onClick={() => handleSortClick(opt.key)}
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontWeight: 600, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "4px 10px", borderRadius: "2px", cursor: "pointer",
                    transition: "all 0.15s",
                    color: currentSort === opt.key ? "var(--color-secondary)" : "var(--color-text-faint)",
                    background: currentSort === opt.key ? "rgba(0, 241, 253, 0.08)" : "transparent",
                  }}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          )}

          {/* Results */}
          {fixes.length === 0 ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: "200px", color: "var(--color-text-muted)", fontSize: "14px",
            }}>
              {currentQuery
                ? `No fixes found for "${currentQuery}"`
                : "No community fixes available yet"}
            </div>
          ) : (
            fixes.map((fix) => (
              <FixCard key={fix.thread_id} fix={fix} model={model} />
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: "16px", padding: "24px 0",
            }}>
              {currentPage > 1 && (
                <button
                  onClick={() => router.push(buildUrl({ page: String(currentPage - 1) }))}
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontWeight: 600, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "8px 16px", borderRadius: "2px", cursor: "pointer",
                    background: "var(--color-surface-low)", border: "1px solid var(--color-surface-highest)",
                    color: "var(--color-text-muted)", transition: "all 0.15s",
                  }}
                >
                  &larr; Previous
                </button>
              )}
              <span style={{
                fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                fontSize: "12px", color: "var(--color-text-faint)",
              }}>
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <button
                  onClick={() => router.push(buildUrl({ page: String(currentPage + 1) }))}
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontWeight: 600, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "8px 16px", borderRadius: "2px", cursor: "pointer",
                    background: "var(--color-surface-low)", border: "1px solid var(--color-surface-highest)",
                    color: "var(--color-text-muted)", transition: "all 0.15s",
                  }}
                >
                  Next &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
