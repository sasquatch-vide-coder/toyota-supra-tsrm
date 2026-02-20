"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";

interface MobileSidebarWrapperProps {
  children: React.ReactNode;
}

export default function MobileSidebarWrapper({ children }: MobileSidebarWrapperProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        className={`sidebar-backdrop${open ? " sidebar-open" : ""}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar overlay — hidden on desktop (inline), shown as fixed overlay on mobile when open */}
      <div
        className={`sidebar-overlay${open ? " sidebar-open" : ""}`}
        style={{ display: "none" }}
      >
        {children}
      </div>
    </>
  );
}
