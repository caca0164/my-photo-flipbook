import type { SupabaseClient } from "@supabase/supabase-js";
import { getMessages, type Locale } from "@/lib/i18n";
import { formatBookingSlotHk } from "@/lib/booking-hk-display";
import {
  bookingIntakeRuleMatchesOrder,
  bookingPostPaidMatchesOrder,
  explainPostPaidMatch,
  hkSlotStartHmFromIso,
  hkWeekday0SunFromSlot,
  type BookingIntakeRuleRow,
  type BookingPostPaidAutoMessageRow,
  type BookingOrderMatchFields,
  type IntakeOptionJson,
} from "@/lib/booking-intake-match";

const PAID_MARKER = "[DPG_BOOKING_PAID]";
export const AUTO_MSG_MARKER_PREFIX = "[DPG_AUTO_MSG:";
/** Trailing dedupe marker line on studio auto messages. */
export const AUTO_MSG_MARKER_LINE_RE = /\n\[DPG_AUTO_MSG:[0-9a-f-]{36}\]/i;
export const AUTO_MSG_MARKER_EXTRACT_RE = /\[DPG_AUTO_MSG:([0-9a-f-]{36})\]/gi;

/** Guests/members see message text only; admins see the full body including the marker. */
export function formatChatMessageBodyForViewer(
  body: string,
  viewer: "guest" | "member" | "admin",
): string {
  if (viewer === "admin") return body;
  return body.replace(AUTO_MSG_MARKER_LINE_RE, "").replace(/\s+$/, "");
}

export function extractAutoMessageIdsFromBody(body: string): string[] {
  const ids: string[] = [];
  for (const match of body.matchAll(AUTO_MSG_MARKER_EXTRACT_RE)) {
    ids.push(match[1].toLowerCase());
  }
  return ids;
}

export type SeedPaidBookingPostChatResult = {
  welcomeInserted: boolean;
  intakeInserted: number;
  autoInserted: number;
};

export type PostPaidSeedDiagnosticRow = {
  id: string;
  sort_order: number;
  kind: "intake" | "auto";
  label: string;
  matches: boolean;
  alreadyInChat: boolean;
  willSend: boolean;
  note?: string;
};

export type PostPaidSeedDiagnostic = {
  bookingId: string;
  order: BookingOrderMatchFields & { slot_weekday_hk: number; slot_start_hk: string };
  rows: PostPaidSeedDiagnosticRow[];
};

export type IntakePromptPayload = {
  ruleId: string;
  questionEn: string;
  questionZh: string;
  options: { id: string; labelEn: string; labelZh: string }[];
};

function isLocale(s: string): s is Locale {
  return s === "en" || s === "zh";
}

function labelsForBooking(locale: Locale) {
  const t = getMessages(locale);
  return {
    shoot: (v: string) =>
      v === "boudoir"
        ? t.bookingShootBoudoir
        : v === "prewedding"
          ? t.bookingShootPrewedding
          : t.bookingShootPortrait,
    party: (v: string) =>
      v === "double"
        ? t.bookingPartyDouble
        : v === "group"
          ? t.bookingPartyGroup
          : t.bookingPartySingle,
    hours: (v: string) =>
      v === "h3"
        ? t.bookingHours3
        : v === "h4"
          ? t.bookingHours4
          : v === "h10"
            ? t.bookingHoursFullDay
            : t.bookingHours2,
    makeup: (v: string) => (v === "yes" ? t.bookingMakeupYes : t.bookingMakeupNo),
    fa: (v: string) => (v === "yes" ? t.bookingFemaleAssistantYes : t.bookingFemaleAssistantNo),
  };
}

