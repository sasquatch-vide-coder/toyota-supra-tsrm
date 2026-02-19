"use client";

interface HourData {
  hour: number;
  views: number;
}

export function PeakHoursChart({ data }: { data: HourData[] }) {
  // Normalize to 24 hours
  const hours: HourData[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    views: data.find((d) => d.hour === h)?.views ?? 0,
  }));

  const maxViews = Math.max(...hours.map((h) => h.views), 1);
  const peakHour = hours.reduce((a, b) => (a.views >= b.views ? a : b));

  function formatHour(h: number): string {
    if (h === 0) return "12a";
    if (h < 12) return `${h}a`;
    if (h === 12) return "12p";
    return `${h - 12}p`;
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #D4C9B8",
        borderRadius: "8px",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "15px",
            color: "#1A1A1A",
            margin: 0,
          }}
        >
          Peak Hours
        </h3>
        {maxViews > 0 && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#8B7355",
            }}
          >
            Peak: {formatHour(peakHour.hour)} ({peakHour.views} views)
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "3px",
          alignItems: "flex-end",
        }}
      >
        {hours.map(({ hour, views }) => {
          const opacity = maxViews > 0 ? (views / maxViews) * 0.9 + 0.05 : 0.05;
          return (
            <div
              key={hour}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
              title={`${formatHour(hour)}: ${views} views`}
            >
              <div
                style={{
                  width: "100%",
                  height: "40px",
                  background: `rgba(196, 30, 58, ${opacity.toFixed(3)})`,
                  borderRadius: "2px",
                }}
              />
              {hour % 6 === 0 && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "9px",
                    color: "#8B7355",
                  }}
                >
                  {formatHour(hour)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
