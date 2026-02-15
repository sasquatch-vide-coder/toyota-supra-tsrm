import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SearchResult, FAQResult } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const openaiKey = process.env.OPENAI_API_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!openaiKey) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: openaiKey });
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    return response.data[0].embedding;
  } catch {
    console.error("Failed to generate query embedding, falling back to FTS-only");
    return null;
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json(
      { results: [], faqs: [], error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    // Generate embedding if OpenAI key is available
    const queryEmbedding = await getQueryEmbedding(query);

    // Run both searches in parallel
    const [pagesResult, faqsResult] = await Promise.all([
      supabase.rpc("hybrid_search", {
        query_text: query,
        query_embedding: queryEmbedding,
        match_count: 20,
      }),
      supabase.rpc("search_faqs", {
        query_text: query,
        query_embedding: queryEmbedding,
        match_count: 5,
      }),
    ]);

    if (pagesResult.error) {
      console.error("hybrid_search error:", pagesResult.error);
    }
    if (faqsResult.error) {
      console.error("search_faqs error:", faqsResult.error);
    }

    const results: SearchResult[] = pagesResult.data ?? [];
    const faqs: FAQResult[] = faqsResult.data ?? [];

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
