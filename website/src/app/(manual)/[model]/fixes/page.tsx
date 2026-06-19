import type { Metadata } from "next";
import { getModel } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { IssueData } from "@/components/IssueCard";
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
    description: `Common ${modelDef.name} problems grouped from confirmed-fix threads on SupraForums, each linking to the original discussions`,
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
  const modelDef = getModel(model);
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const system = typeof sp.system === "string" ? sp.system : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "threads";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data: issuesData } = await supabaseAdmin.rpc("search_issues", {
    search_query: query,
    filter_model: model,
    filter_system: system || null,
    sort_by: query ? "relevance" : sort,
    result_limit: pageSize,
    result_offset: offset,
  });

  const { data: systemData } = await supabaseAdmin.rpc("get_issue_system_counts", {
    filter_model: model,
  });

  const issues: IssueData[] = (issuesData ?? []).map((f: Record<string, unknown>) => ({
    slug: f.slug as string,
    system: f.system as string,
    issue: f.issue as string,
    thread_count: Number(f.thread_count),
    threads: (f.threads as IssueData["threads"]) || [],
  }));

  const totalCount = issuesData?.[0]?.total_count ?? 0;
  const totalPages = Math.ceil(Number(totalCount) / pageSize);
  const systems: { system: string; issue_count: number }[] = (systemData ?? []).map(
    (c: Record<string, unknown>) => ({
      system: c.system as string,
      issue_count: Number(c.issue_count),
    })
  );
  const totalIssues = systems.reduce((sum, c) => sum + c.issue_count, 0);

  return (
    <>
      <FixesBrowser
        model={model}
        issues={issues}
        systems={systems}
        totalIssues={totalIssues}
        totalCount={Number(totalCount)}
        totalPages={totalPages}
        currentPage={page}
        currentSystem={system}
        currentSort={sort}
        currentQuery={query}
      />
      {modelDef && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "TSRM",
                  item: "https://tsrm.sasquatchvc.com",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: modelDef.name,
                  item: `https://tsrm.sasquatchvc.com/${model}`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: "Community Fixes",
                  item: `https://tsrm.sasquatchvc.com/${model}/fixes`,
                },
              ],
            }),
          }}
        />
      )}
    </>
  );
}
