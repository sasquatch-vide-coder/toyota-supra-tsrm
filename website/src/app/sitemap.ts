import fs from "fs";
import path from "path";
import type { MetadataRoute } from "next";
import { getModelIds } from "@/lib/models";
import { loadSections } from "@/lib/sections";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Last time a content set was regenerated (sections.json mtime); undefined if unknown. */
function contentLastModified(contentDir: string): Date | undefined {
  try {
    return fs.statSync(path.join(process.cwd(), "src", "content", contentDir, "sections.json")).mtime;
  } catch {
    return undefined;
  }
}

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
    const tsrmSections = loadSections(model);
    const ewdSections = loadSections(`${model}-ewd`);
    const tsrmMod = contentLastModified(model);
    const ewdMod = contentLastModified(`${model}-ewd`);

    // Model hub page
    entries.push({
      url: `${baseUrl}/${model}`,
      lastModified: tsrmMod ?? ewdMod,
      changeFrequency: "monthly",
      priority: 0.9,
    });

    // ── Repair manual (TSRM) ──
    if (tsrmSections.length > 0) {
      entries.push({
        url: `${baseUrl}/${model}/tsrm`,
        lastModified: tsrmMod,
        changeFrequency: "monthly",
        priority: 0.8,
      });

      for (const section of tsrmSections) {
        entries.push({
          url: `${baseUrl}/${model}/tsrm/${section.code}`,
          lastModified: tsrmMod,
          changeFrequency: "monthly",
          priority: 0.7,
        });
        if (section.page_index) {
          for (const page of section.page_index) {
            entries.push({
              url: `${baseUrl}/${model}/tsrm/${section.code}/${page.page}`,
              lastModified: tsrmMod,
              changeFrequency: "yearly",
              priority: 0.5,
            });
          }
        }
      }
    }

    // ── Wiring diagrams (EWD) ──
    if (ewdSections.length > 0) {
      entries.push({
        url: `${baseUrl}/${model}/ewd`,
        lastModified: ewdMod,
        changeFrequency: "monthly",
        priority: 0.8,
      });

      for (const section of ewdSections) {
        entries.push({
          url: `${baseUrl}/${model}/ewd/${section.code}`,
          lastModified: ewdMod,
          changeFrequency: "monthly",
          priority: 0.7,
        });
        if (section.page_index) {
          for (const page of section.page_index) {
            entries.push({
              url: `${baseUrl}/${model}/ewd/${section.code}/${page.page}`,
              lastModified: ewdMod,
              changeFrequency: "yearly",
              priority: 0.5,
            });
          }
        }
      }
    }
  }

  // ── Community issues (Supabase-backed) ──
  try {
    const { data: issues } = await supabaseAdmin
      .from("forum_issues")
      .select("model, slug");

    const modelsWithFixes = new Set<string>();
    if (issues) {
      for (const issue of issues as { model: string; slug: string }[]) {
        modelsWithFixes.add(issue.model);
        entries.push({
          url: `${baseUrl}/${issue.model}/fixes/${issue.slug}`,
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
    // If Supabase is unavailable at build time, skip issues — they'll be
    // discovered via internal links from the model landing pages.
  }

  return entries;
}
