"use client";

import { signIn } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginForm({
  locale,
  redirectTo,
}: {
  locale: Locale;
  redirectTo: string;
}) {
  const t = messages[locale];
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="redirect" value={redirectTo} />
      <input type="hidden" name="localeFallback" value={`/${locale}`} />

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
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "…" : t.loginSubmitBtn}
      </button>

      <Link
        href={`/${locale}/register`}
        className="text-center text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
      >
        {t.registerTitle}
      </Link>
    </form>
  );
}
