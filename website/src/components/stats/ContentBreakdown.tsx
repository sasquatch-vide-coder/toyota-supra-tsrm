"use client";

interface ContentItem {
  model: string;
  views: number;
  pct: number;
}

const modelColors: Record<string, string> = {
  "MK4 Supra": "var(--color-red)",
  "MK3 Supra": "var(--color-tan)",
  "MK2 Celica-Supra": "var(--color-brown)",
  "Homepage": "#6B8E7B",
  "Landing Variants": "#7B9BAE",
  "Search": "#B8860B",
  "Other": "var(--color-border)",
};

const modelOrder = ["MK2 Celica-Supra", "MK3 Supra", "MK4 Supra"];

export function ContentBreakdown({ data }: { data: ContentItem[] }) {
  const sorted = [...data].sort((a, b) => {
    const ai = modelOrder.indexOf(a.model);
    const bi = modelOrder.indexOf(b.model);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  if (!sorted.length) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
        }}
      >
        <p style={{ fontFamily: "Georgia, serif", color: "var(--color-tan)", fontSize: "14px" }}>
          No data yet
        </p>
      </div>
    );
  }

  const total = sorted.reduce((sum, d) => sum + d.views, 0);
  const maxViews = Math.max(...sorted.map((d) => d.views));

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "20px",
      }}
    >
      <h3
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "15px",
          color: "var(--color-dark)",
          margin: "0 0 6px 0",
          letterSpacing: "0.02em",
        }}
      >
        Content Breakdown
      </h3>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          color: "var(--color-tan)",
          margin: "0 0 16px 0",
        }}
      >
        {total.toLocaleString()} total views
      </p>

      {/* Stacked bar */}
      <div
        style={{
          display: "flex",
          height: "8px",
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        {sorted.map((item) => (
          <div
            key={item.model}
            style={{
              width: `${item.pct}%`,
              background: modelColors[item.model] || "#D4C9B8",
              minWidth: item.pct > 0 ? "2px" : 0,
            }}
            title={`${item.model}: ${item.pct}%`}
          />
        ))}
      </div>

      {/* Legend rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sorted.map((item) => (
          <div key={item.model} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                background: modelColors[item.model] || "#D4C9B8",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "13px",
                color: "var(--color-dark)",
                width: "140px",
                flexShrink: 0,
              }}
            >
              {item.model}
            </span>
            <div style={{ flex: 1, position: "relative", height: "6px" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--color-cream)",
                  borderRadius: "3px",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${(item.views / maxViews) * 100}%`,
                  background: modelColors[item.model] || "#D4C9B8",
                  borderRadius: "3px",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                color: "var(--color-tan)",
                width: "80px",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {item.views.toLocaleString()} ({item.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
