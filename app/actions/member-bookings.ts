"use server";

import {
  sendBookingOrderPaidReceiptToEmail,
  type BookingOrderPaidRow,
} from "@/lib/email-order-receipts";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type MemberBookingReceiptState = {
  ok?: boolean;
  error?: string;
} | null;

const BOOKING_RECEIPT_SELECT =
  "id, user_id, customer_email, customer_name, total_cents, currency, locale, shoot_type, party_size, hours_tier, makeup, slot_start, slot_end, notes, status";

export async function emailBookingReceiptToSelf(
  _prev: MemberBookingReceiptState,
  formData: FormData,
): Promise<MemberBookingReceiptState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en").trim();
  if (!orderId) return { error: "not_found" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "not_authenticated" };

  const { data: row, error } = await supabase
    .from("booking_orders")
    .select(BOOKING_RECEIPT_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !row) return { error: "not_found" };
  if (row.status !== "paid") return { error: "not_paid" };

  const sent = await sendBookingOrderPaidReceiptToEmail(row as BookingOrderPaidRow, user.email);
  if (!sent.ok) {
    if (sent.error === "Email not configured") return { error: "email_not_configured" };
    return { error: "send_failed" };
  }

  revalidatePath(`/${locale}/member/bookings`, "page");
  return { ok: true };
}
