import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel } from "@/lib/models";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string; section: string }>;
}): Promise<Metadata> {
  const { model, section } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  const sections = loadSections(`${model}-ewd`);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) return {};

  return {
    title: `${sectionInfo.name} — ${modelDef.name} Wiring Diagrams`,
    description: `${sectionInfo.name} wiring diagrams for the ${modelDef.name} — ${sectionInfo.pages} pages.`,
    alternates: { canonical: `/${model}/ewd/${section}` },
  };
}

export default async function EwdSectionPage({
  params,
}: {
  params: Promise<{ model: string; section: string }>;
}) {
  const { model, section } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const sections = loadSections(`${model}-ewd`);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Section hero */}
      <div
        className="section-hero"
        style={{
          padding: "40px 32px 32px",
          borderBottom: "1px solid var(--color-border-faint)",
        }}
      >
        <div
          className="section-code"
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "48px",
            fontWeight: 900,
            color: "var(--color-secondary)",
            marginBottom: "8px",
            letterSpacing: "-0.02em",
          }}
        >
          {sectionInfo.code}
        </div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: "16px",
            lineHeight: 1.2,
          }}
        >
          {sectionInfo.name}
        </h1>
        <span
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "12px",
            color: "var(--color-text-faint)",
            letterSpacing: "0.1em",
          }}
        >
          {sectionInfo.pages} {sectionInfo.pages === 1 ? "page" : "pages"}
        </span>
      </div>

      {/* Page list */}
      <div className="section-page-list" style={{ padding: "32px", flex: 1 }}>
        <p
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px",
            letterSpacing: "0.25em",
            color: "var(--color-text-faint)",
            textTransform: "uppercase",
            marginBottom: "20px",
          }}
        >
          — Pages
        </p>

        {sectionInfo.page_index && sectionInfo.page_index.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sectionInfo.page_index.map((p) => (
              <Link
                key={p.page}
                href={`/${model}/ewd/${section}/${p.page}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  background: "var(--color-surface-low)",
                  padding: "12px 20px 12px 24px",
                  position: "relative",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: "2px",
                  transition: "background-color 0.2s",
                }}
              >
                {/* Left accent */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "3px",
                    background: "var(--color-primary-dim)",
                    opacity: 0.5,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontSize: "11px",
                    color: "var(--color-text-faint)",
                    minWidth: "36px",
                  }}
                >
                  {String(p.page).padStart(3, "0")}
                </span>
                <span
                  style={{
                    fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                    fontSize: "14px",
                    color: "var(--color-text)",
                    lineHeight: 1.4,
                  }}
                >
                  {p.title || p.section_header || `Page ${p.page}`}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No pages indexed for this section.
          </p>
        )}
      </div>
    </div>
  );
}
