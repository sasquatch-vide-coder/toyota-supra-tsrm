import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SearchResult, FAQResult } from "@/types";
import { getModel } from "@/lib/models";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const source = request.nextUrl.searchParams.get("source");
  const model = request.nextUrl.searchParams.get("model") ?? "mk3";

  if (query.length < 2) {
    return NextResponse.json(
      { results: [], faqs: [], error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const modelDef = getModel(model);

  try {
    const searchManual = !source || source === "manual";
    const searchFaq = !source || source === "faq";

    const empty = { data: [] as unknown[], error: null };

    const [pagesResult, faqsResult] = await Promise.all([
      searchManual
        ? supabase.rpc("hybrid_search", {
            query_text: query,
            match_count: 20,
            filter_model: model,
          })
        : empty,
      searchFaq
        ? supabase.rpc("search_faqs", {
            query_text: query,
            match_count: 5,
            filter_model: model,
          })
        : empty,
    ]);

    if (pagesResult.error) {
      console.error("hybrid_search error:", pagesResult.error);
    }
    if (faqsResult.error) {
      console.error("search_faqs error:", faqsResult.error);
    }

    const results: SearchResult[] = (pagesResult.data ?? []) as SearchResult[];
    const faqs: FAQResult[] = (faqsResult.data ?? []) as FAQResult[];

    const response = NextResponse.json({ results, faqs });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { results: [], faqs: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
