import type { MetadataRoute } from "next";
import { getModelIds } from "@/lib/models";
import { loadSections } from "@/lib/sections";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://tsrm.sasquatchvc.com";
  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: baseUrl,
    changeFrequency: "monthly",
    priority: 1.0,
  });

  for (const model of getModelIds()) {
    // Model landing (redirects to first available document)
    entries.push({
      url: `${baseUrl}/${model}`,
      changeFrequency: "monthly",
      priority: 0.9,
    });

    // ── Repair manual (TSRM) ──
    const tsrmSections = loadSections(model);
    if (tsrmSections.length > 0) {
      entries.push({
        url: `${baseUrl}/${model}/tsrm`,
        changeFrequency: "monthly",
        priority: 0.8,
      });
      entries.push({
        url: `${baseUrl}/${model}/tsrm/search`,
        changeFrequency: "monthly",
        priority: 0.3,
      });

      for (const section of tsrmSections) {
        entries.push({
          url: `${baseUrl}/${model}/tsrm/${section.code}`,
          changeFrequency: "monthly",
          priority: 0.7,
        });
        if (section.page_index) {
          for (const page of section.page_index) {
            entries.push({
              url: `${baseUrl}/${model}/tsrm/${section.code}/${page.page}`,
              changeFrequency: "yearly",
              priority: 0.5,
            });
          }
        }
      }
    }

    // ── Wiring diagrams (EWD) ──
    const ewdSections = loadSections(`${model}-ewd`);
    if (ewdSections.length > 0) {
      entries.push({
        url: `${baseUrl}/${model}/ewd`,
        changeFrequency: "monthly",
        priority: 0.8,
      });

      for (const section of ewdSections) {
        entries.push({
          url: `${baseUrl}/${model}/ewd/${section.code}`,
          changeFrequency: "monthly",
          priority: 0.7,
        });
        if (section.page_index) {
          for (const page of section.page_index) {
            entries.push({
              url: `${baseUrl}/${model}/ewd/${section.code}/${page.page}`,
              changeFrequency: "yearly",
              priority: 0.5,
            });
          }
        }
      }
    }
  }

  // ── Community fixes (Supabase-backed) ──
  try {
    const { data: fixes } = await supabaseAdmin
      .from("forum_fixes")
      .select("model, thread_id");

    const modelsWithFixes = new Set<string>();
    if (fixes) {
      for (const fix of fixes as { model: string; thread_id: string }[]) {
        modelsWithFixes.add(fix.model);
        entries.push({
          url: `${baseUrl}/${fix.model}/fixes/${fix.thread_id}`,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
    for (const model of modelsWithFixes) {
      entries.push({
        url: `${baseUrl}/${model}/fixes`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // If Supabase is unavailable at build time, skip fixes — they'll be
    // discovered via internal links from the model landing pages.
  }

  return entries;
}
