import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface)",
        fontFamily: "'Manrope', var(--font-manrope), sans-serif",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(6rem, 15vw, 10rem)",
          fontWeight: 700,
          lineHeight: 1,
          margin: 0,
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.03em",
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: "1.125rem",
          color: "var(--color-text-muted)",
          marginTop: "1rem",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        This page could not be found.
      </p>

      <Link
        href="/"
        style={{
          color: "var(--color-secondary)",
          fontSize: "0.9375rem",
          fontWeight: 500,
          textDecoration: "none",
          padding: "0.625rem 1.5rem",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          background: "var(--color-surface-high)",
          transition: "border-color 0.15s ease, background 0.15s ease",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
