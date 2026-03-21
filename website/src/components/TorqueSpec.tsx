export default function TorqueSpec({
  component,
  value,
}: {
  component: string;
  value: string;
}) {
  return (
    <div style={{
      margin: "8px 0",
      display: "flex",
      alignItems: "baseline",
      gap: "12px",
      padding: "8px 16px",
      background: "var(--color-surface-low)",
      borderLeft: "3px solid var(--color-primary-dim)",
      borderRadius: "0 2px 2px 0",
    }}>
      <span style={{ fontWeight: 600, color: "var(--color-text)", fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px" }}>
        {component}
      </span>
      <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontSize: "13px", color: "var(--color-secondary)", fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}
