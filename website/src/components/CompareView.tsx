"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ManualPage from "./ManualPage";
import { PageData } from "@/types";

interface CompareViewProps {
  section: string;
  sectionName: string;
  page: number;
  totalPages: number;
  data: PageData;
  originalSrc: string;
}

export default function CompareView({
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
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Link href={`/${section}/${page}`} className="text-sm text-red-600 hover:underline">
            Back to page
          </Link>
          <span className="text-sm text-gray-600">
            {sectionName} — Page {page}/{totalPages}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="rounded"
            />
            Sync scroll
          </label>

          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/compare/${section}/${page - 1}`}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/compare/${section}/${page + 1}`}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 border-r border-gray-300 flex flex-col">
          <div className="px-4 py-1 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
            ORIGINAL SCAN
          </div>
          <div
            ref={leftRef}
            className="flex-1 overflow-y-auto p-4 bg-gray-200"
            onScroll={() => handleScroll("left")}
          >
            <img
              src={originalSrc}
              alt={`Original scan ${section}-${page}`}
              className="w-full h-auto bg-white"
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-1 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
            MODERNIZED
          </div>
          <div
            ref={rightRef}
            className="flex-1 overflow-y-auto p-6"
            onScroll={() => handleScroll("right")}
          >
            <ManualPage data={data} section={section} page={page} />
          </div>
        </div>
      </div>
    </div>
  );
}
