import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";
import V1Sidebar from "@/components/V1Sidebar";
import SearchDialog from "@/components/SearchDialog";
import MobileSidebarWrapper from "@/components/MobileSidebarWrapper";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const sections = loadSections(model);
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F5F0E8",
        color: "#1A1A1A",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* Triple racing stripe */}
      <div style={{ display: "flex", height: "10px", flexShrink: 0 }}>
        <div style={{ flex: 4, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 2, background: "#8B7355" }} />
      </div>

      {/* Top nav bar */}
      <div
        className="manual-topbar"
        style={{
          background: "#1A1A1A",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#8B7355",
            letterSpacing: "0.15em",
          }}
        >
          <MobileSidebarWrapper>
            <V1Sidebar sections={sections} model={model} totalPages={totalPages} />
          </MobileSidebarWrapper>
          <Link
            href="/"
            style={{ color: "#C41E3A", textDecoration: "none", fontWeight: "700", letterSpacing: "0.3em" }}
          >
            TSRM
          </Link>
          <span style={{ color: "#3A2A1A" }}>›</span>
          <Link
            href={`/${model}`}
            style={{ color: "#8B7355", textDecoration: "none", textTransform: "uppercase" }}
          >
            {modelDef.name}
          </Link>
          <span style={{ color: "#3A2A1A" }}>›</span>
          <span style={{ color: "#F5F0E8" }}>Browse Manual</span>
        </div>
        <SearchDialog model={model} />
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div className="sidebar-desktop">
          <V1Sidebar sections={sections} model={model} totalPages={totalPages} />
        </div>
        <main style={{ flex: 1, overflowY: "auto", background: "#F5F0E8" }}>
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="manual-footer"
        style={{
          background: "#1A1A1A",
          padding: "20px 24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: "900",
              fontSize: "16px",
              letterSpacing: "0.2em",
              color: "#C41E3A",
            }}
          >
            TSRM
          </span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "#8B7355" }}>
            Toyota Supra factory service manuals — digitized
          </span>
        </div>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#4A3A2A",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Not affiliated with Toyota Motor Corporation
        </span>
      </footer>
    </div>
  );
}
