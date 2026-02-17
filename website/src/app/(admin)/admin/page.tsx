"use client";

import { useEffect, useState, useCallback } from "react";
import { MetricCard } from "@/components/admin/MetricCard";
import { TopPages } from "@/components/admin/TopPages";
import { TopReferrers } from "@/components/admin/TopReferrers";

type Period = "today" | "7d" | "30d" | "all";

interface Metrics {
  total_views: number;
  unique_sessions: number;
  active_now: number;
  bounce_rate: number;
  avg_duration_seconds: number;
  top_pages: { path: string; views: number }[];
  top_referrers: { referrer: string; count: number }[];
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

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p.value
                  ? "bg-red-600/20 text-red-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !metrics ? (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse"
            >
              <div className="h-3 bg-gray-800 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-5 gap-4 mb-6">
            <MetricCard
              label="Visitors"
              value={metrics.unique_sessions.toLocaleString()}
              color="blue"
            />
            <MetricCard
              label="Page Views"
              value={metrics.total_views.toLocaleString()}
              color="green"
            />
            <MetricCard
              label="Active Now"
              value={metrics.active_now}
              color="red"
            />
            <MetricCard
              label="Bounce Rate"
              value={`${metrics.bounce_rate}%`}
              color="amber"
            />
            <MetricCard
              label="Avg Duration"
              value={formatDuration(metrics.avg_duration_seconds)}
              color="gray"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TopPages pages={metrics.top_pages} />
            <TopReferrers referrers={metrics.top_referrers} />
          </div>
        </>
      ) : null}
    </div>
  );
}
