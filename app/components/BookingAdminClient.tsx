"use client";

import { updateBookingAdminConfig, type BookingAdminConfigRow } from "@/app/actions/booking-admin";
import BookingAdminSubNav from "@/app/components/BookingAdminSubNav";
import { tryGetServiceAccountClientEmail } from "@/lib/google-service-account-json";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type BookingPriceCentsKey =
  | "price_shoot_portrait_cents"
  | "price_shoot_boudoir_cents"
  | "price_shoot_prewedding_cents"
  | "price_party_single_cents"
  | "price_party_double_cents"
  | "price_party_group_cents"
  | "price_hours_2_cents"
  | "price_hours_3_cents"
  | "price_hours_4_cents"
  | "price_hours_10_cents"
  | "price_makeup_yes_cents"
  | "price_makeup_yes_both_cents"
  | "price_makeup_no_cents"
  | "price_female_assistant_yes_cents"
  | "price_female_assistant_no_cents";

export default function BookingAdminClient({
  locale,
  initialRow,
}: {
  locale: Locale;
  initialRow: BookingAdminConfigRow;
}) {
  const t = messages[locale];
  const router = useRouter();
  const [row, setRow] = useState(initialRow);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function field<K extends keyof BookingAdminConfigRow>(key: K, v: BookingAdminConfigRow[K]) {
    setRow((r) => ({ ...r, [key]: v }));
    setSaved(false);
  }

  function submit() {
    setErr(null);
    startTransition(async () => {
      const r = await updateBookingAdminConfig({
        locale,
        currency: row.currency,
        price_shoot_portrait_cents: row.price_shoot_portrait_cents,
        price_shoot_boudoir_cents: row.price_shoot_boudoir_cents,
        price_shoot_prewedding_cents: row.price_shoot_prewedding_cents,
        price_party_single_cents: row.price_party_single_cents,
        price_party_double_cents: row.price_party_double_cents,
        price_party_group_cents: row.price_party_group_cents,
        price_hours_2_cents: row.price_hours_2_cents,
        price_hours_3_cents: row.price_hours_3_cents,
        price_hours_4_cents: row.price_hours_4_cents ?? 0,
        price_hours_10_cents: row.price_hours_10_cents,
        price_makeup_yes_cents: row.price_makeup_yes_cents,
        price_makeup_yes_both_cents: row.price_makeup_yes_both_cents ?? 0,
        price_makeup_no_cents: row.price_makeup_no_cents,
        price_female_assistant_yes_cents: row.price_female_assistant_yes_cents ?? 0,
        price_female_assistant_no_cents: row.price_female_assistant_no_cents ?? 0,
        notices_md_en: row.notices_md_en,
        notices_md_zh: row.notices_md_zh,
        boudoir_confidentiality_md_en: row.boudoir_confidentiality_md_en ?? "",
        boudoir_confidentiality_md_zh: row.boudoir_confidentiality_md_zh ?? "",
        google_calendar_id: row.google_calendar_id,
        google_sa_json: row.google_sa_json,
      });
      if (r.error) setErr(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const serviceAccountClientEmail = useMemo(
    () => tryGetServiceAccountClientEmail(row.google_sa_json),
    [row.google_sa_json],
  );

  /** Admin UI uses HKD; DB keeps smallest currency unit (cents). */
  function setPriceCentsFromHkd(key: BookingPriceCentsKey, hkdRaw: number) {
    const hkd = Number.isFinite(hkdRaw) ? Math.max(0, hkdRaw) : 0;
    field(key, Math.round(hkd * 100));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t.adminBookingTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{t.adminBookingSubtitle}</p>
        </div>
        <Link href={`/${locale}`} className="text-sm text-amber-200/90 hover:underline">
          {t.adminBookingBack}
        </Link>
      </div>
      <BookingAdminSubNav locale={locale} active="settings" />

      <div className="mt-8 space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBookingCurrency}
          <input
            value={row.currency}
            onChange={(e) => field("currency", e.target.value)}
            className="mt-2 w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs leading-relaxed text-zinc-600">{t.adminBookingPricesHkdHint}</p>

        <div>
          <p className="text-sm font-medium text-zinc-300">{t.adminBookingShootPrices}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["price_shoot_portrait_cents", "Portrait"],
                ["price_shoot_boudoir_cents", "Boudoir"],
                ["price_shoot_prewedding_cents", "Pre-wedding"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-xs text-zinc-500">
                {lab}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={row[k] / 100}
                  onChange={(e) => setPriceCentsFromHkd(k, e.target.valueAsNumber)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-300">{t.adminBookingPartyPrices}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["price_party_single_cents", "Single"],
                ["price_party_double_cents", "Double"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-xs text-zinc-500">
                {lab}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={row[k] / 100}
                  onChange={(e) => setPriceCentsFromHkd(k, e.target.valueAsNumber)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-300">{t.adminBookingHourPrices}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["price_hours_2_cents", t.bookingHours2],
                ["price_hours_3_cents", t.bookingHours3],
                ["price_hours_4_cents", t.bookingHours4],
                ["price_hours_10_cents", t.bookingHoursFullDay],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-xs text-zinc-500">
                {lab}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={row[k] / 100}
                  onChange={(e) => setPriceCentsFromHkd(k, e.target.valueAsNumber)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-300">{t.adminBookingMakeupPrices}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["price_makeup_yes_cents", "Makeup yes"],
                ["price_makeup_yes_both_cents", t.adminBookingMakeupYesBothPrice],
                ["price_makeup_no_cents", "Makeup no"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-xs text-zinc-500">
                {lab}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={row[k] / 100}
                  onChange={(e) => setPriceCentsFromHkd(k, e.target.valueAsNumber)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-300">{t.adminBookingFemaleAssistantPrices}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t.adminBookingFemaleAssistantPricesHint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["price_female_assistant_yes_cents", t.adminBookingFemaleAssistantPriceYes],
                ["price_female_assistant_no_cents", t.adminBookingFemaleAssistantPriceNo],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-xs text-zinc-500">
                {lab}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(row[k] ?? 0) / 100}
                  onChange={(e) => setPriceCentsFromHkd(k, e.target.valueAsNumber)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBookingNoticesEn}
          <textarea
            value={row.notices_md_en}
            onChange={(e) => field("notices_md_en", e.target.value)}
            rows={6}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBookingNoticesZh}
          <textarea
            value={row.notices_md_zh}
            onChange={(e) => field("notices_md_zh", e.target.value)}
            rows={6}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-sm font-medium text-zinc-200">{t.adminBookingBoudoirConfidentialityTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t.adminBookingBoudoirConfidentialityHint}</p>
          <label className="mt-4 block text-sm font-medium text-zinc-300">
            {t.adminBookingBoudoirConfidentialityEn}
            <textarea
              value={row.boudoir_confidentiality_md_en ?? ""}
              onChange={(e) => field("boudoir_confidentiality_md_en", e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-zinc-300">
            {t.adminBookingBoudoirConfidentialityZh}
            <textarea
              value={row.boudoir_confidentiality_md_zh ?? ""}
              onChange={(e) => field("boudoir_confidentiality_md_zh", e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBookingCalId}
          <input
            value={row.google_calendar_id}
            onChange={(e) => field("google_calendar_id", e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-amber-100/95">{t.adminBookingCalShareTitle}</p>
          {serviceAccountClientEmail ? (
            <p className="mt-2 leading-relaxed text-zinc-300">
              {t.adminBookingCalShareBody.replace("{email}", serviceAccountClientEmail)}
            </p>
          ) : (
            <p className="mt-2 leading-relaxed text-zinc-400">{t.adminBookingCalShareNoEmail}</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.adminBookingSaExplain}</p>
        </div>

        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBookingSaJson}
          <textarea
            value={row.google_sa_json ?? ""}
            onChange={(e) => field("google_sa_json", e.target.value || null)}
            rows={8}
            placeholder='{"type":"service_account",...}'
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
          />
        </label>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {saved ? <p className="text-sm text-emerald-400">{t.adminBookingSaved}</p> : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => submit()}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {t.adminBookingSave}
        </button>
      </div>
    </div>
  );
}
