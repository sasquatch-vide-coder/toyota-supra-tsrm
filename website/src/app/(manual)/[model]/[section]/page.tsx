import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  const params: { model: string; section: string }[] = [];
  for (const model of getModelIds()) {
    const sections = loadSections(model);
    for (const s of sections) {
      params.push({ model, section: s.code });
    }
  }
  return params;
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ model: string; section: string }>;
}) {
  const { model, section } = await params;
  if (!getModel(model)) notFound();

  const sections = loadSections(model);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Section hero */}
      <div
        style={{
          padding: "40px 32px 32px",
          borderBottom: "1px solid #D4C9B8",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "48px",
            fontWeight: "900",
            color: "#C41E3A",
            marginBottom: "8px",
            letterSpacing: "-0.02em",
          }}
        >
          {sectionInfo.code}
        </div>
        <h1
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "32px",
            fontWeight: "700",
            color: "#1A1A1A",
            marginBottom: "16px",
            lineHeight: 1.2,
          }}
        >
          {sectionInfo.name}
        </h1>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#8B7355",
            letterSpacing: "0.1em",
          }}
        >
          {sectionInfo.pages} {sectionInfo.pages === 1 ? "page" : "pages"}
        </span>
      </div>

      {/* Racing divider stripe */}
      <div style={{ display: "flex", height: "4px", flexShrink: 0 }}>
        <div style={{ flex: 6, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 3, background: "#8B7355" }} />
      </div>

      {/* Page list */}
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
          — Pages
        </p>

        {sectionInfo.page_index && sectionInfo.page_index.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sectionInfo.page_index.map((p) => (
              <Link
                key={p.page}
                href={`/${model}/${section}/${p.page}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  background: "#FFFFFF",
                  border: "1px solid #D4C9B8",
                  padding: "14px 20px 14px 24px",
                  position: "relative",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* Red left bar */}
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
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#8B7355",
                    minWidth: "36px",
                  }}
                >
                  {String(p.page).padStart(3, "0")}
                </span>
                <span
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "14px",
                    color: "#1A1A1A",
                    lineHeight: 1.4,
                  }}
                >
                  {p.title || p.section_header || `Page ${p.page}`}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: "Georgia, serif", color: "#8B7355", fontStyle: "italic" }}>
            No pages indexed for this section.
          </p>
        )}
      </div>
    </div>
  );
}
