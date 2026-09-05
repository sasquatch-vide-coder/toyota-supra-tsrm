import fs from "fs";
import path from "path";
import { PageData } from "@/types";

/** Load one page's JSON from src/content/{contentDir}/{section}/{page}.json (contentDir e.g. "mk3" or "mk3-ewd"). */
export function loadPage(contentDir: string, section: string, page: number): PageData | null {
  const filePath = path.join(process.cwd(), "src", "content", contentDir, section, `${page}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
