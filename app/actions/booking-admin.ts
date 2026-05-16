"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { getMergedBookingBusy } from "@/lib/booking-busy-server";
import { normalizeGoogleCalendarId } from "@/lib/google-calendar-busy";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { locales, type Locale } from "@/lib/i18n";
import {
  BOOKING_TZ_OFFSET,
  type BookingHoursTier,
  bookingLocalSlotToUtcIso,
  bookingTodayYmdHk,
  hoursTierToDurationHours,
} from "@/lib/booking-types";
import { listAvailableSlotStarts } from "@/lib/booking-slots-client";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

const ORDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BOOKING_ORDER_STATUSES = ["pending_payment", "paid", "cancelled"] as const;
export type BookingOrderStatus = (typeof BOOKING_ORDER_STATUSES)[number];

function isBookingOrderStatus(s: string): s is BookingOrderStatus {
  return (BOOKING_ORDER_STATUSES as readonly string[]).includes(s);
}

function isHoursTier(s: string): s is BookingHoursTier {
  return s === "h2" || s === "h3" || s === "h4" || s === "h10";
}

export type BookingAdminConfigRow = {
  id: string;
  currency: string;
  price_shoot_portrait_cents: number;
  price_shoot_boudoir_cents: number;
  price_shoot_prewedding_cents: number;
  price_party_single_cents: number;
  price_party_double_cents: number;
  price_party_group_cents: number;
  price_hours_2_cents: number;
  price_hours_3_cents: number;
  price_hours_4_cents: number;
  price_hours_10_cents: number;
  price_makeup_yes_cents: number;
  price_makeup_no_cents: number;
  price_female_assistant_yes_cents: number;
  price_female_assistant_no_cents: number;
  notices_md_en: string;
  notices_md_zh: string;
  boudoir_confidentiality_md_en: string;
  boudoir_confidentiality_md_zh: string;
  google_calendar_id: string;
  google_sa_json: string | null;
};

export async function getBookingAdminConfig(): Promise<{ error?: string; row?: BookingAdminConfigRow }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_config").select("*").eq("id", "default").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Missing booking_config" };
  const d = data as Record<string, unknown>;
  const row = {
    ...data,
    price_hours_4_cents: Number(d.price_hours_4_cents) || 0,
  } as BookingAdminConfigRow;
  return { row };
}

