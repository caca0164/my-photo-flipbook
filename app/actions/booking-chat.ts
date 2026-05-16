"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { parseBookingOrderId, formatBookingNumber } from "@/lib/booking-id-parse";
import {
  CHAT_GUEST_COOKIE_NAME,
  chatGuestCookieOptions,
  decodeChatGuestCookie,
  encodeChatGuestCookie,
  newChatGuestPayload,
} from "@/lib/chat-guest-cookie";
import { formatChatMessageBodyForViewer, parseIntakePayload } from "@/lib/booking-post-paid-chat";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getMessages, locales, type Locale } from "@/lib/i18n";
import { cookies } from "next/headers";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_role: "studio" | "guest";
  body: string;
  created_at: string;
  kind?: string | null;
  payload?: unknown;
};

function sanitizeChatMessagesForViewer(
  rows: ChatMessageRow[],
  viewer: "guest" | "member" | "admin",
): ChatMessageRow[] {
  return rows.map((m) => ({
    ...m,
    body: formatChatMessageBodyForViewer(m.body, viewer),
  }));
}

const BOOKING_CHAT_ELIGIBLE_STATUS = "paid" as const;

async function bookingAllowsChat(
  svc: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  bookingId: string,
): Promise<boolean> {
  const { data } = await svc
    .from("booking_orders")
    .select("status")
    .eq("id", bookingId)
    .maybeSingle();
  return data?.status === BOOKING_CHAT_ELIGIBLE_STATUS;
}

export type ChatThreadSummary = {
  thread_id: string;
  booking_order_id: string;
  booking_number: string;
  customer_name: string;
  customer_email: string;
  slot_start: string;
  slot_end: string;
  status: string;
  updated_at: string;
  unread_for_studio: boolean;
  unread_for_guest: boolean;
};

function revalidateChatPaths(locale?: Locale) {
  const locs = locale ? [locale] : locales;
  for (const loc of locs) {
    revalidatePath(`/${loc}/member/chat`, "page");
    revalidatePath(`/${loc}/chat`, "page");
    revalidatePath(`/${loc}/admin/chat`, "page");
  }
}

async function readGuestSession() {
  const jar = await cookies();
  return decodeChatGuestCookie(jar.get(CHAT_GUEST_COOKIE_NAME)?.value);
}

export async function guestOpenBookingChat(input: {
  locale: Locale;
  bookingNumber: string;
  email: string;
}): Promise<{ error?: string; redirectTo?: string }> {
  noStore();
  const bookingId = parseBookingOrderId(input.bookingNumber);
  const email = input.email.trim();
  if (!bookingId) return { error: "INVALID_BOOKING" };
  if (!email || !email.includes("@")) return { error: "INVALID_EMAIL" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_booking_chat_guest", {
    p_booking_id: bookingId,
    p_email: email,
  });

  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.thread_id) return { error: "NO_ACCESS" };

  const payload = newChatGuestPayload(row.thread_id as string, bookingId);
  const jar = await cookies();
  jar.set(CHAT_GUEST_COOKIE_NAME, encodeChatGuestCookie(payload), chatGuestCookieOptions());

  revalidateChatPaths(input.locale);
  return { redirectTo: `/${input.locale}/chat/${bookingId}` };
}

export async function guestLogoutBookingChat(locale: Locale) {
  const jar = await cookies();
  jar.delete(CHAT_GUEST_COOKIE_NAME);
  revalidateChatPaths(locale);
}

export async function getChatThreadForGuest(
  bookingIdRaw: string,
): Promise<{ error?: string; bookingId?: string; threadId?: string }> {
  noStore();
  const bookingId = parseBookingOrderId(bookingIdRaw);
  if (!bookingId) return { error: "INVALID" };
  const session = await readGuestSession();
  if (!session || session.bookingId !== bookingId) return { error: "FORBIDDEN" };
  const svc = createServiceRoleClient();
  if (!svc) return { error: "Server misconfigured" };
  if (!(await bookingAllowsChat(svc, bookingId))) return { error: "NOT_PAID" };
  return { bookingId, threadId: session.threadId };
}

