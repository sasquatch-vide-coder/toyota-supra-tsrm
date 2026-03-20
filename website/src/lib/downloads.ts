import fs from "fs";
import path from "path";

interface DownloadManifestEntry {
  size: number;
  images: number;
  built: string;
  filename: string;
}

export interface DownloadInfo {
  url: string;
  sizeFormatted: string;
  images: number;
  filename: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000)
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${bytes} B`;
}

export function getDownloadInfo(model: string): DownloadInfo | null {
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "downloads",
    "manifest.json"
  );
  try {
    const manifest: Record<string, DownloadManifestEntry> = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );
    const entry = manifest[model];
    if (!entry) return null;
    return {
      url: `/downloads/${entry.filename}`,
      sizeFormatted: formatBytes(entry.size),
      images: entry.images,
      filename: entry.filename,
    };
  } catch {
    return null;
  }
}
