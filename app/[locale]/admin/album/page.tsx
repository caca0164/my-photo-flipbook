import AlbumAdminClient from "@/app/components/AlbumAdminClient";
import { getAlbumFlipCoverPublic, listAlbumImagesAdmin } from "@/app/actions/album";
import { requireAdmin } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminAlbumPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin/album`);
  const [rows, cover] = await Promise.all([listAlbumImagesAdmin(), getAlbumFlipCoverPublic()]);

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <AlbumAdminClient locale={locale} initialRows={rows} initialCover={cover} />
      {!process.env.NEXT_PUBLIC_SUPABASE_URL ? (
        <p className="px-4 pb-8 text-center text-xs text-amber-400">
          {locale === "zh"
            ? "請設定 NEXT_PUBLIC_SUPABASE_URL 與 ANON KEY。"
            : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."}
        </p>
      ) : null}
    </main>
  );
}
