import type { MetadataRoute } from "next";
import { getModelIds } from "@/lib/models";
import { loadSections } from "@/lib/sections";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tsrm.sasquatchvc.com";
  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: baseUrl,
    changeFrequency: "monthly",
    priority: 1.0,
  });

  for (const model of getModelIds()) {
    // Model page
    entries.push({
      url: `${baseUrl}/${model}`,
      changeFrequency: "monthly",
      priority: 0.9,
    });

    // Search page
    entries.push({
      url: `${baseUrl}/${model}/search`,
      changeFrequency: "monthly",
      priority: 0.3,
    });

    const sections = loadSections(model);
    for (const section of sections) {
      // Section page
      entries.push({
        url: `${baseUrl}/${model}/${section.code}`,
        changeFrequency: "monthly",
        priority: 0.7,
      });

      // Individual pages
      if (section.page_index) {
        for (const page of section.page_index) {
          entries.push({
            url: `${baseUrl}/${model}/${section.code}/${page.page}`,
            changeFrequency: "yearly",
            priority: 0.5,
          });
        }
      }
    }
  }

  return entries;
}
