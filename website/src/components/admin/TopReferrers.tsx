function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function TopReferrers({
  referrers,
}: {
  referrers: { referrer: string; count: number }[];
}) {
  if (!referrers.length) {
    return (
      <p style={{ fontFamily: "Georgia, serif", color: "#8B7355", fontSize: "14px" }}>
        No referrers yet
      </p>
    );
  }

  const maxCount = referrers[0].count;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #D4C9B8",
        borderRadius: "8px",
        padding: "20px",
      }}
    >
      <h3
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "13px",
          color: "#8B7355",
          margin: "0 0 16px 0",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Top Referrers
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {referrers.map((ref, i) => (
          <div key={ref.referrer} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#D4C9B8",
                width: "20px",
                textAlign: "right",
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(196,30,58,0.08)",
                  borderRadius: "3px",
                  width: `${(ref.count / maxCount) * 100}%`,
                }}
              />
              <span
                style={{
                  position: "relative",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#1A1A1A",
                  display: "block",
                  padding: "2px 8px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stripProtocol(ref.referrer)}
              </span>
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#8B7355",
                width: "48px",
                textAlign: "right",
              }}
            >
              {ref.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
