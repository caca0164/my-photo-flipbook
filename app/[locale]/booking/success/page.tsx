import { getStripe } from "@/lib/stripe-server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const ORDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string; booking_id?: string }>;
};

export default async function BookingSuccessPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const postCheckoutHref = user ? `/${locale}/member/bookings` : `/${locale}`;
  const postCheckoutLabel = user ? t.navMemberBookings : t.storeNavHome;
  const sp = await searchParams;
  const sessionId = sp.session_id;
  const bookingId = sp.booking_id?.trim();

  if (bookingId && ORDER_UUID_RE.test(bookingId)) {
    const svc = createServiceRoleClient();
    const { data: booking } = svc
      ? await svc.from("booking_orders").select("status").eq("id", bookingId).maybeSingle()
      : { data: null };
    const paid = String((booking as { status?: string } | null)?.status ?? "") === "paid";

    if (paid) {
      return (
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-center text-zinc-100">
          <h1 className="text-2xl font-semibold">{t.bookingSuccessTitle}</h1>
          <p className="max-w-md text-sm text-zinc-400">{t.bookingSuccessPaid}</p>
          <Link href={postCheckoutHref} className="text-sm text-amber-200 underline underline-offset-4">
            {postCheckoutLabel}
          </Link>
        </main>
      );
    }
  }

  if (!sessionId) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-sm text-zinc-400">{t.bookingSuccessMissingSession}</p>
        <Link href={postCheckoutHref} className="text-amber-200 underline">
          {postCheckoutLabel}
        </Link>
      </main>
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-sm text-zinc-400">{t.storeSuccessStripeMissing}</p>
        <Link href={postCheckoutHref} className="text-amber-200 underline">
          {postCheckoutLabel}
        </Link>
      </main>
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === "paid";

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-center text-zinc-100">
      <h1 className="text-2xl font-semibold">{t.bookingSuccessTitle}</h1>
      <p className="max-w-md text-sm text-zinc-400">
        {paid ? t.bookingSuccessPaid : t.bookingSuccessPending}
      </p>
      <Link href={postCheckoutHref} className="text-sm text-amber-200 underline underline-offset-4">
        {postCheckoutLabel}
      </Link>
    </main>
  );
}
