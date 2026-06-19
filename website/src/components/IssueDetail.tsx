import { systemLabel } from "@/components/IssueCard";
import type { IssueData } from "@/components/IssueCard";

export default function IssueDetail({ issue }: { issue: IssueData }) {
  const threads = [...issue.threads].sort(
    (a, b) => (b.post_count ?? 0) - (a.post_count ?? 0)
  );

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px 24px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "2px 10px", borderRadius: "9999px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          background: "rgba(222, 142, 255, 0.15)", color: "var(--color-primary)",
          marginBottom: "12px",
        }}>
          {systemLabel(issue.system)}
        </span>
        <h1 style={{
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontWeight: 900, fontSize: "26px", letterSpacing: "0.02em",
          color: "var(--color-text)", marginBottom: "8px", textTransform: "capitalize",
        }}>
          {issue.issue}
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          Confirmed fixed in{" "}
          <span style={{ color: "var(--color-secondary)", fontWeight: 700 }}>
            {issue.thread_count} forum thread{issue.thread_count === 1 ? "" : "s"}
          </span>. Open the originals on SupraForums for the full discussion.
        </p>
      </div>

      {/* Thread list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {threads.map((t) => (
          <a
            key={t.thread_id}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              className="fix-card-hover"
              style={{
                background: "var(--color-surface-low)",
                border: "1px solid var(--color-surface-highest)",
                borderRadius: "2px",
                padding: "14px 18px",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <div style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px",
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                  fontWeight: 700, fontSize: "14px", color: "var(--color-text)",
                }}>
                  {t.title}
                </span>
                <span style={{
                  color: "var(--color-secondary)", fontSize: "12px", fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                  Thread &rarr;
                </span>
              </div>
              {t.issue_label && (
                <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "4px" }}>
                  {t.issue_label}
                </div>
              )}
              <div style={{
                display: "flex", gap: "14px", marginTop: "6px",
                color: "var(--color-text-faint)", fontSize: "11px",
              }}>
                {typeof t.post_count === "number" && (
                  <span>{t.post_count} post{t.post_count === 1 ? "" : "s"}</span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
