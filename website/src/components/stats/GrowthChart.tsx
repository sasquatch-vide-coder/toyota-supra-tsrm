"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface DailyData {
  day: string;
  visitors: number;
  views: number;
}

const periodLabels: Record<string, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  all: "All Time",
};

export function GrowthChart({ data, period = "7d" }: { data: DailyData[]; period?: string }) {
  if (!data || data.length === 0) {
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
          height: "280px",
        }}
      >
        <p style={{ fontFamily: "Georgia, serif", color: "var(--color-tan)", fontSize: "14px" }}>
          No growth data yet
        </p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.day).toLocaleDateString([], { month: "short", day: "numeric" }),
  }));

  // Calculate total and average
  const totalVisitors = data.reduce((s, d) => s + d.visitors, 0);
  const activeDays = data.filter((d) => d.visitors > 0).length;
  const avgDaily = activeDays > 0 ? (totalVisitors / activeDays).toFixed(1) : "0";

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h3
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "15px",
            color: "var(--color-dark)",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          Daily Visitors — {periodLabels[period] ?? period}
        </h3>
        <div style={{ display: "flex", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
            Total: <strong style={{ color: "var(--color-dark)" }}>{totalVisitors}</strong>
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
            Daily avg: <strong style={{ color: "var(--color-dark)" }}>{avgDaily}</strong>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C41E3A" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#C41E3A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.floor(chartData.length / 8))}
          />
          <YAxis
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid var(--color-border)",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--color-dark)", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="visitors"
            name="Visitors"
            stroke="#C41E3A"
            strokeWidth={1.5}
            fill="url(#growthGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#C41E3A" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
