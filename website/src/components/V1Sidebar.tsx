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
  basePath?: string;
}

export default function V1Sidebar({ sections, model, totalPages, basePath: basePathProp }: V1SidebarProps) {
  const pathname = usePathname();

  const basePath = basePathProp || (pathname.startsWith("/v1") ? `/v1/${model}` : `/${model}`);

  // Determine active section from path
  const pathParts = pathname.split("/").filter(Boolean);
  const ewdIdx = pathParts.indexOf("ewd");
  const tsrmIdx = pathParts.indexOf("tsrm");
  const modelIdx = pathParts.indexOf(model);
  const activeSection = ewdIdx >= 0
    ? pathParts[ewdIdx + 1]
    : tsrmIdx >= 0
      ? pathParts[tsrmIdx + 1]
      : modelIdx >= 0
        ? pathParts[modelIdx + 1]
        : undefined;

  return (
    <div
      style={{
        width: "260px",
        flexShrink: 0,
        background: "var(--color-surface-low)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        borderRight: "1px solid var(--color-border-faint)",
      }}
    >
      {/* Sidebar header */}
      <div
        style={{
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--color-border-faint)",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(0, 241, 253, 0.03) 0%, transparent 100%)",
        }}
      >
        {/* Ghost watermark */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-8px",
            top: "-8px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: "4rem",
            lineHeight: 1,
            color: "var(--color-text)",
            opacity: 0.025,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {model.toUpperCase()}
        </div>
        <div style={{ position: "relative" }}>
          <p
            style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            {sections.length} sections · {totalPages.toLocaleString()} pages
          </p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "4px 0" }}>
        {sections.map((s) => {
          const isActive = s.code === activeSection;
          return (
            <Link
              key={s.code}
              href={`${basePath}/${s.code}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 20px",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid var(--color-secondary)" : "3px solid transparent",
                background: isActive ? "rgba(0, 241, 253, 0.05)" : "transparent",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "var(--color-secondary)",
                  minWidth: "48px",
                  flexShrink: 0,
                }}
              >
                {s.code}
              </span>
              <span
                style={{
                  fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                  fontSize: "13px",
                  color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                  fontWeight: isActive ? 600 : 400,
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {s.name}
              </span>
              <span
                style={{
                  fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                  fontSize: "9px",
                  color: isActive ? "var(--color-secondary)" : "var(--color-text-faint)",
                  flexShrink: 0,
                }}
              >
                {s.pages}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
