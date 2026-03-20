"use client";

interface PageImageProps {
  imageSrc: string;
  alt: string;
}

export default function PageImage({ imageSrc, alt }: PageImageProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt={alt}
        style={{
          maxWidth: "100%",
          border: "1px solid #D4C9B8",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          background: "#FFFFFF",
          display: "block",
        }}
      />
    </div>
  );
}