export async function updateBookingAdminConfig(input: {
  locale: Locale;
  currency: string;
  price_shoot_portrait_cents: number;
  price_shoot_boudoir_cents: number;
  price_shoot_prewedding_cents: number;
  price_party_single_cents: number;
  price_party_double_cents: number;
  price_party_group_cents: number;
  price_hours_2_cents: number;
  price_hours_3_cents: number;
  price_hours_4_cents: number;
  price_hours_10_cents: number;
  price_makeup_yes_cents: number;
  price_makeup_no_cents: number;
  price_female_assistant_yes_cents: number;
  price_female_assistant_no_cents: number;
  notices_md_en: string;
  notices_md_zh: string;
  boudoir_confidentiality_md_en: string;
  boudoir_confidentiality_md_zh: string;
  google_calendar_id: string;
  google_sa_json: string | null;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const cur = String(input.currency || "hkd")
    .toLowerCase()
    .trim();
  if (cur !== "hkd" && cur !== "usd") {
    return { error: "Currency must be hkd or usd." };
  }
  const clamp = (n: number) => Math.min(99_999_999, Math.max(0, Math.floor(Number(n)) || 0));

  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_config")
    .update({
      currency: cur,
      price_shoot_portrait_cents: clamp(input.price_shoot_portrait_cents),
      price_shoot_boudoir_cents: clamp(input.price_shoot_boudoir_cents),
      price_shoot_prewedding_cents: clamp(input.price_shoot_prewedding_cents),
      price_party_single_cents: clamp(input.price_party_single_cents),
      price_party_double_cents: clamp(input.price_party_double_cents),
      price_party_group_cents: clamp(input.price_party_group_cents),
      price_hours_2_cents: clamp(input.price_hours_2_cents),
      price_hours_3_cents: clamp(input.price_hours_3_cents),
      price_hours_4_cents: clamp(input.price_hours_4_cents),
      price_hours_10_cents: clamp(input.price_hours_10_cents),
      price_makeup_yes_cents: clamp(input.price_makeup_yes_cents),
      price_makeup_no_cents: clamp(input.price_makeup_no_cents),
      price_female_assistant_yes_cents: clamp(input.price_female_assistant_yes_cents),
      price_female_assistant_no_cents: clamp(input.price_female_assistant_no_cents),
      notices_md_en: input.notices_md_en,
      notices_md_zh: input.notices_md_zh,
      boudoir_confidentiality_md_en: input.boudoir_confidentiality_md_en,
      boudoir_confidentiality_md_zh: input.boudoir_confidentiality_md_zh,
      google_calendar_id: normalizeGoogleCalendarId(input.google_calendar_id),
      google_sa_json: input.google_sa_json?.trim() ? input.google_sa_json.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) return { error: error.message };
  revalidatePath(`/${input.locale}/admin/booking`, "page");
  for (const loc of locales) {
    revalidatePath(`/${loc}/booking`, "page");
  }
  return { ok: true };
}

export type BookingAdminOrderRow = {
  id: string;
  status: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  total_cents: number;
  currency: string;
  locale: string;
  shoot_type: string;
  party_size: string;
  hours_tier: string;
  makeup: string;
  female_assistant: string | null;
  slot_start: string;
  slot_end: string;
  notes: string;
  created_at: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

export async function listBookingOrdersForAdmin(): Promise<{
  error?: string;
  orders?: BookingAdminOrderRow[];
}> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_orders")
    .select(
      "id, status, customer_email, customer_name, customer_phone, total_cents, currency, locale, shoot_type, party_size, hours_tier, makeup, female_assistant, slot_start, slot_end, notes, created_at, stripe_checkout_session_id, stripe_payment_intent_id",
    )
    .order("slot_start", { ascending: false })
    .limit(200);
  if (error) return { error: error.message };
  return { orders: (data ?? []) as BookingAdminOrderRow[] };
}

export async function getBookingAdminRescheduleSlots(input: {
  locale: Locale;
  orderId: string;
  dateYmd: string;
}): Promise<{ error?: string; slots?: string[] }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(input.dateYmd)) {
    return { error: zh ? "日期格式不正確。" : "Invalid date." };
  }
  if (input.dateYmd <= bookingTodayYmdHk()) {
    return {
      error: zh
        ? "不可選今天或過去日期（香港時間）。"
        : "Same-day and past dates are not available (Hong Kong time).",
    };
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("booking_orders")
    .select("id, status, hours_tier")
    .eq("id", input.orderId)
    .maybeSingle();
  if (error || !row) return { error: zh ? "找不到訂單。" : "Order not found." };
  const st = String((row as { status?: string }).status ?? "");
  if (st !== "paid" && st !== "pending_payment") {
    return { error: zh ? "此訂單狀態不可改期。" : "This order cannot be rescheduled." };
  }
  const ht = String((row as { hours_tier?: string }).hours_tier ?? "");
  if (!isHoursTier(ht)) {
    return { error: zh ? "訂單時長資料異常。" : "Invalid hours tier on order." };
  }

  const day0Ms = new Date(`${input.dateYmd}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
  const merged = await getMergedBookingBusy(new Date(day0Ms - 86400000), new Date(day0Ms + 2 * 86400000), {
    excludeOrderId: input.orderId,
  });
  const siteFull = new Set(merged.siteOrderFullDayYmds);
  const slots = listAvailableSlotStarts(input.dateYmd, ht, merged.busy, { siteOrderFullDayYmds: siteFull });
  return { slots };
}

export async function updateBookingOrderSlotForAdmin(input: {
  locale: Locale;
  orderId: string;
  dateYmd: string;
  timeHm: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^\d{2}:\d{2}$/;
  if (!dateRe.test(input.dateYmd) || !timeRe.test(input.timeHm)) {
    return { error: zh ? "日期或時間格式不正確。" : "Invalid date or time." };
  }
  if (input.dateYmd <= bookingTodayYmdHk()) {
    return {
      error: zh
        ? "不可選今天或過去日期（香港時間）。"
        : "Same-day and past dates are not available (Hong Kong time).",
    };
  }

  const supabase = await createClient();
  const { data: row, error: fe } = await supabase
    .from("booking_orders")
    .select("id, status, hours_tier, slot_start, slot_end")
    .eq("id", input.orderId)
    .maybeSingle();
  if (fe || !row) return { error: zh ? "找不到訂單。" : "Order not found." };
  const r = row as { id: string; status: string; hours_tier: string; slot_start: string; slot_end: string };
  if (r.status !== "paid" && r.status !== "pending_payment") {
    return { error: zh ? "此訂單狀態不可改期。" : "This order cannot be rescheduled." };
  }
  if (!isHoursTier(r.hours_tier)) {
    return { error: zh ? "訂單時長資料異常。" : "Invalid hours tier on order." };
  }

  const durH = hoursTierToDurationHours(r.hours_tier);
  const day0Ms = new Date(`${input.dateYmd}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
  const merged = await getMergedBookingBusy(new Date(day0Ms - 86400000), new Date(day0Ms + 2 * 86400000), {
    excludeOrderId: input.orderId,
  });
  const siteFull = new Set(merged.siteOrderFullDayYmds);
  const allowed = listAvailableSlotStarts(input.dateYmd, r.hours_tier, merged.busy, {
    siteOrderFullDayYmds: siteFull,
  });
  if (!allowed.includes(input.timeHm)) {
    return { error: zh ? "此時段不可用或與其他預約／日曆衝突。" : "That slot is unavailable or conflicts with calendar or other bookings." };
  }

  const slotStartIso = bookingLocalSlotToUtcIso(input.dateYmd, input.timeHm);
  const slotStart = new Date(slotStartIso);
  if (Number.isNaN(slotStart.getTime())) {
    return { error: zh ? "時段無效。" : "Invalid slot." };
  }
  const slotEnd = new Date(slotStart.getTime() + durH * 60 * 60 * 1000);

  const { error: ue } = await supabase
    .from("booking_orders")
    .update({
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.orderId);

  if (ue) return { error: ue.message };
  revalidatePath(`/${input.locale}/admin/booking`, "page");
  revalidatePath(`/${input.locale}/admin/booking/orders`, "page");
  for (const loc of locales) {
    revalidatePath(`/${loc}/booking`, "page");
  }
  return { ok: true };
}

export async function cancelBookingOrderForAdmin(input: {
  locale: Locale;
  orderId: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }

  const supabase = await createClient();
  const { data: row, error: fe } = await supabase
    .from("booking_orders")
    .select("id, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (fe || !row) return { error: zh ? "找不到訂單。" : "Order not found." };
  const st = String((row as { status?: string }).status ?? "");
  if (st === "cancelled") {
    return { error: zh ? "此預約已取消。" : "This booking is already cancelled." };
  }
  if (st !== "paid" && st !== "pending_payment") {
    return { error: zh ? "此訂單狀態無法取消。" : "This order cannot be cancelled." };
  }

  const { error: ue } = await supabase
    .from("booking_orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.orderId);

  if (ue) return { error: ue.message };
  revalidatePath(`/${input.locale}/admin/booking`, "page");
  revalidatePath(`/${input.locale}/admin/booking/orders`, "page");
  for (const loc of locales) {
    revalidatePath(`/${loc}/booking`, "page");
    revalidatePath(`/${loc}/member/bookings`, "page");
    revalidatePath(`/${loc}/member/chat`, "page");
    revalidatePath(`/${loc}/chat`, "page");
    revalidatePath(`/${loc}/admin/chat`, "page");
  }
  return { ok: true };
}

export async function updateBookingOrderStatusForAdmin(input: {
  locale: Locale;
  orderId: string;
  status: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }
  if (!isBookingOrderStatus(input.status)) {
    return { error: zh ? "付款狀態無效。" : "Invalid payment status." };
  }

  const supabase = await createClient();
  const { data: row, error: fe } = await supabase
    .from("booking_orders")
    .select("id, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (fe || !row) return { error: zh ? "找不到訂單。" : "Order not found." };

  const current = String((row as { status?: string }).status ?? "");
  if (current === input.status) return { ok: true };

  const { error: ue } = await supabase
    .from("booking_orders")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.orderId);

  if (ue) return { error: ue.message };

  if (input.status === "paid") {
    const svc = createServiceRoleClient();
    if (svc) {
      try {
        const { seedPaidBookingPostChat } = await import("@/lib/booking-post-paid-chat");
        await seedPaidBookingPostChat(svc, input.orderId);
      } catch (e) {
        console.error("[updateBookingOrderStatusForAdmin] post-paid chat seed", e);
      }
    }
  }

  revalidatePath(`/${input.locale}/admin/booking`, "page");
  revalidatePath(`/${input.locale}/admin/booking/orders`, "page");
  for (const loc of locales) {
    revalidatePath(`/${loc}/booking`, "page");
    revalidatePath(`/${loc}/member/bookings`, "page");
    revalidatePath(`/${loc}/member/chat`, "page");
    revalidatePath(`/${loc}/chat`, "page");
    revalidatePath(`/${loc}/admin/chat`, "page");
  }
  return { ok: true };
}

/** Re-send missing post-paid welcome / auto messages / intake prompts (repair mode). */
export async function repairBookingPostPaidChatSeed(input: {
  locale: Locale;
  orderId: string;
}): Promise<{
  error?: string;
  ok?: boolean;
  notice?: string;
  intakeInserted?: number;
  autoInserted?: number;
  welcomeInserted?: boolean;
}> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return { error: zh ? "伺服器設定不完整。" : "Server misconfigured." };
  }

  const { data: row, error: fe } = await svc
    .from("booking_orders")
    .select("id, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (fe || !row) return { error: zh ? "找不到訂單。" : "Order not found." };
  if (String((row as { status?: string }).status ?? "") !== "paid") {
    return { error: zh ? "僅已付預約可補發付款後內容。" : "Only paid bookings can be repaired." };
  }

  try {
    const { seedPaidBookingPostChat } = await import("@/lib/booking-post-paid-chat");
    const result = await seedPaidBookingPostChat(svc, input.orderId, { repair: true });
    revalidatePath(`/${input.locale}/admin/booking/orders`, "page");
    for (const loc of locales) {
      revalidatePath(`/${loc}/member/chat`, "page");
      revalidatePath(`/${loc}/chat`, "page");
      revalidatePath(`/${loc}/admin/chat`, "page");
    }
    const notice =
      result.intakeInserted === 0 && result.autoInserted === 0 && !result.welcomeInserted
        ? zh
          ? "沒有新增任何內容：可能全部不符合條件、已在對話中，或規則選項不足 2 個。請用「檢查付款後規則」查看原因。"
          : "Nothing new was sent: items may not match, already in chat, or rules need at least 2 options. Use “Check post-payment rules”."
        : undefined;
    return { ok: true, ...result, notice };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function diagnoseBookingPostPaidChatSeed(input: {
  locale: Locale;
  orderId: string;
}): Promise<{ error?: string; diagnostic?: import("@/lib/booking-post-paid-chat").PostPaidSeedDiagnostic }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };
  const zh = input.locale === "zh";
  if (!ORDER_UUID_RE.test(input.orderId)) {
    return { error: zh ? "訂單編號無效。" : "Invalid order id." };
  }
  const svc = createServiceRoleClient();
  if (!svc) return { error: zh ? "伺服器設定不完整。" : "Server misconfigured." };
  const { diagnosePostPaidChatSeed } = await import("@/lib/booking-post-paid-chat");
  const diagnostic = await diagnosePostPaidChatSeed(svc, input.orderId);
  if (!diagnostic) return { error: zh ? "找不到訂單。" : "Order not found." };
  return { diagnostic };
}
