import { getStripe } from "@/lib/stripe-server";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function StoreSuccessPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const sp = await searchParams;
  const sessionId = sp.session_id;

  if (!sessionId) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-sm text-zinc-400">{t.storeSuccessMissingSession}</p>
        <Link href={`/${locale}/store`} className="text-amber-200 underline">
          {t.storeBrowseProducts}
        </Link>
      </main>
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-sm text-zinc-400">{t.storeSuccessStripeMissing}</p>
        <Link href={`/${locale}/store`} className="text-amber-200 underline">
          {t.storeBrowseProducts}
        </Link>
      </main>
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === "paid";

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 text-center text-zinc-100">
      <h1 className="text-2xl font-semibold">{t.storeSuccessTitle}</h1>
      <p className="max-w-md text-sm text-zinc-400">
        {paid ? t.storeSuccessPaid : t.storeSuccessPending}
      </p>
      <Link href={`/${locale}/store`} className="text-sm text-amber-200 underline underline-offset-4">
        {t.storeBrowseProducts}
      </Link>
    </main>
  );
}
