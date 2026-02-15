"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SectionInfo } from "@/types";

export default function SectionSidebar({
  sections,
  model,
}: {
  sections: SectionInfo[];
  model: string;
}) {
  const pathname = usePathname();
  const currentSection = pathname.split("/")[2];
  const [expanded, setExpanded] = useState<string | null>(currentSection || null);

  return (
    <nav className="w-64 bg-gray-900 text-gray-300 h-screen overflow-y-auto fixed left-0 top-0 flex flex-col">
      <Link
        href={`/${model}`}
        className="block px-4 py-3 text-white font-bold text-lg border-b border-gray-700 hover:bg-gray-800"
      >
        <span className="text-red-500">TSRM</span>{" "}
        <span className="text-sm font-normal text-gray-400">{model.toUpperCase()} Supra</span>
      </Link>

      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const isActive = currentSection === section.code;
          const isExpanded = expanded === section.code;

          return (
            <div key={section.code}>
              <button
                onClick={() =>
                  setExpanded(isExpanded ? null : section.code)
                }
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-800 transition-colors ${
                  isActive ? "bg-gray-800 text-white" : ""
                }`}
              >
                <span>
                  <span className="font-mono text-red-400 mr-2">
                    {section.code}
                  </span>
                  {section.name}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {isExpanded && section.page_index && (
                <div className="bg-gray-950 py-1">
                  {section.page_index.map((p) => {
                    const pageActive =
                      pathname === `/${model}/${section.code}/${p.page}`;
                    return (
                      <Link
                        key={p.page}
                        href={`/${model}/${section.code}/${p.page}`}
                        className={`block px-8 py-1 text-xs hover:bg-gray-800 transition-colors ${
                          pageActive
                            ? "text-red-400 bg-gray-800"
                            : "text-gray-500"
                        }`}
                      >
                        <span className="font-mono mr-1">{p.page}.</span>{" "}
                        {p.title || p.section_header || `Page ${p.page}`}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
