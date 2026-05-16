import BookingWizardClient from "@/app/components/BookingWizardClient";
import { getBookingWizardPublicData } from "@/app/actions/booking";
import { getSessionProfile } from "@/lib/auth/admin";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import type { BookingPriceSnapshot } from "@/lib/booking-types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

const zeroPrices: BookingPriceSnapshot = {
  currency: "hkd",
  price_shoot_portrait_cents: 0,
  price_shoot_boudoir_cents: 0,
  price_shoot_prewedding_cents: 0,
  price_party_single_cents: 0,
  price_party_double_cents: 0,
  price_party_group_cents: 0,
  price_hours_2_cents: 0,
  price_hours_3_cents: 0,
  price_hours_4_cents: 0,
  price_hours_10_cents: 0,
  price_makeup_yes_cents: 0,
  price_makeup_no_cents: 0,
  price_female_assistant_yes_cents: 0,
  price_female_assistant_no_cents: 0,
};

export default async function BookingPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const [d, session] = await Promise.all([getBookingWizardPublicData(locale), getSessionProfile()]);
  const prices = d.prices ?? zeroPrices;
  const viewerIsAdmin = session?.role === "admin";

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t.bookingTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t.bookingSubtitle}</p>
        {d.error && viewerIsAdmin ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t.bookingConfigError}
          </p>
        ) : null}
        <div className="mt-10">
          <BookingWizardClient
            locale={locale}
            initialPrices={prices}
            initialNoticesMd={d.noticesMd}
            initialBoudoirConfidentialityMd={d.boudoirConfidentialityMd ?? ""}
            initialCalendarConfigured={d.calendarConfigured}
            viewerIsAdmin={viewerIsAdmin}
          />
        </div>
        <Link
          href={`/${locale}`}
          className="mt-10 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
        >
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
