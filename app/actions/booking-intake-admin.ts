"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { locales, type Locale } from "@/lib/i18n";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import type { BookingIntakeRuleRow, IntakeOptionJson } from "@/lib/booking-intake-match";
import { randomUUID } from "crypto";

export type BookingIntakeRuleAdminRow = BookingIntakeRuleRow & {
  created_at?: string;
  updated_at?: string;
};

function revalidateIntake(locale: Locale) {
  for (const loc of locales) {
    revalidatePath(`/${loc}/admin/booking/intake`, "page");
  }
  revalidatePath(`/${locale}/admin/booking`, "page");
}

export async function listBookingIntakeRules(): Promise<{ error?: string; rules?: BookingIntakeRuleAdminRow[] }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_intake_rules")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { error: error.message };
  const rules = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      sort_order: Number(r.sort_order) || 0,
      enabled: Boolean(r.enabled),
      match_shoot_types: (r.match_shoot_types as string[] | null) ?? null,
      match_party_sizes: (r.match_party_sizes as string[] | null) ?? null,
      match_hours_tiers: (r.match_hours_tiers as string[] | null) ?? null,
      match_makeup: (r.match_makeup as string[] | null) ?? null,
      match_female_assistants: (r.match_female_assistants as string[] | null) ?? null,
      match_slot_weekdays: (r.match_slot_weekdays as number[] | null) ?? null,
      match_slot_start_times: (r.match_slot_start_times as string[] | null) ?? null,
      question_en: String(r.question_en ?? ""),
      question_zh: String(r.question_zh ?? ""),
      options: normalizeOptionsFromDb(r.options),
      created_at: r.created_at as string | undefined,
      updated_at: r.updated_at as string | undefined,
    } as BookingIntakeRuleAdminRow;
  });
  return { rules };
}

function normalizeOptionsFromDb(raw: unknown): IntakeOptionJson[] {
  if (!Array.isArray(raw)) return [];
  const out: IntakeOptionJson[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    const label_en = String(r.label_en ?? r.labelEn ?? "").trim();
    const label_zh = String(r.label_zh ?? r.labelZh ?? "").trim();
    if (!id || !label_en || !label_zh) continue;
    out.push({ id, label_en, label_zh });
  }
  return out;
}

export async function upsertBookingIntakeRule(input: {
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
  question_en: string;
  question_zh: string;
  options: { id?: string; label_en: string; label_zh: string }[];
}): Promise<{ error?: string; ok?: boolean; id?: string }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const opts: IntakeOptionJson[] = input.options
    .map((o) => ({
      id: (o.id && String(o.id).trim()) || randomUUID(),
      label_en: String(o.label_en ?? "").trim(),
      label_zh: String(o.label_zh ?? "").trim(),
    }))
    .filter((o) => o.label_en && o.label_zh);
  if (opts.length < 2 || opts.length > 4) {
    return { error: "Options must be between 2 and 4 (non-empty labels)." };
  }

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
    question_en: input.question_en.trim(),
    question_zh: input.question_zh.trim(),
    options: opts,
    updated_at: new Date().toISOString(),
  };

  if (!row.question_en || !row.question_zh) {
    return { error: "Question text is required in both languages." };
  }

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("booking_intake_rules").update(row).eq("id", input.id);
    if (error) return { error: error.message };
    revalidateIntake(input.locale);
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("booking_intake_rules").insert(row).select("id").single();
  if (error) return { error: error.message };
  revalidateIntake(input.locale);
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function deleteBookingIntakeRule(input: {
  locale: Locale;
  id: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("booking_intake_rules").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidateIntake(input.locale);
  return { ok: true };
}
