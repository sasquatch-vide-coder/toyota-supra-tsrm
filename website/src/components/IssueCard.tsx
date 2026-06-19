import Link from "next/link";

export interface IssueThread {
  thread_id: string;
  title: string;
  url: string;
  issue_label?: string;
  confidence?: number;
  post_count?: number;
}

export interface IssueData {
  slug: string;
  system: string;
  issue: string;
  thread_count: number;
  threads: IssueThread[];
}

export const SYSTEM_LABELS: Record<string, string> = {
  engine: "Engine",
  electrical: "Electrical",
  cooling: "Cooling",
  turbo: "Turbo",
  fuel: "Fuel System",
  transmission: "Transmission",
  suspension: "Suspension",
  brakes: "Brakes",
  exhaust: "Exhaust",
  body: "Body / Interior",
  other: "Other",
  uncategorized: "Uncategorized",
};

export function systemLabel(system: string): string {
  return SYSTEM_LABELS[system] ?? system.charAt(0).toUpperCase() + system.slice(1);
}

export default function IssueCard({ issue, model }: { issue: IssueData; model: string }) {
  const sample = issue.threads.slice(0, 3);

  return (
    <Link
      href={`/${model}/fixes/${issue.slug}`}
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
        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 10px", borderRadius: "9999px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            background: "rgba(222, 142, 255, 0.15)", color: "var(--color-primary)",
          }}>
            {systemLabel(issue.system)}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 10px", borderRadius: "9999px",
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            background: "rgba(0, 241, 253, 0.12)", color: "var(--color-secondary)",
            marginLeft: "auto",
          }}>
            {issue.thread_count} thread{issue.thread_count === 1 ? "" : "s"}
          </span>
        </div>

        {/* Issue title */}
        <h3 style={{
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontWeight: 700, fontSize: "16px", color: "var(--color-text)",
          marginBottom: "10px", letterSpacing: "0.02em", textTransform: "capitalize",
        }}>
          {issue.issue}
        </h3>

        {/* Sample thread titles */}
        {sample.length > 0 && (
          <div style={{
            paddingLeft: "12px", borderLeft: "2px solid var(--color-secondary)",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {sample.map((t) => (
              <span key={t.thread_id} style={{
                color: "var(--color-text-muted)", fontSize: "13px", lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {t.title}
              </span>
            ))}
            {issue.thread_count > sample.length && (
              <span style={{ color: "var(--color-text-faint)", fontSize: "12px", marginTop: "2px" }}>
                + {issue.thread_count - sample.length} more thread{issue.thread_count - sample.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
