"use client";

import { adminSendMemberMessage } from "@/app/actions/member-messages-admin";
import { getMessages, type Locale } from "@/lib/i18n";
import { useActionState } from "react";

type State = { error?: string; ok?: boolean };

export default function AdminMemberMessagesClient({ locale }: { locale: Locale }) {
  const t = getMessages(locale);

  const [state, action, pending] = useActionState(async (_prev: State, formData: FormData): Promise<State> => {
    const res = await adminSendMemberMessage({
      locale,
      memberEmail: String(formData.get("memberEmail") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    if (res.ok) return { ok: true };
    const err =
      res.error === "NO_USER"
        ? t.adminMemberMsgErrorUser
        : res.error === "Forbidden"
          ? "Forbidden"
          : (res.error ?? t.adminMemberMsgError);
    return { error: err };
  }, {});

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold">{t.adminMemberMsgTitle}</h1>
      <p className="mt-2 text-sm text-zinc-400">{t.adminMemberMsgSubtitle}</p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <label className="block text-sm">
          <span className="text-zinc-300">{t.adminMemberMsgEmail}</span>
          <input
            name="memberEmail"
            type="email"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-300">{t.adminMemberMsgSubject}</span>
          <input
            name="subject"
            type="text"
            required
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500/60"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-300">{t.adminMemberMsgBody}</span>
          <textarea
            name="body"
            required
            rows={8}
            className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-amber-500/60"
          />
        </label>
        {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
        {state?.ok ? <p className="text-sm text-emerald-400">{t.adminMemberMsgSent}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="appearance-none rounded-lg border border-amber-500/70 bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:border-amber-400 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.adminMemberMsgSend}
        </button>
      </form>
    </div>
  );
}
