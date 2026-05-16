import BtsAdminClient from "@/app/components/BtsAdminClient";
import { getBtsSettingsAdmin, listBtsVideosAdmin } from "@/app/actions/bts";
import { requireAdmin } from "@/lib/auth/admin";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminBtsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin/bts`);
  const t = getMessages(locale);
  const [{ videos, error }, settingsRes] = await Promise.all([
    listBtsVideosAdmin(),
    getBtsSettingsAdmin(),
  ]);

  if (error && error !== "Forbidden") {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 px-4 py-12 text-zinc-100">
        <p className="text-center text-sm text-red-400">{error}</p>
        <p className="mt-4 text-center text-xs text-zinc-500">
          {locale === "zh"
            ? "請套用 migration：20260516140000_site_bts_videos.sql"
            : "Apply migration: 20260516140000_site_bts_videos.sql"}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <BtsAdminClient
        locale={locale}
        initialVideos={videos ?? []}
        initialPageHidden={settingsRes.settings?.page_hidden ?? false}
      />
      {!process.env.NEXT_PUBLIC_SUPABASE_URL ? (
        <p className="px-4 pb-8 text-center text-xs text-amber-400">{t.adminAboutEnvHint}</p>
      ) : null}
    </main>
  );
}
