import { notFound } from "next/navigation";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

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

      {/* Body — each sub-layout provides its own topbar + sidebar */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {children}
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
