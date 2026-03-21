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
    const color = isGood ? "#4ade80" : "var(--color-tertiary)";
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
        background: "var(--color-surface-low)",
        border: "1px solid var(--color-surface-highest)",
        borderRadius: "6px",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <p
        style={{
          fontFamily: "'Manrope', var(--font-manrope), sans-serif",
          fontSize: "12px",
          color: "var(--color-text-muted)",
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
          color: "var(--color-secondary)",
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
