"use client";

import {
  listChatMessages,
  sendChatMessage,
  submitBookingIntakeResponse,
  type ChatMessageRow,
} from "@/app/actions/booking-chat";
import { formatBookingNumber } from "@/lib/booking-id-parse";
import { parseIntakePayload } from "@/lib/booking-post-paid-chat";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type IntakeResponseBrief = { ruleId: string; selectedOptionIds: string[] };

type Props = {
  locale: Locale;
  threadId: string;
  bookingId: string;
  mode: "guest" | "member" | "admin";
  customerName?: string;
  backHref: string;
  backLabel: string;
};

function IntakePromptBlock({
  locale,
  threadId,
  mode,
  message,
  intakeResponses,
  onSubmitted,
}: {
  locale: Locale;
  threadId: string;
  mode: "guest" | "member" | "admin";
  message: ChatMessageRow;
  intakeResponses: IntakeResponseBrief[];
  onSubmitted: () => void;
}) {
  const t = messages[locale];
  const payload = parseIntakePayload(message.payload);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const savingRef = useRef(false);

  const existing = payload
    ? intakeResponses.find((r) => r.ruleId === payload.ruleId)
    : undefined;
  const canAnswer = mode === "guest" || mode === "member";

  const saveSelection = useCallback(
    async (optionId: string) => {
      if (!canAnswer || existing || savingRef.current || !optionId) return;
      savingRef.current = true;
      setErr(null);
      setBusy(true);
      const r = await submitBookingIntakeResponse({
        locale,
        threadId,
        messageId: message.id,
        selectedOptionIds: [optionId],
        mode,
      });
      savingRef.current = false;
      setBusy(false);
      if (r.error) {
        if (r.error === "ALREADY_ANSWERED") setErr(t.chatIntakeAlreadyAnswered);
        else setErr(r.error);
        return;
      }
      onSubmitted();
    },
    [canAnswer, existing, locale, message.id, mode, onSubmitted, t.chatIntakeAlreadyAnswered, threadId],
  );

  if (!payload) {
    return <p className="text-xs text-red-300/90">{t.chatIntakeLoadError}</p>;
  }

  function pickOption(id: string) {
    if (existing || !canAnswer || busy) return;
    setSelectedId(id);
    void saveSelection(id);
  }

  const q = locale === "zh" ? payload.questionZh : payload.questionEn;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-zinc-100">{q}</p>
      <ul className="space-y-2">
        {payload.options.map((o) => {
          const savedId = existing?.selectedOptionIds[0];
          const checked = existing ? savedId === o.id : selectedId === o.id;
          const label = locale === "zh" ? o.labelZh : o.labelEn;
          return (
            <li key={o.id}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  existing
                    ? "border-zinc-700/80 bg-zinc-900/40 text-zinc-300"
                    : busy
                      ? "border-zinc-700 bg-zinc-900/40 text-zinc-400"
                      : "border-zinc-600 bg-zinc-900/60 text-zinc-100 hover:border-amber-500/40"
                }`}
              >
                <input
                  type="radio"
                  name={`intake-${message.id}`}
                  className="mt-0.5"
                  checked={checked}
                  disabled={!!existing || !canAnswer || busy}
                  onChange={() => pickOption(o.id)}
                />
                <span>{label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {existing ? (
        <p className="text-xs text-emerald-400/90">{t.chatIntakeSubmitted}</p>
      ) : canAnswer ? (
        <>
          {busy ? <p className="text-xs text-zinc-500">{t.chatIntakeSaving}</p> : null}
          {err ? <p className="text-xs text-red-400">{err}</p> : null}
        </>
      ) : (
        <p className="text-xs text-zinc-500">{t.chatIntakeAdminReadOnly}</p>
      )}
    </div>
  );
}

export default function ChatRoomClient({
  locale,
  threadId,
  bookingId,
  mode,
  customerName,
  backHref,
  backLabel,
}: Props) {
  const t = messages[locale];
  const [items, setItems] = useState<ChatMessageRow[]>([]);
  const [intakeResponses, setIntakeResponses] = useState<IntakeResponseBrief[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const bookingLabel = formatBookingNumber(bookingId);

  const chatErrorMessage = (code: string) =>
    code === "NOT_PAID" ? t.chatNotPaidError : code;

  const refresh = useCallback(async () => {
    const r = await listChatMessages(threadId, mode);
    if (r.error) {
      setLoadErr(chatErrorMessage(r.error));
      return;
    }
    setLoadErr(null);
    setItems(r.messages ?? []);
    setIntakeResponses(r.intakeResponses ?? []);
  }, [threadId, mode, t.chatNotPaidError]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSendErr(null);
    start(async () => {
      const r = await sendChatMessage({ locale, threadId, body: text, mode });
      if (r.error) {
        setSendErr(chatErrorMessage(r.error));
        return;
      }
      setDraft("");
      await refresh();
    });
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/90">
              {t.chatPrivateBadge}
            </p>
            <h1 className="mt-1 text-lg font-semibold text-zinc-50">{t.chatRoomTitle}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {t.chatBookingNumber}: <span className="font-mono text-zinc-400">{bookingLabel}</span>
              {customerName ? (
                <span className="text-zinc-600">
                  {" "}
                  · {customerName}
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">{t.chatConfidentialHint}</p>
          </div>
          <Link
            href={backHref}
            className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            {backLabel}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {loadErr ? <p className="mb-3 text-sm text-red-400">{loadErr}</p> : null}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/20 p-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t.chatEmpty}</p>
          ) : (
            items.map((m) => {
              const isStudio = m.sender_role === "studio";
              const isIntake = m.kind === "intake_prompt";
              return (
                <div
                  key={m.id}
                  className={`flex ${isStudio ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isStudio
                        ? "rounded-bl-md bg-zinc-800 text-zinc-100"
                        : "rounded-br-md bg-amber-600/90 text-zinc-950"
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-70">
                      {isStudio ? t.chatStudioLabel : t.chatYouLabel}
                      {isIntake && isStudio ? ` · ${t.chatIntakeBadge}` : null}
                    </p>
                    {isIntake && isStudio ? (
                      <IntakePromptBlock
                        locale={locale}
                        threadId={threadId}
                        mode={mode}
                        message={m}
                        intakeResponses={intakeResponses}
                        onSubmitted={() => void refresh()}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    )}
                    <p className="mt-2 text-[10px] opacity-60">
                      {new Date(m.created_at).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSend} className="mt-4 shrink-0 space-y-2">
          {sendErr ? <p className="text-sm text-red-400">{sendErr}</p> : null}
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={t.chatInputPlaceholder}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="self-end rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {t.chatSend}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
