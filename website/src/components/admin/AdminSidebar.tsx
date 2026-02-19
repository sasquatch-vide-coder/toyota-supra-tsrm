"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div
      style={{
        width: "240px",
        flexShrink: 0,
        background: "#1A1A1A",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        borderRight: "1px solid #2A2A2A",
      }}
    >
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid #2A2A2A",
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "0.3em",
            color: "#8B7355",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          Navigation
        </p>
      </div>

      <nav style={{ flex: 1, padding: "8px 0" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                textDecoration: "none",
                borderLeft: isActive ? "3px solid #C41E3A" : "3px solid transparent",
                background: isActive ? "rgba(196,30,58,0.08)" : "transparent",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#C41E3A",
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "14px",
                  color: isActive ? "#F5F0E8" : "#8B7355",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #2A2A2A",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#4A3A2A",
          }}
        >
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
