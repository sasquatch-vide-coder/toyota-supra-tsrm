import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// 60-second response cache per period key
const cache = new Map<string, { data: object; ts: number }>();
const CACHE_TTL = 60_000;

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "today";

  // Check cache
  const cached = cache.get(period);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  let since: string;
  const now = new Date();
  switch (period) {
    case "7d":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "30d":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case "all":
      since = new Date(0).toISOString();
      break;
    case "today":
    default:
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      break;
  }

  // Refresh today's summary row (single UPSERT, scans only today's page_views)
  await supabaseAdmin.rpc("refresh_stats_daily");

  const [
    metricsResult,
    contentResult,
    dailyVisitorsResult,
    liveSessionsResult,
    heatmapResult,
    systemMetricsResult,
    downloadCountsResult,
  ] = await Promise.all([
    supabaseAdmin.rpc("get_stats_metrics", { since }),
    supabaseAdmin.rpc("get_stats_content", { since }),
    supabaseAdmin.rpc("get_stats_visitors", { since }),
    supabaseAdmin.rpc("get_live_sessions"),
    supabaseAdmin.rpc("get_hourly_heatmap", { since }),
    supabaseAdmin.rpc("get_system_metrics", { since }),
    supabaseAdmin.rpc("get_download_counts", { since }),
  ]);

  if (metricsResult.error) {
    console.error("Stats metrics error:", metricsResult.error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  const data = {
    unique_sessions: metricsResult.data.unique_sessions,
    prev_unique_sessions: metricsResult.data.prev_unique_sessions,
    active_now: (liveSessionsResult.data ?? []).length,
    content_breakdown: contentResult.data ?? [],
    daily_visitors: dailyVisitorsResult.data ?? [],
    hourly_heatmap: heatmapResult.data ?? [],
    system_metrics: systemMetricsResult.data ?? [],
    download_counts: downloadCountsResult.data ?? [],
  };

  cache.set(period, { data, ts: Date.now() });

  return NextResponse.json(data);
}
