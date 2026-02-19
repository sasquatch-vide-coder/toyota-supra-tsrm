"use client";

export function NewVsReturning({
  newSessions,
  returningSessions,
}: {
  newSessions: number;
  returningSessions: number;
}) {
  const total = newSessions + returningSessions;
  const newPct = total > 0 ? Math.round((newSessions / total) * 100) : 0;
  const returningPct = total > 0 ? Math.round((returningSessions / total) * 100) : 0;

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
          fontSize: "15px",
          color: "#1A1A1A",
          margin: "0 0 16px 0",
        }}
      >
        New vs Returning
      </h3>
      <div style={{ display: "flex", gap: "0" }}>
        <div style={{ flex: 1, paddingRight: "20px" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "28px",
              fontWeight: 900,
              color: "#C41E3A",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {newSessions.toLocaleString()}
          </p>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "13px",
              color: "#8B7355",
              margin: "4px 0 0 0",
            }}
          >
            New
          </p>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#C41E3A",
              margin: "2px 0 0 0",
            }}
          >
            {newPct}%
          </p>
        </div>

        <div
          style={{
            width: "1px",
            background: "#D4C9B8",
            margin: "0 4px",
          }}
        />

        <div style={{ flex: 1, paddingLeft: "20px" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "28px",
              fontWeight: 900,
              color: "#8B7355",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {returningSessions.toLocaleString()}
          </p>
          <p
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "13px",
              color: "#8B7355",
              margin: "4px 0 0 0",
            }}
          >
            Returning
          </p>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#8B7355",
              margin: "2px 0 0 0",
            }}
          >
            {returningPct}%
          </p>
        </div>
      </div>
    </div>
  );
}
