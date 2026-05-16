"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/admin";
import type { StoreOrderStatus, StoreProductKind } from "@/lib/store-types";
import { revalidatePath } from "next/cache";
import { locales } from "@/lib/i18n";

async function requireAdminSupabase() {
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "forbidden" as const };
  return { supabase: await createClient(), session };
}

function revalidateStorePaths() {
  for (const loc of locales) {
    revalidatePath(`/${loc}/store`, "page");
    revalidatePath(`/${loc}/admin/store`, "page");
  }
}

export async function listStoreProductsAdmin() {
  const r = await requireAdminSupabase();
  if ("error" in r) return { error: r.error, products: [] };
  const { data, error } = await r.supabase
    .from("store_products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return { error: error.message, products: [] };
  return { products: data ?? [] };
}

export async function listStoreOrdersAdmin() {
  const r = await requireAdminSupabase();
  if ("error" in r) return { error: r.error, orders: [] };
  const { data: orders, error } = await r.supabase
    .from("store_orders")
    .select("id, user_id, customer_email, customer_name, status, total_cents, currency, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { error: error.message, orders: [] };
  const ids = (orders ?? []).map((o: { id: string }) => o.id);
  if (!ids.length) return { orders: [] as { order: unknown; items: unknown[] }[] };

  const { data: items, error: ie } = await r.supabase
    .from("store_order_items")
    .select("id, order_id, product_id, quantity, unit_price_cents, title_en_snapshot, title_zh_snapshot")
    .in("order_id", ids);
  if (ie) return { error: ie.message, orders: [] };

  const byOrder = new Map<string, unknown[]>();
  for (const row of items ?? []) {
    const oid = (row as { order_id: string }).order_id;
    const arr = byOrder.get(oid) ?? [];
    arr.push(row);
    byOrder.set(oid, arr);
  }

  const merged = (orders ?? []).map((o: { id: string }) => ({
    order: o,
    items: byOrder.get(o.id) ?? [],
  }));

  return { orders: merged };
}

export async function updateStoreOrderStatus(orderId: string, status: StoreOrderStatus) {
  const r = await requireAdminSupabase();
  if ("error" in r) return { error: r.error };
  const allowed: StoreOrderStatus[] = ["pending_payment", "paid", "processing", "shipped", "cancelled"];
  if (!allowed.includes(status)) return { error: "invalid_status" };
  const { error } = await r.supabase
    .from("store_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { error: error.message };
  revalidateStorePaths();
  return { ok: true as const };
}

export async function upsertStoreProduct(input: {
  id?: string | null;
  slug: string;
  product_kind: StoreProductKind;
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}) {
  const r = await requireAdminSupabase();
  if ("error" in r) return { error: r.error };

  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!slug) return { error: "slug_required" };

  const price = Math.max(0, Math.round(Number(input.price_cents)) || 0);
  const cur = (input.currency || "hkd").trim().toLowerCase();
  const row = {
    slug,
    product_kind: input.product_kind,
    title_en: input.title_en.trim(),
    title_zh: input.title_zh.trim(),
    description_en: input.description_en.trim(),
    description_zh: input.description_zh.trim(),
    price_cents: price,
    currency: cur,
    image_url: input.image_url?.trim() || null,
    active: input.active,
    sort_order: Math.round(Number(input.sort_order)) || 0,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await r.supabase.from("store_products").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await r.supabase.from("store_products").insert(row);
    if (error) return { error: error.message };
  }
  revalidateStorePaths();
  return { ok: true as const };
}

export async function setStoreProductActive(productId: string, active: boolean) {
  const r = await requireAdminSupabase();
  if ("error" in r) return { error: r.error };
  const { error } = await r.supabase
    .from("store_products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) return { error: error.message };
  revalidateStorePaths();
  return { ok: true as const };
}
