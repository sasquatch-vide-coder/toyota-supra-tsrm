import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel } from "@/lib/models";
import { getDocuments } from "@/lib/documents";
import V1Sidebar from "@/components/V1Sidebar";
import SearchDialog from "@/components/SearchDialog";
import MobileSidebarWrapper from "@/components/MobileSidebarWrapper";
import DocumentTabs from "@/components/DocumentTabs";

export default async function TsrmLayout({
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
  const documents = getDocuments(model);

  return (
    <>
      {/* Top nav bar */}
      <div
        className="manual-topbar"
        style={{
          background: "rgba(19, 19, 24, 0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "10px 20px",
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
            gap: "12px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <MobileSidebarWrapper>
            <V1Sidebar sections={sections} model={model} totalPages={totalPages} basePath={`/${model}/tsrm`} />
          </MobileSidebarWrapper>
          <Link
            href="/"
            className="gradient-text-purple"
            style={{ textDecoration: "none", fontWeight: 900, fontStyle: "italic", fontSize: "16px", letterSpacing: "-0.02em", paddingRight: "4px" }}
          >
            TSRM
          </Link>
          <span style={{ color: "var(--color-text-faint)", opacity: 0.4 }}>/</span>
          <Link
            href={`/${model}`}
            style={{ color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            {modelDef.name}
          </Link>
          <span style={{ color: "var(--color-text-faint)", opacity: 0.4 }}>/</span>
          <span style={{ color: "var(--color-text)" }}>Repair Manual</span>
        </div>
        <SearchDialog model={model} />
      </div>
      {documents.length > 1 && (
        <DocumentTabs documents={documents} model={model} />
      )}

      {/* Accent stripe */}
      <div className="accent-stripe" style={{ flexShrink: 0 }}>
        <div /><div /><div />
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div className="sidebar-desktop" style={{ overflowY: "auto" }}>
          <V1Sidebar sections={sections} model={model} totalPages={totalPages} basePath={`/${model}/tsrm`} />
        </div>
        <main style={{ flex: 1, overflowY: "auto", background: "var(--color-surface)" }}>
          {children}
        </main>
      </div>
    </>
  );
}
