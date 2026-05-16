"use client";

import { createStoreCheckoutSession } from "@/app/actions/store";
import { formatPriceFromCents } from "@/lib/format-price";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import type { StoreProductRow } from "@/lib/store-types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useStoreCart } from "./StoreCartProvider";

export default function StoreCheckoutClient({
  locale,
  products,
  catalogFetchFailed = false,
}: {
  locale: Locale;
  products: StoreProductRow[];
  catalogFetchFailed?: boolean;
}) {
  const t = messages[locale];
  const router = useRouter();
  const { lines, ready, clearCart, retainLinesForKnownProducts } = useStoreCart();

  useEffect(() => {
    if (!ready || catalogFetchFailed) return;
    retainLinesForKnownProducts(products.map((p) => p.id));
  }, [ready, catalogFetchFailed, products, retainLinesForKnownProducts]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const { rows, grand, currency } = useMemo(() => {
    const r = lines
      .map((l) => {
        const p = byId.get(l.productId);
        if (!p) return null;
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
    const g = r.reduce((s, x) => s + x.lineTotal, 0);
    const c = r[0]?.p.currency ?? "hkd";
    return { rows: r, grand: g, currency: c };
  }, [lines, byId, locale]);

  function onPay(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rows.length) {
      setError(t.storeCheckoutEmpty);
      return;
    }
    start(async () => {
      const res = await createStoreCheckoutSession({
        locale,
        cart: rows.map((r) => ({ productId: r.line.productId, quantity: r.line.quantity })),
        customerEmail: email,
        customerName: name,
        customerPhone: phone,
        shippingAddress: address,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("url" in res && res.url) {
        clearCart();
        window.location.href = res.url;
        return;
      }
      setError(t.storeCheckoutUnknown);
    });
  }

  if (!ready) {
    return <p className="text-sm text-zinc-500">{t.storeCartLoading}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
        <p>{t.storeCheckoutEmpty}</p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/store`)}
          className="mt-4 text-amber-200 underline hover:text-amber-100"
        >
          {t.storeBrowseProducts}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form onSubmit={onPay} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-100">{t.storeCheckoutContact}</h2>
        <label className="block text-sm text-zinc-300">
          {t.storeFieldEmail}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          {t.storeFieldName}
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          {t.storeFieldPhone}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          {t.storeFieldAddress}
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-fit rounded-lg bg-amber-600/90 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? "…" : t.storePayStripe}
        </button>
        <p className="text-xs text-zinc-500">{t.storeCheckoutStripeNote}</p>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{t.storeOrderSummary}</h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm">
          {rows.map(({ line, p, title, lineTotal }) => (
            <li key={line.productId} className="flex justify-between gap-4 text-zinc-300">
              <span>
                {title} × {line.quantity}
              </span>
              <span className="shrink-0 text-amber-100/90">
                {formatPriceFromCents(lineTotal, p.currency, locale)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-zinc-800 pt-4 text-base font-semibold text-zinc-100">
          {t.storeTotal}{" "}
          <span className="text-amber-100">{formatPriceFromCents(grand, currency, locale)}</span>
        </p>
      </div>
    </div>
  );
}
