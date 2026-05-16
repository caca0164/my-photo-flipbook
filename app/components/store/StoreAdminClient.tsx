"use client";

import {
  setStoreProductActive,
  setStoreProductSoldOut,
  updateStoreOrderStatus,
  upsertStoreProduct,
} from "@/app/actions/store-admin";
import { formatPriceFromCents } from "@/lib/format-price";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import type {
  StoreAdminOrderBundle,
  StoreOrderStatus,
  StoreProductKind,
  StoreProductRow,
} from "@/lib/store-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type ProductRow = StoreProductRow;

const KINDS: StoreProductKind[] = ["physical_album", "e_album", "framed_print"];

const STATUSES: StoreOrderStatus[] = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "cancelled",
];

export default function StoreAdminClient({
  locale,
  initialProducts,
  initialOrders,
}: {
  locale: Locale;
  initialProducts: ProductRow[];
  initialOrders: StoreAdminOrderBundle[];
}) {
  const t = messages[locale];
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<StoreProductKind>("physical_album");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descZh, setDescZh] = useState("");
  const [priceHkd, setPriceHkd] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [soldOut, setSoldOut] = useState(false);

  function resetForm() {
    setEditingId(null);
    setSlug("");
    setKind("physical_album");
    setTitleEn("");
    setTitleZh("");
    setDescEn("");
    setDescZh("");
    setPriceHkd("");
    setImageUrl("");
    setSortOrder("0");
    setActive(true);
    setSoldOut(false);
  }

  function loadProduct(p: ProductRow) {
    setEditingId(p.id);
    setSlug(p.slug);
    setKind(p.product_kind);
    setTitleEn(p.title_en);
    setTitleZh(p.title_zh);
    setDescEn(p.description_en);
    setDescZh(p.description_zh);
    setPriceHkd((p.price_cents / 100).toFixed(2));
    setImageUrl(p.image_url ?? "");
    setSortOrder(String(p.sort_order));
    setActive(p.active);
    setSoldOut(p.sold_out);
  }

  const priceCents = useMemo(() => {
    const n = Number.parseFloat(priceHkd);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }, [priceHkd]);

  function onSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await upsertStoreProduct({
        id: editingId,
        slug,
        product_kind: kind,
        title_en: titleEn,
        title_zh: titleZh,
        description_en: descEn,
        description_zh: descZh,
        price_cents: priceCents,
        currency: "hkd",
        image_url: imageUrl.trim() || null,
        active,
        sold_out: soldOut,
        sort_order: Number.parseInt(sortOrder, 10) || 0,
      });
      if ("error" in r && r.error) setError(r.error);
      else {
        resetForm();
        router.refresh();
      }
    });
  }

  function onToggleActive(id: string, next: boolean) {
    setError(null);
    start(async () => {
      const r = await setStoreProductActive(id, next);
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  function onToggleSoldOut(id: string, next: boolean) {
    setError(null);
    start(async () => {
      const r = await setStoreProductSoldOut(id, next);
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  function onOrderStatus(orderId: string, status: StoreOrderStatus) {
    setError(null);
    start(async () => {
      const r = await updateStoreOrderStatus(orderId, status);
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-50">{t.storeAdminTitle}</h1>
        <Link href={`/${locale}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          {t.storeAdminBackSite}
        </Link>
      </div>

      <div className="mt-6 flex gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "products" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {t.storeAdminProductsTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "orders" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {t.storeAdminOrdersTab}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "products" ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <form onSubmit={onSaveProduct} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-lg font-medium text-zinc-100">
              {editingId ? t.storeAdminSaveProduct : t.storeAdminNewProduct}
            </h2>
            <label className="text-sm text-zinc-300">
              {t.storeAdminSlug}
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminKind}
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as StoreProductKind)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminTitleEn}
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminTitleZh}
              <input
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminDescEn}
              <textarea
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminDescZh}
              <textarea
                value={descZh}
                onChange={(e) => setDescZh(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminPriceHkd}
              <input
                type="number"
                min={0}
                step={0.01}
                value={priceHkd}
                onChange={(e) => setPriceHkd(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminImageUrl}
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              {t.storeAdminSort}
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              {t.storeAdminActive}
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} />
              {t.storeAdminSoldOut}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
              >
                {t.storeAdminSaveProduct}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                {t.storeAdminNewProduct}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">HKD</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {initialProducts.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/80">
                    <td className="px-3 py-2 text-zinc-200">{p.slug}</td>
                    <td className="px-3 py-2 text-amber-100/90">
                      {formatPriceFromCents(p.price_cents, p.currency, locale)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{p.active ? "yes" : "no"}</td>
                    <td className="px-3 py-2 text-zinc-400">{p.sold_out ? "sold out" : "in stock"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadProduct(p)}
                          className="text-amber-200/90 hover:text-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onToggleSoldOut(p.id, !p.sold_out)}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          {p.sold_out ? t.storeAdminMarkInStock : t.storeAdminMarkSoldOut}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onToggleActive(p.id, !p.active)}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          {p.active ? t.storeAdminDeactivate : t.storeAdminActivate}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800">
          {initialOrders.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">{t.storeAdminNoOrders}</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{t.storeAdminOrderEmail}</th>
                  <th className="px-3 py-2">{t.storeAdminOrderTotal}</th>
                  <th className="px-3 py-2">{t.storeAdminOrderStatus}</th>
                  <th className="px-3 py-2">{t.storeAdminOrderDate}</th>
                </tr>
              </thead>
              <tbody>
                {initialOrders.map(({ order: o }) => (
                  <tr key={o.id} className="border-b border-zinc-800/80">
                    <td className="px-3 py-2 text-zinc-200">
                      <div>{o.customer_name}</div>
                      <div className="text-xs text-zinc-500">{o.customer_email}</div>
                    </td>
                    <td className="px-3 py-2 text-amber-100/90">
                      {formatPriceFromCents(o.total_cents, o.currency, locale)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={o.status}
                        disabled={pending}
                        onChange={(e) => onOrderStatus(o.id, e.target.value as StoreOrderStatus)}
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {new Date(o.created_at).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
