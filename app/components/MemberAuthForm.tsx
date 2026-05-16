"use client";

import { requestPasswordReset, signInOrSignUp } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { useActionState, useState } from "react";

function mapAuthError(t: (typeof messages)[Locale], code: string | undefined): string {
  if (!code) return "";
  switch (code) {
    case "email_password_required":
      return t.authErrorEmailPasswordRequired;
    case "password_too_short":
      return t.authErrorPasswordTooShort;
    case "invalid_credentials":
      return t.authErrorInvalidCredentials;
    case "email_not_registered":
      return t.authResetEmailNotRegistered;
    case "reset_session_expired":
      return t.authResetSessionExpired;
    case "service_unavailable":
      return t.authErrorServiceUnavailable;
    case "email_rate_limit":
      return t.authErrorRateLimit;
    default:
      if (/rate limit/i.test(code)) return t.authErrorRateLimit;
      return code;
  }
}

function mapAuthSuccess(t: (typeof messages)[Locale], code: string | undefined): string {
  if (!code) return "";
  switch (code) {
    case "account_created_confirm_email":
      return t.registerSuccess;
    case "reset_email_sent":
      return t.authResetEmailSent;
    default:
      return code;
  }
}

export default function MemberAuthForm({
  locale,
  redirectTo,
}: {
  locale: Locale;
  redirectTo: string;
}) {
  const t = messages[locale];
  const [showForgot, setShowForgot] = useState(false);
  const [authState, authAction, authPending] = useActionState(signInOrSignUp, null);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, null);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30";

  const authError = mapAuthError(t, authState?.error);
  const authSuccess = mapAuthSuccess(t, authState?.success);
  const resetError = mapAuthError(t, resetState?.error);
  const resetSuccess = mapAuthSuccess(t, resetState?.success);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {showForgot ? (
        <form key="forgot" action={resetAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <p className="text-sm text-zinc-400">{t.authForgotPasswordHint}</p>
          <div>
            <label htmlFor="reset-email" className="mb-1 block text-sm text-zinc-400">
              {t.emailLabel}
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          {resetError ? (
            <p className="text-sm text-red-400" role="alert">
              {resetError}
            </p>
          ) : null}
          {resetSuccess ? (
            <p className="text-sm text-emerald-400" role="status">
              {resetSuccess}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={resetPending || !!resetSuccess}
            className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {resetPending ? "…" : t.authResetSubmit}
          </button>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
          >
            {t.authBackToSignIn}
          </button>
        </form>
      ) : (
        <form key="auth" action={authAction} className="flex flex-col gap-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          <input type="hidden" name="localeFallback" value={`/${locale}`} />
          <p className="text-sm text-zinc-400">{t.authUnifiedHint}</p>
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm text-zinc-400">
              {t.emailLabel}
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="auth-password" className="text-sm text-zinc-400">
                {t.passwordLabel}
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              >
                {t.authForgotPassword}
              </button>
            </div>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {authError ? (
            <p className="text-sm text-red-400" role="alert">
              {authError}
            </p>
          ) : null}
          {authSuccess ? (
            <p className="text-sm text-emerald-400" role="status">
              {authSuccess}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={authPending || !!authSuccess}
            className="rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {authPending ? "…" : t.authContinueBtn}
          </button>
        </form>
      )}
    </div>
  );
}