/** Studio welcome text after payment (customer booking locale). */
export function buildPaidBookingWelcomeBody(booking: {
  locale: string;
  customer_name: string;
  shoot_type: string;
  party_size: string;
  hours_tier: string;
  makeup: string;
  female_assistant: string | null;
  slot_start: string;
  slot_end: string;
  notes: string;
}): string {
  const loc = isLocale(booking.locale) ? booking.locale : "en";
  const t = getMessages(loc);
  const L = labelsForBooking(loc);
  const slot = formatBookingSlotHk(booking.slot_start, booking.slot_end, loc);
  const lines = [
    PAID_MARKER,
    "",
    t.chatPaidWelcomeLead,
    "",
    `${t.adminBookingDetailShoot}: ${L.shoot(booking.shoot_type)}`,
    `${t.adminBookingDetailParty}: ${L.party(booking.party_size)}`,
    `${t.adminBookingDetailHours}: ${L.hours(booking.hours_tier)}`,
    `${t.adminBookingDetailMakeup}: ${L.makeup(booking.makeup)}`,
  ];
  if (booking.shoot_type === "boudoir" && booking.makeup === "no" && booking.female_assistant) {
    lines.push(`${t.adminBookingDetailFemaleAssistant}: ${L.fa(booking.female_assistant)}`);
  }
  lines.push(`${t.adminBookingDetailSlot}: ${slot}`);
  if (booking.notes?.trim()) {
    lines.push(`${t.adminBookingDetailNotes}: ${booking.notes.trim()}`);
  }
  lines.push("", t.chatPaidWelcomeIntakeHint);
  return lines.join("\n");
}

function normalizeRuleOptions(raw: unknown): IntakeOptionJson[] {
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

function toPromptPayload(rule: BookingIntakeRuleRow): IntakePromptPayload {
  const opts = normalizeRuleOptions(rule.options);
  return {
    ruleId: rule.id,
    questionEn: rule.question_en,
    questionZh: rule.question_zh,
    options: opts.map((o) => ({
      id: o.id,
      labelEn: o.label_en,
      labelZh: o.label_zh,
    })),
  };
}

function intakeRuleIdFromPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.ruleId ?? "").trim();
  return id || null;
}

/**
 * After an order is paid, post a summary + matching intake questions into the booking chat thread.
 * Idempotent: welcome skipped if marker exists; intake prompts deduped by ruleId.
 * `repair` re-runs even when post_paid_chat_seed_at is set (adds missing prompts only).
 */
function orderRowFromBooking(b: Record<string, unknown>): BookingOrderMatchFields {
  return {
    shoot_type: String(b.shoot_type ?? ""),
    party_size: String(b.party_size ?? ""),
    hours_tier: String(b.hours_tier ?? ""),
    makeup: String(b.makeup ?? ""),
    female_assistant: (b.female_assistant as string | null) ?? null,
    slot_start: String(b.slot_start ?? ""),
  };
}

function autoMessageBodyWithMarker(autoId: string, body: string): string {
  return `${body}\n${AUTO_MSG_MARKER_PREFIX}${autoId}]`;
}

function autoRowFromDb(r: Record<string, unknown>): BookingPostPaidAutoMessageRow {
  return {
    id: String(r.id),
    sort_order: Number(r.sort_order) || 0,
    enabled: Boolean(r.enabled),
    after_intake_complete: Boolean(r.after_intake_complete),
    match_shoot_types: (r.match_shoot_types as string[] | null) ?? null,
    match_party_sizes: (r.match_party_sizes as string[] | null) ?? null,
    match_hours_tiers: (r.match_hours_tiers as string[] | null) ?? null,
    match_makeup: (r.match_makeup as string[] | null) ?? null,
    match_female_assistants: (r.match_female_assistants as string[] | null) ?? null,
    match_slot_weekdays: (r.match_slot_weekdays as number[] | null) ?? null,
    match_slot_start_times: (r.match_slot_start_times as string[] | null) ?? null,
    message_en: String(r.message_en ?? "").trim(),
    message_zh: String(r.message_zh ?? "").trim(),
  };
}

