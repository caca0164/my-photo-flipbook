"use client";

import { formatPriceFromCents } from "@/lib/format-price";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { isStoreProductPurchasable, type StoreProductRow } from "@/lib/store-types";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useStoreCart } from "./StoreCartProvider";

export default function StoreCartPage({
  locale,
  products,
  catalogFetchFailed = false,
}: {
  locale: Locale;
  products: StoreProductRow[];
  /** When true, do not prune localStorage cart (catalog API failed; avoid wiping valid lines). */
  catalogFetchFailed?: boolean;
}) {
  const t = messages[locale];
  const { lines, ready, setQty, removeItem, retainLinesForKnownProducts } = useStoreCart();

  useEffect(() => {
    if (!ready || catalogFetchFailed) return;
    retainLinesForKnownProducts(
      products.filter((p) => isStoreProductPurchasable(p)).map((p) => p.id),
    );
  }, [ready, catalogFetchFailed, products, retainLinesForKnownProducts]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const rows = useMemo(() => {
    return lines
      .map((l) => {
        const p = byId.get(l.productId);
        if (!p || !isStoreProductPurchasable(p)) return null;
        const title = locale === "zh" ? p.title_zh : p.title_en;
        const lineTotal = p.price_cents * l.quantity;
        return { line: l, p, title, lineTotal };
      })
      .filter(Boolean) as {
      line: { productId: string; quantity: number };
      p: StoreProductRow;
      title: string;
      lineTotal: number;
    }[];
  }, [lines, byId, locale]);

  const grand = rows.reduce((s, r) => s + r.lineTotal, 0);
  const currency = rows[0]?.p.currency ?? "hkd";

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">{t.storeCartTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.storeCartHint}</p>

        {!ready ? (
          <p className="mt-8 text-sm text-zinc-500">{t.storeCartLoading}</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">{t.storeCartEmpty}</p>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {rows.map(({ line, p, title, lineTotal }) => (
              <li
                key={line.productId}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-100">{title}</p>
                  <p className="text-sm text-zinc-500">
                    {formatPriceFromCents(p.price_cents, p.currency, locale)} × {line.quantity}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  {t.storeQty}
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(e) => setQty(line.productId, Number.parseInt(e.target.value, 10) || 1)}
                    className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                  />
                </label>
                <p className="text-sm font-medium text-amber-100">
                  {formatPriceFromCents(lineTotal, p.currency, locale)}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(line.productId)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  {t.storeRemove}
                </button>
              </li>
            ))}
          </ul>
        )}

        {ready && rows.length > 0 ? (
          <div className="mt-8 flex flex-col gap-4 border-t border-zinc-800 pt-6">
            <p className="text-lg font-semibold text-zinc-100">
              {t.storeTotal}{" "}
              <span className="text-amber-100">{formatPriceFromCents(grand, currency, locale)}</span>
            </p>
            <Link
              href={`/${locale}/store/checkout`}
              className="inline-flex w-fit rounded-lg bg-amber-600/90 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              {t.storeCheckoutCta}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