export async function listChatMessages(
  threadId: string,
  mode: "guest" | "member" | "admin",
): Promise<{
  error?: string;
  messages?: ChatMessageRow[];
  intakeResponses?: { ruleId: string; selectedOptionIds: string[] }[];
}> {
  noStore();

  async function listIntakeResponses(
    bookingOrderId: string,
    mode: "guest" | "member" | "admin",
  ): Promise<{ ruleId: string; selectedOptionIds: string[] }[]> {
    if (mode === "guest") {
      const svc = createServiceRoleClient();
      if (!svc) return [];
      const { data } = await svc
        .from("booking_intake_responses")
        .select("rule_id, selected_option_ids")
        .eq("booking_order_id", bookingOrderId);
      return (data ?? []).map((r) => ({
        ruleId: String((r as { rule_id: string }).rule_id),
        selectedOptionIds: ((r as { selected_option_ids: string[] }).selected_option_ids ?? []).map(String),
      }));
    }
    const supabase = await createClient();
    const { data } = await supabase
      .from("booking_intake_responses")
      .select("rule_id, selected_option_ids")
      .eq("booking_order_id", bookingOrderId);
    return (data ?? []).map((r) => ({
      ruleId: String((r as { rule_id: string }).rule_id),
      selectedOptionIds: ((r as { selected_option_ids: string[] }).selected_option_ids ?? []).map(String),
    }));
  }

  if (mode === "guest") {
    const session = await readGuestSession();
    if (!session || session.threadId !== threadId) return { error: "Forbidden" };
    const svc = createServiceRoleClient();
    if (!svc) return { error: "Server misconfigured" };
    if (!(await bookingAllowsChat(svc, session.bookingId))) return { error: "NOT_PAID" };
    const { data, error } = await svc
      .from("booking_chat_messages")
      .select("id, thread_id, sender_role, body, created_at, kind, payload")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) return { error: error.message };
    await svc
      .from("booking_chat_threads")
      .update({ guest_last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", threadId);
    const responded = await listIntakeResponses(session.bookingId, "guest");
    return {
      messages: sanitizeChatMessagesForViewer((data ?? []) as ChatMessageRow[], "guest"),
      intakeResponses: responded,
    };
  }

  const supabase = await createClient();
  if (mode === "member") {
    const { data: thread } = await supabase
      .from("booking_chat_threads")
      .select("booking_order_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!thread) return { error: "Not found" };
    const { data: can } = await supabase.rpc("member_owns_booking", {
      p_booking_id: thread.booking_order_id,
    });
    if (!can) return { error: "Forbidden" };
    await supabase.rpc("mark_booking_chat_read_member", { p_thread_id: threadId });
  } else {
    const profile = await getSessionProfile();
    if (!profile || profile.role !== "admin") return { error: "Forbidden" };
    await supabase.rpc("mark_booking_chat_read_admin", { p_thread_id: threadId });
  }

  const { data: threadRow } = await supabase
    .from("booking_chat_threads")
    .select("booking_order_id")
    .eq("id", threadId)
    .maybeSingle();
  const bookingOrderId = threadRow?.booking_order_id as string | undefined;

  const { data, error } = await supabase
    .from("booking_chat_messages")
    .select("id, thread_id, sender_role, body, created_at, kind, payload")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  let intakeResponses: { ruleId: string; selectedOptionIds: string[] }[] = [];
  if (bookingOrderId) {
    intakeResponses = await listIntakeResponses(bookingOrderId, mode);
  }
  return {
    messages: sanitizeChatMessagesForViewer((data ?? []) as ChatMessageRow[], mode),
    intakeResponses,
  };
}

export async function sendChatMessage(input: {
  locale: Locale;
  threadId: string;
  body: string;
  mode: "guest" | "member" | "admin";
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const body = input.body.trim();
  if (!body) return { error: "Empty message" };

  const now = new Date().toISOString();

  if (input.mode === "guest") {
    const session = await readGuestSession();
    if (!session || session.threadId !== input.threadId) return { error: "Forbidden" };
    const svc = createServiceRoleClient();
    if (!svc) return { error: "Server misconfigured" };
    if (!(await bookingAllowsChat(svc, session.bookingId))) return { error: "NOT_PAID" };
    const { error } = await svc.from("booking_chat_messages").insert({
      thread_id: input.threadId,
      sender_role: "guest",
      body,
    });
    if (error) return { error: error.message };
    await svc
      .from("booking_chat_threads")
      .update({ updated_at: now, guest_last_read_at: now })
      .eq("id", input.threadId);
    revalidateChatPaths(input.locale);
    return { ok: true };
  }

  const supabase = await createClient();
  if (input.mode === "member") {
    const { error } = await supabase.from("booking_chat_messages").insert({
      thread_id: input.threadId,
      sender_role: "guest",
      body,
    });
    if (error) return { error: error.message };
    await supabase
      .from("booking_chat_threads")
      .update({ updated_at: now, guest_last_read_at: now })
      .eq("id", input.threadId);
  } else {
    const profile = await getSessionProfile();
    if (!profile || profile.role !== "admin") return { error: "Forbidden" };
    const { error } = await supabase.from("booking_chat_messages").insert({
      thread_id: input.threadId,
      sender_role: "studio",
      body,
      created_by: profile.user.id,
    });
    if (error) return { error: error.message };
    await supabase
      .from("booking_chat_threads")
      .update({ updated_at: now, studio_last_read_at: now })
      .eq("id", input.threadId);
  }

  revalidateChatPaths(input.locale);
  return { ok: true };
}

export async function listMemberChatThreads(): Promise<{
  error?: string;
  threads?: ChatThreadSummary[];
}> {
  noStore();
  const supabase = await createClient();
  const { data: bookings, error: bErr } = await supabase
    .from("booking_orders")
    .select("id, customer_name, customer_email, slot_start, slot_end, status, created_at")
    .eq("status", BOOKING_CHAT_ELIGIBLE_STATUS)
    .order("created_at", { ascending: false });

  if (bErr) return { error: bErr.message };
  const rows = bookings ?? [];
  if (!rows.length) return { threads: [] };

  const threads: ChatThreadSummary[] = [];
  for (const b of rows) {
    const { data: threadId } = await supabase.rpc("get_or_create_booking_chat_thread", {
      p_booking_id: b.id,
    });
    if (!threadId) continue;

    const { data: thread } = await supabase
      .from("booking_chat_threads")
      .select("id, guest_last_read_at, studio_last_read_at, updated_at")
      .eq("id", threadId)
      .maybeSingle();

    const { count: unreadGuest } = await supabase
      .from("booking_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .eq("sender_role", "studio")
      .gt("created_at", thread?.guest_last_read_at ?? "1970-01-01");

    threads.push({
      thread_id: threadId as string,
      booking_order_id: b.id,
      booking_number: formatBookingNumber(b.id),
      customer_name: b.customer_name,
      customer_email: b.customer_email,
      slot_start: b.slot_start,
      slot_end: b.slot_end,
      status: b.status,
      updated_at: thread?.updated_at ?? b.created_at,
      unread_for_guest: (unreadGuest ?? 0) > 0,
      unread_for_studio: false,
    });
  }

  return { threads };
}

export async function getMemberChatThreadByBooking(
  bookingIdRaw: string,
): Promise<{ error?: string; threadId?: string; bookingId?: string }> {
  noStore();
  const bookingId = parseBookingOrderId(bookingIdRaw) ?? bookingIdRaw;
  const supabase = await createClient();
  const { data: can } = await supabase.rpc("member_owns_booking", { p_booking_id: bookingId });
  if (!can) return { error: "Forbidden" };
  const { data: threadId, error } = await supabase.rpc("get_or_create_booking_chat_thread", {
    p_booking_id: bookingId,
  });
  if (error || !threadId) return { error: error?.message ?? "Thread error" };
  return { threadId: threadId as string, bookingId };
}

export async function listAdminChatThreads(): Promise<{
  error?: string;
  threads?: ChatThreadSummary[];
}> {
  noStore();
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin") return { error: "Forbidden" };

  const svc = createServiceRoleClient();
  if (!svc) return { error: "Server misconfigured" };

  const { data: bookings, error } = await svc
    .from("booking_orders")
    .select("id, customer_name, customer_email, slot_start, slot_end, status, created_at")
    .eq("status", BOOKING_CHAT_ELIGIBLE_STATUS)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const threads: ChatThreadSummary[] = [];
  for (const b of bookings ?? []) {
    const { data: threadRow } = await svc
      .from("booking_chat_threads")
      .select("id, guest_last_read_at, studio_last_read_at, updated_at")
      .eq("booking_order_id", b.id)
      .maybeSingle();

    let threadId = threadRow?.id as string | undefined;
    let studioLastRead = threadRow?.studio_last_read_at ?? null;
    if (!threadId) {
      const { data: newId } = await svc.rpc("get_or_create_booking_chat_thread", {
        p_booking_id: b.id,
      });
      threadId = newId as string;
      studioLastRead = null;
    }
    if (!threadId) continue;

    const { count: unreadStudio } = await svc
      .from("booking_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .eq("sender_role", "guest")
      .gt("created_at", studioLastRead ?? "1970-01-01");

    threads.push({
      thread_id: threadId,
      booking_order_id: b.id,
      booking_number: formatBookingNumber(b.id),
      customer_name: b.customer_name,
      customer_email: b.customer_email,
      slot_start: b.slot_start,
      slot_end: b.slot_end,
      status: b.status,
      updated_at: threadRow?.updated_at ?? b.created_at,
      unread_for_studio: (unreadStudio ?? 0) > 0,
      unread_for_guest: false,
    });
  }

  threads.sort((a, b) => {
    if (a.unread_for_studio !== b.unread_for_studio) return a.unread_for_studio ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return { threads };
}

export async function getAdminChatThreadByBooking(
  bookingIdRaw: string,
): Promise<{ error?: string; threadId?: string; bookingId?: string }> {
  noStore();
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin") return { error: "Forbidden" };
  const bookingId = parseBookingOrderId(bookingIdRaw) ?? bookingIdRaw;
  const svc = createServiceRoleClient();
  if (!svc) return { error: "Server misconfigured" };
  const { data: threadId, error } = await svc.rpc("get_or_create_booking_chat_thread", {
    p_booking_id: bookingId,
  });
  if (error || !threadId) return { error: error?.message ?? "Thread error" };
  return { threadId: threadId as string, bookingId };
}

export async function submitBookingIntakeResponse(input: {
  locale: Locale;
  threadId: string;
  messageId: string;
  selectedOptionIds: string[];
  mode: "guest" | "member";
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const selected = [
    ...new Set(input.selectedOptionIds.map((x) => String(x).trim()).filter(Boolean)),
  ];
  if (selected.length !== 1) return { error: "SINGLE_CHOICE_ONLY" };

  let bookingId: string | null = null;
  if (input.mode === "guest") {
    const session = await readGuestSession();
    if (!session || session.threadId !== input.threadId) return { error: "Forbidden" };
    bookingId = session.bookingId;
  } else {
    const supabase = await createClient();
    const { data: thread } = await supabase
      .from("booking_chat_threads")
      .select("booking_order_id")
      .eq("id", input.threadId)
      .maybeSingle();
    if (!thread) return { error: "Forbidden" };
    const { data: can } = await supabase.rpc("member_owns_booking", {
      p_booking_id: thread.booking_order_id,
    });
    if (!can) return { error: "Forbidden" };
    bookingId = thread.booking_order_id as string;
  }

  const svc = createServiceRoleClient();
  if (!svc) return { error: "Server misconfigured" };
  if (!bookingId || !(await bookingAllowsChat(svc, bookingId))) return { error: "NOT_PAID" };

  const { data: msg, error: me } = await svc
    .from("booking_chat_messages")
    .select("id, thread_id, kind, payload")
    .eq("id", input.messageId)
    .eq("thread_id", input.threadId)
    .maybeSingle();
  if (me || !msg) return { error: "Not found" };
  if (msg.kind !== "intake_prompt") return { error: "Invalid message" };

  const payload = parseIntakePayload(msg.payload);
  if (!payload) return { error: "Invalid prompt" };

  const allowed = new Set(payload.options.map((o) => o.id));
  if (!selected.every((id) => allowed.has(id))) return { error: "Invalid option" };

  const { data: existing } = await svc
    .from("booking_intake_responses")
    .select("id")
    .eq("booking_order_id", bookingId)
    .eq("rule_id", payload.ruleId)
    .maybeSingle();
  if (existing) return { error: "ALREADY_ANSWERED" };

  const { data: booking } = await svc.from("booking_orders").select("locale").eq("id", bookingId).maybeSingle();
  const loc = booking?.locale === "zh" ? "zh" : "en";
  const t = getMessages(loc);
  const qtext =
    (booking?.locale === "zh" ? payload.questionZh : payload.questionEn) || payload.questionEn;
  const labels = selected
    .map((id) => payload.options.find((o) => o.id === id))
    .filter(Boolean)
    .map((o) => (booking?.locale === "zh" ? o!.labelZh : o!.labelEn));
  const body = t.chatIntakeGuestReplyBody
    .replace("{question}", qtext)
    .replace("{answer}", labels[0] ?? "");

  const now = new Date().toISOString();

  const { error: re } = await svc.from("booking_intake_responses").insert({
    booking_order_id: bookingId,
    rule_id: payload.ruleId,
    prompt_message_id: input.messageId,
    selected_option_ids: selected,
  });
  if (re) return { error: re.message };

  const { error: ge } = await svc.from("booking_chat_messages").insert({
    thread_id: input.threadId,
    sender_role: "guest",
    kind: "text",
    body,
  });
  if (ge) return { error: ge.message };

  await svc
    .from("booking_chat_threads")
    .update({ updated_at: now, guest_last_read_at: now })
    .eq("id", input.threadId);

  const { flushAfterIntakeAutoMessages } = await import("@/lib/booking-post-paid-chat");
  await flushAfterIntakeAutoMessages(svc, bookingId);

  revalidateChatPaths(input.locale);
  return { ok: true };
}

export async function countUnreadChatsForMember(): Promise<number> {
  noStore();
  const { threads } = await listMemberChatThreads();
  return threads?.filter((t) => t.unread_for_guest).length ?? 0;
}

export async function countUnreadChatsForAdmin(): Promise<number> {
  noStore();
  const { threads } = await listAdminChatThreads();
  return threads?.filter((t) => t.unread_for_studio).length ?? 0;
}
