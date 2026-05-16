import AboutInstagramEmbed from "@/app/components/AboutInstagramEmbed";
import AboutPageShell from "@/app/components/AboutPageShell";
import { getSiteAboutPublic } from "@/app/actions/about";
import { getAlbumFlipCoverPublic, listAlbumPagesForPublic } from "@/app/actions/album";
import type { FlipBookPage } from "@/lib/album-types";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
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
  const [{ row, error }, cover, albumPages] = await Promise.all([
    getSiteAboutPublic(),
    getAlbumFlipCoverPublic(),
    listAlbumPagesForPublic(),
  ]);
  const extra = locale === "zh" ? (row?.content_zh ?? "") : (row?.content_en ?? "");
  const pages = albumPages.length > 0 ? albumPages : DEMO_PAGES;

  return (
    <AboutPageShell locale={locale} pages={pages} coverOverlay={cover}>
      <article className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t.aboutTitle}</h1>
        <p className="mt-6 text-lg text-zinc-100">{t.aboutPhotographerLead}</p>

        {error ? (
          <p className="mt-6 text-sm text-amber-300">{error}</p>
        ) : extra.trim() ? (
          <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{extra}</div>
        ) : null}

        <AboutInstagramEmbed locale={locale} />

        <p className="mt-12 text-center">
          <Link
            href={`/${locale}`}
            className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200"
          >
            {t.backHome}
          </Link>
        </p>
      </article>
    </AboutPageShell>
  );
}
