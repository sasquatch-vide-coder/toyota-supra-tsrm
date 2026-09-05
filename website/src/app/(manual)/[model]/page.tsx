import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModel, getModelIds, shortName } from "@/lib/models";
import { getDocuments, getDocumentRoute } from "@/lib/documents";
import { loadSections } from "@/lib/sections";
import { getDownloadInfo } from "@/lib/downloads";

const FONT_DISPLAY = "'Space Grotesk', var(--font-space-grotesk), sans-serif";
const FONT_BODY = "'Manrope', var(--font-manrope), sans-serif";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string }>;
}): Promise<Metadata> {
  const { model } = await params;
  const m = getModel(model);
  if (!m) return {};

  const tsrm = loadSections(model);
  const ewd = loadSections(`${model}-ewd`);
  const pages = [...tsrm, ...ewd].reduce((sum, s) => sum + s.pages, 0);
  const short = shortName(m);

  return {
    title: { absolute: `${short} Toyota Supra (${m.generation}) Service Manual & Wiring Diagrams | TSRM` },
    description: `${m.year} Toyota Supra ${m.generation} (${m.engines}) factory service manual online: ${tsrm.length} repair manual sections, ${ewd.length} wiring diagram sections, ${pages.toLocaleString()} pages. Free, searchable, AI-upscaled, with offline ZIP download.`,
    alternates: { canonical: `/${model}` },
  };
}

