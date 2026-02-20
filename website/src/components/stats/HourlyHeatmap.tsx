"use client";

import { Fragment } from "react";

interface HeatmapPoint {
  dow: number;
  hour: number;
  views: number;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export function HourlyHeatmap({ data }: { data: HeatmapPoint[] }) {
  if (!data.length) {
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
          No heatmap data yet
        </p>
      </div>
    );
  }

  // Build a 7x24 grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxViews = 0;
  for (const point of data) {
    grid[point.dow][point.hour] = point.views;
    if (point.views > maxViews) maxViews = point.views;
  }

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
          margin: "0 0 16px 0",
        }}
      >
        Traffic Heatmap
      </h3>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, 1fr)", gap: "2px", minWidth: "500px" }}>
          {/* Hour labels row */}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`h-${h}`}
              style={{
                fontFamily: "monospace",
                fontSize: "8px",
                color: "var(--color-tan)",
                textAlign: "center",
              }}
            >
              {h % 3 === 0 ? formatHour(h) : ""}
            </div>
          ))}

          {/* Day rows */}
          {dayLabels.map((day, dow) => (
            <Fragment key={`row-${dow}`}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  color: "var(--color-tan)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: "6px",
                }}
              >
                {day}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const views = grid[dow][h];
                const intensity = maxViews > 0 ? views / maxViews : 0;
                return (
                  <div
                    key={`cell-${dow}-${h}`}
                    style={{
                      aspectRatio: "1",
                      borderRadius: "2px",
                      background:
                        intensity === 0
                          ? "var(--color-cream)"
                          : `rgba(196, 30, 58, ${(intensity * 0.85 + 0.15).toFixed(3)})`,
                      minHeight: "14px",
                      cursor: "default",
                    }}
                    title={`${day} ${formatHour(h)}: ${views} views`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "4px",
          marginTop: "8px",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: "9px", color: "var(--color-tan)" }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              background: v === 0 ? "var(--color-cream)" : `rgba(196, 30, 58, ${(v * 0.85 + 0.15).toFixed(2)})`,
            }}
          />
        ))}
        <span style={{ fontFamily: "monospace", fontSize: "9px", color: "var(--color-tan)" }}>More</span>
      </div>
    </div>
  );
}
