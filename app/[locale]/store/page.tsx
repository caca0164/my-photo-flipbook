import StoreCatalog from "@/app/components/store/StoreCatalog";
import { listStoreProductsPublic } from "@/app/actions/store";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import type { StoreProductRow } from "@/lib/store-types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function StorePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);
  const { products, error } = await listStoreProductsPublic();

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t.storeTitle}</h1>
        {error ? (
          <p className="mt-6 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {error}
          </p>
        ) : null}
        {!error && (!products || products.length === 0) ? (
          <p className="mt-8 text-sm text-zinc-500">{t.storeCatalogEmpty}</p>
        ) : null}
      </div>
      {products && products.length > 0 ? (
        <StoreCatalog locale={locale} products={products as StoreProductRow[]} />
      ) : null}
      <div className="mx-auto max-w-5xl px-4 py-8 text-center">
        <Link
          href={`/${locale}`}
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
        >
          {t.backHome}
        </Link>
      </div>
    </main>
  );
}
