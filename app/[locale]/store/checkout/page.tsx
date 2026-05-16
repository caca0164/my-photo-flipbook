import StoreCheckoutClient from "@/app/components/store/StoreCheckoutClient";
import { listStoreProductsPublic } from "@/app/actions/store";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import type { StoreProductRow } from "@/lib/store-types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function StoreCheckoutPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const { products, error } = await listStoreProductsPublic();

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold">{t.storeCheckoutTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.storeCheckoutStripeNote}</p>
        <div className="mt-10">
          <StoreCheckoutClient
            locale={locale}
            products={(products ?? []) as StoreProductRow[]}
            catalogFetchFailed={Boolean(error)}
          />
        </div>
      </div>
    </main>
  );
}
