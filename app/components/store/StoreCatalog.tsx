"use client";

import { formatPriceFromCents } from "@/lib/format-price";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { isStoreProductPurchasable, type StoreProductRow } from "@/lib/store-types";
import { useEffect } from "react";
import { useStoreCart } from "./StoreCartProvider";

export default function StoreCatalog({
  locale,
  products,
}: {
  locale: Locale;
  products: StoreProductRow[];
}) {
  const t = messages[locale];
  const { addItem, retainLinesForKnownProducts } = useStoreCart();

  useEffect(() => {
    retainLinesForKnownProducts(
      products.filter((p) => isStoreProductPurchasable(p)).map((p) => p.id),
    );
  }, [products, retainLinesForKnownProducts]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const title = locale === "zh" ? p.title_zh : p.title_en;
        const desc = locale === "zh" ? p.description_zh : p.description_en;
        const kindLabel =
          p.product_kind === "physical_album"
            ? t.storeKindPhysicalAlbum
            : p.product_kind === "e_album"
              ? t.storeKindEAlbum
              : t.storeKindFramed;
        const price = formatPriceFromCents(p.price_cents, p.currency, locale);
        const soldOut = p.sold_out;
        const canBuy = isStoreProductPurchasable(p);

        return (
          <article
            key={p.id}
            className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-lg ${
              soldOut ? "opacity-80" : ""
            }`}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
              {p.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin image URLs */
                <img src={p.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                  {t.storeNoImage}
                </div>
              )}
              {soldOut ? (
                <span className="absolute left-3 top-3 rounded-md bg-zinc-950/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-200 ring-1 ring-zinc-600">
                  {t.storeSoldOut}
                </span>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-200/70">{kindLabel}</p>
              <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
              <p className="line-clamp-3 text-sm text-zinc-400">{desc}</p>
              <p className="mt-auto pt-2 text-lg font-medium text-amber-100">{price}</p>
              <button
                type="button"
                disabled={!canBuy}
                onClick={() => addItem(p.id, 1)}
                className="mt-2 rounded-lg bg-amber-600/90 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:hover:bg-zinc-700"
              >
                {soldOut ? t.storeSoldOut : t.storeAddToCart}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
