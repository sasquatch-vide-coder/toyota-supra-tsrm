import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModel } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import IssueDetail from "@/components/IssueDetail";
import { systemLabel } from "@/components/IssueCard";
import type { IssueData } from "@/components/IssueCard";

// DB-backed: always render fresh so added/removed issues reflect immediately
// (avoids serving stale cached pages for slugs that no longer exist).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string; slug: string }>;
}): Promise<Metadata> {
  const { model, slug } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  const { data } = await supabaseAdmin
    .from("forum_issues")
    .select("issue, system, thread_count")
    .eq("slug", slug)
    .eq("model", model)
    .single();

  if (!data) return {};

  return {
    title: `${data.issue} — ${modelDef.name} Community Fixes`,
    description: `${systemLabel(data.system)}: "${data.issue}" — confirmed fixed in ${data.thread_count} ${modelDef.name} forum threads on SupraForums.`,
    alternates: { canonical: `/${model}/fixes/${slug}` },
  };
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ model: string; slug: string }>;
}) {
  const { model, slug } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const { data, error } = await supabaseAdmin
    .from("forum_issues")
    .select("*")
    .eq("slug", slug)
    .eq("model", model)
    .single();

  if (error || !data) notFound();

  const issue: IssueData = {
    slug: data.slug,
    system: data.system,
    issue: data.issue,
    thread_count: data.thread_count,
    threads: data.threads || [],
  };

  return (
    <div>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 24px 0" }}>
        <Link
          href={`/${model}/fixes`}
          style={{
            fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-faint)",
            textDecoration: "none",
            transition: "color 0.15s",
          }}
        >
          &larr; Back to fixes
        </Link>
      </div>
      <IssueDetail issue={issue} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "TSRM", item: "https://tsrm.sasquatchvc.com" },
              { "@type": "ListItem", position: 2, name: modelDef.name, item: `https://tsrm.sasquatchvc.com/${model}` },
              { "@type": "ListItem", position: 3, name: "Community Fixes", item: `https://tsrm.sasquatchvc.com/${model}/fixes` },
              { "@type": "ListItem", position: 4, name: data.issue },
            ],
          }),
        }}
      />
    </div>
  );
}
