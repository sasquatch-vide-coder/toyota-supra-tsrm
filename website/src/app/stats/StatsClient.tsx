"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/stats/MetricCard";
import { GrowthChart } from "@/components/stats/GrowthChart";
import { ContentBreakdown } from "@/components/stats/ContentBreakdown";
import { HourlyHeatmap } from "@/components/stats/HourlyHeatmap";
import { CumulativeChart } from "@/components/stats/CumulativeChart";
import { SystemMetricsChart } from "@/components/stats/SystemMetricsChart";

type Period = "today" | "7d" | "30d" | "all";

interface Stats {
  unique_sessions: number;
  prev_unique_sessions: number;
  active_now: number;
  content_breakdown: { model: string; views: number; pct: number }[];
  daily_visitors: { day: string; visitors: number; views: number }[];
  hourly_heatmap: { dow: number; hour: number; views: number }[];
  system_metrics: { recorded_at: string; cpu_pct: number; mem_pct: number; net_rx_mb: number; net_tx_mb: number }[];
  download_counts: { model: string; downloads: number }[];
}

const periods: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export default function StatsClient() {
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
      className="stats-container"
      style={{
        minHeight: "100vh",
        background: "var(--color-surface)",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header row */}
        <div
          className="stats-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div>
            <Link href="/" style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "11px", color: "var(--color-text-muted)", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ← TSRM
            </Link>
            <h1
              style={{
                fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: "4px 0 0 0",
                letterSpacing: "0.02em",
              }}
            >
              Site Stats
            </h1>
            {lastUpdated && (
              <p
                style={{
                  fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                  fontSize: "10px",
                  color: "var(--color-text-faint)",
                  margin: "4px 0 0 0",
                }}
              >
                Updated {lastUpdated.toLocaleTimeString()} · auto-refresh 30s
              </p>
            )}
          </div>

          {/* Metric cards inline in header */}
          {stats && (
            <div className="stats-metrics" style={{ display: "flex", gap: "12px" }}>
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
              background: "var(--color-surface-highest)",
              border: "1px solid var(--color-surface-highest)",
              borderRadius: "6px",
              padding: "3px",
            }}
          >
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  fontFamily: "'Manrope', var(--font-manrope), sans-serif",
                  fontSize: "12px",
                  padding: "5px 14px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background: period === p.value ? "linear-gradient(135deg, var(--color-primary-dim), var(--color-primary))" : "transparent",
                  color: period === p.value ? "#FFFFFF" : "var(--color-text-muted)",
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
              background: "rgba(255, 110, 129, 0.08)",
              border: "1px solid rgba(255, 110, 129, 0.3)",
              borderRadius: "6px",
              padding: "12px 16px",
              marginBottom: "24px",
              fontFamily: "'Manrope', var(--font-manrope), sans-serif",
              fontSize: "13px",
              color: "var(--color-tertiary)",
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
                background: "var(--color-surface-low)",
                border: "1px solid var(--color-surface-highest)",
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
            <div style={{ marginBottom: "24px" }}>
              <SystemMetricsChart data={stats.system_metrics} />
            </div>

            {/* Downloads, content breakdown, and heatmap */}
            <div
              className="stats-bottom-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <ContentBreakdown data={stats.content_breakdown} />
              <HourlyHeatmap data={stats.hourly_heatmap} />
            </div>

            {/* Download counts */}
            {(() => {
              const countMap = Object.fromEntries(stats.download_counts.map((d) => [d.model, d.downloads]));
              const models = [
                { id: "mk2", label: "MK2 Supra" },
                { id: "mk3", label: "MK3 Supra" },
                { id: "mk4", label: "MK4 Supra" },
              ];
              return (
                <div
                  style={{
                    marginTop: "24px",
                    background: "var(--color-surface-low)",
                    border: "1px solid var(--color-surface-highest)",
                    borderRadius: "8px",
                    padding: "20px 24px",
                  }}
                >
                  <p style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 16px 0" }}>
                    Downloads
                  </p>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {models.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          flex: "1 1 120px",
                          padding: "12px 16px",
                          background: "var(--color-surface-mid)",
                          borderRadius: "6px",
                          border: "1px solid var(--color-surface-highest)",
                        }}
                      >
                        <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 4px 0" }}>
                          {m.label}
                        </p>
                        <p style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: 900, color: "var(--color-secondary)", margin: 0 }}>
                          {(countMap[m.id] || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        ) : null}
      </div>
    </div>
  );
}
