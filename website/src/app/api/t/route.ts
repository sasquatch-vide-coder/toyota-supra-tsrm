import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// In-memory rate limiting
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, RATE_WINDOW_MS);

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return new Response(null, { status: 429 });
    }

    const body = await request.json();
    const { sid, path, referrer, sw, sh, type = "pageview" } = body;

    if (!sid || typeof sid !== "string") {
      return new Response(null, { status: 400 });
    }

    if (type === "heartbeat") {
      await supabaseAdmin.rpc("heartbeat_session", { p_id: sid });
      return new Response(null, { status: 204 });
    }

    // Pageview validation
    if (!path || typeof path !== "string" || !path.startsWith("/") || path.length > 500) {
      return new Response(null, { status: 400 });
    }

    const safeReferrer = typeof referrer === "string" && referrer.length <= 2000 ? referrer : null;
    const ua = request.headers.get("user-agent") || null;
    const screenW = typeof sw === "number" && sw > 0 && sw < 10000 ? sw : null;
    const screenH = typeof sh === "number" && sh > 0 && sh < 10000 ? sh : null;

    // Insert page view and upsert session in parallel
    await Promise.all([
      supabaseAdmin.from("page_views").insert({
        session_id: sid,
        path,
        referrer: safeReferrer,
        user_agent: ua,
        screen_width: screenW,
        screen_height: screenH,
      }),
      supabaseAdmin.rpc("upsert_session", {
        p_id: sid,
        p_path: path,
        p_referrer: safeReferrer,
        p_ua: ua,
        p_sw: screenW,
        p_sh: screenH,
      }),
    ]);

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
