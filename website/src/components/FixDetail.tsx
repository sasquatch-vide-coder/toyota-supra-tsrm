export interface FixDetailData {
  thread_id: string;
  title: string;
  category: string;
  subcategory?: string;
  source_urls: string[];
  problem_description: string;
  symptoms: string[];
  root_cause?: string;
  fix_summary: string;
  fix_steps: string[];
  parts_needed: string[];
  tools_needed: string[];
  difficulty: string;
  estimated_time?: string;
  confidence: number;
  confirmation_type: string;
  thread_date?: string;
}

const difficultyStyles: Record<string, { bg: string; color: string }> = {
  beginner: { bg: "rgba(0, 241, 253, 0.12)", color: "var(--color-secondary)" },
  intermediate: { bg: "rgba(255, 193, 7, 0.12)", color: "#ffc107" },
  advanced: { bg: "rgba(255, 110, 129, 0.12)", color: "var(--color-tertiary)" },
};

export default function FixDetail({ fix }: { fix: FixDetailData }) {
  const diff = difficultyStyles[fix.difficulty] || difficultyStyles.beginner;
  const confirmLabel = fix.confirmation_type === "op_confirmed" ? "OP Confirmed" : "Community Verified";
  const confidenceText = fix.confidence >= 0.9 ? "High" : fix.confidence >= 0.7 ? "Moderate" : "Low";
  const confidenceDesc = fix.confirmation_type === "op_confirmed"
    ? "Original poster confirmed this resolved the issue"
    : "Multiple community members agreed on this solution";

  const sectionStyle = {
    background: "var(--color-surface-low)",
    border: "1px solid var(--color-surface-highest)",
    borderRadius: "2px",
    padding: "24px 28px",
    marginBottom: "16px",
    position: "relative" as const,
    overflow: "hidden" as const,
  };

  const labelStyle = {
    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
    fontWeight: 700,
    fontSize: "10px",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--color-text-faint)",
    marginBottom: "12px",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <h1 style={{
        fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
        fontWeight: 900, fontSize: "26px", letterSpacing: "0.03em", marginBottom: "12px",
      }}>
        {fix.title}
      </h1>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <span style={{
          display: "inline-flex", padding: "2px 10px", borderRadius: "9999px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          background: "rgba(222, 142, 255, 0.15)", color: "var(--color-primary)",
        }}>
          {fix.category}
        </span>
        <span style={{
          display: "inline-flex", padding: "2px 10px", borderRadius: "9999px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          background: diff.bg, color: diff.color,
        }}>
          {fix.difficulty}
        </span>
        <span style={{
          display: "inline-flex", padding: "2px 10px", borderRadius: "9999px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          background: "rgba(76, 175, 80, 0.12)", color: "#66bb6a",
        }}>
          &#x2713; {confirmLabel}
        </span>
      </div>

      {/* Problem */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Problem</div>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", lineHeight: 1.6 }}>
          {fix.problem_description}
        </p>
        {fix.symptoms.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px" }}>
            {fix.symptoms.map((s, i) => (
              <span key={i} style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "2px",
                background: "var(--color-surface-high)", color: "var(--color-text-muted)", fontWeight: 500,
              }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Root cause */}
      {fix.root_cause && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Root Cause</div>
          <p style={{ color: "var(--color-tertiary)", fontWeight: 600, fontSize: "14px", lineHeight: 1.6 }}>
            {fix.root_cause}
          </p>
        </div>
      )}

      {/* Fix steps */}
      {fix.fix_steps.length > 0 && (
        <div style={{ ...sectionStyle, overflow: "hidden" }}>
          {/* Ghost watermark */}
          <div style={{
            position: "absolute",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontWeight: 900, fontStyle: "italic", fontSize: "120px", lineHeight: "0.85",
            textTransform: "uppercase", opacity: 0.02, pointerEvents: "none",
            right: "-10px", bottom: "-20px", color: "var(--color-text)",
          }}>
            FIX
          </div>
          <div style={labelStyle}>Fix Steps</div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {fix.fix_steps.map((step, i) => (
              <li key={i} style={{
                display: "flex", gap: "14px", padding: "12px 0",
                borderBottom: i < fix.fix_steps.length - 1 ? "1px solid rgba(72, 71, 77, 0.15)" : "none",
                fontSize: "14px", lineHeight: 1.5, color: "var(--color-text-muted)",
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                  fontWeight: 700, fontSize: "14px", color: "var(--color-secondary)",
                  minWidth: "24px", height: "24px", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "rgba(0, 241, 253, 0.1)",
                  borderRadius: "2px", flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Parts & Tools side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={sectionStyle}>
          <div style={labelStyle}>Parts Needed</div>
          {fix.parts_needed.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {fix.parts_needed.map((p, i) => (
                <li key={i} style={{ fontSize: "13px", color: "var(--color-text-muted)", padding: "3px 0" }}>
                  <span style={{ color: "var(--color-secondary)", marginRight: "8px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700 }}>&gt;</span>
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontStyle: "italic" }}>No parts required</p>
          )}
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Tools Needed</div>
          {fix.tools_needed.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {fix.tools_needed.map((t, i) => (
                <li key={i} style={{ fontSize: "13px", color: "var(--color-text-muted)", padding: "3px 0" }}>
                  <span style={{ color: "var(--color-secondary)", marginRight: "8px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700 }}>&gt;</span>
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontStyle: "italic" }}>No special tools required</p>
          )}
        </div>
      </div>

      {/* Difficulty & Time side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={sectionStyle}>
          <div style={labelStyle}>Difficulty</div>
          <p style={{ color: diff.color, fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, fontSize: "14px" }}>
            {fix.difficulty.charAt(0).toUpperCase() + fix.difficulty.slice(1)}
          </p>
        </div>
        <div style={sectionStyle}>
          <div style={labelStyle}>Estimated Time</div>
          <p style={{ color: "var(--color-text)", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, fontSize: "14px" }}>
            {fix.estimated_time || "Not specified"}
          </p>
        </div>
      </div>

      {/* Confidence */}
      <div style={{ ...sectionStyle, marginBottom: "16px" }}>
        <div style={labelStyle}>Confidence</div>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginBottom: "8px" }}>
          {confidenceText} confidence &mdash; {confidenceDesc}
        </p>
        <div style={{ height: "4px", background: "var(--color-surface-high)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: "2px",
            background: "linear-gradient(to right, var(--color-secondary), var(--color-primary))",
            width: `${Math.round(fix.confidence * 100)}%`,
          }} />
        </div>
      </div>

      {/* Source links */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 0" }}>
        {fix.source_urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              color: "var(--color-secondary)",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontWeight: 600, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase",
              textDecoration: "none", padding: "8px 16px",
              background: "rgba(0, 241, 253, 0.08)",
              border: "1px solid rgba(0, 241, 253, 0.2)", borderRadius: "2px",
              transition: "background 0.2s",
            }}
          >
            {fix.source_urls.length > 1 ? `Source Thread ${i + 1}` : "View Original Thread"} &rarr;
          </a>
        ))}
        {fix.thread_date && (
          <span style={{ color: "var(--color-text-faint)", fontSize: "12px" }}>
            Posted {new Date(fix.thread_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })} on SupraForums.com
          </span>
        )}
      </div>
    </div>
  );
}
