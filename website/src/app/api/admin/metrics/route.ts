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

  const { data, error } = await supabaseAdmin.rpc("get_dashboard_metrics", {
    since,
  });

  if (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }

  return NextResponse.json(data);
}
