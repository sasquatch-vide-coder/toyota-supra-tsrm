import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModel } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase/admin";
import FixDetail from "@/components/FixDetail";
import type { FixDetailData } from "@/components/FixDetail";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string; thread_id: string }>;
}): Promise<Metadata> {
  const { model, thread_id } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  const { data } = await supabaseAdmin
    .from("forum_fixes")
    .select("title, category, fix_summary")
    .eq("thread_id", thread_id)
    .eq("model", model)
    .single();

  if (!data) return {};

  return {
    title: `${data.title} — ${modelDef.name} Community Fixes`,
    description: `${data.category}: ${data.fix_summary}`,
    alternates: { canonical: `/${model}/fixes/${thread_id}` },
  };
}

export default async function FixDetailPage({
  params,
}: {
  params: Promise<{ model: string; thread_id: string }>;
}) {
  const { model, thread_id } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const { data, error } = await supabaseAdmin
    .from("forum_fixes")
    .select("*")
    .eq("thread_id", thread_id)
    .eq("model", model)
    .single();

  if (error || !data) notFound();

  const fix: FixDetailData = {
    thread_id: data.thread_id,
    title: data.title,
    category: data.category,
    subcategory: data.subcategory,
    source_urls: data.source_urls,
    problem_description: data.problem_description,
    symptoms: data.symptoms || [],
    root_cause: data.root_cause,
    fix_summary: data.fix_summary,
    difficulty: data.difficulty,
    confidence: data.confidence,
    confirmation_type: data.confirmation_type,
    thread_date: data.thread_date,
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
      <FixDetail fix={fix} />

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
              {
                "@type": "ListItem",
                position: 4,
                name: data.title,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
