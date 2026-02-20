"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface MetricPoint {
  recorded_at: string;
  cpu_pct: number;
  mem_pct: number;
  net_rx_mb: number;
  net_tx_mb: number;
}

export function SystemMetricsChart({ data }: { data: MetricPoint[] }) {
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
          No server metrics yet — data appears after the first cron run
        </p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    bandwidth: +(d.net_rx_mb + d.net_tx_mb).toFixed(3),
    label: new Date(d.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  const maxBw = Math.max(...chartData.map((d) => d.bandwidth), 0.1);
  const avgCpu = (chartData.reduce((s, d) => s + d.cpu_pct, 0) / chartData.length).toFixed(1);
  const avgMem = (chartData.reduce((s, d) => s + d.mem_pct, 0) / chartData.length).toFixed(1);
  const totalBw = chartData.reduce((s, d) => s + d.bandwidth, 0);
  const bwLabel = totalBw >= 1024 ? `${(totalBw / 1024).toFixed(1)} GB` : `${totalBw.toFixed(1)} MB`;

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
          Server Metrics
        </h3>
        <div style={{ display: "flex", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
            Avg CPU: <strong style={{ color: "#C41E3A" }}>{avgCpu}%</strong>
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
            Avg Mem: <strong style={{ color: "#8B7355" }}>{avgMem}%</strong>
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)" }}>
            Bandwidth: <strong style={{ color: "#2D8A4E" }}>{bwLabel}</strong>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.floor(chartData.length / 8))}
          />
          <YAxis
            yAxisId="pct"
            domain={[0, 100]}
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            yAxisId="bw"
            orientation="right"
            domain={[0, Math.ceil(maxBw * 1.2)]}
            tick={{ fontFamily: "monospace", fontSize: 10, fill: "#8B7355" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v} MB`}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, name: string) => {
              if (name === "Bandwidth") return [`${value.toFixed(2)} MB`, name];
              return [`${value.toFixed(1)}%`, name];
            }) as any}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="cpu_pct"
            name="CPU"
            stroke="#C41E3A"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#C41E3A" }}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="mem_pct"
            name="Memory"
            stroke="#8B7355"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#8B7355" }}
          />
          <Line
            yAxisId="bw"
            type="monotone"
            dataKey="bandwidth"
            name="Bandwidth"
            stroke="#2D8A4E"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#2D8A4E" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