/** Every intake_prompt in the thread has a booking_intake_responses row. */
export async function isBookingIntakeComplete(
  svc: SupabaseClient,
  threadId: string,
  bookingId: string,
): Promise<boolean> {
  const { data: prompts, error: pe } = await svc
    .from("booking_chat_messages")
    .select("payload")
    .eq("thread_id", threadId)
    .eq("kind", "intake_prompt");
  if (pe) throw new Error(pe.message);

  const ruleIds = new Set<string>();
  for (const row of prompts ?? []) {
    const rid = intakeRuleIdFromPayload((row as { payload?: unknown }).payload);
    if (rid) ruleIds.add(rid);
  }
  if (ruleIds.size === 0) return true;

  const { data: responses, error: re } = await svc
    .from("booking_intake_responses")
    .select("rule_id")
    .eq("booking_order_id", bookingId);
  if (re) throw new Error(re.message);

  const answered = new Set((responses ?? []).map((r) => String((r as { rule_id: string }).rule_id)));
  for (const rid of ruleIds) {
    if (!answered.has(rid)) return false;
  }
  return true;
}

/** Send deferred auto messages (after_intake_complete) when intake is done. Idempotent. */
export async function flushAfterIntakeAutoMessages(
  svc: SupabaseClient,
  bookingId: string,
): Promise<number> {
  const { data: booking, error: be } = await svc.from("booking_orders").select("*").eq("id", bookingId).maybeSingle();
  if (be || !booking) return 0;
  const b = booking as Record<string, unknown>;
  if (String(b.status) !== "paid") return 0;

  const { data: thread } = await svc
    .from("booking_chat_threads")
    .select("id")
    .eq("booking_order_id", bookingId)
    .maybeSingle();
  const tid = (thread as { id?: string } | null)?.id;
  if (!tid) return 0;

  if (!(await isBookingIntakeComplete(svc, tid, bookingId))) return 0;

  const seededAutoIds = new Set<string>();
  const { data: existingAutoMsgs } = await svc
    .from("booking_chat_messages")
    .select("body")
    .eq("thread_id", tid)
    .eq("kind", "text");
  for (const row of existingAutoMsgs ?? []) {
    const body = String((row as { body?: string }).body ?? "");
    for (const id of extractAutoMessageIdsFromBody(body)) {
      seededAutoIds.add(id);
    }
  }

  const { data: autoData, error: ae } = await svc
    .from("booking_post_paid_auto_messages")
    .select("*")
    .eq("enabled", true)
    .eq("after_intake_complete", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (ae) {
    const code = String((ae as { code?: string }).code ?? "");
    const msg = ae.message ?? "";
    if (code === "42P01" || msg.includes("booking_post_paid_auto_messages")) return 0;
    throw new Error(ae.message);
  }

  const orderRow = orderRowFromBooking(b);
  const loc = isLocale(String(b.locale)) ? (String(b.locale) as Locale) : "en";
  const now = new Date().toISOString();
  let inserted = 0;

  for (const raw of autoData ?? []) {
    const auto = autoRowFromDb(raw as Record<string, unknown>);
    if (!auto.message_en || !auto.message_zh) continue;
    if (!bookingPostPaidMatchesOrder(auto, orderRow)) continue;
    if (seededAutoIds.has(auto.id.toLowerCase())) continue;

    const plain = loc === "zh" ? auto.message_zh : auto.message_en;
    const body = autoMessageBodyWithMarker(auto.id, plain);
    const { error: me } = await svc.from("booking_chat_messages").insert({
      thread_id: tid,
      sender_role: "studio",
      kind: "text",
      body,
    });
    if (me) throw new Error(me.message);
    inserted += 1;
  }

  if (inserted > 0) {
    await svc.from("booking_chat_threads").update({ updated_at: now, studio_last_read_at: now }).eq("id", tid);
  }

  return inserted;
}

export async function diagnosePostPaidChatSeed(
  svc: SupabaseClient,
  bookingId: string,
): Promise<PostPaidSeedDiagnostic | null> {
  const { data: booking, error: be } = await svc.from("booking_orders").select("*").eq("id", bookingId).maybeSingle();
  if (be || !booking) return null;
  const b = booking as Record<string, unknown>;
  const orderRow = orderRowFromBooking(b);

  const { data: thread } = await svc
    .from("booking_chat_threads")
    .select("id")
    .eq("booking_order_id", bookingId)
    .maybeSingle();
  const tid = (thread as { id?: string } | null)?.id;

  const seededRuleIds = new Set<string>();
  const seededAutoIds = new Set<string>();
  let intakeComplete = false;
  if (tid) {
    const { data: msgs } = await svc
      .from("booking_chat_messages")
      .select("kind, body, payload")
      .eq("thread_id", tid);
    for (const m of msgs ?? []) {
      const row = m as { kind?: string; body?: string; payload?: unknown };
      if (row.kind === "intake_prompt") {
        const rid = intakeRuleIdFromPayload(row.payload);
        if (rid) seededRuleIds.add(rid);
      } else if (row.kind === "text" && row.body) {
        for (const id of extractAutoMessageIdsFromBody(row.body)) {
          seededAutoIds.add(id);
        }
      }
    }
    intakeComplete = await isBookingIntakeComplete(svc, tid, bookingId);
  }

  const rows: PostPaidSeedDiagnosticRow[] = [];

  const { data: rulesRaw } = await svc
    .from("booking_intake_rules")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  for (const raw of rulesRaw ?? []) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id);
    const rule: BookingIntakeRuleRow = {
      id,
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
      options: normalizeRuleOptions(r.options),
    };
    const opts = rule.options;
    const { matches, failed } = explainPostPaidMatch(rule, orderRow);
    let note: string | undefined;
    if (opts.length < 2) note = "options < 2";
    else if (!matches) note = failed.join("; ");
    const alreadyInChat = seededRuleIds.has(id);
    rows.push({
      id,
      sort_order: rule.sort_order,
      kind: "intake",
      label: rule.question_zh || rule.question_en || id,
      matches: matches && opts.length >= 2,
      alreadyInChat,
      willSend: matches && opts.length >= 2 && !alreadyInChat,
      note,
    });
  }

  const { data: autoData } = await svc
    .from("booking_post_paid_auto_messages")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  for (const raw of autoData ?? []) {
    const r = raw as Record<string, unknown>;
    const id = String(r.id);
    const auto = autoRowFromDb(r);
    const { matches, failed } = explainPostPaidMatch(auto, orderRow);
    let note: string | undefined;
    if (!auto.message_en || !auto.message_zh) note = "message empty";
    else if (!matches) note = failed.join("; ");
    else if (auto.after_intake_complete && !intakeComplete) note = "after_intake_complete";
    const alreadyInChat = seededAutoIds.has(id.toLowerCase());
    const eligible = matches && Boolean(auto.message_en && auto.message_zh);
    const canSendNow = eligible && !auto.after_intake_complete;
    const canSendDeferred = eligible && auto.after_intake_complete && intakeComplete;
    rows.push({
      id,
      sort_order: auto.sort_order,
      kind: "auto",
      label: auto.message_zh || auto.message_en || id,
      matches: eligible,
      alreadyInChat,
      willSend: (canSendNow || canSendDeferred) && !alreadyInChat,
      note,
    });
  }

  rows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  return {
    bookingId,
    order: {
      ...orderRow,
      slot_weekday_hk: hkWeekday0SunFromSlot(orderRow.slot_start),
      slot_start_hk: hkSlotStartHmFromIso(orderRow.slot_start),
    },
    rows,
  };
}

