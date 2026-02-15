import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SearchResult, FAQResult, ForumResult } from "@/types";

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
  const source = request.nextUrl.searchParams.get("source");

  if (query.length < 2) {
    return NextResponse.json(
      { results: [], faqs: [], forum: [], error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    // Generate embedding if OpenAI key is available
    const queryEmbedding = await getQueryEmbedding(query);

    // Build parallel search calls based on source filter
    const searches: Promise<{ data: unknown; error: unknown }>[] = [];

    const searchManual = !source || source === "manual";
    const searchFaq = !source || source === "faq";
    const searchForum = !source || source === "forum";

    searches.push(
      searchManual
        ? supabase.rpc("hybrid_search", {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: 20,
          })
        : Promise.resolve({ data: [], error: null })
    );

    searches.push(
      searchFaq
        ? supabase.rpc("search_faqs", {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: 5,
          })
        : Promise.resolve({ data: [], error: null })
    );

    searches.push(
      searchForum
        ? supabase.rpc("search_forum_threads", {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: 10,
          })
        : Promise.resolve({ data: [], error: null })
    );

    const [pagesResult, faqsResult, forumResult] = await Promise.all(searches);

    if (pagesResult.error) {
      console.error("hybrid_search error:", pagesResult.error);
    }
    if (faqsResult.error) {
      console.error("search_faqs error:", faqsResult.error);
    }
    if (forumResult.error) {
      console.error("search_forum_threads error:", forumResult.error);
    }

    const results: SearchResult[] = (pagesResult.data as SearchResult[]) ?? [];
    const faqs: FAQResult[] = (faqsResult.data as FAQResult[]) ?? [];
    const forum: ForumResult[] = (forumResult.data as ForumResult[]) ?? [];

    const response = NextResponse.json({ results, faqs, forum });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return response;
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { results: [], faqs: [], forum: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
