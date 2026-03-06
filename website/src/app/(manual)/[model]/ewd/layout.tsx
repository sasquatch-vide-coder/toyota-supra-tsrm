import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel } from "@/lib/models";
import V1Sidebar from "@/components/V1Sidebar";
import SearchDialog from "@/components/SearchDialog";
import MobileSidebarWrapper from "@/components/MobileSidebarWrapper";

export default async function EwdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const contentDir = `${model}-ewd`;
  const sections = loadSections(contentDir);
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <>
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
            <V1Sidebar sections={sections} model={model} totalPages={totalPages} basePath={`/${model}/ewd`} />
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
          <span style={{ color: "#F5F0E8" }}>Wiring Diagrams</span>
        </div>
        <SearchDialog model={model} docType="ewd" />
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div className="sidebar-desktop" style={{ overflowY: "auto" }}>
          <V1Sidebar sections={sections} model={model} totalPages={totalPages} basePath={`/${model}/ewd`} />
        </div>
        <main style={{ flex: 1, overflowY: "auto", background: "#F5F0E8" }}>
          {children}
        </main>
      </div>
    </>
  );
}
