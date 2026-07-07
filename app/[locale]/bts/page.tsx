import BtsReelsFeed from "@/app/components/BtsReelsFeed";
import { canViewPublicBtsPage, listBtsVideosPublic } from "@/app/actions/bts";
import { mapBtsRowsToReelsItems } from "@/lib/bts-public";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function BtsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);

  const allowed = await canViewPublicBtsPage();
  if (!allowed) notFound();

  const { videos, error } = await listBtsVideosPublic();

  if (error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <p className="text-sm text-amber-400">{error}</p>
      </main>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-zinc-100">
        <p className="text-sm text-zinc-500">{t.btsEmpty}</p>
        <Link
          href={`/${locale}`}
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200"
        >
          {t.backHome}
        </Link>
      </main>
    );
  }

  const items = mapBtsRowsToReelsItems(videos, locale);

  return (
    <main className="bg-black">
      <BtsReelsFeed
        locale={locale}
        pageTitle={t.btsTitle}
        videos={items}
        backHref={`/${locale}`}
        backLabel={t.backHome}
      />
    </main>
  );
}
