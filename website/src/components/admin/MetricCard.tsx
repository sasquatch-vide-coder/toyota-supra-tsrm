export function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #D4C9B8",
        borderRadius: "8px",
        padding: "20px",
        borderLeft: "4px solid #C41E3A",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "13px",
          color: "#8B7355",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: "32px",
          fontWeight: 900,
          color: "#1A1A1A",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
