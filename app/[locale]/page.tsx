import FlipBook from "@/app/components/FlipBook";
import { getAlbumFlipCoverPublic, listAlbumPagesForPublic } from "@/app/actions/album";
import type { FlipBookPage } from "@/lib/album-types";

export const dynamic = "force-dynamic";

/** Local assets so intranet / offline demo works without picsum or Supabase pages. */
const DEMO_PAGES: FlipBookPage[] = [
  { id: "demo-1", kind: "image", src: "/globe.svg" },
  { id: "demo-2", kind: "image", src: "/window.svg" },
  { id: "demo-3", kind: "image", src: "/next.svg" },
  { id: "demo-4", kind: "image", src: "/file.svg" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [cover, albumPages] = await Promise.all([
    getAlbumFlipCoverPublic(),
    listAlbumPagesForPublic(),
  ]);
  const show = albumPages.length > 0 ? albumPages : DEMO_PAGES;

  return <FlipBook key={locale} locale={locale} pages={show} coverOverlay={cover} />;
}
