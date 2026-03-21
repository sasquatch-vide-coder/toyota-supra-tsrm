"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

interface MobileSidebarWrapperProps {
  children: React.ReactNode;
}

export default function MobileSidebarWrapper({ children }: MobileSidebarWrapperProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Client-side only for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open, isMobile]);

  const portal = mounted && open ? createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          zIndex: 99,
        }}
      />
      {/* Sidebar panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          height: "100dvh",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface-low)",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Hamburger button — only visible on mobile via CSS */}
      <button
        className="hamburger-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle sidebar"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          marginRight: "8px",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {portal}
    </>
  );
}
