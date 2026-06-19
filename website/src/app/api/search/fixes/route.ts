import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const model = request.nextUrl.searchParams.get("model") ?? "mk3";
  const system = request.nextUrl.searchParams.get("system") || null;
  const sort = request.nextUrl.searchParams.get("sort") ?? "threads";
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);

  try {
    const { data, error } = await supabase.rpc("search_issues", {
      search_query: q,
      filter_model: model,
      filter_system: system,
      sort_by: q ? "relevance" : sort,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) {
      console.error("search_issues error:", error);
      return NextResponse.json({ results: [], total: 0, error: "Search failed" }, { status: 500 });
    }

    const results = data ?? [];
    const total = results.length > 0 ? results[0].total_count : 0;

    const response = NextResponse.json({ results, total });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=3600"
    );
    return response;
  } catch (error) {
    console.error("Issues search API error:", error);
    return NextResponse.json({ results: [], total: 0, error: "Search failed" }, { status: 500 });
  }
}
