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

export function CumulativeChart({ data, period = "7d" }: { data: DailyData[]; period?: string }) {
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

  let cumulative = 0;
  const chartData = data.map((d) => {
    cumulative += d.visitors;
    return {
      label: new Date(d.day).toLocaleDateString([], { month: "short", day: "numeric" }),
      total: cumulative,
    };
  });

  const totalVisitors = cumulative;

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
          Total Visitors — {periodLabels[period] ?? period}
        </h3>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
          Total: <strong style={{ color: "var(--color-dark)" }}>{totalVisitors.toLocaleString()}</strong>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B7355" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#8B7355" stopOpacity={0} />
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
            dataKey="total"
            name="Total Visitors"
            stroke="#8B7355"
            strokeWidth={2}
            fill="url(#cumulativeGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#8B7355" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
