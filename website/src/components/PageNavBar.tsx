import Link from "next/link";

interface NavLink {
  section: string;
  page: number;
  sectionName?: string;
}

interface PageNavBarProps {
  model: string;
  docType: "tsrm" | "ewd";
  section: string;
  sectionName: string;
  pageNum: number;
  totalPages: number;
  prevLink: NavLink | null;
  nextLink: NavLink | null;
}

export default function PageNavBar({
  model,
  docType,
  section,
  sectionName,
  pageNum,
  totalPages,
  prevLink,
  nextLink,
}: PageNavBarProps) {
  const basePath = `/${model}/${docType}`;

  const navButtonStyle: React.CSSProperties = {
    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--color-text-muted)",
    background: "var(--color-surface-highest)",
    padding: "6px 12px",
    textDecoration: "none",
    borderRadius: "2px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "background-color 0.2s, color 0.2s",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 16px",
        background: "var(--color-surface-high)",
        flexShrink: 0,
        borderBottom: "1px solid var(--color-border-faint)",
      }}
    >
      {/* Prev */}
      {prevLink ? (
        <Link href={`${basePath}/${prevLink.section}/${prevLink.page}`} style={navButtonStyle}>
          ← {prevLink.sectionName ? prevLink.section : `p.${String(prevLink.page).padStart(3, "0")}`}
        </Link>
      ) : (
        <span />
      )}

      {/* Center info */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
          <span style={{ color: "var(--color-secondary)" }}>{section}</span>
          <span style={{ color: "var(--color-text-faint)", margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--color-text-muted)" }}>{sectionName}</span>
        </span>
        <span style={{
          background: "rgba(0, 241, 253, 0.15)",
          color: "var(--color-secondary)",
          padding: "2px 10px",
          borderRadius: "9999px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}>
          {pageNum} / {totalPages}
        </span>
      </div>

      {/* Next */}
      {nextLink ? (
        <Link href={`${basePath}/${nextLink.section}/${nextLink.page}`} style={navButtonStyle}>
          {nextLink.sectionName ? nextLink.section : `p.${String(nextLink.page).padStart(3, "0")}`} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
