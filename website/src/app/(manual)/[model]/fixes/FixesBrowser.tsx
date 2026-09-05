"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import IssueCard, { systemLabel } from "@/components/IssueCard";
import type { IssueData } from "@/components/IssueCard";

interface FixesBrowserProps {
  model: string;
  issues: IssueData[];
  systems: { system: string; issue_count: number }[];
  totalIssues: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  currentSystem: string;
  currentSort: string;
  currentQuery: string;
}

export default function FixesBrowser({
  model,
  issues,
  systems,
  totalIssues,
  totalCount,
  totalPages,
  currentPage,
  currentSystem,
  currentSort,
  currentQuery,
}: FixesBrowserProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(currentQuery);

  const FORUM_LABEL: Record<string, string> = { mk2: "MKII", mk3: "MKIII", mk4: "MKIV" };
  const forumLabel = FORUM_LABEL[model] ?? model.toUpperCase();

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        q: currentQuery,
        system: currentSystem,
        sort: currentSort,
        page: String(currentPage),
        ...overrides,
      };
      if (merged.q) params.set("q", merged.q);
      if (merged.system) params.set("system", merged.system);
      if (merged.sort && merged.sort !== "threads") params.set("sort", merged.sort);
      if (merged.page !== "1") params.set("page", merged.page);
      const qs = params.toString();
      return `/${model}/fixes${qs ? `?${qs}` : ""}`;
    },
    [model, currentQuery, currentSystem, currentSort, currentPage]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ q: searchInput, page: "1" }));
  };

  const handleSortClick = (sort: string) => {
    router.push(buildUrl({ sort, page: "1" }));
  };

  const sortOptions = [
    { key: "threads", label: "Most Discussed" },
    { key: "system", label: "System" },
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
          Common problems grouped from confirmed-fix threads on SupraForums &mdash;{" "}
          <span style={{
            color: "var(--color-secondary)",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
          }}>
            {totalIssues} issues
          </span>{" "}
          across {forumLabel} threads
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
          placeholder="Search issues... (e.g. 'rough idle', 'boost leak', 'no start')"
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
        {/* System sidebar */}
        <div style={{ width: "220px", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-text-faint)", marginBottom: "12px",
          }}>
            Systems
          </div>
          {/* All */}
          <Link
            href={buildUrl({ system: "", page: "1" })}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderRadius: "2px", cursor: "pointer", textDecoration: "none",
              fontSize: "13px", fontWeight: 500, marginBottom: "2px",
              color: !currentSystem ? "var(--color-secondary)" : "var(--color-text-muted)",
              background: !currentSystem ? "rgba(0, 241, 253, 0.05)" : "transparent",
              borderLeft: !currentSystem ? "3px solid var(--color-secondary)" : "3px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <span>All Issues</span>
            <span style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontWeight: 700, fontSize: "11px",
              background: !currentSystem ? "rgba(0, 241, 253, 0.15)" : "var(--color-surface-mid)",
              color: !currentSystem ? "var(--color-secondary)" : "var(--color-text-faint)",
              padding: "2px 8px", borderRadius: "9999px",
            }}>
              {totalIssues}
            </span>
          </Link>
          {systems.map((s) => (
            <Link
              key={s.system}
              href={buildUrl({ system: s.system === currentSystem ? "" : s.system, page: "1" })}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: "2px", cursor: "pointer", textDecoration: "none",
                fontSize: "13px", fontWeight: 500, marginBottom: "2px",
                color: currentSystem === s.system ? "var(--color-secondary)" : "var(--color-text-muted)",
                background: currentSystem === s.system ? "rgba(0, 241, 253, 0.05)" : "transparent",
                borderLeft: currentSystem === s.system ? "3px solid var(--color-secondary)" : "3px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span>{systemLabel(s.system)}</span>
              <span style={{
                fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                fontWeight: 700, fontSize: "11px",
                background: currentSystem === s.system ? "rgba(0, 241, 253, 0.15)" : "var(--color-surface-mid)",
                color: currentSystem === s.system ? "var(--color-secondary)" : "var(--color-text-faint)",
                padding: "2px 8px", borderRadius: "9999px",
              }}>
                {s.issue_count}
              </span>
            </Link>
          ))}
        </div>

        {/* Issue cards */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
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

          {issues.length === 0 ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: "200px", color: "var(--color-text-muted)", fontSize: "14px",
            }}>
              {currentQuery
                ? `No issues found for "${currentQuery}"`
                : "No community issues available yet"}
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard key={issue.slug} issue={issue} model={model} />
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: "16px", padding: "24px 0",
            }}>
              {currentPage > 1 && (
                <Link
                  href={buildUrl({ page: String(currentPage - 1) })}
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontWeight: 600, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "8px 16px", borderRadius: "2px", cursor: "pointer", textDecoration: "none",
                    background: "var(--color-surface-low)", border: "1px solid var(--color-surface-highest)",
                    color: "var(--color-text-muted)", transition: "all 0.15s",
                  }}
                >
                  &larr; Previous
                </Link>
              )}
              <span style={{
                fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                fontSize: "12px", color: "var(--color-text-faint)",
              }}>
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link
                  href={buildUrl({ page: String(currentPage + 1) })}
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontWeight: 600, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "8px 16px", borderRadius: "2px", cursor: "pointer", textDecoration: "none",
                    background: "var(--color-surface-low)", border: "1px solid var(--color-surface-highest)",
                    color: "var(--color-text-muted)", transition: "all 0.15s",
                  }}
                >
                  Next &rarr;
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
