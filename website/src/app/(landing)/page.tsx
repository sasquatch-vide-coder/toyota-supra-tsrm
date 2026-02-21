import type { Metadata } from "next";
import Link from "next/link";
import { MODELS } from "@/lib/models";
import { loadSections } from "@/lib/sections";

export const metadata: Metadata = {
  title: "TSRM — Toyota Supra Technical Service Repair Manual",
  description:
    "Complete factory service manuals for MK2, MK3, and MK4 Toyota Supra — digitized, AI-upscaled, and fully searchable.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--color-cream)", color: "var(--color-dark)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Triple racing stripe */}
      <div style={{ display: "flex", height: "10px", flexShrink: 0 }}>
        <div style={{ flex: 4, background: "var(--color-red)" }} />
        <div style={{ flex: 1, background: "var(--color-dark)" }} />
        <div style={{ flex: 2, background: "var(--color-tan)" }} />
      </div>

      {/* Top bar */}
      <div className="landing-topbar" style={{ background: "var(--color-dark)", padding: "12px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.25em", color: "var(--color-tan)", textTransform: "uppercase" }}>
          Toyota Supra · Technical Service Repair Manual
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "900", letterSpacing: "0.3em", color: "var(--color-red)" }}>
          TSRM
        </span>
      </div>

      {/* Hero */}
      <div className="landing-hero" style={{ flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "72px 48px 56px", boxSizing: "border-box" }}>
        <div className="landing-hero-content" style={{ display: "flex", alignItems: "flex-start", gap: "48px" }}>
          {/* Ghost engine code watermarks — JZ, 7M, 5M */}
          <div
            className="landing-hero-codes"
            aria-hidden="true"
            style={{
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              marginTop: "-16px",
              lineHeight: 0.9,
              userSelect: "none",
              letterSpacing: "-0.05em",
            }}
          >
            {["JZ", "7M", "5M"].map((code) => (
              <div
                key={code}
                style={{
                  fontSize: "clamp(90px, 12vw, 140px)",
                  fontWeight: "900",
                  color: "var(--color-red)",
                  opacity: 0.1,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {code}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: "8px", flex: 1 }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.35em", color: "var(--color-tan)", textTransform: "uppercase", marginBottom: "20px" }}>
              Factory Service Manual — Digitized &amp; AI-Enhanced
            </p>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(64px, 8vw, 100px)", fontWeight: "900", lineHeight: 1, color: "var(--color-dark)", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              TSRM
            </h1>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(18px, 2.5vw, 26px)", fontWeight: "300", color: "var(--color-tan)", fontStyle: "italic", marginBottom: "28px" }}>
              Toyota Supra
            </p>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "16px", color: "#5A4A3A", maxWidth: "480px", lineHeight: 1.8 }}>
              The complete factory service manuals for three generations of Toyota Supra —
              digitized, AI-upscaled, and fully searchable. Built for owners, mechanics, and enthusiasts.
            </p>
          </div>

          {/* Supra generations illustration */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="landing-hero-image"
            src="/supras.png"
            alt="Toyota Supra MK2, MK3, and MK4 side profile illustrations"
            style={{
              flexShrink: 0,
              width: "clamp(280px, 32vw, 480px)",
              objectFit: "contain",
              objectPosition: "top",
              alignSelf: "stretch",
              opacity: 0.15,
              marginTop: "1cm",
            }}
          />
        </div>

        {/* Divider stripe */}
        <div style={{ display: "flex", height: "3px", margin: "56px 0" }}>
          <div style={{ flex: 6, background: "var(--color-red)" }} />
          <div style={{ flex: 1, background: "var(--color-dark)" }} />
          <div style={{ flex: 3, background: "var(--color-tan)" }} />
        </div>

        {/* Model cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {MODELS.map((model) => {
            const sections = loadSections(model.id);
            const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);
            return (
              <Link
                key={model.id}
                href={`/${model.id}`}
                style={{
                  display: "block",
                  background: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  padding: "32px",
                  position: "relative",
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* Ghost generation watermark */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "-8px",
                    fontSize: "110px",
                    fontWeight: "900",
                    color: "var(--color-red)",
                    opacity: 0.06,
                    lineHeight: 1,
                    fontFamily: "Georgia, serif",
                    userSelect: "none",
                    letterSpacing: "-0.05em",
                  }}
                >
                  {model.generation}
                </div>

                {/* Left accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "4px", background: "var(--color-red)" }} />

                <div style={{ position: "relative", paddingLeft: "4px" }}>
                  <p style={{ fontFamily: "monospace", fontSize: "15px", letterSpacing: "0.3em", color: "var(--color-tan)", textTransform: "uppercase", marginBottom: "10px" }}>
                    {model.year}
                  </p>
                  <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: "700", color: "var(--color-dark)", marginBottom: "12px" }}>
                    {model.name}
                  </h2>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "var(--color-brown-mid)", lineHeight: 1.6, marginBottom: "16px" }}>
                    {model.description}
                  </p>
                  <div style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-tan)", display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                    {sections.length > 0 ? (
                      <>
                        <span>{sections.length} sections</span>
                        <span style={{ color: "var(--color-border)" }}>·</span>
                        <span>{totalPages.toLocaleString()} pages</span>
                      </>
                    ) : (
                      <span>Coming soon</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-red)", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: "700" }}>
                    Browse Manual
                    <span style={{ fontSize: "14px" }}>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Features */}
        <div style={{ marginTop: "64px", paddingTop: "48px", borderTop: "1px solid var(--color-border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "40px" }}>
          {[
            { code: "01", label: "AI-Upscaled Diagrams", desc: "All factory manual diagrams upscaled using AI for crisp, modern clarity" },
            { code: "02", label: "Full-Text Search", desc: "Search across every page of every manual" },
            { code: "03", label: "Three Generations", desc: "Complete coverage across MK2, MK3, and MK4 Supra manuals from 1982 to 2002" },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontFamily: "monospace", fontSize: "10px", letterSpacing: "0.3em", color: "var(--color-red)", textTransform: "uppercase", marginBottom: "10px" }}>
                — {f.code}
              </div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: "700", color: "var(--color-dark)", marginBottom: "8px" }}>
                {f.label}
              </div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "var(--color-brown-mid)", lineHeight: 1.7 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer" style={{ background: "var(--color-dark)", padding: "24px 48px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontWeight: "900", fontSize: "16px", letterSpacing: "0.2em", color: "var(--color-red)" }}>TSRM</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "var(--color-tan)" }}>Toyota Supra factory service manuals — digitized</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--color-brown)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Not affiliated with Toyota Motor Corporation
          </span>
          <span style={{ color: "var(--color-brown)" }}>·</span>
          <Link href="/stats" style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--color-brown)", letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none" }}>
            Site Stats
          </Link>
        </div>
      </footer>
    </div>
  );
}
