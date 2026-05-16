import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies public flipbook storage through this origin so LAN clients without
 * internet can still load album images when the Next server can reach Supabase.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse | Response> {
  const { path: segments } = await ctx.params;
  if (!segments?.length) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  if (segments.some((s) => s === ".." || s.includes("/"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const rel = segments.map((s) => encodeURIComponent(s)).join("/");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const upstream = `${base}/storage/v1/object/public/flipbook/${rel}`;
  const res = await fetch(upstream, { cache: "no-store" });
  if (!res.ok) {
    return new NextResponse(null, { status: res.status === 404 ? 404 : 502 });
  }
  const buf = await res.arrayBuffer();
  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "public, max-age=300");
  return new NextResponse(buf, { status: 200, headers });
}
