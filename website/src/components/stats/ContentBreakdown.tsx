"use client";

interface ContentItem {
  model: string;
  views: number;
  pct: number;
}

const modelColors: Record<string, string> = {
  "MK4 Supra": "#C41E3A",
  "MK3 Supra": "#8B7355",
  "MK2 Celica-Supra": "#4A3A2A",
  "Homepage": "#6B8E7B",
  "Landing Variants": "#7B9BAE",
  "Search": "#B8860B",
  "Other": "#D4C9B8",
};

export function ContentBreakdown({ data }: { data: ContentItem[] }) {
  if (!data.length) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #D4C9B8",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
        }}
      >
        <p style={{ fontFamily: "Georgia, serif", color: "#8B7355", fontSize: "14px" }}>
          No data yet
        </p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.views, 0);
  const maxViews = Math.max(...data.map((d) => d.views));

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
          color: "#8B7355",
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
        {data.map((item) => (
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
        {data.map((item) => (
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
                color: "#1A1A1A",
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
                  background: "#F5F0E8",
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
                color: "#8B7355",
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
