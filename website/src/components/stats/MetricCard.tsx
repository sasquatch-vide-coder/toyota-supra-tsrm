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
  if (prevValue !== undefined && currentValue !== undefined && prevValue > 0 && currentValue !== prevValue) {
    const change = ((currentValue - prevValue) / prevValue) * 100;
    const isPositive = change > 0;
    const isGood = invertTrend ? !isPositive : isPositive;
    const arrow = isPositive ? "▲" : "▼";
    const color = isGood ? "var(--color-green)" : "var(--color-red)";
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
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--color-border)",
        borderRadius: "6px",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "12px",
          color: "var(--color-tan)",
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: "18px",
          fontWeight: 900,
          color: "var(--color-dark)",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {trendEl}
    </div>
  );
}
