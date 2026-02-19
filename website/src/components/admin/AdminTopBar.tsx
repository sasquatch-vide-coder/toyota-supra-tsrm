"use client";

import { useRouter } from "next/navigation";

export function AdminTopBar({ email }: { email?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "#1A1A1A",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#8B7355",
          letterSpacing: "0.05em",
        }}
      >
        <span style={{ color: "#C41E3A", fontWeight: 900 }}>TSRM</span>
        {" "}›{" "}
        <span style={{ color: "#F5F0E8" }}>Admin</span>
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {email && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#4A3A2A",
            }}
          >
            {email}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#8B7355",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            letterSpacing: "0.05em",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