export async function seedPaidBookingPostChat(
  svc: SupabaseClient,
  bookingId: string,
  opts?: { repair?: boolean },
): Promise<SeedPaidBookingPostChatResult> {
  const empty: SeedPaidBookingPostChatResult = {
    welcomeInserted: false,
    intakeInserted: 0,
    autoInserted: 0,
  };
  const { data: booking, error: be } = await svc.from("booking_orders").select("*").eq("id", bookingId).maybeSingle();
  if (be || !booking) return empty;
  const b = booking as Record<string, unknown>;
  if (String(b.status) !== "paid") return empty;
  if (b.post_paid_chat_seed_at && !opts?.repair) return empty;

  const { data: threadId, error: te } = await svc.rpc("get_or_create_booking_chat_thread", {
    p_booking_id: bookingId,
  });
  if (te || !threadId) return empty;

  const tid = threadId as string;

  const { count: welcomeCount, error: ce } = await svc
    .from("booking_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", tid)
    .ilike("body", `%${PAID_MARKER}%`);

  if (ce) throw new Error(ce.message);
  const welcomeAlreadySent = (welcomeCount ?? 0) > 0;

  const { data: existingIntakeMsgs, error: ieExisting } = await svc
    .from("booking_chat_messages")
    .select("payload")
    .eq("thread_id", tid)
    .eq("kind", "intake_prompt");

  if (ieExisting) throw new Error(ieExisting.message);
  const seededRuleIds = new Set<string>();
  const seededAutoIds = new Set<string>();
  for (const row of existingIntakeMsgs ?? []) {
    const rid = intakeRuleIdFromPayload((row as { payload?: unknown }).payload);
    if (rid) seededRuleIds.add(rid);
  }

  const { data: existingAutoMsgs } = await svc
    .from("booking_chat_messages")
    .select("body")
    .eq("thread_id", tid)
    .eq("kind", "text");
  for (const row of existingAutoMsgs ?? []) {
    const body = String((row as { body?: string }).body ?? "");
    for (const id of extractAutoMessageIdsFromBody(body)) {
      seededAutoIds.add(id);
    }
  }

  let welcomeInserted = false;
  let intakeInserted = 0;
  let autoInserted = 0;

  const now = new Date().toISOString();
  const welcome = buildPaidBookingWelcomeBody({
    locale: String(b.locale ?? "en"),
    customer_name: String(b.customer_name ?? ""),
    shoot_type: String(b.shoot_type ?? ""),
    party_size: String(b.party_size ?? ""),
    hours_tier: String(b.hours_tier ?? ""),
    makeup: String(b.makeup ?? ""),
    female_assistant: (b.female_assistant as string | null) ?? null,
    slot_start: String(b.slot_start ?? ""),
    slot_end: String(b.slot_end ?? ""),
    notes: String(b.notes ?? ""),
  });

  if (!welcomeAlreadySent) {
    const { error: we } = await svc.from("booking_chat_messages").insert({
      thread_id: tid,
      sender_role: "studio",
      kind: "text",
      body: welcome,
    });
    if (we) throw new Error(we.message);
    welcomeInserted = true;
  }

  const { data: rulesRaw, error: re } = await svc
    .from("booking_intake_rules")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (re) throw new Error(re.message);

  let autosRaw: Record<string, unknown>[] | null = null;
  const { data: autoData, error: ae } = await svc
    .from("booking_post_paid_auto_messages")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (ae) {
    const code = String((ae as { code?: string }).code ?? "");
    const msg = ae.message ?? "";
    if (code !== "42P01" && !msg.includes("booking_post_paid_auto_messages")) {
      throw new Error(ae.message);
    }
  } else {
    autosRaw = (autoData ?? []) as Record<string, unknown>[];
  }

  const orderRow = orderRowFromBooking(b);

  const loc = isLocale(String(b.locale)) ? (String(b.locale) as Locale) : "en";

  type SeedItem =
    | { kind: "intake"; sort_order: number; id: string; rule: BookingIntakeRuleRow }
    | { kind: "auto"; sort_order: number; id: string; auto: BookingPostPaidAutoMessageRow };

  const seedItems: SeedItem[] = [];

  for (const raw of rulesRaw ?? []) {
    const r = raw as Record<string, unknown>;
    const rule: BookingIntakeRuleRow = {
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
      options: normalizeRuleOptions(r.options),
    };
    if (rule.options.length < 2) continue;
    if (!bookingIntakeRuleMatchesOrder(rule, orderRow)) continue;
    if (seededRuleIds.has(rule.id)) continue;
    seedItems.push({ kind: "intake", sort_order: rule.sort_order, id: rule.id, rule });
  }

  for (const raw of autosRaw ?? []) {
    const auto = autoRowFromDb(raw as Record<string, unknown>);
    if (!auto.message_en || !auto.message_zh) continue;
    if (!bookingPostPaidMatchesOrder(auto, orderRow)) continue;
    if (seededAutoIds.has(auto.id.toLowerCase())) continue;
    if (auto.after_intake_complete) continue;
    seedItems.push({ kind: "auto", sort_order: auto.sort_order, id: auto.id, auto });
  }

  seedItems.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  if (seedItems.length === 0 && welcomeAlreadySent && !opts?.repair) {
    await svc
      .from("booking_orders")
      .update({ post_paid_chat_seed_at: now, updated_at: now })
      .eq("id", bookingId)
      .is("post_paid_chat_seed_at", null);
    autoInserted += await flushAfterIntakeAutoMessages(svc, bookingId);
    return { welcomeInserted, intakeInserted, autoInserted };
  }

  for (const item of seedItems) {
    if (item.kind === "auto") {
      const plain = loc === "zh" ? item.auto.message_zh : item.auto.message_en;
      const body = autoMessageBodyWithMarker(item.auto.id, plain);
      const { error: me } = await svc.from("booking_chat_messages").insert({
        thread_id: tid,
        sender_role: "studio",
        kind: "text",
        body,
      });
      if (me) throw new Error(me.message);
      autoInserted += 1;
      continue;
    }

    const rule = item.rule;
    const payload = toPromptPayload(rule);
    const bodyLine = loc === "zh" ? rule.question_zh : rule.question_en;

    const { error: ie } = await svc.from("booking_chat_messages").insert({
      thread_id: tid,
      sender_role: "studio",
      kind: "intake_prompt",
      body: bodyLine,
      payload: {
        ruleId: payload.ruleId,
        questionEn: payload.questionEn,
        questionZh: payload.questionZh,
        options: payload.options.map((o) => ({
          id: o.id,
          label_en: o.labelEn,
          label_zh: o.labelZh,
        })),
      },
    });
    if (ie) throw new Error(ie.message);
    intakeInserted += 1;
  }

  await svc.from("booking_chat_threads").update({ updated_at: now, studio_last_read_at: now }).eq("id", tid);

  const { error: ue } = await svc
    .from("booking_orders")
    .update({ post_paid_chat_seed_at: now, updated_at: now })
    .eq("id", bookingId);

  if (ue) throw new Error(ue.message);

  autoInserted += await flushAfterIntakeAutoMessages(svc, bookingId);

  return { welcomeInserted, intakeInserted, autoInserted };
}

export function parseIntakePayload(raw: unknown): IntakePromptPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const ruleId = String(p.ruleId ?? "").trim();
  const questionEn = String(p.questionEn ?? p.question_en ?? "").trim();
  const questionZh = String(p.questionZh ?? p.question_zh ?? "").trim();
  const optsRaw = p.options;
  if (!ruleId || !Array.isArray(optsRaw)) return null;
  const options: IntakePromptPayload["options"] = [];
  for (const o of optsRaw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    const labelEn = String(r.labelEn ?? r.label_en ?? "").trim();
    const labelZh = String(r.labelZh ?? r.label_zh ?? "").trim();
    if (!id || !labelEn || !labelZh) continue;
    options.push({ id, labelEn, labelZh });
  }
  if (options.length < 2) return null;
  return { ruleId, questionEn, questionZh, options };
}
