"use client";

import { updatePassword } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useActionState } from "react";

function mapError(t: (typeof messages)[Locale], code: string | undefined): string {
  if (!code) return "";
  switch (code) {
    case "email_password_required":
      return t.authErrorEmailPasswordRequired;
    case "password_too_short":
      return t.authErrorPasswordTooShort;
    case "reset_session_expired":
      return t.authResetSessionExpired;
    default:
      return code;
  }
}

export default function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = messages[locale];
  const [state, action, pending] = useActionState(updatePassword, null);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30";

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-zinc-400">{t.authNewPasswordHint}</p>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm text-zinc-400">
          {t.authNewPasswordLabel}
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-red-400" role="alert">
          {mapError(t, state.error)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "…" : t.authNewPasswordSubmit}
      </button>
      <Link
        href={`/${locale}/login`}
        className="text-center text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
      >
        {t.authBackToSignIn}
      </Link>
    </form>
  );
}
