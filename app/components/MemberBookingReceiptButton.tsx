"use client";

import { emailBookingReceiptToSelf } from "@/app/actions/member-bookings";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { useActionState } from "react";

function mapError(t: (typeof messages)[Locale], code: string | undefined): string {
  switch (code) {
    case "not_paid":
      return t.memberBookingsReceiptNotPaid;
    case "not_found":
      return t.memberBookingsReceiptNotFound;
    case "not_authenticated":
      return t.memberBookingsReceiptNotAuth;
    case "email_not_configured":
      return t.memberBookingsReceiptNotConfigured;
    case "send_failed":
      return t.memberBookingsReceiptSendFailed;
    default:
      return t.memberBookingsReceiptSendFailed;
  }
}

export default function MemberBookingReceiptButton({
  locale,
  orderId,
}: {
  locale: Locale;
  orderId: string;
}) {
  const t = messages[locale];
  const [state, action, pending] = useActionState(emailBookingReceiptToSelf, null);
  const err = state?.error ? mapError(t, state.error) : "";

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-md border border-zinc-600 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "…" : t.memberBookingsEmailReceipt}
      </button>
      {err ? (
        <span className="max-w-[10rem] text-xs text-red-400" role="alert">
          {err}
        </span>
      ) : state?.ok ? (
        <span className="max-w-[10rem] text-xs text-emerald-400" role="status">
          {t.memberBookingsReceiptSent}
        </span>
      ) : null}
    </form>
  );
}
