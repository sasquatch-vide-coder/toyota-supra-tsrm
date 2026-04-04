import type { Metadata } from "next";
import { getModel } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import FixCard from "@/components/FixCard";
import type { FixCardData } from "@/components/FixCard";
import FixesBrowser from "./FixesBrowser";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string }>;
}): Promise<Metadata> {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  return {
    title: `Community Fixes — ${modelDef.name}`,
    description: `Verified community repair solutions for the ${modelDef.name} from SupraForums`,
    alternates: { canonical: `/${model}/fixes` },
  };
}

export default async function FixesBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ model: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { model } = await params;
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "confidence";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Fetch fixes
  const { data: fixesData } = await supabaseAdmin.rpc("search_fixes", {
    search_query: query,
    filter_model: model,
    filter_category: category || null,
    sort_by: query ? "relevance" : sort,
    result_limit: pageSize,
    result_offset: offset,
  });

  // Fetch category counts
  const { data: categoryData } = await supabaseAdmin.rpc("get_fix_category_counts", {
    filter_model: model,
  });

  const fixes: FixCardData[] = (fixesData ?? []).map((f: Record<string, unknown>) => ({
    thread_id: f.thread_id as string,
    title: f.title as string,
    category: f.category as string,
    subcategory: f.subcategory as string | undefined,
    source_urls: (f.source_urls as string[]) || [],
    problem_description: f.problem_description as string,
    symptoms: (f.symptoms as string[]) || [],
    fix_summary: f.fix_summary as string,
    difficulty: f.difficulty as string,
    estimated_time: f.estimated_time as string | undefined,
    confidence: f.confidence as number,
    confirmation_type: f.confirmation_type as string,
    thread_date: f.thread_date as string | undefined,
    parts_needed: (f.parts_needed as string[]) || [],
  }));

  const totalCount = fixesData?.[0]?.total_count ?? 0;
  const totalPages = Math.ceil(Number(totalCount) / pageSize);
  const categories: { category: string; fix_count: number }[] = (categoryData ?? []).map(
    (c: Record<string, unknown>) => ({
      category: c.category as string,
      fix_count: Number(c.fix_count),
    })
  );
  const totalFixes = categories.reduce((sum, c) => sum + c.fix_count, 0);

  return (
    <FixesBrowser
      model={model}
      fixes={fixes}
      categories={categories}
      totalFixes={totalFixes}
      totalCount={Number(totalCount)}
      totalPages={totalPages}
      currentPage={page}
      currentCategory={category}
      currentSort={sort}
      currentQuery={query}
    />
  );
}
