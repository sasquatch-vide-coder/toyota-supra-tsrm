import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds, shortName } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string }>;
}): Promise<Metadata> {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  return {
    title: `${shortName(modelDef)} Toyota Supra (${modelDef.generation}) Wiring Diagrams (EWD)`,
    description: `Factory electrical wiring diagrams (EWD) for the ${modelDef.year} Toyota Supra ${modelDef.generation}: system circuit diagrams, connector and ground locations, relay and junction block layouts, power source charts. Free, searchable, AI-upscaled.`,
    alternates: { canonical: `/${model}/ewd` },
  };
}

export default async function EwdLandingPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const contentDir = `${model}-ewd`;
  const sections = loadSections(contentDir);
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Hero */}
      <div
        className="model-hero"
        style={{
          padding: "40px 32px 32px",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--color-border-faint)",
        }}
      >
        <div
          aria-hidden="true"
          className="ghost-text"
          style={{
            top: "-20px",
            right: "24px",
            fontSize: "200px",
            color: "var(--color-text)",
            opacity: 0.025,
          }}
        >
          EWD
        </div>

        <div style={{ position: "relative" }}>
          <p
            style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontSize: "10px",
              letterSpacing: "0.3em",
              color: "var(--color-secondary)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            {modelDef.generation} · {modelDef.year}
          </p>
          <h1
            className="model-hero-title"
            style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontSize: "48px",
              fontWeight: 900,
              fontStyle: "italic",
              lineHeight: 1,
              color: "var(--color-text)",
              marginBottom: "6px",
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
            }}
          >
            Wiring Diagrams
          </h1>
          <p
            style={{
              fontFamily: "'Manrope', var(--font-manrope), sans-serif",
              fontSize: "18px",
              fontWeight: 300,
              color: "var(--color-text-muted)",
              fontStyle: "italic",
              marginBottom: "24px",
            }}
          >
            {modelDef.name} Electrical Wiring Diagram Book
          </p>

          <div
            className="model-stats"
            style={{
              display: "flex",
              gap: "32px",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontSize: "11px",
              color: "var(--color-text-muted)",
            }}
          >
            <div>
              <span style={{ color: "var(--color-secondary)", fontWeight: 900, fontSize: "20px", display: "block" }}>
                {sections.length}
              </span>
              Sections
            </div>
            <div style={{ borderLeft: "1px solid var(--color-border)", paddingLeft: "32px" }}>
              <span style={{ color: "var(--color-secondary)", fontWeight: 900, fontSize: "20px", display: "block" }}>
                {totalPages.toLocaleString()}
              </span>
              Pages
            </div>
          </div>
        </div>
      </div>

      {/* Section grid */}
      <div className="model-sections-grid" style={{ padding: "32px", flex: 1 }}>
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
          — Browse Sections
        </p>

        {sections.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {sections.map((section) => (
              <Link
                key={section.code}
                href={`/${model}/ewd/${section.code}`}
                style={{
                  display: "block",
                  background: "var(--color-surface-low)",
                  padding: "20px 20px 20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: "2px",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "3px",
                    background: "var(--color-secondary)",
                  }}
                />
                <div
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "var(--color-secondary)",
                    marginBottom: "6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {section.code}
                </div>
                <h2
                  style={{
                    fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    marginBottom: "10px",
                    lineHeight: 1.4,
                  }}
                >
                  {section.name}
                </h2>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontSize: "10px",
                    color: "var(--color-text-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {section.pages} {section.pages === 1 ? "page" : "pages"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              fontFamily: "'Manrope', var(--font-manrope), sans-serif",
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}
          >
            <p style={{ marginBottom: "8px" }}>No EWD content generated yet.</p>
            <p style={{ fontSize: "13px", fontStyle: "normal" }}>
              Run{" "}
              <code style={{ fontFamily: "monospace", background: "var(--color-surface-high)", padding: "2px 8px", borderRadius: "2px" }}>
                python scripts/process_ewd.py --model {model} --pdf &lt;path&gt;
              </code>{" "}
              to process a wiring diagram PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
