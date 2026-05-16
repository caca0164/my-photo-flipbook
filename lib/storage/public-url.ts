/**
 * Public flipbook image URL.
 * Default: direct Supabase Storage URL (works for normal browsers with internet).
 * Set `NEXT_PUBLIC_FLIPBOOK_SAME_ORIGIN_STORAGE=1` to use `/api/flipbook/...` so the browser
 * only talks to your app origin (e.g. air-gapped LAN clients when the Next server can reach Supabase).
 */
export function flipbookPublicUrl(storagePath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return "";
  const path = storagePath.replace(/^\//, "").replace(/\\/g, "/");
  if (!path) return "";
  const encodedSegments = path
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  if (process.env.NEXT_PUBLIC_FLIPBOOK_SAME_ORIGIN_STORAGE === "1") {
    return `/api/flipbook/${encodedSegments}`;
  }
  return `${base}/storage/v1/object/public/flipbook/${encodedSegments}`;
}
