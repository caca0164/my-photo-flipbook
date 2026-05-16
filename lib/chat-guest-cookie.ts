import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "bf_booking_chat";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export type ChatGuestPayload = {
  threadId: string;
  bookingId: string;
  exp: number;
};

function secret(): string {
  const s =
    process.env.CHAT_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!s) throw new Error("CHAT_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY required");
  return s;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function encodeChatGuestCookie(payload: ChatGuestPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeChatGuestCookie(raw: string | undefined | null): ChatGuestPayload | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChatGuestPayload;
    if (!payload.threadId || !payload.bookingId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function chatGuestCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function newChatGuestPayload(threadId: string, bookingId: string): ChatGuestPayload {
  return {
    threadId,
    bookingId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
}

export { COOKIE_NAME as CHAT_GUEST_COOKIE_NAME };
