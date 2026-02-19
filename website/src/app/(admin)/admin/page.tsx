"use client";

import { useEffect, useState, useCallback } from "react";
import { MetricCard } from "@/components/admin/MetricCard";
import { TopReferrers } from "@/components/admin/TopReferrers";
import { TrafficChart } from "@/components/admin/TrafficChart";
import { PeakHoursChart } from "@/components/admin/PeakHoursChart";
import { NewVsReturning } from "@/components/admin/NewVsReturning";

type Period = "today" | "7d" | "30d" | "all";

interface TimeseriesPoint {
  ts: string;
  mk4: number;
  mk3: number;
  mk2: number;
  other: number;
}

interface HourData {
  hour: number;
  views: number;
}

interface Metrics {
  total_views: number;
  unique_sessions: number;
  active_now: number;
  bounce_rate: number;
  avg_duration_seconds: number;
  new_sessions: number;
  returning_sessions: number;
  top_referrers: { referrer: string; count: number }[];
  timeseries: TimeseriesPoint[];
  peak_hours: HourData[];
}

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All Time" },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("today");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/metrics?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMetrics(data);
      setError("");
    } catch {
      setError("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const bucket = period === "today" ? "hour" : "day";

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "22px",
            fontWeight: 700,
            color: "#1A1A1A",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          Dashboard
        </h1>

        {/* Period selector */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: "#FFFFFF",
            border: "1px solid #D4C9B8",
            borderRadius: "6px",
            padding: "3px",
          }}
        >
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                padding: "5px 12px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: period === p.value ? "#C41E3A" : "transparent",
                color: period === p.value ? "#FFFFFF" : "#8B7355",
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(196,30,58,0.08)",
            border: "1px solid rgba(196,30,58,0.3)",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "24px",
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#C41E3A",
          }}
        >
          {error}
        </div>
      )}

      {loading && !metrics ? (
        /* Skeleton */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #D4C9B8",
                borderRadius: "8px",
                padding: "20px",
                borderLeft: "4px solid #D4C9B8",
                height: "90px",
              }}
            />
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Row 1: 5 metric cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <MetricCard label="Visitors" value={metrics.unique_sessions.toLocaleString()} />
            <MetricCard label="Page Views" value={metrics.total_views.toLocaleString()} />
            <MetricCard label="Active Now" value={metrics.active_now} />
            <MetricCard label="Bounce Rate" value={`${metrics.bounce_rate}%`} />
            <MetricCard label="Avg Duration" value={formatDuration(metrics.avg_duration_seconds)} />
          </div>

          {/* Row 2: Traffic chart (full width) */}
          <div style={{ marginBottom: "24px" }}>
            <TrafficChart data={metrics.timeseries} bucket={bucket} />
          </div>

          {/* Row 3: New vs Returning + Peak Hours */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <NewVsReturning
              newSessions={metrics.new_sessions}
              returningSessions={metrics.returning_sessions}
            />
            <PeakHoursChart data={metrics.peak_hours} />
          </div>

          {/* Row 4: Top Referrers (full width) */}
          <TopReferrers referrers={metrics.top_referrers} />
        </>
      ) : null}
    </div>
  );
}
