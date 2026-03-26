import Link from "next/link";

export interface FixCardData {
  thread_id: string;
  title: string;
  category: string;
  subcategory?: string;
  problem_description: string;
  symptoms: string[];
  fix_summary: string;
  difficulty: string;
  estimated_time?: string;
  confidence: number;
  confirmation_type: string;
  thread_date?: string;
  parts_needed?: string[];
}

const difficultyStyles: Record<string, { bg: string; color: string }> = {
  beginner: { bg: "rgba(0, 241, 253, 0.12)", color: "var(--color-secondary)" },
  intermediate: { bg: "rgba(255, 193, 7, 0.12)", color: "#ffc107" },
  advanced: { bg: "rgba(255, 110, 129, 0.12)", color: "var(--color-tertiary)" },
};

export default function FixCard({ fix, model }: { fix: FixCardData; model: string }) {
  const diff = difficultyStyles[fix.difficulty] || difficultyStyles.beginner;
  const confirmLabel = fix.confirmation_type === "op_confirmed" ? "OP Confirmed" : "Community Verified";
  const partsText = fix.parts_needed?.length
    ? fix.parts_needed.join(", ")
    : "No parts needed";

  return (
    <Link
      href={`/${model}/fixes/${fix.thread_id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          background: "var(--color-surface-low)",
          border: "1px solid var(--color-surface-highest)",
          borderRadius: "2px",
          padding: "20px 24px",
          cursor: "pointer",
          transition: "border-color 0.2s, background 0.2s",
          position: "relative",
          overflow: "hidden",
        }}
        className="fix-card-hover"
      >
        {/* Ghost watermark */}
        <div
          style={{
            position: "absolute",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: "120px",
            lineHeight: "0.85",
            textTransform: "uppercase",
            opacity: 0.02,
            pointerEvents: "none",
            right: "-10px",
            bottom: "-20px",
            color: "var(--color-text)",
          }}
        >
          FIX
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 10px", borderRadius: "9999px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            background: "rgba(222, 142, 255, 0.15)", color: "var(--color-primary)",
          }}>
            {fix.category}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 10px", borderRadius: "9999px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            background: diff.bg, color: diff.color,
          }}>
            {fix.difficulty}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 10px", borderRadius: "9999px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            background: "rgba(76, 175, 80, 0.12)", color: "#66bb6a",
            marginLeft: "auto",
          }}>
            &#x2713; {confirmLabel}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontWeight: 700, fontSize: "16px", color: "var(--color-text)",
          marginBottom: "6px", letterSpacing: "0.02em",
        }}>
          {fix.title}
        </h3>

        {/* Symptoms */}
        {fix.symptoms.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
            {fix.symptoms.slice(0, 5).map((s, i) => (
              <span key={i} style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "2px",
                background: "var(--color-surface-high)", color: "var(--color-text-muted)", fontWeight: 500,
              }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Problem snippet */}
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", lineHeight: 1.5, marginBottom: "12px" }}>
          {fix.problem_description.length > 200
            ? fix.problem_description.slice(0, 200) + "..."
            : fix.problem_description}
        </p>

        {/* Fix summary with cyan border */}
        <div style={{
          color: "var(--color-text)", fontSize: "13px", lineHeight: 1.5,
          paddingLeft: "12px", borderLeft: "2px solid var(--color-secondary)", marginBottom: "12px",
        }}>
          {fix.fix_summary}
        </div>

        {/* Meta row */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px",
          color: "var(--color-text-faint)", fontSize: "11px",
        }}>
          {fix.estimated_time && <span>~{fix.estimated_time}</span>}
          <span>{partsText}</span>
          {fix.thread_date && (
            <span>{new Date(fix.thread_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
