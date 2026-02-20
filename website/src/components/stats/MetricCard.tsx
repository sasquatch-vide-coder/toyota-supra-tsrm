"use client";

export function MetricCard({
  label,
  value,
  prevValue,
  currentValue,
  invertTrend = false,
}: {
  label: string;
  value: string | number;
  prevValue?: number;
  currentValue?: number;
  invertTrend?: boolean;
}) {
  let trendEl = null;
  if (prevValue !== undefined && currentValue !== undefined && prevValue > 0) {
    const change = ((currentValue - prevValue) / prevValue) * 100;
    const isPositive = change > 0;
    const isGood = invertTrend ? !isPositive : isPositive;
    const arrow = isPositive ? "▲" : "▼";
    const color = isGood ? "#2D8A4E" : "#C41E3A";
    trendEl = (
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          color,
          display: "flex",
          alignItems: "center",
          gap: "2px",
        }}
      >
        {arrow} {Math.abs(change).toFixed(0)}%
      </span>
    );
  } else if (prevValue !== undefined) {
    trendEl = (
      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#D4C9B8" }}>
        —
      </span>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #D4C9B8",
        borderRadius: "8px",
        padding: "20px",
        borderLeft: "4px solid #C41E3A",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "13px",
            color: "#8B7355",
            margin: 0,
          }}
        >
          {label}
        </p>
        {trendEl}
      </div>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: "28px",
          fontWeight: 900,
          color: "#1A1A1A",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
