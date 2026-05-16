"use client";

import {
  cancelBookingOrderForAdmin,
  getBookingAdminRescheduleSlots,
  listBookingOrdersForAdmin,
  diagnoseBookingPostPaidChatSeed,
  repairBookingPostPaidChatSeed,
  updateBookingOrderSlotForAdmin,
  updateBookingOrderStatusForAdmin,
  type BookingOrderStatus,
  type BookingAdminOrderRow,
} from "@/app/actions/booking-admin";
import { hoursTierToDurationHours, type BookingHoursTier } from "@/lib/booking-types";
import { formatSlotRangeLabel, isoUtcToHkYmdHm } from "@/lib/booking-slots-client";
import type { PostPaidSeedDiagnostic } from "@/lib/booking-post-paid-chat";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BookingAdminSubNav from "@/app/components/BookingAdminSubNav";

export default function BookingAdminOrdersClient({ locale }: { locale: Locale }) {
  const t = messages[locale];
  const router = useRouter();

  const [orders, setOrders] = useState<BookingAdminOrderRow[]>([]);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [modalOrder, setModalOrder] = useState<BookingAdminOrderRow | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleSaved, setRescheduleSaved] = useState(false);
  const [slotsTried, setSlotsTried] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState(false);
  const [statusDraft, setStatusDraft] = useState<BookingOrderStatus>("pending_payment");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [statusSaved, setStatusSaved] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairErr, setRepairErr] = useState<string | null>(null);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [repairDone, setRepairDone] = useState(false);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [diagnoseErr, setDiagnoseErr] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<PostPaidSeedDiagnostic | null>(null);

  const refreshOrders = useCallback(async (): Promise<BookingAdminOrderRow[] | null> => {
    setOrdersErr(null);
    setOrdersLoading(true);
    const r = await listBookingOrdersForAdmin();
    setOrdersLoading(false);
    if (r.error) {
      setOrdersErr(r.error);
      return null;
    }
    const list = r.orders ?? [];
    setOrders(list);
    return list;
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  function tierHours(tier: string): number {
    if (tier === "h2" || tier === "h3" || tier === "h4" || tier === "h10") {
      return hoursTierToDurationHours(tier as BookingHoursTier);
    }
    return 2;
  }

  function modalHoursTierLabel(tier: string): string {
    if (tier === "h2") return t.bookingHours2;
    if (tier === "h3") return t.bookingHours3;
    if (tier === "h4") return t.bookingHours4;
    if (tier === "h10") return t.bookingHoursFullDay;
    return tier;
  }

  function formatOrderSlotLine(o: BookingAdminOrderRow): string {
    const { ymd, hm } = isoUtcToHkYmdHm(o.slot_start);
    if (!ymd) return "—";
    return `${ymd} ${formatSlotRangeLabel(hm, tierHours(o.hours_tier))}`;
  }

  function statusLabel(status: string): string {
    if (status === "paid") return t.adminBookingStatusPaid;
    if (status === "pending_payment") return t.adminBookingStatusPendingPayment;
    if (status === "cancelled") return t.adminBookingStatusCancelled;
    return status;
  }

  function openOrderDetail(o: BookingAdminOrderRow) {
    setModalOrder(o);
    setRescheduleErr(null);
    setRescheduleSaved(false);
    setSlotsTried(false);
    setCancelErr(null);
    setCancelDone(false);
    setStatusErr(null);
    setStatusSaved(false);
    setRepairErr(null);
    setRepairNotice(null);
    setRepairDone(false);
    setDiagnoseErr(null);
    setDiagnostic(null);
    setStatusDraft(
      o.status === "paid" || o.status === "cancelled" ? o.status : "pending_payment",
    );
    const { ymd, hm } = isoUtcToHkYmdHm(o.slot_start);
    setRescheduleDate(ymd);
    setRescheduleTime(hm);
    setRescheduleSlots([]);
  }

  function closeOrderDetail() {
    setModalOrder(null);
    setRescheduleSlots([]);
    setRescheduleErr(null);
    setRescheduleSaved(false);
    setSlotsTried(false);
    setCancelErr(null);
    setCancelDone(false);
    setStatusErr(null);
    setStatusSaved(false);
    setRepairErr(null);
    setRepairNotice(null);
    setRepairDone(false);
    setDiagnoseErr(null);
    setDiagnostic(null);
  }

  async function submitDiagnosePostPaid() {
    if (!modalOrder) return;
    setDiagnoseErr(null);
    setDiagnostic(null);
    setDiagnoseBusy(true);
    const r = await diagnoseBookingPostPaidChatSeed({ locale, orderId: modalOrder.id });
    setDiagnoseBusy(false);
    if (r.error) {
      setDiagnoseErr(r.error);
      return;
    }
    setDiagnostic(r.diagnostic ?? null);
  }

  async function submitRepairPostPaidChat() {
    if (!modalOrder) return;
    setRepairErr(null);
    setRepairNotice(null);
    setRepairDone(false);
    setRepairBusy(true);
    const r = await repairBookingPostPaidChatSeed({ locale, orderId: modalOrder.id });
    setRepairBusy(false);
    if (r.error) {
      setRepairErr(r.error);
      return;
    }
    setRepairDone(true);
    if (r.notice) setRepairNotice(r.notice);
    else if (r.ok) {
      setRepairNotice(
        t.adminBookingRepairResult
          .replace("{welcome}", r.welcomeInserted ? "1" : "0")
          .replace("{intake}", String(r.intakeInserted ?? 0))
          .replace("{auto}", String(r.autoInserted ?? 0)),
      );
    }
    void submitDiagnosePostPaid();
  }

  async function submitStatusUpdate() {
    if (!modalOrder) return;
    setStatusErr(null);
    setStatusSaved(false);
    setStatusBusy(true);
    const r = await updateBookingOrderStatusForAdmin({
      locale,
      orderId: modalOrder.id,
      status: statusDraft,
    });
    setStatusBusy(false);
    if (r.error) {
      setStatusErr(r.error);
      return;
    }
    setStatusSaved(true);
    const list = await refreshOrders();
    const next = list?.find((x) => x.id === modalOrder.id);
    if (next) {
      setModalOrder(next);
      setStatusDraft(
        next.status === "paid" || next.status === "cancelled"
          ? next.status
          : "pending_payment",
      );
    }
    router.refresh();
  }

  async function loadRescheduleSlots() {
    if (!modalOrder || !rescheduleDate) return;
    setRescheduleErr(null);
    setRescheduleBusy(true);
    setRescheduleSlots([]);
    const r = await getBookingAdminRescheduleSlots({
      locale,
      orderId: modalOrder.id,
      dateYmd: rescheduleDate,
    });
    setRescheduleBusy(false);
    if (r.error) {
      setRescheduleErr(r.error);
      setSlotsTried(true);
      return;
    }
    const slots = r.slots ?? [];
    setRescheduleSlots(slots);
    setSlotsTried(true);
    if (slots.length && !slots.includes(rescheduleTime)) {
      setRescheduleTime(slots[0] ?? "");
    }
  }

  async function saveRescheduleSlot() {
    if (!modalOrder || !rescheduleDate || !rescheduleTime) return;
    setRescheduleErr(null);
    setRescheduleBusy(true);
    const r = await updateBookingOrderSlotForAdmin({
      locale,
      orderId: modalOrder.id,
      dateYmd: rescheduleDate,
      timeHm: rescheduleTime,
    });
    setRescheduleBusy(false);
    if (r.error) {
      setRescheduleErr(r.error);
      return;
    }
    setRescheduleSaved(true);
    const list = await refreshOrders();
    const next = list?.find((x) => x.id === modalOrder.id);
    if (next) {
      setModalOrder(next);
      const { ymd, hm } = isoUtcToHkYmdHm(next.slot_start);
      setRescheduleDate(ymd);
      setRescheduleTime(hm);
      setRescheduleSlots([]);
    }
    router.refresh();
  }

  async function submitCancelBooking() {
    if (!modalOrder) return;
    if (!window.confirm(t.adminBookingCancelConfirm)) return;
    setCancelErr(null);
    setCancelDone(false);
    setCancelBusy(true);
    const r = await cancelBookingOrderForAdmin({ locale, orderId: modalOrder.id });
    setCancelBusy(false);
    if (r.error) {
      setCancelErr(r.error);
      return;
    }
    setCancelDone(true);
    const list = await refreshOrders();
    const next = list?.find((x) => x.id === modalOrder.id);
    if (next) {
      setModalOrder(next);
      setStatusDraft(
        next.status === "paid" || next.status === "cancelled"
          ? next.status
          : "pending_payment",
      );
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t.adminBookingOrdersPageTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{t.adminBookingOrdersSubtitle}</p>
        </div>
        <Link href={`/${locale}`} className="text-sm text-amber-200/90 hover:underline">
          {t.adminBookingBack}
        </Link>
      </div>
      <BookingAdminSubNav locale={locale} active="orders" />

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <button
            type="button"
            disabled={ordersLoading}
            onClick={() => void refreshOrders()}
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {t.adminBookingOrdersRefresh}
          </button>
        </div>
        {ordersErr ? <p className="text-sm text-red-400">{ordersErr}</p> : null}
        {ordersLoading ? (
          <p className="text-sm text-zinc-500">{t.bookingCalBusyLoading}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.adminBookingOrdersEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/20">
            <table className="w-full min-w-[720px] text-left text-sm text-zinc-200">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5">{t.adminBookingOrdersSlot}</th>
                  <th className="px-3 py-2.5">{t.adminBookingOrdersCustomer}</th>
                  <th className="px-3 py-2.5">{t.adminBookingOrdersStatus}</th>
                  <th className="px-3 py-2.5">{t.adminBookingOrdersTotal}</th>
                  <th className="px-3 py-2.5">{t.adminBookingOrdersAction}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="px-3 py-2.5 align-top font-mono text-xs text-zinc-300">
                      {formatOrderSlotLine(o)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className="font-medium text-zinc-100">{o.customer_name}</span>
                      <br />
                      <span className="text-xs text-zinc-500">{o.customer_email}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs">{statusLabel(o.status)}</td>
                    <td className="px-3 py-2.5 align-top tabular-nums">
                      {(o.total_cents / 100).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK", {
                        style: "currency",
                        currency: o.currency.toUpperCase(),
                      })}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <button
                        type="button"
                        onClick={() => openOrderDetail(o)}
                        className="text-amber-200/90 underline-offset-4 hover:underline"
                      >
                        {t.adminBookingOrdersAction}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOrder ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-50">{t.adminBookingDetailTitle}</h3>
              <button
                type="button"
                onClick={() => closeOrderDetail()}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {t.adminBookingDetailClose}
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm text-zinc-300">
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailId}</dt>
                <dd className="mt-0.5 font-mono text-xs text-zinc-400">{modalOrder.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailSlot}</dt>
                <dd className="mt-0.5">{formatOrderSlotLine(modalOrder)} (UTC+8)</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingPaymentStatusTitle}</dt>
                <dd className="mt-1.5 space-y-2">
                  <select
                    value={statusDraft}
                    onChange={(e) => {
                      setStatusDraft(e.target.value as BookingOrderStatus);
                      setStatusSaved(false);
                    }}
                    disabled={statusBusy || cancelBusy || rescheduleBusy}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
                  >
                    <option value="pending_payment">{t.adminBookingStatusPendingPayment}</option>
                    <option value="paid">{t.adminBookingStatusPaid}</option>
                    <option value="cancelled">{t.adminBookingStatusCancelled}</option>
                  </select>
                  <p className="text-xs leading-relaxed text-zinc-500">{t.adminBookingPaymentStatusHint}</p>
                  <button
                    type="button"
                    disabled={
                      statusBusy ||
                      cancelBusy ||
                      rescheduleBusy ||
                      statusDraft === modalOrder.status
                    }
                    onClick={() => void submitStatusUpdate()}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 py-2 text-sm text-zinc-100 hover:border-zinc-500 disabled:opacity-40"
                  >
                    {statusBusy ? t.adminBookingRescheduleLoading : t.adminBookingPaymentStatusSave}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailEmail}</dt>
                <dd className="mt-0.5">{modalOrder.customer_email}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailPhone}</dt>
                <dd className="mt-0.5">{modalOrder.customer_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailShoot}</dt>
                <dd className="mt-0.5">
                  {modalOrder.shoot_type === "portrait"
                    ? t.bookingShootPortrait
                    : modalOrder.shoot_type === "boudoir"
                      ? t.bookingShootBoudoir
                      : modalOrder.shoot_type === "prewedding"
                        ? t.bookingShootPrewedding
                        : modalOrder.shoot_type}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailParty}</dt>
                <dd className="mt-0.5">
                  {modalOrder.party_size === "single"
                    ? t.bookingPartySingle
                    : modalOrder.party_size === "double"
                      ? t.bookingPartyDouble
                      : modalOrder.party_size === "group"
                        ? t.bookingPartyGroup
                        : modalOrder.party_size}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailHours}</dt>
                <dd className="mt-0.5">{modalHoursTierLabel(modalOrder.hours_tier)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailMakeup}</dt>
                <dd className="mt-0.5">
                  {modalOrder.makeup === "yes"
                    ? t.bookingMakeupYes
                    : modalOrder.makeup === "no"
                      ? t.bookingMakeupNo
                      : modalOrder.makeup}
                </dd>
              </div>
              {modalOrder.shoot_type === "boudoir" &&
              modalOrder.makeup === "no" &&
              modalOrder.female_assistant ? (
                <div>
                  <dt className="text-xs text-zinc-500">{t.adminBookingDetailFemaleAssistant}</dt>
                  <dd className="mt-0.5">
                    {modalOrder.female_assistant === "yes"
                      ? t.bookingFemaleAssistantYes
                      : t.bookingFemaleAssistantNo}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingOrdersTotal}</dt>
                <dd className="mt-0.5 tabular-nums">
                  {(modalOrder.total_cents / 100).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK", {
                    style: "currency",
                    currency: modalOrder.currency.toUpperCase(),
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailNotes}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words">{modalOrder.notes || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailCreated}</dt>
                <dd className="mt-0.5 font-mono text-xs">{new Date(modalOrder.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailStripeSession}</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">
                  {modalOrder.stripe_checkout_session_id || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t.adminBookingDetailStripePi}</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">
                  {modalOrder.stripe_payment_intent_id || "—"}
                </dd>
              </div>
            </dl>

            {modalOrder.status === "paid" ? (
              <div className="mt-6 border-t border-zinc-800 pt-5 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-amber-100/95">{t.adminBookingDiagnosePostPaidChat}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.adminBookingDiagnosePostPaidChatHint}</p>
                  <button
                    type="button"
                    disabled={diagnoseBusy || repairBusy || rescheduleBusy || cancelBusy || statusBusy}
                    onClick={() => void submitDiagnosePostPaid()}
                    className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-900 py-2.5 text-sm text-zinc-200 hover:border-amber-500/40 disabled:opacity-40"
                  >
                    {diagnoseBusy ? t.adminBookingRescheduleLoading : t.adminBookingDiagnosePostPaidChat}
                  </button>
                  {diagnoseErr ? <p className="mt-2 text-xs text-red-400">{diagnoseErr}</p> : null}
                  {diagnostic ? (
                    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-950/80 p-3 text-xs">
                      <p className="text-zinc-400">
                        {t.adminBookingDiagnoseOrderSummary
                          .replace("{wd}", String(diagnostic.order.slot_weekday_hk))
                          .replace("{hm}", diagnostic.order.slot_start_hk || "—")
                          .replace("{shoot}", diagnostic.order.shoot_type)
                          .replace("{party}", diagnostic.order.party_size)
                          .replace("{hours}", diagnostic.order.hours_tier)
                          .replace("{makeup}", diagnostic.order.makeup)}
                      </p>
                      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                        {diagnostic.rows.map((row) => (
                          <li key={`${row.kind}-${row.id}`} className="border-t border-zinc-800 pt-2 first:border-0 first:pt-0">
                            <p className="font-medium text-zinc-200">
                              [{row.sort_order}] {row.kind === "auto" ? (locale === "zh" ? "自動" : "Auto") : locale === "zh" ? "問題" : "Q"} ·{" "}
                              {row.willSend
                                ? t.adminBookingDiagnoseWillSend
                                : row.alreadyInChat
                                  ? t.adminBookingDiagnoseInChat
                                  : t.adminBookingDiagnoseWontSend}
                            </p>
                            <p className="mt-0.5 text-zinc-500 line-clamp-2">{row.label}</p>
                            {row.note ? (
                              <p className="mt-0.5 text-amber-200/80">
                                {row.note === "after_intake_complete"
                                  ? t.adminBookingDiagnoseAfterIntakePending
                                  : row.note}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-amber-100/95">{t.adminBookingRepairPostPaidChat}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.adminBookingRepairPostPaidChatHint}</p>
                  <button
                    type="button"
                    disabled={repairBusy || diagnoseBusy || rescheduleBusy || cancelBusy || statusBusy}
                    onClick={() => void submitRepairPostPaidChat()}
                    className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-950/30 py-2.5 text-sm font-medium text-amber-100 hover:border-amber-400/60 hover:bg-amber-950/50 disabled:opacity-40"
                  >
                    {repairBusy ? t.adminBookingRescheduleLoading : t.adminBookingRepairPostPaidChat}
                  </button>
                  {repairErr ? <p className="mt-2 text-xs text-red-400">{repairErr}</p> : null}
                  {repairNotice ? (
                    <p
                      className={`mt-2 text-xs ${repairNotice.includes("沒有") || repairNotice.includes("Nothing") ? "text-amber-200/90" : "text-emerald-400"}`}
                    >
                      {repairNotice}
                    </p>
                  ) : repairDone ? (
                    <p className="mt-2 text-xs text-emerald-400">{t.adminBookingRepairPostPaidChatDone}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {modalOrder.status === "paid" || modalOrder.status === "pending_payment" ? (
              <>
                <div className="mt-6 border-t border-zinc-800 pt-5">
                  <h4 className="text-sm font-medium text-amber-100/95">{t.adminBookingRescheduleTitle}</h4>
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs text-zinc-500">
                      {t.adminBookingRescheduleDateLabel}
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => {
                          setRescheduleDate(e.target.value);
                          setRescheduleSlots([]);
                          setRescheduleTime("");
                          setSlotsTried(false);
                        }}
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={rescheduleBusy || cancelBusy || !rescheduleDate}
                      onClick={() => void loadRescheduleSlots()}
                      className="w-full rounded-lg border border-zinc-600 bg-zinc-900 py-2 text-sm text-zinc-100 hover:border-zinc-500 disabled:opacity-40"
                    >
                      {rescheduleBusy ? t.adminBookingRescheduleLoading : t.adminBookingRescheduleLoadSlots}
                    </button>
                    {rescheduleSlots.length > 0 ? (
                      <label className="block text-xs text-zinc-500">
                        {t.adminBookingReschedulePickTime}
                        <select
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                        >
                          {rescheduleSlots.map((hm) => (
                            <option key={hm} value={hm}>
                              {formatSlotRangeLabel(hm, tierHours(modalOrder.hours_tier))}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : slotsTried && rescheduleSlots.length === 0 && !rescheduleErr ? (
                      <p className="text-xs text-zinc-500">{t.adminBookingRescheduleNoSlots}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={rescheduleBusy || cancelBusy || !rescheduleDate || !rescheduleTime}
                      onClick={() => void saveRescheduleSlot()}
                      className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                    >
                      {t.adminBookingRescheduleSubmit}
                    </button>
                  </div>
                </div>

                <div className="mt-6 border-t border-zinc-800 pt-5">
                  <h4 className="text-sm font-medium text-red-200/95">{t.adminBookingCancelTitle}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.adminBookingCancelHint}</p>
                  <button
                    type="button"
                    disabled={cancelBusy || rescheduleBusy}
                    onClick={() => void submitCancelBooking()}
                    className="mt-4 w-full rounded-lg border border-red-800/60 bg-red-950/50 py-2.5 text-sm font-medium text-red-100 hover:border-red-600 hover:bg-red-900/60 disabled:opacity-40"
                  >
                    {cancelBusy ? t.adminBookingRescheduleLoading : t.adminBookingCancelCta}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-6 border-t border-zinc-800 pt-5 text-xs text-zinc-500">
                {modalOrder.status === "cancelled"
                  ? t.adminBookingOrderCancelledBlurb
                  : t.adminBookingRescheduleClosedStatuses}
              </p>
            )}
            {statusErr ? <p className="mt-3 text-xs text-red-400">{statusErr}</p> : null}
            {statusSaved ? (
              <p className="mt-2 text-xs text-emerald-400">{t.adminBookingPaymentStatusSaved}</p>
            ) : null}
            {rescheduleErr ? <p className="mt-3 text-xs text-red-400">{rescheduleErr}</p> : null}
            {rescheduleSaved ? <p className="mt-2 text-xs text-emerald-400">{t.adminBookingRescheduleSaved}</p> : null}
            {cancelErr ? <p className="mt-3 text-xs text-red-400">{cancelErr}</p> : null}
            {cancelDone ? <p className="mt-2 text-xs text-emerald-400">{t.adminBookingCancelDone}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
