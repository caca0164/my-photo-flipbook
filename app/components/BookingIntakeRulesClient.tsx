"use client";

import {
  deleteBookingIntakeRule,
  listBookingIntakeRules,
  upsertBookingIntakeRule,
  type BookingIntakeRuleAdminRow,
} from "@/app/actions/booking-intake-admin";
import type { BookingPostPaidAutoMessageAdminRow } from "@/app/actions/booking-post-paid-auto-admin";
import BookingPostPaidAutoMessagesClient from "@/app/components/BookingPostPaidAutoMessagesClient";
import BookingPostPaidMatchFilters from "@/app/components/BookingPostPaidMatchFilters";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

function cloneRuleForDuplicate(source: BookingIntakeRuleAdminRow): BookingIntakeRuleAdminRow {
  return {
    id: "",
    sort_order: source.sort_order + 1,
    enabled: source.enabled,
    match_shoot_types: source.match_shoot_types ? [...source.match_shoot_types] : null,
    match_party_sizes: source.match_party_sizes ? [...source.match_party_sizes] : null,
    match_hours_tiers: source.match_hours_tiers ? [...source.match_hours_tiers] : null,
    match_makeup: source.match_makeup ? [...source.match_makeup] : null,
    match_female_assistants: source.match_female_assistants ? [...source.match_female_assistants] : null,
    match_slot_weekdays: source.match_slot_weekdays ? [...source.match_slot_weekdays] : null,
    match_slot_start_times: source.match_slot_start_times ? [...source.match_slot_start_times] : null,
    question_en: source.question_en,
    question_zh: source.question_zh,
    options: source.options.map((o) => ({
      id: crypto.randomUUID(),
      label_en: o.label_en,
      label_zh: o.label_zh,
    })),
  };
}

function emptyRule(): BookingIntakeRuleAdminRow {
  return {
    id: "",
    sort_order: 0,
    enabled: true,
    match_shoot_types: null,
    match_party_sizes: null,
    match_hours_tiers: null,
    match_makeup: null,
    match_female_assistants: null,
    match_slot_weekdays: null,
    match_slot_start_times: null,
    question_en: "",
    question_zh: "",
    options: [
      { id: crypto.randomUUID(), label_en: "", label_zh: "" },
      { id: crypto.randomUUID(), label_en: "", label_zh: "" },
    ],
  };
}

