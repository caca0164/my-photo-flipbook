import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUserEmailById } from "@/lib/supabase/admin-auth-users";
import {
  buildBookingPaidEmailHtml,
  buildNewInboxMessageEmailHtml,
  buildStorePaidEmailHtml,
  sendOutboundEmail,
} from "@/lib/outbound-email";
import { getMessages, type Locale } from "@/lib/i18n";
import { formatBookingSlotHk } from "@/lib/booking-hk-display";

function isLocale(s: string): s is Locale {
  return s === "en" || s === "zh";
}

function localeTag(locale: string): string {
  return locale === "zh" ? "zh-HK" : "en-HK";
}

function bookingLabels(locale: Locale) {
  const t = getMessages(locale);
  const shoot = (v: string) =>
    v === "boudoir"
      ? t.bookingShootBoudoir
      : v === "prewedding"
        ? t.bookingShootPrewedding
        : t.bookingShootPortrait;
  const party = (v: string) =>
    v === "double"
      ? t.bookingPartyDouble
      : v === "group"
        ? t.bookingPartyGroup
        : t.bookingPartySingle;
  const hours = (v: string) =>
    v === "h3"
      ? t.bookingHours3
      : v === "h4"
        ? t.bookingHours4
        : v === "h10"
          ? t.bookingHoursFullDay
          : t.bookingHours2;
  const makeup = (v: string) => (v === "yes" ? t.bookingMakeupYes : t.bookingMakeupNo);
  return { shoot, party, hours, makeup };
}

export type BookingOrderPaidRow = {
  id: string;
  user_id: string | null;
  customer_email: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  locale: string;
  shoot_type: string;
  party_size: string;
  hours_tier: string;
  makeup: string;
  slot_start: string;
  slot_end: string;
  notes: string;
};

export async function sendBookingOrderPaidEmails(svc: SupabaseClient, row: BookingOrderPaidRow): Promise<void> {
  const loc = isLocale(row.locale) ? row.locale : "en";
  const t = getMessages(loc);
  const accountEmail = await getAuthUserEmailById(svc, row.user_id);
  const labels = bookingLabels(loc);
  const html = buildBookingPaidEmailHtml({
    localeTag: localeTag(loc),
    orderId: row.id,
    customerName: row.customer_name,
    totalCents: row.total_cents,
    currency: row.currency,
    shootType: labels.shoot(row.shoot_type),
    partySize: labels.party(row.party_size),
    hoursTier: labels.hours(row.hours_tier),
    makeup: labels.makeup(row.makeup),
    slotLabel: formatBookingSlotHk(row.slot_start, row.slot_end, loc),
    notes: row.notes,
  });

  await sendOutboundEmail({
    subject: t.emailSubjectBookingPaid,
    html,
    to: [row.customer_email],
    cc: accountEmail ? [accountEmail] : [],
  });
}

export type StoreOrderItemRow = {
  quantity: number;
  unit_price_cents: number;
  title_en_snapshot: string;
  title_zh_snapshot: string;
};

export type StoreOrderPaidRow = {
  id: string;
  user_id: string | null;
  customer_email: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  locale: string;
  shipping_address: string;
};

export async function sendStoreOrderPaidEmails(
  svc: SupabaseClient,
  order: StoreOrderPaidRow,
  items: StoreOrderItemRow[],
): Promise<void> {
  const loc = isLocale(order.locale) ? order.locale : "en";
  const t = getMessages(loc);
  const accountEmail = await getAuthUserEmailById(svc, order.user_id);
  const lines = items.map((it) => ({
    title: loc === "zh" ? it.title_zh_snapshot : it.title_en_snapshot,
    qty: it.quantity,
    lineTotalCents: it.unit_price_cents * it.quantity,
  }));
  const html = buildStorePaidEmailHtml({
    localeTag: localeTag(loc),
    orderId: order.id,
    customerName: order.customer_name,
    totalCents: order.total_cents,
    currency: order.currency,
    shippingAddress: order.shipping_address,
    lines,
  });
  await sendOutboundEmail({
    subject: t.emailSubjectStorePaid,
    html,
    to: [order.customer_email],
    cc: accountEmail ? [accountEmail] : [],
  });
}

export async function sendMemberInboxNotificationEmail(
  svc: SupabaseClient,
  userId: string,
  subject: string,
  bodyPreview: string,
  localeFallback: Locale,
): Promise<void> {
  const email = await getAuthUserEmailById(svc, userId);
  if (!email) return;
  const t = getMessages(localeFallback);
  const html = buildNewInboxMessageEmailHtml({ subject, preview: bodyPreview });
  await sendOutboundEmail({
    subject: t.emailSubjectNewInbox,
    html,
    to: [email],
  });
}
