import Link from "next/link";
import { MODELS } from "@/lib/models";
import { loadSections } from "@/lib/sections";

export default function LandingPage() {
  return (
    <div style={{ background: "#F5F0E8", color: "#1A1A1A", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Triple racing stripe */}
      <div style={{ display: "flex", height: "10px", flexShrink: 0 }}>
        <div style={{ flex: 4, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 2, background: "#8B7355" }} />
      </div>

      {/* Top bar */}
      <div style={{ background: "#1A1A1A", padding: "12px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.25em", color: "#8B7355", textTransform: "uppercase" }}>
          Toyota Supra · Technical Service Repair Manual
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "900", letterSpacing: "0.3em", color: "#C41E3A" }}>
          TSRM
        </span>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "72px 48px 56px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "48px" }}>
          {/* Ghost engine code watermarks — JZ, 7M, 5M */}
          <div
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
                  color: "#C41E3A",
                  opacity: 0.1,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {code}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: "8px", flex: 1 }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.35em", color: "#8B7355", textTransform: "uppercase", marginBottom: "20px" }}>
              Factory Service Manual — Digitized &amp; AI-Enhanced
            </p>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(64px, 8vw, 100px)", fontWeight: "900", lineHeight: 1, color: "#1A1A1A", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              TSRM
            </h1>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(18px, 2.5vw, 26px)", fontWeight: "300", color: "#8B7355", fontStyle: "italic", marginBottom: "28px" }}>
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
            src="/supras.png"
            alt="Toyota Supra MK2, MK3, and MK4 side profile illustrations"
            style={{
              flexShrink: 0,
              width: "clamp(280px, 32vw, 480px)",
              objectFit: "contain",
              objectPosition: "top",
              alignSelf: "stretch",
              opacity: 0.25,
            }}
          />
        </div>

        {/* Divider stripe */}
        <div style={{ display: "flex", height: "3px", margin: "56px 0" }}>
          <div style={{ flex: 6, background: "#C41E3A" }} />
          <div style={{ flex: 1, background: "#1A1A1A" }} />
          <div style={{ flex: 3, background: "#8B7355" }} />
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
                  border: "1px solid #D4C9B8",
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
                    color: "#C41E3A",
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
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "4px", background: "#C41E3A" }} />

                <div style={{ position: "relative", paddingLeft: "4px" }}>
                  <p style={{ fontFamily: "monospace", fontSize: "15px", letterSpacing: "0.3em", color: "#8B7355", textTransform: "uppercase", marginBottom: "10px" }}>
                    {model.year}
                  </p>
                  <h2 style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: "700", color: "#1A1A1A", marginBottom: "12px" }}>
                    {model.name}
                  </h2>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "#6B5A4A", lineHeight: 1.6, marginBottom: "16px" }}>
                    {model.description}
                  </p>
                  <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#8B7355", display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                    {sections.length > 0 ? (
                      <>
                        <span>{sections.length} sections</span>
                        <span style={{ color: "#D4C9B8" }}>·</span>
                        <span>{totalPages.toLocaleString()} pages</span>
                      </>
                    ) : (
                      <span>Coming soon</span>
                    )}
                    {model.hasForum && (
                      <>
                        <span style={{ color: "#D4C9B8" }}>·</span>
                        <span style={{ color: "#1A6B8B" }}>Forum indexed</span>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#C41E3A", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: "700" }}>
                    Browse Manual
                    <span style={{ fontSize: "14px" }}>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Features */}
        <div style={{ marginTop: "64px", paddingTop: "48px", borderTop: "1px solid #D4C9B8", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "40px" }}>
          {[
            { code: "01", label: "AI-Upscaled Diagrams", desc: "All factory manual diagrams upscaled using AI for crisp, modern clarity" },
            { code: "02", label: "Full-Text Search", desc: "Hybrid semantic + keyword search across every page of every manual" },
            { code: "03", label: "Community Forum", desc: "Thousands of SupraForums threads indexed and cross-referenced" },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontFamily: "monospace", fontSize: "10px", letterSpacing: "0.3em", color: "#C41E3A", textTransform: "uppercase", marginBottom: "10px" }}>
                — {f.code}
              </div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "16px", fontWeight: "700", color: "#1A1A1A", marginBottom: "8px" }}>
                {f.label}
              </div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "#6B5A4A", lineHeight: 1.7 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: "#1A1A1A", padding: "24px 48px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: "monospace", fontWeight: "900", fontSize: "16px", letterSpacing: "0.2em", color: "#C41E3A" }}>TSRM</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: "#8B7355" }}>Toyota Supra factory service manuals — digitized</span>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#4A3A2A", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Not affiliated with Toyota Motor Corporation
        </span>
      </footer>
    </div>
  );
}