export default function BookingIntakeRulesClient({
  locale,
  initialRules,
  initialAutoMessages,
  initialError,
}: {
  locale: Locale;
  initialRules: BookingIntakeRuleAdminRow[];
  initialAutoMessages: BookingPostPaidAutoMessageAdminRow[];
  initialError?: string;
}) {
  const t = messages[locale];
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [err, setErr] = useState<string | null>(initialError ?? null);
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    const r = await listBookingIntakeRules();
    if (r.error) setErr(r.error);
    else {
      setErr(null);
      setRules(r.rules ?? []);
    }
    router.refresh();
  }, [router]);

  function updateRule(i: number, patch: Partial<BookingIntakeRuleAdminRow>) {
    setRules((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function addOption(i: number) {
    setRules((prev) => {
      const next = [...prev];
      const r = next[i];
      if (r.options.length >= 4) return prev;
      next[i] = {
        ...r,
        options: [...r.options, { id: crypto.randomUUID(), label_en: "", label_zh: "" }],
      };
      return next;
    });
  }

  function removeOption(ruleIdx: number, optIdx: number) {
    setRules((prev) => {
      const next = [...prev];
      const r = next[ruleIdx];
      if (r.options.length <= 2) return prev;
      next[ruleIdx] = { ...r, options: r.options.filter((_, j) => j !== optIdx) };
      return next;
    });
  }

  function saveRule(i: number) {
    const r = rules[i];
    setErr(null);
    start(async () => {
      const res = await upsertBookingIntakeRule({
        locale,
        id: r.id || null,
        sort_order: r.sort_order,
        enabled: r.enabled,
        match_shoot_types: r.match_shoot_types,
        match_party_sizes: r.match_party_sizes,
        match_hours_tiers: r.match_hours_tiers,
        match_makeup: r.match_makeup,
        match_female_assistants: r.match_female_assistants,
        match_slot_weekdays: r.match_slot_weekdays,
        match_slot_start_times: r.match_slot_start_times,
        question_en: r.question_en,
        question_zh: r.question_zh,
        options: r.options,
      });
      if (res.error) setErr(res.error);
      else await refresh();
    });
  }

  function duplicateRule(i: number) {
    const source = rules[i];
    if (!source) return;
    const copy = cloneRuleForDuplicate(source);
    setErr(null);
    start(async () => {
      const res = await upsertBookingIntakeRule({
        locale,
        id: null,
        sort_order: copy.sort_order,
        enabled: copy.enabled,
        match_shoot_types: copy.match_shoot_types,
        match_party_sizes: copy.match_party_sizes,
        match_hours_tiers: copy.match_hours_tiers,
        match_makeup: copy.match_makeup,
        match_female_assistants: copy.match_female_assistants,
        match_slot_weekdays: copy.match_slot_weekdays,
        match_slot_start_times: copy.match_slot_start_times,
        question_en: copy.question_en,
        question_zh: copy.question_zh,
        options: copy.options,
      });
      if (res.error) setErr(res.error);
      else await refresh();
    });
  }

  function removeRule(i: number) {
    const r = rules[i];
    if (!r.id) {
      setRules((prev) => prev.filter((_, j) => j !== i));
      return;
    }
    if (!window.confirm(t.adminBookingIntakeDeleteConfirm)) return;
    setErr(null);
    start(async () => {
      const res = await deleteBookingIntakeRule({ locale, id: r.id });
      if (res.error) setErr(res.error);
      else await refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t.adminBookingIntakeTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">{t.adminBookingIntakeSubtitle}</p>
        </div>
        <Link href={`/${locale}/admin`} className="text-sm text-amber-200/90 hover:underline">
          {t.adminBtsBackHub}
        </Link>
      </div>

      {err ? <p className="mb-4 text-sm text-red-400">{err}</p> : null}

      <p className="mb-6 text-xs text-zinc-600">{t.adminBookingIntakeWeekdayHint}</p>

      <h2 className="mb-6 text-lg font-medium text-zinc-300">{t.adminBookingIntakeRulesSectionTitle}</h2>

      <div className="space-y-8">
        {rules.map((r, i) => (
          <div key={r.id || `new-${i}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => updateRule(i, { enabled: e.target.checked })}
                />
                {t.adminBookingIntakeEnabled}
              </label>
              <label className="text-xs text-zinc-500">
                {t.adminBookingIntakeSort}
                <input
                  type="number"
                  className="ml-2 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                  value={r.sort_order}
                  onChange={(e) => updateRule(i, { sort_order: e.target.valueAsNumber || 0 })}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                {t.adminBookingIntakeQuestionEn}
                <textarea
                  value={r.question_en}
                  onChange={(e) => updateRule(i, { question_en: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                {t.adminBookingIntakeQuestionZh}
                <textarea
                  value={r.question_zh}
                  onChange={(e) => updateRule(i, { question_zh: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <BookingPostPaidMatchFilters
              locale={locale}
              values={r}
              onChange={(patch) => updateRule(i, patch)}
            />

            <p className="mt-5 text-sm font-medium text-zinc-400">{t.adminBookingIntakeOptionsTitle}</p>
            <div className="mt-2 space-y-2">
              {r.options.map((o, j) => (
                <div key={o.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    placeholder={t.adminBookingIntakeOptionEn}
                    value={o.label_en}
                    onChange={(e) => {
                      const opts = [...r.options];
                      opts[j] = { ...o, label_en: e.target.value };
                      updateRule(i, { options: opts });
                    }}
                    className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <input
                    placeholder={t.adminBookingIntakeOptionZh}
                    value={o.label_zh}
                    onChange={(e) => {
                      const opts = [...r.options];
                      opts[j] = { ...o, label_zh: e.target.value };
                      updateRule(i, { options: opts });
                    }}
                    className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    disabled={r.options.length <= 2}
                    onClick={() => removeOption(i, j)}
                    className="text-xs text-red-400 disabled:opacity-30"
                  >
                    −
                  </button>
                </div>
              ))}
            </div>
            {r.options.length < 4 ? (
              <button
                type="button"
                onClick={() => addOption(i)}
                className="mt-2 text-xs text-amber-200/90 hover:underline"
              >
                + {t.adminBookingIntakeAddOption}
              </button>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => saveRule(i)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {t.adminBookingIntakeSave}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => duplicateRule(i)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-amber-500/40 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t.adminBookingIntakeDuplicate}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeRule(i)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t.adminBookingIntakeDelete}
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRules((prev) => [...prev, emptyRule()])}
          className="w-full rounded-xl border border-dashed border-zinc-600 py-3 text-sm text-zinc-400 hover:border-amber-500/40 hover:text-zinc-200"
        >
          + {t.adminBookingIntakeAddRule}
        </button>
      </div>

      <BookingPostPaidAutoMessagesClient
        locale={locale}
        initialMessages={initialAutoMessages}
        onError={setErr}
      />
    </div>
  );
}
