"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ManualPage from "./ManualPage";
import { PageData } from "@/types";

interface CompareViewProps {
  model: string;
  section: string;
  sectionName: string;
  page: number;
  totalPages: number;
  data: PageData;
  originalSrc: string;
}

export default function CompareView({
  model,
  section,
  sectionName,
  page,
  totalPages,
  data,
  originalSrc,
}: CompareViewProps) {
  const [syncScroll, setSyncScroll] = useState(true);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);

  const handleScroll = useCallback(
    (source: "left" | "right") => {
      if (!syncScroll || scrolling.current) return;
      scrolling.current = true;

      const from = source === "left" ? leftRef.current : rightRef.current;
      const to = source === "left" ? rightRef.current : leftRef.current;

      if (from && to) {
        const ratio =
          from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
        to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
      }

      requestAnimationFrame(() => {
        scrolling.current = false;
      });
    },
    [syncScroll]
  );

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      <div
        className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0 px-4 py-2"
        style={{
          background: "var(--color-surface-high)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/${model}/tsrm/${section}/${page}`}
            className="text-sm hover:underline"
            style={{ color: "var(--color-secondary)" }}
          >
            Back to page
          </Link>
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {sectionName} — Page {page}/{totalPages}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="rounded"
              style={{ accentColor: "var(--color-secondary)" }}
            />
            Sync scroll
          </label>

          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/${model}/tsrm/compare/${section}/${page - 1}`}
                className="px-3 py-1 text-sm rounded"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/${model}/tsrm/compare/${section}/${page + 1}`}
                className="px-3 py-1 text-sm rounded"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div
          className="w-full md:w-1/2 flex flex-col"
          style={{
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div
            className="px-4 py-1 text-xs font-medium"
            style={{
              background: "var(--color-surface-mid)",
              borderBottom: "1px solid var(--color-border-faint)",
              color: "var(--color-text-faint)",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            ORIGINAL SCAN
          </div>
          <div
            ref={leftRef}
            className="flex-1 overflow-y-auto p-4"
            style={{ background: "var(--color-surface-low)" }}
            onScroll={() => handleScroll("left")}
          >
            <img
              src={originalSrc}
              alt={`Original scan ${section}-${page}`}
              className="w-full h-auto"
              style={{ background: "var(--color-surface-high)" }}
            />
          </div>
        </div>

        <div
          className="w-full md:w-1/2 flex flex-col"
          style={{ borderLeft: "1px solid var(--color-border)" }}
        >
          <div
            className="px-4 py-1 text-xs font-medium"
            style={{
              background: "var(--color-surface-mid)",
              borderBottom: "1px solid var(--color-border-faint)",
              color: "var(--color-text-faint)",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            MODERNIZED
          </div>
          <div
            ref={rightRef}
            className="flex-1 overflow-y-auto p-6"
            style={{ background: "var(--color-surface)" }}
            onScroll={() => handleScroll("right")}
          >
            <ManualPage data={data} model={model} section={section} page={page} />
          </div>
        </div>
      </div>
    </div>
  );
}
