"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
    } catch {
      setError("Network error — unable to reach server");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F5F0E8",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Racing stripe */}
      <div style={{ display: "flex", height: "10px" }}>
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 1, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#F5F0E8", borderTop: "1px solid #D4C9B8" }} />
      </div>

      {/* Centered card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "360px",
            background: "#FFFFFF",
            border: "1px solid #D4C9B8",
            borderRadius: "10px",
            padding: "36px 32px",
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1
              style={{
                fontFamily: "monospace",
                fontSize: "28px",
                fontWeight: 900,
                color: "#C41E3A",
                margin: 0,
                letterSpacing: "0.1em",
              }}
            >
              TSRM
            </h1>
            <p
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "13px",
                color: "#8B7355",
                margin: "6px 0 0 0",
              }}
            >
              Admin Dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontFamily: "Georgia, serif",
                  fontSize: "12px",
                  color: "#8B7355",
                  marginBottom: "6px",
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@tsrm.local"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#F5F0E8",
                  border: "1px solid #D4C9B8",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#1A1A1A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontFamily: "Georgia, serif",
                  fontSize: "12px",
                  color: "#8B7355",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "#F5F0E8",
                  border: "1px solid #D4C9B8",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#1A1A1A",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  color: "#C41E3A",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                background: loading ? "#8B7355" : "#C41E3A",
                border: "none",
                borderRadius: "6px",
                fontFamily: "monospace",
                fontSize: "13px",
                fontWeight: 700,
                color: "#FFFFFF",
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.08em",
                marginTop: "4px",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
