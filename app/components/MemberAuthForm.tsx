"use client";

import { requestPasswordReset, signInOrSignUp, signInWithGoogle } from "@/app/actions/auth";
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
    case "google_oauth_failed":
      return t.authErrorGoogleOAuth;
    case "auth_callback":
      return t.authErrorAuthCallback;
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function MemberAuthForm({
  locale,
  redirectTo,
  initialError,
}: {
  locale: Locale;
  redirectTo: string;
  initialError?: string;
}) {
  const t = messages[locale];
  const [showForgot, setShowForgot] = useState(false);
  const [googleState, googleAction, googlePending] = useActionState(signInWithGoogle, null);
  const [authState, authAction, authPending] = useActionState(signInOrSignUp, null);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, null);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30";

  const googleError = mapAuthError(t, googleState?.error ?? initialError);
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
        <div key="auth" className="flex flex-col gap-4">
          <form action={googleAction} className="flex flex-col gap-3">
            <input type="hidden" name="redirect" value={redirectTo} />
            <input type="hidden" name="localeFallback" value={`/${locale}`} />
            <button
              type="submit"
              disabled={googlePending}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
            >
              <GoogleIcon />
              {googlePending ? "…" : t.authGoogleBtn}
            </button>
          </form>
          {googleError ? (
            <p className="text-sm text-red-400" role="alert">
              {googleError}
            </p>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="h-px flex-1 bg-zinc-800" />
            <span>{t.authOrEmailDivider}</span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
          <form action={authAction} className="flex flex-col gap-4">
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
        </div>
      )}
    </div>
  );
}
