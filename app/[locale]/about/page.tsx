import AboutPageShell from "@/app/components/AboutPageShell";
import BtsReelsFeed from "@/app/components/BtsReelsFeed";
import { getSiteAboutPublic } from "@/app/actions/about";
import { getAlbumFlipCoverPublic, listAlbumPagesForPublic } from "@/app/actions/album";
import { listBtsVideosPublic } from "@/app/actions/bts";
import type { FlipBookPage } from "@/lib/album-types";
import { mapBtsRowsToReelsItems } from "@/lib/bts-public";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

const DEMO_PAGES: FlipBookPage[] = [
  { id: "demo-1", kind: "image", src: "/globe.svg" },
  { id: "demo-2", kind: "image", src: "/window.svg" },
  { id: "demo-3", kind: "image", src: "/next.svg" },
  { id: "demo-4", kind: "image", src: "/file.svg" },
];

export default async function AboutPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const [{ row, error }, cover, albumPages, { videos: btsVideos }] = await Promise.all([
    getSiteAboutPublic(),
    getAlbumFlipCoverPublic(),
    listAlbumPagesForPublic(),
    listBtsVideosPublic(),
  ]);
  const extra = locale === "zh" ? (row?.content_zh ?? "") : (row?.content_en ?? "");
  const pages = albumPages.length > 0 ? albumPages : DEMO_PAGES;
  const btsItems = mapBtsRowsToReelsItems(btsVideos ?? [], locale);

  const hasBts = btsItems.length > 0;

  const profileArticle = (
    <article className="mx-auto flex min-h-full max-w-xl flex-col px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t.aboutTitle}</h1>
      <p className="mt-6 text-lg text-zinc-100">{t.aboutPhotographerLead}</p>

      {error ? (
        <p className="mt-6 text-sm text-amber-300">{error}</p>
      ) : extra.trim() ? (
        <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{extra}</div>
      ) : null}
    </article>
  );

  return (
    <AboutPageShell locale={locale} pages={pages} coverOverlay={cover} fullBleed={hasBts}>
      {hasBts ? (
        <BtsReelsFeed
          embedded
          locale={locale}
          pageTitle={t.btsTitle}
          videos={btsItems}
          leadingSlot={profileArticle}
        />
      ) : (
        <div className="px-4 py-12">{profileArticle}</div>
      )}
    </AboutPageShell>
  );
}
