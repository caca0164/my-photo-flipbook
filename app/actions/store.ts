"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe-server";
import type { CartLine } from "@/lib/store-types";
import type { Locale } from "@/lib/i18n";
import { headers } from "next/headers";

export async function listStoreProductsPublic() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_products")
    .select(
      "id, slug, product_kind, title_en, title_zh, description_en, description_zh, price_cents, currency, image_url, active, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message, products: [] };
  return { products: data ?? [] };
}

async function getRequestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function createStoreCheckoutSession(input: {
  locale: Locale;
  cart: CartLine[];
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
}) {
  const stripe = getStripe();
  const svc = createServiceRoleClient();
  if (!stripe) {
    return { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local." };
  }
  if (!svc) {
    return {
      error:
        "Checkout requires SUPABASE_SERVICE_ROLE_KEY on the server (used to create orders securely). Add it in .env.local.",
    };
  }

  const trimmed = {
    email: input.customerEmail.trim(),
    name: input.customerName.trim(),
    phone: input.customerPhone.trim(),
    addr: input.shippingAddress.trim(),
  };
  if (!trimmed.email || !trimmed.name) {
    return { error: "Please enter your name and email." };
  }
  if (!input.cart.length) return { error: "Your cart is empty." };

  const lines = input.cart
    .map((l) => ({
      productId: l.productId,
      qty: Math.min(99, Math.max(1, Math.floor(Number(l.quantity)) || 1)),
    }))
    .filter((l) => l.qty > 0);
  if (!lines.length) return { error: "Your cart is empty." };

  const { data: products, error: pe } = await svc
    .from("store_products")
    .select("id, title_en, title_zh, price_cents, currency, active")
    .in(
      "id",
      lines.map((l) => l.productId),
    );

  if (pe || !products?.length) return { error: "Could not load product prices. Try again." };

  const byId = new Map((products as { id: string }[]).map((p) => [p.id, p]));
  let totalCents = 0;
  const currency = String((products[0] as { currency: string }).currency).toLowerCase();
  const resolved: {
    product_id: string;
    qty: number;
    unit_price_cents: number;
    title_en: string;
    title_zh: string;
    stripeName: string;
  }[] = [];

  for (const line of lines) {
    const p = byId.get(line.productId) as
      | {
          id: string;
          title_en: string;
          title_zh: string;
          price_cents: number;
          currency: string;
          active: boolean;
        }
      | undefined;
    if (!p || !p.active) return { error: "One or more products are unavailable." };
    if (String(p.currency).toLowerCase() !== currency) {
      return { error: "Mixed currencies are not supported in one order." };
    }
    totalCents += p.price_cents * line.qty;
    resolved.push({
      product_id: p.id,
      qty: line.qty,
      unit_price_cents: p.price_cents,
      title_en: p.title_en,
      title_zh: p.title_zh,
      stripeName: input.locale === "zh" ? p.title_zh : p.title_en,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const orderRow = {
    user_id: user?.id ?? null,
    customer_email: trimmed.email,
    customer_name: trimmed.name,
    customer_phone: trimmed.phone,
    shipping_address: trimmed.addr,
    status: "pending_payment" as const,
    currency,
    total_cents: totalCents,
    locale: input.locale,
    updated_at: new Date().toISOString(),
  };

  const { data: order, error: oe } = await svc
    .from("store_orders")
    .insert(orderRow)
    .select("id")
    .single();

  if (oe || !order) return { error: oe?.message ?? "Could not create order." };

  const orderId = (order as { id: string }).id;
  const itemRows = resolved.map((r) => ({
    order_id: orderId,
    product_id: r.product_id,
    quantity: r.qty,
    unit_price_cents: r.unit_price_cents,
    title_en_snapshot: r.title_en,
    title_zh_snapshot: r.title_zh,
  }));

  const { error: ie } = await svc.from("store_order_items").insert(itemRows);
  if (ie) {
    await svc.from("store_orders").delete().eq("id", orderId);
    return { error: ie.message };
  }

  const origin = await getRequestOrigin();
  const successUrl = `${origin}/${input.locale}/store/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/${input.locale}/store/cart`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: trimmed.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { order_id: orderId },
      line_items: resolved.map((r) => ({
        quantity: r.qty,
        price_data: {
          currency,
          unit_amount: r.unit_price_cents,
          product_data: {
            name: r.stripeName,
            metadata: { product_id: r.product_id },
          },
        },
      })),
    });

    await svc
      .from("store_orders")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    await svc.from("store_orders").delete().eq("id", orderId);
    const msg = e instanceof Error ? e.message : "Stripe error";
    return { error: msg };
  }
}
