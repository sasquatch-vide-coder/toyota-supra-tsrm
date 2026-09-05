"use client";

import Image from "next/image";
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
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const pinchZoomStart = useRef(1);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Mouse wheel zoom ──
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => {
        const next = clampZoom(z * delta);
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return next;
      });
    },
    []
  );

  // ── Mouse/pen drag (not touch — touch handled in useEffect) ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return;
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
      if (e.pointerType === "touch") return;
      if (!dragging) return;
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x) / zoom,
        y: panStart.current.y + (e.clientY - dragStart.current.y) / zoom,
      });
    },
    [dragging, zoom]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    setDragging(false);
  }, []);

  // ── Double-click/tap: toggle zoom ──
  const handleDoubleClick = useCallback(() => {
    setZoom((z) => {
      if (z > MIN_ZOOM) {
        setPan({ x: 0, y: 0 });
        return MIN_ZOOM;
      }
      return 2.5;
    });
  }, []);

  // ── Touch events: pinch-to-zoom + single-finger pan ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getDist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastPinchDist.current = getDist(e.touches[0], e.touches[1]);
        pinchZoomStart.current = zoomRef.current;
      } else if (e.touches.length === 1 && zoomRef.current > MIN_ZOOM) {
        e.preventDefault();
        setDragging(true);
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStart.current = { ...panRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        e.preventDefault();
        const dist = getDist(e.touches[0], e.touches[1]);
        const scale = dist / lastPinchDist.current;
        const next = clampZoom(pinchZoomStart.current * scale);
        setZoom(next);
        if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      } else if (e.touches.length === 1 && zoomRef.current > MIN_ZOOM) {
        e.preventDefault();
        setPan({
          x: panStart.current.x + (e.touches[0].clientX - dragStart.current.x) / zoomRef.current,
          y: panStart.current.y + (e.touches[0].clientY - dragStart.current.y) / zoomRef.current,
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) lastPinchDist.current = null;
      if (e.touches.length === 0) setDragging(false);
    };

    const preventWheel = (e: WheelEvent) => e.preventDefault();

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("wheel", preventWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", preventWheel);
    };
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
          border: "1px solid var(--color-border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          background: "var(--color-surface)",
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Zoom/pan is applied to this wrapper; next/image serves resized WebP (LCP). */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformOrigin: "center center",
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transition: dragging ? "none" : "transform 0.15s ease-out",
            userSelect: "none",
          }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority
            quality={85}
            sizes="100vw"
            draggable={false}
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Zoom controls — larger touch targets */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          background: "var(--color-surface-highest)",
          padding: "2px 6px",
          fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
          fontSize: "12px",
          color: "var(--color-text)",
          letterSpacing: "0.05em",
          borderRadius: "4px",
          border: "1px solid var(--color-border)",
          userSelect: "none",
        }}
      >
        <button
          onClick={() => {
            setZoom((z) => {
              const next = Math.max(MIN_ZOOM, z / 1.3);
              if (next <= MIN_ZOOM) setPan({ x: 0, y: 0 });
              return next;
            });
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text)",
            cursor: "pointer",
            fontSize: "20px",
            padding: "6px 10px",
            lineHeight: 1,
            minWidth: "36px",
            minHeight: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          −
        </button>
        <span style={{
          color: zoom > MIN_ZOOM ? "var(--color-secondary)" : "var(--color-text-muted)",
          minWidth: "44px",
          textAlign: "center",
        }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3))}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text)",
            cursor: "pointer",
            fontSize: "20px",
            padding: "6px 10px",
            lineHeight: 1,
            minWidth: "36px",
            minHeight: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
        {zoom > MIN_ZOOM && (
          <button
            onClick={() => { setZoom(MIN_ZOOM); setPan({ x: 0, y: 0 }); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-secondary)",
              cursor: "pointer",
              fontSize: "10px",
              padding: "6px 10px",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              letterSpacing: "0.1em",
              minHeight: "36px",
              display: "flex",
              alignItems: "center",
            }}
          >
            RESET
          </button>
        )}
      </div>
    </div>
  );
}
