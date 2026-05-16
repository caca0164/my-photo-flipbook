"use server";

import { unstable_noStore as noStore } from "next/cache";
import { connection } from "next/server";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/admin";
import {
  BOOKING_TZ_OFFSET,
  type BookingFemaleAssistant,
  type BookingHoursTier,
  bookingHoursTierValidForShoot,
  type BookingMakeup,
  type BookingPartySize,
  type BookingPriceSnapshot,
  type BookingShootType,
  bookingNeedsFemaleAssistantStep,
  bookingLocalSlotToUtcIso,
  bookingTodayYmdHk,
  computeBookingTotalCents,
  hoursTierToDurationHours,
} from "@/lib/booking-types";
import { getMergedBookingBusy } from "@/lib/booking-busy-server";
import { listAvailableSlotStarts } from "@/lib/booking-slots-client";
import type { Locale } from "@/lib/i18n";
import { sendBookingOrderPaidEmails, type BookingOrderPaidRow } from "@/lib/email-order-receipts";
import { seedPaidBookingPostChat } from "@/lib/booking-post-paid-chat";
import { getStripe } from "@/lib/stripe-server";

/** Admin-only test promo: server applies only when `profiles.role === "admin"`. */
const ADMIN_BOOKING_PROMO_CODE = "pudding";
/** Admin-only: skip Stripe and mark booking paid immediately. */
const ADMIN_BOOKING_PROMO_SKIP = "skip";
/** HK$4.00 in smallest currency unit (HKD cents). */
const ADMIN_BOOKING_PROMO_TOTAL_CENTS = 400;

async function getRequestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function rowToPriceSnapshot(row: Record<string, unknown>): BookingPriceSnapshot {
  return {
    currency: String(row.currency ?? "hkd"),
    price_shoot_portrait_cents: Number(row.price_shoot_portrait_cents) || 0,
    price_shoot_boudoir_cents: Number(row.price_shoot_boudoir_cents) || 0,
    price_shoot_prewedding_cents: Number(row.price_shoot_prewedding_cents) || 0,
    price_party_single_cents: Number(row.price_party_single_cents) || 0,
    price_party_double_cents: Number(row.price_party_double_cents) || 0,
    price_party_group_cents: Number(row.price_party_group_cents) || 0,
    price_hours_2_cents: Number(row.price_hours_2_cents) || 0,
    price_hours_3_cents: Number(row.price_hours_3_cents) || 0,
    price_hours_4_cents: Number(row.price_hours_4_cents) || 0,
    price_hours_10_cents: Number(row.price_hours_10_cents) || 0,
    price_makeup_yes_cents: Number(row.price_makeup_yes_cents) || 0,
    price_makeup_no_cents: Number(row.price_makeup_no_cents) || 0,
    price_female_assistant_yes_cents: Number(row.price_female_assistant_yes_cents) || 0,
    price_female_assistant_no_cents: Number(row.price_female_assistant_no_cents) || 0,
  };
}

function buildWizardResult(locale: Locale, row: Record<string, unknown>): {
  error: null;
  prices: BookingPriceSnapshot;
  noticesMd: string;
  boudoirConfidentialityMd: string;
  calendarConfigured: boolean;
} {
  const prices = rowToPriceSnapshot(row);
  const noticesMd = locale === "zh" ? String(row.notices_md_zh ?? "") : String(row.notices_md_en ?? "");
  const boudoirConfidentialityMd =
    locale === "zh"
      ? String(row.boudoir_confidentiality_md_zh ?? "")
      : String(row.boudoir_confidentiality_md_en ?? "");
  const secretInDb =
    typeof row._calendar_secret_in_db === "boolean"
      ? row._calendar_secret_in_db
      : String(row.google_sa_json ?? "").trim().length > 0;
  const calendarConfigured = Boolean(
    String(row.google_calendar_id ?? "").trim() &&
      (secretInDb || Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim())),
  );
  return { error: null, prices, noticesMd, boudoirConfidentialityMd, calendarConfigured };
}

export async function getBookingWizardPublicData(locale: Locale) {
  noStore();

  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc("booking_wizard_public_snapshot");
  if (!rpcError && rpcData != null && typeof rpcData === "object" && !Array.isArray(rpcData)) {
    const row = rpcData as Record<string, unknown>;
    if (Object.keys(row).length > 0) {
      return buildWizardResult(locale, row);
    }
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return {
      error: rpcError?.message ?? "Server misconfigured",
      prices: null as BookingPriceSnapshot | null,
      noticesMd: "",
      boudoirConfidentialityMd: "",
      calendarConfigured: false,
    };
  }
  const { data, error } = await svc.from("booking_config").select("*").eq("id", "default").maybeSingle();
  if (error || !data) {
    return {
      error: error?.message ?? rpcError?.message ?? "No booking config",
      prices: null as BookingPriceSnapshot | null,
      noticesMd: "",
      boudoirConfidentialityMd: "",
      calendarConfigured: false,
    };
  }
  const row = data as Record<string, unknown>;
  return buildWizardResult(locale, row);
}

