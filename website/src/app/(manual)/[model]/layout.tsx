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
        background: "var(--color-surface)",
        color: "var(--color-text)",
        fontFamily: "'Manrope', var(--font-manrope), sans-serif",
      }}
    >
      {/* Body — each sub-layout provides its own topbar + sidebar */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        {children}
      </div>

      {/* Footer */}
      <footer
        className="manual-footer"
        style={{
          background: "var(--color-surface-low)",
          padding: "12px 24px",
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
            className="gradient-text-purple"
            style={{
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: "16px",
              letterSpacing: "-0.02em",
              paddingRight: "4px",
            }}
          >
            TSRM
          </span>
          <span style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "13px", color: "var(--color-text-muted)" }}>
            Toyota Supra factory service manuals — digitized
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px",
            color: "var(--color-text-faint)",
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
