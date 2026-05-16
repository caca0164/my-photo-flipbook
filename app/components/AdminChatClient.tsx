"use client";

import type { ChatThreadSummary } from "@/app/actions/booking-chat";
import { formatBookingSlotHk } from "@/lib/booking-hk-display";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";

export default function AdminChatClient({
  locale,
  initialThreads,
  loadError,
}: {
  locale: Locale;
  initialThreads: ChatThreadSummary[];
  loadError?: string;
}) {
  const t = messages[locale];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-50">{t.adminChatTitle}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t.adminChatSubtitle}</p>

      {loadError ? <p className="mt-6 text-sm text-red-400">{loadError}</p> : null}

      {initialThreads.length === 0 && !loadError ? (
        <p className="mt-8 text-sm text-zinc-500">{t.adminChatEmpty}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {initialThreads.map((th) => (
            <li key={th.thread_id}>
              <Link
                href={`/${locale}/admin/chat/${th.booking_order_id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-amber-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100">{th.customer_name}</span>
                  {th.unread_for_studio ? (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {t.chatUnread}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t.chatBookingNumber}:{" "}
                  <span className="font-mono text-zinc-400">{th.booking_number}</span>
                  {" · "}
                  {th.customer_email}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {formatBookingSlotHk(th.slot_start, th.slot_end, locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-center">
        <Link href={`/${locale}/admin`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
          {t.adminBtsBackHub}
        </Link>
      </p>
    </div>
  );
}
