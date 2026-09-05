import { ImageResponse } from "next/og";

export const alt = "TSRM — Toyota Supra Technical Service Repair Manual";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#0e0e13",
          padding: "60px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(rgba(0, 241, 253, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 241, 253, 1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Gradient accent stripe at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(to right, #de8eff, #b90afc, #00f1fd)",
          }}
        />

        {/* Ghost engine codes */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "40px",
            fontSize: "280px",
            fontWeight: 900,
            fontStyle: "italic",
            lineHeight: 0.75,
            color: "rgba(248, 245, 253, 0.03)",
            fontFamily: "sans-serif",
          }}
        >
          2JZ
        </div>
        <div
          style={{
            position: "absolute",
            top: "220px",
            right: "300px",
            fontSize: "180px",
            fontWeight: 900,
            fontStyle: "italic",
            lineHeight: 0.75,
            color: "rgba(0, 241, 253, 0.04)",
            fontFamily: "sans-serif",
          }}
        >
          7M
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
          {/* Label */}
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#00f1fd",
              marginBottom: "20px",
              fontFamily: "sans-serif",
            }}
          >
            Factory Service Manual — Digitized & AI-Enhanced
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: 900,
              fontStyle: "italic",
              textTransform: "uppercase",
              lineHeight: 0.85,
              letterSpacing: "-0.03em",
              color: "#f8f5fd",
              marginBottom: "8px",
              fontFamily: "sans-serif",
            }}
          >
            TOYOTA SUPRA
          </div>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 900,
              fontStyle: "italic",
              textTransform: "uppercase",
              lineHeight: 0.85,
              letterSpacing: "-0.03em",
              color: "transparent",
              marginBottom: "30px",
              fontFamily: "sans-serif",
              WebkitTextStroke: "2px #de8eff",
            }}
          >
            MANUALS
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "20px",
              color: "#acaab1",
              maxWidth: "600px",
              lineHeight: 1.5,
              borderLeft: "3px solid #00f1fd",
              paddingLeft: "20px",
              marginBottom: "30px",
              fontFamily: "sans-serif",
            }}
          >
            Three generations of factory service manuals — MK2, MK3, and MK4 Supra. Digitized, AI-upscaled, and fully searchable.
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "40px", alignItems: "baseline" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "36px", fontWeight: 900, color: "#00f1fd", fontFamily: "sans-serif" }}>3</span>
              <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#76747b", fontFamily: "sans-serif" }}>Generations</span>
            </div>
            <div style={{ width: "1px", height: "40px", background: "rgba(72, 71, 77, 0.3)" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "36px", fontWeight: 900, color: "#f8f5fd", fontFamily: "sans-serif" }}>89</span>
              <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#76747b", fontFamily: "sans-serif" }}>Sections</span>
            </div>
            <div style={{ width: "1px", height: "40px", background: "rgba(72, 71, 77, 0.3)" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "36px", fontWeight: 900, color: "#f8f5fd", fontFamily: "sans-serif" }}>5,244+</span>
              <span style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#76747b", fontFamily: "sans-serif" }}>Pages</span>
            </div>
          </div>
        </div>

        {/* TSRM logo bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "60px",
            fontSize: "24px",
            fontWeight: 900,
            fontStyle: "italic",
            background: "linear-gradient(135deg, #de8eff, #b90afc)",
            backgroundClip: "text",
            color: "transparent",
            fontFamily: "sans-serif",
          }}
        >
          TSRM
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
