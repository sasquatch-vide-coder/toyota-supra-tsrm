import fs from "fs";
import path from "path";
import { SectionInfo } from "@/types";

export function loadSections(): SectionInfo[] {
  const filePath = path.join(process.cwd(), "src", "content", "sections.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}
