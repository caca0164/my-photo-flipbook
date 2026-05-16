"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { locales, type Locale } from "@/lib/i18n";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import type { BookingPostPaidAutoMessageRow } from "@/lib/booking-intake-match";

export type BookingPostPaidAutoMessageAdminRow = BookingPostPaidAutoMessageRow & {
  created_at?: string;
  updated_at?: string;
};

function revalidatePostPaid(locale: Locale) {
  for (const loc of locales) {
    revalidatePath(`/${loc}/admin/booking/intake`, "page");
  }
  revalidatePath(`/${locale}/admin/booking`, "page");
}

function rowFromDb(raw: Record<string, unknown>): BookingPostPaidAutoMessageAdminRow {
  return {
    id: String(raw.id),
    sort_order: Number(raw.sort_order) || 0,
    enabled: Boolean(raw.enabled),
    match_shoot_types: (raw.match_shoot_types as string[] | null) ?? null,
    match_party_sizes: (raw.match_party_sizes as string[] | null) ?? null,
    match_hours_tiers: (raw.match_hours_tiers as string[] | null) ?? null,
    match_makeup: (raw.match_makeup as string[] | null) ?? null,
    match_female_assistants: (raw.match_female_assistants as string[] | null) ?? null,
    match_slot_weekdays: (raw.match_slot_weekdays as number[] | null) ?? null,
    match_slot_start_times: (raw.match_slot_start_times as string[] | null) ?? null,
    after_intake_complete: Boolean(raw.after_intake_complete),
    message_en: String(raw.message_en ?? ""),
    message_zh: String(raw.message_zh ?? ""),
    created_at: raw.created_at as string | undefined,
    updated_at: raw.updated_at as string | undefined,
  };
}

export async function listBookingPostPaidAutoMessages(): Promise<{
  error?: string;
  messages?: BookingPostPaidAutoMessageAdminRow[];
}> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_post_paid_auto_messages")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { error: error.message };
  return { messages: (data ?? []).map((raw) => rowFromDb(raw as Record<string, unknown>)) };
}

export async function upsertBookingPostPaidAutoMessage(input: {
  locale: Locale;
  id?: string | null;
  sort_order: number;
  enabled: boolean;
  match_shoot_types: string[] | null;
  match_party_sizes: string[] | null;
  match_hours_tiers: string[] | null;
  match_makeup: string[] | null;
  match_female_assistants: string[] | null;
  match_slot_weekdays: number[] | null;
  match_slot_start_times: string[] | null;
  after_intake_complete: boolean;
  message_en: string;
  message_zh: string;
}): Promise<{ error?: string; ok?: boolean; id?: string }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const row = {
    sort_order: Math.floor(input.sort_order) || 0,
    enabled: input.enabled,
    match_shoot_types: input.match_shoot_types?.length ? input.match_shoot_types : null,
    match_party_sizes: input.match_party_sizes?.length ? input.match_party_sizes : null,
    match_hours_tiers: input.match_hours_tiers?.length ? input.match_hours_tiers : null,
    match_makeup: input.match_makeup?.length ? input.match_makeup : null,
    match_female_assistants: input.match_female_assistants?.length ? input.match_female_assistants : null,
    match_slot_weekdays: input.match_slot_weekdays?.length ? input.match_slot_weekdays : null,
    match_slot_start_times: input.match_slot_start_times?.length ? input.match_slot_start_times : null,
    after_intake_complete: input.after_intake_complete,
    message_en: input.message_en.trim(),
    message_zh: input.message_zh.trim(),
    updated_at: new Date().toISOString(),
  };

  if (!row.message_en || !row.message_zh) {
    return { error: "Message text is required in both languages." };
  }

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("booking_post_paid_auto_messages").update(row).eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePostPaid(input.locale);
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase
    .from("booking_post_paid_auto_messages")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePostPaid(input.locale);
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function deleteBookingPostPaidAutoMessage(input: {
  locale: Locale;
  id: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("booking_post_paid_auto_messages").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePostPaid(input.locale);
  return { ok: true };
}
