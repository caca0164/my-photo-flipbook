import { listMemberChatThreads } from "@/app/actions/booking-chat";
import { formatBookingSlotHk } from "@/lib/booking-hk-display";
import { requireMember } from "@/lib/auth/member";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function MemberChatListPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  await requireMember(locale, `/${locale}/member/chat`);
  const t = getMessages(locale);
  const { threads, error } = await listMemberChatThreads();

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-xl">
        <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/90">
          {t.chatPrivateBadge}
        </p>
        <h1 className="mt-2 text-xl font-semibold">{t.chatMemberListTitle}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t.chatMemberListSubtitle}</p>

        {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

        {!error && (!threads || threads.length === 0) ? (
          <p className="mt-8 text-sm text-zinc-500">{t.chatMemberListEmpty}</p>
        ) : null}

        {threads && threads.length > 0 ? (
          <ul className="mt-8 flex flex-col gap-2">
            {threads.map((th) => (
              <li key={th.thread_id}>
                <Link
                  href={`/${locale}/member/chat/${th.booking_order_id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-600"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-amber-200/90">{th.booking_number}</span>
                    {th.unread_for_guest ? (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {t.chatUnread}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatBookingSlotHk(th.slot_start, th.slot_end, locale)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-8 text-center">
          <Link href={`/${locale}`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
            {t.backHome}
          </Link>
        </p>
      </div>
    </main>
  );
}
