"use client";

import { guestOpenBookingChat } from "@/app/actions/booking-chat";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function BookingChatGuestLogin({ locale }: { locale: Locale }) {
  const t = messages[locale];
  const router = useRouter();
  const [bookingNumber, setBookingNumber] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await guestOpenBookingChat({ locale, bookingNumber, email });
      if (r.redirectTo) {
        router.push(r.redirectTo);
        router.refresh();
        return;
      }
      if (r.error === "NO_ACCESS" || r.error === "INVALID_BOOKING") {
        setErr(t.chatGuestLoginError);
      } else if (r.error === "INVALID_EMAIL") {
        setErr(t.chatGuestLoginEmailError);
      } else {
        setErr(r.error ?? t.chatGuestLoginError);
      }
    });
  }

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/90">
          {t.chatPrivateBadge}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{t.chatGuestLoginTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t.chatGuestLoginSubtitle}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <label className="block text-sm font-medium text-zinc-300">
            {t.chatGuestBookingNumber}
            <input
              type="text"
              required
              value={bookingNumber}
              onChange={(e) => setBookingNumber(e.target.value)}
              placeholder={t.chatGuestBookingNumberPlaceholder}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            {t.emailLabel}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <p className="text-xs text-zinc-500">{t.chatGuestLoginHint}</p>
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {t.chatGuestLoginSubmit}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href={`/${locale}/login`} className="text-amber-200/90 underline-offset-4 hover:underline">
            {t.chatGuestMemberLogin}
          </Link>
        </p>
        <p className="mt-4 text-center">
          <Link href={`/${locale}`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
            {t.backHome}
          </Link>
        </p>
      </div>
    </main>
  );
}
