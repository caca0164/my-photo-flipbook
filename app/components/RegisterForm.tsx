"use client";

import { signUp } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useActionState } from "react";

export default function RegisterForm({ locale }: { locale: Locale }) {
  const t = messages[locale];
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-zinc-400">
          {t.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-zinc-400">
          {t.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-400" role="status">
          {t.registerSuccess}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !!state?.success}
        className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "…" : t.registerSubmitBtn}
      </button>

      <Link
        href={`/${locale}/login`}
        className="text-center text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
      >
        {t.navLogin}
      </Link>
    </form>
  );
}