export default async function ModelHubPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const m = getModel(model);
  if (!m) notFound();

  const docs = getDocuments(model);
  const tsrm = loadSections(model);
  const ewd = loadSections(`${model}-ewd`);
  const tsrmPages = tsrm.reduce((sum, s) => sum + s.pages, 0);
  const ewdPages = ewd.reduce((sum, s) => sum + s.pages, 0);
  const download = getDownloadInfo(model);
  const short = shortName(m);

  const docStats: Record<string, string> = {
    manual: `${tsrm.length} sections · ${tsrmPages.toLocaleString()} pages`,
    ewd: `${ewd.length} sections · ${ewdPages.toLocaleString()} pages`,
    fixes: "Grouped problems with confirmed fixes",
  };

  const linkStyle: React.CSSProperties = {
    color: "var(--color-text-muted)",
    textDecoration: "none",
    fontFamily: FONT_BODY,
    fontSize: "13px",
    lineHeight: 1.5,
  };

  return (
    <>
      {/* Top bar */}
      <div
        className="manual-topbar"
        style={{
          background: "rgba(19, 19, 24, 0.9)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
          fontFamily: FONT_DISPLAY,
          fontSize: "11px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <Link href="/" className="gradient-text-purple" style={{ textDecoration: "none", fontWeight: 900, fontStyle: "italic", fontSize: "16px", letterSpacing: "-0.02em", paddingRight: "4px" }}>
          TSRM
        </Link>
        <span style={{ color: "var(--color-text-faint)", opacity: 0.4 }}>/</span>
        <span style={{ color: "var(--color-text)" }}>{m.name}</span>
      </div>
      <div className="accent-stripe" style={{ flexShrink: 0 }}>
        <div /><div /><div />
      </div>

      <main style={{ flex: 1, overflowY: "auto", background: "var(--color-surface)" }}>
        {/* Hero */}
        <div className="model-hero" style={{ padding: "40px 32px 32px", position: "relative", overflow: "hidden", borderBottom: "1px solid var(--color-border-faint)" }}>
          <div aria-hidden="true" className="ghost-text" style={{ top: "-20px", right: "24px", fontSize: "200px", color: "var(--color-text)", opacity: 0.025 }}>
            {m.generation}
          </div>
          <div style={{ position: "relative", maxWidth: "900px" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: "10px", letterSpacing: "0.3em", color: "var(--color-secondary)", textTransform: "uppercase", marginBottom: "12px" }}>
              {m.generation} · {m.year} · {m.engines}
            </p>
            <h1 className="model-hero-title" style={{ fontFamily: FONT_DISPLAY, fontSize: "44px", fontWeight: 900, fontStyle: "italic", lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", marginBottom: "10px" }}>
              {short} Toyota Supra Service Manual
            </h1>
            <p style={{ fontFamily: FONT_BODY, fontSize: "17px", fontWeight: 300, color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: "20px" }}>
              Factory repair manual (TSRM), electrical wiring diagrams (EWD){docs.some((d) => d.type === "fixes") ? " and community fixes" : ""} for the {m.generation} Supra
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: "15px", color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: "720px" }}>
              {m.summary}
            </p>
          </div>
        </div>

        {/* Documents */}
        <section style={{ padding: "32px" }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "10px", letterSpacing: "0.25em", color: "var(--color-text-faint)", textTransform: "uppercase", marginBottom: "20px", fontWeight: 700 }}>
            — Browse the {m.name} documentation
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {docs.map((doc) => (
              <Link
                key={doc.type}
                href={`/${model}/${getDocumentRoute(doc)}`}
                style={{ display: "block", background: "var(--color-surface-low)", padding: "20px 20px 20px 24px", position: "relative", overflow: "hidden", textDecoration: "none", color: "inherit", borderRadius: "2px" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3px", background: doc.type === "manual" ? "var(--color-secondary)" : doc.type === "ewd" ? "var(--color-primary)" : "var(--color-tertiary)" }} />
                <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: "18px", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "4px" }}>
                  {doc.label} →
                </h3>
                <p style={{ fontFamily: FONT_BODY, fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                  {doc.description}
                </p>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: "10px", color: "var(--color-text-faint)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {docStats[doc.type]}
                </span>
              </Link>
            ))}
            {download && (
              <a
                href={`/api/download/${model}`}
                style={{ display: "block", background: "var(--color-surface-low)", padding: "20px 20px 20px 24px", position: "relative", overflow: "hidden", textDecoration: "none", color: "inherit", borderRadius: "2px" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3px", background: "var(--color-text-faint)" }} />
                <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: "18px", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "4px" }}>
                  ↓ Download for offline use
                </h3>
                <p style={{ fontFamily: FONT_BODY, fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                  ZIP archive with every page image and an offline HTML viewer
                </p>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: "10px", color: "var(--color-text-faint)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {download.sizeFormatted} · {download.images.toLocaleString()} images
                </span>
              </a>
            )}
          </div>
        </section>

        {/* Section indexes — internal links for crawlers and quick navigation */}
        <section style={{ padding: "0 32px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "32px" }}>
          {tsrm.length > 0 && (
            <div>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "13px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-secondary)", marginBottom: "12px" }}>
                Repair Manual Sections
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                {tsrm.map((s) => (
                  <Link key={s.code} href={`/${model}/tsrm/${s.code}`} style={linkStyle}>
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {ewd.length > 0 && (
            <div>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "13px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: "12px" }}>
                Wiring Diagram Sections
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                {ewd.map((s) => (
                  <Link key={s.code} href={`/${model}/ewd/${s.code}`} style={linkStyle}>
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "TSRM", item: "https://tsrm.sasquatchvc.com" },
                  { "@type": "ListItem", position: 2, name: m.name, item: `https://tsrm.sasquatchvc.com/${model}` },
                ],
              },
              {
                "@type": "CollectionPage",
                name: `${short} Toyota Supra (${m.generation}) Service Manual & Wiring Diagrams`,
                url: `https://tsrm.sasquatchvc.com/${model}`,
                description: m.summary,
                inLanguage: "en-US",
                about: {
                  "@type": "Vehicle",
                  name: `Toyota Supra ${m.generation}`,
                  model: m.generation,
                  vehicleModelDate: m.year,
                  vehicleEngine: { "@type": "EngineSpecification", name: m.engines },
                  manufacturer: { "@type": "Organization", name: "Toyota" },
                },
                hasPart: docs.map((doc) => ({
                  "@type": doc.type === "fixes" ? "CollectionPage" : "Book",
                  name: `${m.name} ${doc.label}`,
                  url: `https://tsrm.sasquatchvc.com/${model}/${getDocumentRoute(doc)}`,
                })),
                publisher: { "@type": "Organization", name: "TSRM", url: "https://tsrm.sasquatchvc.com" },
              },
            ],
          }),
        }}
      />
    </>
  );
}
