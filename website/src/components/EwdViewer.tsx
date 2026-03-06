"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface EwdViewerProps {
  src: string;
  alt: string;
}

export default function EwdViewer({ src, alt }: EwdViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta));
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoom <= MIN_ZOOM) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoom, pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x) / zoom,
        y: panStart.current.y + (e.clientY - dragStart.current.y) / zoom,
      });
    },
    [dragging, zoom]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }, []);

  // Prevent default wheel scrolling on the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          cursor: zoom > MIN_ZOOM ? (dragging ? "grabbing" : "grab") : "zoom-in",
          border: "1px solid #D4C9B8",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          background: "#FFFFFF",
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            transformOrigin: "center center",
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transition: dragging ? "none" : "transform 0.15s ease-out",
            userSelect: "none",
          }}
        />
      </div>

      {/* Zoom indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(26, 26, 26, 0.8)",
          padding: "6px 12px",
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#F5F0E8",
          letterSpacing: "0.1em",
          userSelect: "none",
        }}
      >
        <button
          onClick={() => {
            setZoom((z) => Math.max(MIN_ZOOM, z / 1.3));
            if (zoom / 1.3 <= MIN_ZOOM) setPan({ x: 0, y: 0 });
          }}
          style={{
            background: "none",
            border: "none",
            color: "#F5F0E8",
            cursor: "pointer",
            fontSize: "14px",
            padding: "0 4px",
          }}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3))}
          style={{
            background: "none",
            border: "none",
            color: "#F5F0E8",
            cursor: "pointer",
            fontSize: "14px",
            padding: "0 4px",
          }}
        >
          +
        </button>
        {zoom > MIN_ZOOM && (
          <button
            onClick={handleDoubleClick}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              cursor: "pointer",
              fontSize: "10px",
              padding: "0 4px",
              fontFamily: "monospace",
              letterSpacing: "0.1em",
            }}
          >
            RESET
          </button>
        )}
      </div>
    </div>
  );
}
