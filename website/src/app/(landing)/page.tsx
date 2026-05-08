import type { Metadata } from "next";
import Link from "next/link";
import { MODELS } from "@/lib/models";
import { loadSections } from "@/lib/sections";
import { getDocuments } from "@/lib/documents";
import { getDownloadInfo } from "@/lib/downloads";

export const metadata: Metadata = {
  title: {
    absolute: "TSRM — Toyota Supra Technical Service Repair Manual",
  },
  description:
    "Toyota Supra factory service manuals — MK2 (5M/A60, 1982–1986), MK3 (7M/A70, 1986–1992), MK4 (2JZ/A80, 1993–2002). Searchable TSRM repair procedures, EWD wiring diagrams, torque specs, and community fixes. AI-upscaled scans, free, with offline ZIP downloads.",
  alternates: { canonical: "/" },
};

const ENGINE_CODES: Record<string, string> = {
  mk2: "5M",
  mk3: "7M",
  mk4: "2JZ",
};

export default function LandingPage() {
  // Compute totals
  const modelData = MODELS.map((model) => {
    const sections = loadSections(model.id);
    const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);
    const documents = getDocuments(model.id);
    const download = getDownloadInfo(model.id);
    return { model, sections, totalPages, documents, download };
  });
  const totalSections = modelData.reduce((sum, d) => sum + d.sections.length, 0);
  const totalPages = modelData.reduce((sum, d) => sum + d.totalPages, 0);

  return (
    <div style={{ background: "var(--color-surface)", color: "var(--color-text)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "rgba(19, 19, 24, 0.8)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="gradient-text-purple" style={{ fontSize: "22px", fontWeight: 900, fontStyle: "italic", letterSpacing: "-0.02em", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", paddingRight: "4px" }}>TSRM</span>
            <span style={{ fontSize: "10px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>Toyota Supra</span>
          </Link>
          <nav className="landing-nav" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <Link href="/" className="neon-cyan" style={{ padding: "8px 16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", letterSpacing: "0.02em", color: "var(--color-secondary)", textDecoration: "none" }}>Home</Link>
            <Link href="#collections" style={{ padding: "8px 16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", letterSpacing: "0.02em", color: "rgba(248,245,253,0.7)", textDecoration: "none" }}>Manuals</Link>
            <Link href="#features" style={{ padding: "8px 16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", letterSpacing: "0.02em", color: "rgba(248,245,253,0.7)", textDecoration: "none" }}>Features</Link>
            <Link href="/stats" style={{ padding: "8px 16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", letterSpacing: "0.02em", color: "rgba(248,245,253,0.7)", textDecoration: "none" }}>Stats</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero" style={{ position: "relative", height: "100vh", maxHeight: "900px", width: "100%", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 48px" }}>
        {/* Background grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0, 241, 253, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 241, 253, 0.03) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Radial spotlights */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 50% at 20% 80%, rgba(185, 10, 252, 0.08), transparent), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0, 241, 253, 0.05), transparent)" }} />

        {/* Ghost engine codes */}
        {[
          { code: "2JZ", top: "6%", right: "8%", size: "14rem", opacity: 0.06 },
          { code: "7M", top: "38%", right: "28%", size: "12rem", opacity: 0.045, color: "var(--color-secondary)" },
          { code: "5M", top: "68%", right: "42%", size: "11rem", opacity: 0.04, color: "var(--color-primary)" },
        ].map((g) => (
          <div key={g.code} aria-hidden="true" style={{ position: "absolute", top: g.top, right: g.right, opacity: g.opacity, userSelect: "none", pointerEvents: "none" }}>
            <div style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: g.size, lineHeight: 0.75, letterSpacing: "-0.05em", color: g.color || "var(--color-text)" }}>
              {g.code}
            </div>
          </div>
        ))}

        {/* Hero content — two-column */}
        <div className="landing-hero-content" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "64px" }}>
          {/* Left: headline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "13px", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--color-secondary)", marginBottom: "20px" }} className="neon-cyan">
              Factory Service Manual — Digitized &amp; AI-Enhanced
            </p>
            <h1 className="kinetic-skew" style={{ marginBottom: "24px" }}>
              {["TOYOTA", "SUPRA"].map((word) => (
                <span key={word} className="hero-title" style={{ display: "block", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(3.5rem, 10vw, 9rem)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.82, letterSpacing: "-0.05em", color: "var(--color-text)" }}>
                  {word}
                </span>
              ))}
              <span className="hero-title stroke-text" style={{ display: "block", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(3.5rem, 10vw, 9rem)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", lineHeight: 0.82, letterSpacing: "-0.05em", marginTop: "4px" }}>
                MANUALS
              </span>
            </h1>
            <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "17px", color: "var(--color-text-muted)", maxWidth: "540px", lineHeight: 1.7, borderLeft: "2px solid var(--color-secondary)", paddingLeft: "24px", marginBottom: "32px" }}>
              Three generations of factory service manuals — digitized from original sources, AI-upscaled, and fully searchable. Built for owners, mechanics, and enthusiasts.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Link href="#collections" className="glow-purple" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))", color: "var(--color-on-primary)", padding: "16px 32px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "12px", borderRadius: "2px" }}>
                Browse Manuals →
              </Link>
              <Link href="#collections" style={{ borderBottom: "2px solid var(--color-secondary)", color: "var(--color-text)", padding: "16px 32px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "12px" }}>
                Browse Models →
              </Link>
            </div>
          </div>

          {/* Right: stats panel (hidden on mobile via class) */}
          <div className="landing-hero-codes" style={{ display: "flex", flexDirection: "column", gap: "32px", flexShrink: 0 }}>
            {[
              { value: String(MODELS.length), label: "Generations", cyan: true },
              { value: String(totalSections), label: "Sections" },
              { value: totalPages.toLocaleString() + "+", label: "Pages" },
              { value: "1982–2002", label: "Coverage", small: true },
            ].map((stat, i) => (
              <div key={stat.label}>
                {i > 0 && <div style={{ height: "1px", background: "rgba(72, 71, 77, 0.2)", marginBottom: "32px" }} />}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span className={stat.cyan ? "neon-cyan" : ""} style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: stat.small ? "2rem" : "3.5rem", fontWeight: 900, lineHeight: 1, color: stat.cyan ? "var(--color-secondary)" : "var(--color-text)" }}>
                    {stat.value}
                  </span>
                  <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-text-faint)", marginTop: "4px" }}>
                    {stat.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Manual Collections ── */}
      <section id="collections" className="landing-section" style={{ padding: "32px 48px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "48px", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(1.5rem, 3vw, 1.875rem)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            Manual Collections
          </h2>
          <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>
            Three Generations
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          {modelData.map(({ model, sections, totalPages, documents, download }, idx) => {
            const surfaces = ["var(--color-surface-low)", "var(--color-surface-mid)", "var(--color-surface-high)"];
            return (
              <div key={model.id} style={{ position: "relative", overflow: "hidden", background: surfaces[idx] || surfaces[0], borderRadius: "2px", padding: "28px 32px", minHeight: "280px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {/* Ghost watermark */}
                <div aria-hidden="true" className="ghost-text" style={{ fontSize: "10rem", right: "-16px", bottom: "-32px", color: "var(--color-text)", opacity: 0.03 }}>
                  {model.generation}
                </div>
                {/* Content */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "10px", letterSpacing: "0.2em", color: "var(--color-secondary)", display: "block", marginBottom: "12px" }}>
                    {model.year}
                  </span>
                  <h3 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.03em", lineHeight: 0.9, marginBottom: "4px" }}>
                    {model.generation} / {model.name.split(" ")[0]}
                  </h3>
                  <p style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(0, 241, 253, 0.6)", marginBottom: "12px" }}>
                    {ENGINE_CODES[model.id] || ""}
                  </p>
                  <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px", color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: "16px" }}>
                    {model.description}. With full wiring diagrams.
                  </p>
                </div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  {/* Stats */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", marginBottom: "16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                    <span>{sections.length} sections</span>
                    <span style={{ color: "rgba(72, 71, 77, 0.3)" }}>·</span>
                    <span>{totalPages.toLocaleString()} pages</span>
                    <span style={{ color: "rgba(72, 71, 77, 0.3)" }}>·</span>
                    <span>{documents.filter(d => d.type !== "fixes").map(d => d.type === "manual" ? "TSRM" : "EWD").join(" + ")}</span>
                  </div>
                  {/* Links */}
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    {documents.filter(d => d.type !== "fixes").map((doc) => (
                      <Link
                        key={doc.type}
                        href={doc.type === "manual" ? `/${model.id}/tsrm` : `/${model.id}/ewd`}
                        className={doc.type === "manual" ? "neon-cyan" : "neon-purple"}
                        style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "8px", color: doc.type === "manual" ? "var(--color-secondary)" : "rgba(222,142,255,0.6)" }}
                      >
                        {doc.type === "manual" ? "Service Manual →" : "Wiring Diagram ⚡"}
                      </Link>
                    ))}
                    {download && (
                      <a
                        href={`/api/download/${model.id}`}
                        style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "8px", color: "var(--color-text-faint)" }}
                      >
                        ↓ Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Browse All Sections (internal links for SEO + quick nav) ── */}
      <section id="all-sections" className="landing-section" style={{ padding: "0 48px 64px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            Browse All Sections
          </h2>
          <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>
            Direct Links
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "32px" }}>
          {modelData.map(({ model, sections }) => (
            sections.length > 0 && (
              <div key={model.id}>
                <h3 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-secondary)", marginBottom: "12px" }}>
                  {model.name} — Repair Manual
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "13px", lineHeight: 1.5 }}>
                  {sections.map((s) => (
                    <Link
                      key={s.code}
                      href={`/${model.id}/tsrm/${s.code}`}
                      style={{ color: "var(--color-text-muted)", textDecoration: "none", transition: "color 0.15s" }}
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-section" style={{ padding: "0 48px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          <div style={{ height: "2px", width: "48px", background: "var(--color-tertiary)" }} />
          <h2 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(1.5rem, 3vw, 1.875rem)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            Features
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {[
            { icon: "auto_awesome", title: "AI-Upscaled Diagrams", desc: "Every factory diagram enhanced with AI upscaling for crisp, modern clarity — no more squinting at faded scans." },
            { icon: "search", title: "Full-Text Search", desc: "OCR-indexed pages across every manual. Find torque specs, procedures, and wiring in seconds with Ctrl+K." },
            { icon: "cloud_download", title: "Offline Downloads", desc: "Download complete ZIP archives with an offline HTML viewer. Take the full manual to the garage — no internet needed." },
          ].map((f) => (
            <div key={f.title} style={{ background: "var(--color-surface-low)", borderRadius: "2px", padding: "28px 32px", position: "relative", overflow: "hidden" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "var(--color-secondary)", marginBottom: "16px", display: "block", fontVariationSettings: "'FILL' 0, 'wght' 300, 'opsz' 48" }}>
                {f.icon}
              </span>
              <h3 style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                {f.title}
              </h3>
              <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section" style={{ padding: "0 48px 64px" }}>
        <div style={{ background: "var(--color-surface-low)", borderRadius: "2px", padding: "40px 64px", position: "relative", overflow: "hidden", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "32px" }}>
          <div aria-hidden="true" className="ghost-text" style={{ fontSize: "12rem", right: "-16px", bottom: "-32px", color: "var(--color-text)", opacity: 0.02 }}>TSRM</div>
          <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
            <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--color-secondary)", display: "block", marginBottom: "16px" }}>
              Complete Factory Documentation
            </span>
            <h2 className="kinetic-skew" style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "clamp(1.5rem, 5vw, 3rem)", fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.03em", lineHeight: 0.9, marginBottom: "16px" }}>
              Every page.<br />
              <span className="gradient-text-purple">Every diagram.</span><br />
              Fully searchable.
            </h2>
            <p style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "16px", color: "var(--color-text-muted)", lineHeight: 1.6, maxWidth: "480px" }}>
              Three generations of Toyota Supra service manuals at your fingertips. Browse online or download ZIP archives for offline access.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flexShrink: 0, position: "relative", zIndex: 1 }}>
            <Link href="#collections" className="glow-purple" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))", color: "var(--color-on-primary)", padding: "16px 32px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "12px", borderRadius: "2px" }}>
              Browse Manuals →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer" style={{ background: "var(--color-surface-low)", padding: "24px 48px" }}>
        <div className="landing-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span className="gradient-text-purple" style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "20px", letterSpacing: "-0.02em", paddingRight: "4px" }}>TSRM</span>
            <span style={{ fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px", color: "var(--color-text-muted)" }}>Toyota Supra factory service manuals — digitized</span>
          </div>
          <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-text-faint)" }}>
            Not affiliated with Toyota Motor Corporation
          </span>
        </div>
        {/* Accent stripe */}
        <div className="accent-stripe" style={{ marginTop: "24px" }}>
          <div /><div /><div />
        </div>
      </footer>
    </div>
  );
}
