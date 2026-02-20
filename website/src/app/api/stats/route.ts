import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "today";

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

  const [
    metricsResult,
    contentResult,
    dailyVisitorsResult,
    liveSessionsResult,
    heatmapResult,
  ] = await Promise.all([
    supabaseAdmin.rpc("get_dashboard_metrics", { since }),
    supabaseAdmin.rpc("get_content_breakdown", { since }),
    supabaseAdmin.rpc("get_daily_visitors", { since }),
    supabaseAdmin.rpc("get_live_sessions"),
    supabaseAdmin.rpc("get_hourly_heatmap", { since }),
  ]);

  if (metricsResult.error) {
    console.error("Stats metrics error:", metricsResult.error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  return NextResponse.json({
    unique_sessions: metricsResult.data.unique_sessions,
    prev_unique_sessions: metricsResult.data.prev_unique_sessions,
    active_now: (liveSessionsResult.data ?? []).length,
    content_breakdown: (contentResult.data ?? []).filter(
      (r: { model: string }) =>
        r.model === "MK4 Supra" || r.model === "MK3 Supra" || r.model === "MK2 Celica-Supra"
    ),
    daily_visitors: dailyVisitorsResult.data ?? [],
    hourly_heatmap: heatmapResult.data ?? [],
  });
}
