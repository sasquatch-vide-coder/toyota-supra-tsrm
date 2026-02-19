"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface TimeseriesPoint {
  ts: string;
  mk4: number;
  mk3: number;
  mk2: number;
  other: number;
}

function formatTs(ts: string, bucket: string): string {
  const d = new Date(ts);
  if (bucket === "hour") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function TrafficChart({
  data,
  bucket,
}: {
  data: TimeseriesPoint[];
  bucket: "hour" | "day";
}) {
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
          height: "220px",
        }}
      >
        <p style={{ fontFamily: "Georgia, serif", color: "#8B7355", fontSize: "14px" }}>
          No traffic data yet
        </p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: formatTs(d.ts, bucket),
  }));

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
          margin: "0 0 20px 0",
          letterSpacing: "0.05em",
        }}
      >
        — Traffic by Model
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
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
            itemStyle={{ color: "#8B7355" }}
          />
          <Legend
            wrapperStyle={{
              fontFamily: "monospace",
              fontSize: "11px",
              paddingTop: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="mk4"
            name="MK4"
            stroke="#C41E3A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="mk3"
            name="MK3"
            stroke="#8B7355"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="mk2"
            name="MK2"
            stroke="#4A3A2A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="other"
            name="Other"
            stroke="#D4C9B8"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