function isShoot(v: string): v is BookingShootType {
  return v === "portrait" || v === "boudoir" || v === "prewedding";
}
function isParty(v: string): v is BookingPartySize {
  return v === "single" || v === "double";
}
function isHours(v: string): v is BookingHoursTier {
  return v === "h2" || v === "h3" || v === "h4" || v === "h10";
}
function isMakeup(v: string): v is BookingMakeup {
  return v === "yes" || v === "no";
}
function isFemaleAssistant(v: string): v is BookingFemaleAssistant {
  return v === "yes" || v === "no";
}

export async function createBookingCheckoutSession(input: {
  locale: Locale;
  shoot: string;
  party: string;
  hours: string;
  makeup: string;
  femaleAssistant?: string | null;
  dateYmd: string;
  timeHm: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  /** Ignored unless caller is admin; only `pudding` or `skip` have an effect. */
  promoCode?: string;
}): Promise<{ error?: string; url?: string; successUrl?: string }> {
  noStore();
  await connection();
  void (await headers()).get("x-forwarded-host");
  if (!isShoot(input.shoot) || !isParty(input.party) || !isHours(input.hours) || !isMakeup(input.makeup)) {
    return { error: "Invalid booking options." };
  }
  if (!bookingHoursTierValidForShoot(input.shoot, input.hours)) {
    return { error: "Invalid booking options." };
  }
  const needsFemaleAssistant = bookingNeedsFemaleAssistantStep(input.shoot, input.makeup);
  const faRaw = input.femaleAssistant?.trim() ?? "";
  if (needsFemaleAssistant) {
    if (!isFemaleAssistant(faRaw)) {
      return {
        error:
          input.locale === "zh" ? "請選擇是否需要女助手協助。" : "Please choose whether you need a female assistant.",
      };
    }
  } else if (faRaw) {
    return { error: "Invalid booking options." };
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^\d{2}:\d{2}$/;
  if (!dateRe.test(input.dateYmd) || !timeRe.test(input.timeHm)) {
    return { error: "Invalid date or time." };
  }

  if (input.dateYmd <= bookingTodayYmdHk()) {
    return {
      error:
        input.locale === "zh"
          ? "不接受即日預約，請選擇明天或之後的日期（香港時間）。"
          : "Same-day booking is not available. Pick tomorrow or a later date (Hong Kong time).",
    };
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return { error: "Payment is not configured (Supabase service role)." };
  }

  const sessionProfile = await getSessionProfile();
  const promo = (input.promoCode ?? "").trim().toLowerCase();
  const adminSkipApplied = sessionProfile?.role === "admin" && promo === ADMIN_BOOKING_PROMO_SKIP;
  const adminPromoApplied =
    !adminSkipApplied && sessionProfile?.role === "admin" && promo === ADMIN_BOOKING_PROMO_CODE;

  const stripe = adminSkipApplied ? null : getStripe();
  if (!adminSkipApplied && !stripe) {
    return { error: "Payment is not configured (Stripe or Supabase service role)." };
  }

  const { data: cfg, error: ce } = await svc.from("booking_config").select("*").eq("id", "default").maybeSingle();
  if (ce || !cfg) return { error: "Booking is not configured." };

  const prices = rowToPriceSnapshot(cfg as Record<string, unknown>);
  const femaleAssistantForPrice: BookingFemaleAssistant | null = needsFemaleAssistant
    ? (faRaw as BookingFemaleAssistant)
    : null;
  const baseTotalCents = computeBookingTotalCents(
    prices,
    input.shoot,
    input.party,
    input.hours,
    input.makeup,
    femaleAssistantForPrice,
  );
  const totalCents = adminSkipApplied ? 0 : adminPromoApplied ? ADMIN_BOOKING_PROMO_TOTAL_CENTS : baseTotalCents;
  if (!adminSkipApplied && totalCents <= 0) {
    return { error: "Total price is zero. Ask the studio to set booking prices in admin." };
  }

  const slotStartIso = bookingLocalSlotToUtcIso(input.dateYmd, input.timeHm);
  const slotStart = new Date(slotStartIso);
  if (Number.isNaN(slotStart.getTime())) {
    return { error: "Invalid slot." };
  }
  const durH = hoursTierToDurationHours(input.hours);
  const day0Ms = new Date(`${input.dateYmd}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
  const mergedBusy = await getMergedBookingBusy(
    new Date(day0Ms - 86400000),
    new Date(day0Ms + 2 * 86400000),
  );
  const siteFull = new Set(mergedBusy.siteOrderFullDayYmds);
  const allowed = listAvailableSlotStarts(input.dateYmd, input.hours, mergedBusy.busy, {
    siteOrderFullDayYmds: siteFull,
  });
  if (!allowed.includes(input.timeHm)) {
    return { error: "Invalid or unavailable time slot." };
  }
  const slotEnd = new Date(slotStart.getTime() + durH * 60 * 60 * 1000);

  const trimmed = {
    email: input.customerEmail.trim(),
    name: input.customerName.trim(),
    phone: input.customerPhone.trim(),
    notes: input.notes.trim(),
  };
  if (!trimmed.email || !trimmed.name) {
    return { error: "Please enter your name and email." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const noteParts = [
    trimmed.notes,
    adminSkipApplied ? "[Admin promo: skip → paid without Stripe]" : "",
    adminPromoApplied ? "[Admin promo: pudding → HK$4.00 checkout]" : "",
  ].filter(Boolean);
  const orderNotes = noteParts.join("\n");

  const currency = String(prices.currency).toLowerCase();
  const origin = await getRequestOrigin();

  if (adminSkipApplied) {
    const orderRow = {
      user_id: user?.id ?? null,
      customer_email: trimmed.email,
      customer_name: trimmed.name,
      customer_phone: trimmed.phone,
      status: "paid" as const,
      currency,
      total_cents: totalCents,
      locale: input.locale,
      shoot_type: input.shoot,
      party_size: input.party,
      hours_tier: input.hours,
      makeup: input.makeup,
      female_assistant: needsFemaleAssistant ? faRaw : null,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      notes: orderNotes,
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: oe } = await svc.from("booking_orders").insert(orderRow).select("*").single();
    if (oe || !order) return { error: oe?.message ?? "Could not create booking." };

    const orderId = (order as { id: string }).id;
    try {
      await sendBookingOrderPaidEmails(svc, order as BookingOrderPaidRow);
    } catch (e) {
      console.error("[createBookingCheckoutSession] skip promo receipt email", e);
    }
    try {
      await seedPaidBookingPostChat(svc, orderId);
    } catch (e) {
      console.error("[createBookingCheckoutSession] skip promo post-paid chat", e);
    }

    return {
      successUrl: `${origin}/${input.locale}/booking/success?booking_id=${orderId}`,
    };
  }

  const orderRow = {
    user_id: user?.id ?? null,
    customer_email: trimmed.email,
    customer_name: trimmed.name,
    customer_phone: trimmed.phone,
    status: "pending_payment" as const,
    currency,
    total_cents: totalCents,
    locale: input.locale,
    shoot_type: input.shoot,
    party_size: input.party,
    hours_tier: input.hours,
    makeup: input.makeup,
    female_assistant: needsFemaleAssistant ? faRaw : null,
    slot_start: slotStart.toISOString(),
    slot_end: slotEnd.toISOString(),
    notes: orderNotes,
    updated_at: new Date().toISOString(),
  };

  const { data: order, error: oe } = await svc.from("booking_orders").insert(orderRow).select("id").single();
  if (oe || !order) return { error: oe?.message ?? "Could not create booking." };

  const orderId = (order as { id: string }).id;
  const successUrl = `${origin}/${input.locale}/booking/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/${input.locale}/booking`;

  const label =
    input.locale === "zh"
      ? `預約拍攝 · ${input.shoot} · ${input.dateYmd} ${input.timeHm}`
      : `Photo session · ${input.shoot} · ${input.dateYmd} ${input.timeHm}`;

  try {
    const session = await stripe!.checkout.sessions.create({
      mode: "payment",
      customer_email: trimmed.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        booking_order_id: orderId,
        order_type: "booking",
        ...(adminPromoApplied ? { admin_promo: ADMIN_BOOKING_PROMO_CODE } : {}),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: totalCents,
            product_data: {
              name: label,
              metadata: { booking_order_id: orderId },
            },
          },
        },
      ],
    });

    await svc
      .from("booking_orders")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (!session.url) return { error: "Stripe did not return a checkout URL." };
    return { url: session.url };
  } catch (e) {
    await svc.from("booking_orders").delete().eq("id", orderId);
    const msg = e instanceof Error ? e.message : "Stripe error";
    return { error: msg };
  }
}
