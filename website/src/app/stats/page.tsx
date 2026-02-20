"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/stats/MetricCard";
import { GrowthChart } from "@/components/stats/GrowthChart";
import { ContentBreakdown } from "@/components/stats/ContentBreakdown";
import { HourlyHeatmap } from "@/components/stats/HourlyHeatmap";
import { CumulativeChart } from "@/components/stats/CumulativeChart";

type Period = "today" | "7d" | "30d" | "all";

interface Stats {
  unique_sessions: number;
  prev_unique_sessions: number;
  active_now: number;
  content_breakdown: { model: string; views: number; pct: number }[];
  daily_visitors: { day: string; visitors: number; views: number }[];
  hourly_heatmap: { dow: number; hour: number; views: number }[];
}

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/stats?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setStats(data);
      setError("");
      setLastUpdated(new Date());
    } catch {
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAF8F4",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div>
            <Link href="/" style={{ fontFamily: "monospace", fontSize: "11px", color: "#8B7355", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ← TSRM
            </Link>
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "22px",
                fontWeight: 700,
                color: "#1A1A1A",
                margin: "4px 0 0 0",
                letterSpacing: "0.02em",
              }}
            >
              Site Stats
            </h1>
            {lastUpdated && (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "10px",
                  color: "#D4C9B8",
                  margin: "4px 0 0 0",
                }}
              >
                Updated {lastUpdated.toLocaleTimeString()} · auto-refresh 30s
              </p>
            )}
          </div>

          {/* Metric cards inline in header */}
          {stats && (
            <div style={{ display: "flex", gap: "12px" }}>
              <MetricCard
                label="Total Visitors"
                value={stats.unique_sessions.toLocaleString()}
                currentValue={stats.unique_sessions}
                prevValue={stats.prev_unique_sessions}
              />
              <MetricCard label="Active Now" value={stats.active_now} />
            </div>
          )}

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
                  padding: "5px 14px",
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

        {loading && !stats ? (
          /* Skeleton loading state */
          <div>
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #D4C9B8",
                borderRadius: "8px",
                height: "300px",
                marginBottom: "24px",
              }}
            />
          </div>
        ) : stats ? (
          <>
            {/* Charts full width */}
            <div style={{ marginBottom: "24px" }}>
              <CumulativeChart data={stats.daily_visitors} period={period} />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <GrowthChart data={stats.daily_visitors} period={period} />
            </div>

            {/* Content breakdown and heatmap side by side */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <ContentBreakdown data={stats.content_breakdown} />
              <HourlyHeatmap data={stats.hourly_heatmap} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
