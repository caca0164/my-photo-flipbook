import AdminChatClient from "@/app/components/AdminChatClient";
import { listAdminChatThreads } from "@/app/actions/booking-chat";
import { requireAdmin } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminChatPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  await requireAdmin(locale, `/${locale}/admin/chat`);
  const { threads, error } = await listAdminChatThreads();

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <AdminChatClient locale={locale} initialThreads={threads ?? []} loadError={error} />
    </main>
  );
}
