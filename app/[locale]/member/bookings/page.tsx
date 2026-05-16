import { requireMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { formatBookingSlotHk } from "@/lib/booking-hk-display";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

type BookingRow = {
  id: string;
  status: string;
  total_cents: number;
  currency: string;
  slot_start: string;
  slot_end: string;
  created_at: string;
};

export default async function MemberBookingsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  await requireMember(locale, `/${locale}/member/bookings`);
  const t = getMessages(locale);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("booking_orders")
    .select("id, status, total_cents, currency, slot_start, slot_end, created_at")
    .order("created_at", { ascending: false });

  const list = (rows ?? []) as BookingRow[];

  function statusLabel(s: string): string {
    if (s === "paid") return t.adminBookingStatusPaid;
    if (s === "pending_payment") return t.adminBookingStatusPendingPayment;
    if (s === "cancelled") return t.adminBookingStatusCancelled;
    return s;
  }

  function money(cents: number, cur: string): string {
    return (cents / 100).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK", {
      style: "currency",
      currency: cur.toUpperCase(),
    });
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{t.memberBookingsTitle}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t.memberBookingsSubtitle}</p>
        {error ? (
          <p className="mt-6 text-sm text-red-400">{error.message}</p>
        ) : list.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">{t.memberBookingsEmpty}</p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">{t.memberBookingsOrderId}</th>
                  <th className="px-4 py-3">{t.memberBookingsStatus}</th>
                  <th className="px-4 py-3">{t.memberBookingsTotal}</th>
                  <th className="px-4 py-3">{t.memberBookingsSlot}</th>
                  <th className="px-4 py-3">{t.memberBookingsCreated}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">{r.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-zinc-200">{statusLabel(r.status)}</td>
                    <td className="px-4 py-3">{money(r.total_cents, r.currency)}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {formatBookingSlotHk(r.slot_start, r.slot_end, locale)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(r.created_at).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-10 text-center">
          <Link href={`/${locale}`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
            {t.backHome}
          </Link>
        </p>
      </div>
    </main>
  );
}
