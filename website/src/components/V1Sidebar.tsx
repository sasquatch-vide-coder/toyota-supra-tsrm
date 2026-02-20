"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Section {
  code: string;
  name: string;
  pages: number;
}

interface V1SidebarProps {
  sections: Section[];
  model: string;
  totalPages: number;
}

export default function V1Sidebar({ sections, model, totalPages }: V1SidebarProps) {
  const pathname = usePathname();

  // Detect if we're in a /v1/* route to build correct links
  const basePath = pathname.startsWith("/v1") ? "/v1" : "";

  // Determine active section from path: find model segment then take next part
  const pathParts = pathname.split("/").filter(Boolean);
  const modelIdx = pathParts.indexOf(model);
  const activeSection = modelIdx >= 0 ? pathParts[modelIdx + 1] : undefined;

  return (
    <div
      style={{
        width: "240px",
        flexShrink: 0,
        background: "var(--color-dark)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--color-dark-border)",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "0.3em",
            color: "var(--color-tan)",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          Sections
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            color: "var(--color-brown)",
          }}
        >
          {sections.length} sections · {totalPages.toLocaleString()} pages
        </p>
      </div>

      <nav style={{ flex: 1, padding: "8px 0" }}>
        {sections.map((s) => {
          const isActive = s.code === activeSection;
          return (
            <Link
              key={s.code}
              href={`${basePath}/${model}/${s.code}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 16px",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid var(--color-red)" : "3px solid transparent",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  fontWeight: "900",
                  color: "var(--color-red)",
                  minWidth: "28px",
                  letterSpacing: "0.05em",
                }}
              >
                {s.code}
              </span>
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "14px",
                  color: isActive ? "var(--color-cream)" : "var(--color-tan)",
                  lineHeight: 1.3,
                }}
              >
                {s.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
