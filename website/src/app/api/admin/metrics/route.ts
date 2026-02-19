import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Use 'hour' bucket for today, 'day' for longer periods
  const bucket = period === "today" ? "hour" : "day";

  const [metricsResult, timeseriesResult, peakHoursResult] = await Promise.all([
    supabaseAdmin.rpc("get_dashboard_metrics", { since }),
    supabaseAdmin.rpc("get_traffic_timeseries", { since, bucket }),
    supabaseAdmin.rpc("get_peak_hours", { since }),
  ]);

  if (metricsResult.error) {
    console.error("Dashboard metrics error:", metricsResult.error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  return NextResponse.json({
    ...metricsResult.data,
    timeseries: timeseriesResult.data ?? [],
    peak_hours: peakHoursResult.data ?? [],
  });
}
