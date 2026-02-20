import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelLandingPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const sections = loadSections(model);
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Model hero */}
      <div
        style={{
          padding: "40px 32px 32px",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid #D4C9B8",
        }}
      >
        {/* Ghost generation watermark */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-20px",
            right: "24px",
            fontSize: "200px",
            fontWeight: "900",
            color: "#C41E3A",
            opacity: 0.08,
            lineHeight: 1,
            fontFamily: "Georgia, 'Times New Roman', serif",
            userSelect: "none",
            letterSpacing: "-0.05em",
          }}
        >
          {modelDef.generation}
        </div>

        <div style={{ position: "relative" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "10px",
              letterSpacing: "0.35em",
              color: "#8B7355",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            {modelDef.generation} · {modelDef.year}
          </p>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "48px",
              fontWeight: "900",
              lineHeight: 1,
              color: "#1A1A1A",
              marginBottom: "6px",
              letterSpacing: "-0.02em",
            }}
          >
            {modelDef.name}
          </h1>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "18px",
              fontWeight: "300",
              color: "#8B7355",
              fontStyle: "italic",
              marginBottom: "24px",
            }}
          >
            {modelDef.description}
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#8B7355",
            }}
          >
            <div>
              <span style={{ color: "#C41E3A", fontWeight: "900", fontSize: "20px", display: "block" }}>
                {sections.length}
              </span>
              Sections
            </div>
            <div style={{ borderLeft: "1px solid #D4C9B8", paddingLeft: "32px" }}>
              <span style={{ color: "#C41E3A", fontWeight: "900", fontSize: "20px", display: "block" }}>
                {totalPages.toLocaleString()}
              </span>
              Pages
            </div>
          </div>
        </div>
      </div>

      {/* Racing divider stripe */}
      <div style={{ display: "flex", height: "4px", flexShrink: 0 }}>
        <div style={{ flex: 6, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 3, background: "#8B7355" }} />
      </div>

      {/* Section grid */}
      <div style={{ padding: "32px", flex: 1 }}>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            letterSpacing: "0.3em",
            color: "#8B7355",
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
              gap: "16px",
            }}
          >
            {sections.map((section) => (
              <Link
                key={section.code}
                href={`/${model}/${section.code}`}
                style={{
                  display: "block",
                  background: "#FFFFFF",
                  border: "1px solid #D4C9B8",
                  padding: "20px 20px 20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* Red left accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "4px",
                    background: "#C41E3A",
                  }}
                />
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "24px",
                    fontWeight: "900",
                    color: "#C41E3A",
                    marginBottom: "6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {section.code}
                </div>
                <h2
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#1A1A1A",
                    marginBottom: "10px",
                    lineHeight: 1.4,
                  }}
                >
                  {section.name}
                </h2>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "10px",
                    color: "#8B7355",
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
              fontFamily: "Georgia, serif",
              color: "#8B7355",
              fontStyle: "italic",
            }}
          >
            <p style={{ marginBottom: "8px" }}>No content generated yet.</p>
            <p style={{ fontSize: "13px", fontStyle: "normal" }}>
              Run{" "}
              <code style={{ fontFamily: "monospace", background: "#EDE8DC", padding: "2px 8px" }}>
                python scripts/generate_content.py --model {model} --all
              </code>{" "}
              to generate website content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
