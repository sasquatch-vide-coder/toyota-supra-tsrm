import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDownloadInfo } from "@/lib/downloads";

const VALID_MODELS = new Set(["mk2", "mk3", "mk4"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  const { model } = await params;

  if (!VALID_MODELS.has(model)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 404 });
  }

  const download = getDownloadInfo(model);
  if (!download) {
    return NextResponse.json(
      { error: "Download not available" },
      { status: 404 }
    );
  }

  // Log the download event (fire-and-forget, don't block the redirect)
  supabaseAdmin
    .from("download_events")
    .insert({ model })
    .then();

  // Redirect to the static ZIP file. Use a relative Location header so the
  // browser resolves it against the public request URL — behind the nginx
  // reverse proxy, request.url is the internal upstream (localhost:3000),
  // so constructing an absolute URL from it would leak that to the client.
  return new NextResponse(null, {
    status: 302,
    headers: { Location: download.url },
  });
}
