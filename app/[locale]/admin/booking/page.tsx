import BookingAdminClient from "@/app/components/BookingAdminClient";
import { getBookingAdminConfig } from "@/app/actions/booking-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminBookingPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin/booking`);
  const { row, error } = await getBookingAdminConfig();

  if (error || !row) {
    return (
      <main className="min-h-[100dvh] bg-zinc-950 px-4 py-12 text-zinc-100">
        <p className="text-center text-sm text-red-400">{error ?? "Missing booking_config row."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <BookingAdminClient locale={locale} initialRow={row} />
    </main>
  );
}
