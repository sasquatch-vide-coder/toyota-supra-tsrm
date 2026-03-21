export default function CautionNotice({
  type,
  text,
}: {
  type: "caution" | "notice";
  text: string;
}) {
  const isCaution = type === "caution";

  return (
    <div style={{
      margin: "12px 0",
      padding: "12px 16px",
      background: isCaution ? "rgba(255, 110, 129, 0.08)" : "rgba(0, 241, 253, 0.08)",
      borderLeft: `3px solid ${isCaution ? "var(--color-tertiary)" : "var(--color-secondary)"}`,
      borderRadius: "0 2px 2px 0",
    }}>
      <p style={{
        fontSize: "10px",
        fontWeight: 700,
        color: isCaution ? "var(--color-tertiary)" : "var(--color-secondary)",
        marginBottom: "4px",
        fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
      }}>
        {isCaution ? "CAUTION" : "NOTICE"}
      </p>
      <p style={{
        fontSize: "14px",
        color: "var(--color-text)",
        fontFamily: "'Manrope', var(--font-manrope), sans-serif",
        lineHeight: 1.5,
      }}>
        {text}
      </p>
    </div>
  );
}
