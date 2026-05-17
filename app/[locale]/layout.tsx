import AppShell from "@/app/components/AppShell";
import SetHtmlLang from "@/app/components/SetHtmlLang";
import { getAlbumFlipCoverPublic } from "@/app/actions/album";
import { getBtsSettingsPublic } from "@/app/actions/bts";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "en";
  const t = getMessages(locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();

  const [initialFlipCover, btsSettings] = await Promise.all([
    getAlbumFlipCoverPublic(),
    getBtsSettingsPublic(),
  ]);
  const initialBtsPageHidden = btsSettings.page_hidden ?? true;

  return (
    <>
      <SetHtmlLang locale={raw} />
      <AppShell
        initialFlipCover={initialFlipCover}
        initialBtsPageHidden={initialBtsPageHidden}
      >
        {children}
      </AppShell>
    </>
  );
}
