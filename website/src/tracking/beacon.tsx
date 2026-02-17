"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function getSessionId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )tsrm_sid=([^;]*)/);
  if (match) return match[1];
  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  document.cookie = `tsrm_sid=${id}; path=/; max-age=1800; SameSite=Lax`;
  return id;
}

function refreshSessionCookie(sid: string) {
  document.cookie = `tsrm_sid=${sid}; path=/; max-age=1800; SameSite=Lax`;
}

function isNewSession(): boolean {
  if (typeof document === "undefined") return false;
  return !document.cookie.match(/(?:^|; )tsrm_sid=([^;]*)/);
}

function sendBeacon(payload: Record<string, unknown>) {
  try {
    const url = "/api/t";
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // never block or error for the user
  }
}

export function TrackingBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      if (pathname.startsWith("/admin")) return;
      if (pathname === lastPath.current) return;

      const isNew = isNewSession();
      const sid = getSessionId();
      refreshSessionCookie(sid);
      lastPath.current = pathname;

      sendBeacon({
        sid,
        path: pathname,
        type: "pageview",
        referrer: isNew ? document.referrer || undefined : undefined,
        sw: window.screen?.width,
        sh: window.screen?.height,
      });
    } catch {
      // silent
    }
  }, [pathname]);

  // Heartbeat: every 30s while visible
  useEffect(() => {
    function startHeartbeat() {
      stopHeartbeat();
      heartbeatRef.current = setInterval(() => {
        try {
          const match = document.cookie.match(/(?:^|; )tsrm_sid=([^;]*)/);
          if (!match) return;
          refreshSessionCookie(match[1]);
          sendBeacon({ sid: match[1], type: "heartbeat" });
        } catch {
          // silent
        }
      }, 30_000);
    }

    function stopHeartbeat() {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }

    if (document.visibilityState === "visible") {
      startHeartbeat();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopHeartbeat();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
