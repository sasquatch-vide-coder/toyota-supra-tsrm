// Small helpers for building search-friendly titles/descriptions from OCR text.

const SMALL_WORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "in", "on", "or", "at", "by", "with", "from",
]);

// Common automotive acronyms that should stay upper-case when title-casing OCR headings.
const KEEP_UPPER = new Set([
  "EFI", "ECU", "ECT", "SST", "EGR", "PCV", "ABS", "SRS", "TEMS", "ISC", "VSV", "TCCS", "MAF",
  "TPS", "EVAP", "IAC", "SFI", "MFI", "TDC", "BDC", "OHC", "DOHC", "ATF", "MT", "AT", "TRAC",
  "ELR", "EWD", "TSRM", "USA", "PS", "LH", "RH", "FR", "RR", "EMS", "IIA", "AC", "DC", "CCO",
  "TWC", "HAC", "EBCV", "VCV", "BVSV", "TVV", "TVIS", "ACIS", "VSC", "ECM", "OBD", "PTC",
]);

/** Collapse whitespace (OCR titles often contain newlines). */
export function cleanText(raw: string | undefined | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Title-case an ALL-CAPS OCR heading ("ENGINE MECHANICAL" → "Engine Mechanical").
 * Mixed-case input is returned unchanged. Tokens with digits, slashes, hyphens or
 * periods (7M-GTE, A/C, NO.) and known acronyms are preserved.
 */
export function titleCase(raw: string | undefined | null): string {
  return cleanText(raw)
    .split(" ")
    .map((w, i) => {
      const letters = w.replace(/[^A-Za-z]/g, "");
      if (!letters || letters !== letters.toUpperCase()) return w; // already mixed/lower case
      if (/\d/.test(w) || w.includes("/") || KEEP_UPPER.has(letters)) return w; // 7M-GTE, A/C, EFI
      const lower = w.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      // Capitalize after start, "-" or "(" so TUNE-UP → Tune-Up, (CONT'D) → (Cont'd)
      return lower.replace(/(^|[-(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

/** Drop leading tokens (page id, section header) that the description lead already states. */
export function stripLeading(text: string | undefined | null, prefixes: (string | undefined)[]): string {
  let s = cleanText(text);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prefixes) {
      const pc = cleanText(p);
      if (pc && s.toLowerCase().startsWith(pc.toLowerCase())) {
        s = s.slice(pc.length).replace(/^[\s—–\-:.,]+/, "");
        changed = true;
      }
    }
  }
  return s;
}

/** First ~max chars of OCR text, cut on a word boundary, dot-leaders removed. */
export function ocrSnippet(text: string | undefined | null, max = 150): string {
  if (!text) return "";
  const clean = text.replace(/\.{2,}/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

/** Page title when it adds information beyond the section header, else "". */
export function distinctPageTitle(title: string | undefined, sectionHeader: string | undefined, sectionName: string): string {
  const t = titleCase(title);
  if (!t) return "";
  if (t.toLowerCase() === titleCase(sectionHeader).toLowerCase()) return "";
  if (t.toLowerCase() === sectionName.toLowerCase()) return "";
  return t;
}
