import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SearchResult } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const model = request.nextUrl.searchParams.get("model") ?? "mk3";

  if (query.length < 2) {
    return NextResponse.json(
      { results: [], error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: query,
      match_count: 20,
      filter_model: model,
    });

    if (error) {
      console.error("hybrid_search error:", error);
    }

    const results: SearchResult[] = (data ?? []) as SearchResult[];

    const response = NextResponse.json({ results });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { results: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
