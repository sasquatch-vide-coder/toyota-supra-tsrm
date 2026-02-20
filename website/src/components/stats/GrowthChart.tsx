"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
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

function computeMA(data: { visitors: number }[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += data[j].visitors;
    return Math.round((sum / window) * 10) / 10;
  });
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
          border: "1px solid #D4C9B8",
          borderRadius: "8px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "280px",
        }}
      >
        <p style={{ fontFamily: "Georgia, serif", color: "#8B7355", fontSize: "14px" }}>
          No growth data yet
        </p>
      </div>
    );
  }

  const ma7 = computeMA(data, 7);
  const chartData = data.map((d, i) => ({
    ...d,
    label: new Date(d.day).toLocaleDateString([], { month: "short", day: "numeric" }),
    ma7: ma7[i],
  }));

  // Calculate total and average
  const totalVisitors = data.reduce((s, d) => s + d.visitors, 0);
  const activeDays = data.filter((d) => d.visitors > 0).length;
  const avgDaily = activeDays > 0 ? (totalVisitors / activeDays).toFixed(1) : "0";

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
          marginBottom: "20px",
        }}
      >
        <h3
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "15px",
            color: "#1A1A1A",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          Visitor Growth — {periodLabels[period] ?? period}
        </h3>
        <div style={{ display: "flex", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#8B7355" }}>
            Total: <strong style={{ color: "#1A1A1A" }}>{totalVisitors}</strong>
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#8B7355" }}>
            Daily avg: <strong style={{ color: "#1A1A1A" }}>{avgDaily}</strong>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
              border: "1px solid #D4C9B8",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#1A1A1A", marginBottom: "4px" }}
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
          <Line
            type="monotone"
            dataKey="ma7"
            name="7-day avg"
            stroke="#8B7355"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
            activeDot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
