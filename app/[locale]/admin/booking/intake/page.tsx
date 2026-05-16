import BookingIntakeRulesClient from "@/app/components/BookingIntakeRulesClient";
import { listBookingIntakeRules } from "@/app/actions/booking-intake-admin";
import { listBookingPostPaidAutoMessages } from "@/app/actions/booking-post-paid-auto-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminBookingIntakePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin/booking/intake`);
  const [{ rules, error }, { messages: autoMessages, error: autoError }] = await Promise.all([
    listBookingIntakeRules(),
    listBookingPostPaidAutoMessages(),
  ]);

  const combinedError = error ?? autoError;

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <BookingIntakeRulesClient
        locale={locale}
        initialRules={rules ?? []}
        initialAutoMessages={autoMessages ?? []}
        initialError={combinedError}
      />
    </main>
  );
}
