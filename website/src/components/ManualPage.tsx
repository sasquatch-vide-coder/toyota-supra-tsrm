import { ManualContentBlock, PageData } from "@/types";
import DiagramViewer from "./DiagramViewer";
import TorqueSpec from "./TorqueSpec";
import CautionNotice from "./CautionNotice";
import ManualTable from "./ManualTable";

function renderListItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item !== "object" || item === null) return String(item);
  const obj = item as Record<string, unknown>;
  const parts: string[] = [];
  if (obj.number) parts.push(String(obj.number));
  if (obj.heading) parts.push(String(obj.heading));
  if (obj.title) parts.push(String(obj.title));
  if (obj.text) parts.push(String(obj.text));
  if (obj.label) parts.push(String(obj.label));
  if (obj.description) parts.push(String(obj.description));
  if (obj.conclusion) parts.push(String(obj.conclusion));
  if (Array.isArray(obj.steps)) {
    for (const s of obj.steps) {
      parts.push(typeof s === "string" ? s : renderListItem(s));
    }
  }
  if (Array.isArray(obj.subitems)) {
    for (const sub of obj.subitems) {
      parts.push(renderListItem(sub));
    }
  }
  if (Array.isArray(obj.content)) {
    for (const c of obj.content) {
      parts.push(renderListItem(c));
    }
  }
  if (Array.isArray(obj.items)) {
    for (const i of obj.items) {
      parts.push(renderListItem(i));
    }
  }
  return parts.join(" — ") || JSON.stringify(item);
}

function renderBlock(block: ManualContentBlock, model: string, section: string, page: number, idx: number) {
  switch (block.type) {
    case "text":
      return (
        <p key={idx} style={{ margin: "8px 0", color: "var(--color-text-muted)", lineHeight: 1.7, fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px" }}>
          {block.text}
        </p>
      );

    case "heading":
      if (block.level <= 2) {
        return (
          <h2
            key={idx}
            style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)", marginTop: "24px", marginBottom: "8px", borderBottom: "1px solid var(--color-border-faint)", paddingBottom: "4px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}
          >
            {block.text}
          </h2>
        );
      }
      return (
        <h3
          key={idx}
          style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)", marginTop: "16px", marginBottom: "4px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}
        >
          {block.text}
        </h3>
      );

    case "diagram": {
      const base = `/images/${model}/${section}/${section}_${String(page).padStart(3, "0")}_${block.index}`;
      return (
        <DiagramViewer
          key={idx}
          src={`${base}.svg`}
          fallbackSrc={`${base}.png`}
          alt={block.description}
          labels={block.labels}
        />
      );
    }

    case "caution":
      return <CautionNotice key={idx} type="caution" text={block.text} />;

    case "notice":
      return <CautionNotice key={idx} type="notice" text={block.text} />;

    case "table":
      return (
        <ManualTable
          key={idx}
          caption={block.caption}
          headers={block.headers}
          rows={block.rows}
        />
      );

    case "list":
      if (block.ordered) {
        return (
          <ol key={idx} style={{ margin: "8px 0 8px 24px", listStyleType: "decimal", color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: "4px", fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px" }}>
            {block.items.map((item: unknown, i: number) => (
              <li key={i}>{renderListItem(item)}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={idx} style={{ margin: "8px 0 8px 24px", listStyleType: "disc", color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: "4px", fontFamily: "'Manrope', var(--font-manrope), sans-serif", fontSize: "14px" }}>
          {block.items.map((item: unknown, i: number) => (
            <li key={i}>{renderListItem(item)}</li>
          ))}
        </ul>
      );

    case "torque_spec":
      return (
        <TorqueSpec
          key={idx}
          component={block.component}
          value={block.value}
        />
      );

    case "part_number":
      return (
        <div
          key={idx}
          style={{
            margin: "8px 0",
            display: "inline-flex",
            alignItems: "baseline",
            gap: "8px",
            padding: "6px 12px",
            background: "var(--color-surface-low)",
            borderRadius: "2px",
            fontSize: "14px",
          }}
        >
          <span style={{ color: "var(--color-text-muted)" }}>{block.label}:</span>
          <span style={{ fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", fontWeight: 700, color: "var(--color-secondary)" }}>
            {block.number}
          </span>
          {block.description && (
            <span style={{ color: "var(--color-text-faint)" }}>({block.description})</span>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function ManualPage({
  data,
  model,
  section,
  page,
}: {
  data: PageData;
  model: string;
  section: string;
  page: number;
}) {
  const pageImage = `/images/${model}/${section}/${section}_${String(page).padStart(3, "0")}.png`;
  const hasOcrText = !!data.ocr_text;
  const hasContent = data.content && data.content.length > 0;

  return (
    <article style={{ maxWidth: "56rem" }}>
      {data.section_header && (
        <p style={{ fontSize: "13px", color: "var(--color-text-faint)", marginBottom: "4px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>{data.section_header}</p>
      )}
      {data.title && (
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", marginBottom: "16px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}>{data.title}</h1>
      )}

      {hasOcrText && !hasContent ? (
        <>
          <DiagramViewer
            src={pageImage}
            alt={data.title || "Manual page"}
          />
          <div className="sr-only" aria-hidden="false">
            {data.ocr_text}
          </div>
        </>
      ) : (
        <div>
          {data.content?.map((block, idx) =>
            renderBlock(block, model, section, page, idx)
          )}
        </div>
      )}
    </article>
  );
}
