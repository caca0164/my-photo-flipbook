"use client";

import {
  deleteBookingPostPaidAutoMessage,
  listBookingPostPaidAutoMessages,
  upsertBookingPostPaidAutoMessage,
  type BookingPostPaidAutoMessageAdminRow,
} from "@/app/actions/booking-post-paid-auto-admin";
import BookingPostPaidMatchFilters from "@/app/components/BookingPostPaidMatchFilters";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function emptyAutoMessage(): BookingPostPaidAutoMessageAdminRow {
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
    after_intake_complete: false,
    message_en: "",
    message_zh: "",
  };
}

function cloneAutoMessage(source: BookingPostPaidAutoMessageAdminRow): BookingPostPaidAutoMessageAdminRow {
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
    after_intake_complete: source.after_intake_complete,
    message_en: source.message_en,
    message_zh: source.message_zh,
  };
}

export default function BookingPostPaidAutoMessagesClient({
  locale,
  initialMessages,
  onError,
}: {
  locale: Locale;
  initialMessages: BookingPostPaidAutoMessageAdminRow[];
  onError?: (msg: string | null) => void;
}) {
  const t = messages[locale];
  const router = useRouter();
  const [items, setItems] = useState(initialMessages);
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    const r = await listBookingPostPaidAutoMessages();
    if (r.error) onError?.(r.error);
    else {
      onError?.(null);
      setItems(r.messages ?? []);
    }
    router.refresh();
  }, [onError, router]);

  function updateItem(i: number, patch: Partial<BookingPostPaidAutoMessageAdminRow>) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function saveItem(i: number) {
    const m = items[i];
    onError?.(null);
    start(async () => {
      const res = await upsertBookingPostPaidAutoMessage({
        locale,
        id: m.id || null,
        sort_order: m.sort_order,
        enabled: m.enabled,
        match_shoot_types: m.match_shoot_types,
        match_party_sizes: m.match_party_sizes,
        match_hours_tiers: m.match_hours_tiers,
        match_makeup: m.match_makeup,
        match_female_assistants: m.match_female_assistants,
        match_slot_weekdays: m.match_slot_weekdays,
        match_slot_start_times: m.match_slot_start_times,
        after_intake_complete: m.after_intake_complete,
        message_en: m.message_en,
        message_zh: m.message_zh,
      });
      if (res.error) onError?.(res.error);
      else await refresh();
    });
  }

  function duplicateItem(i: number) {
    const source = items[i];
    if (!source) return;
    const copy = cloneAutoMessage(source);
    onError?.(null);
    start(async () => {
      const res = await upsertBookingPostPaidAutoMessage({
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
        after_intake_complete: copy.after_intake_complete,
        message_en: copy.message_en,
        message_zh: copy.message_zh,
      });
      if (res.error) onError?.(res.error);
      else await refresh();
    });
  }

  function removeItem(i: number) {
    const m = items[i];
    if (!m.id) {
      setItems((prev) => prev.filter((_, j) => j !== i));
      return;
    }
    if (!window.confirm(t.adminBookingAutoDeleteConfirm)) return;
    onError?.(null);
    start(async () => {
      const res = await deleteBookingPostPaidAutoMessage({ locale, id: m.id });
      if (res.error) onError?.(res.error);
      else await refresh();
    });
  }

  return (
    <section className="mt-16 border-t border-zinc-800 pt-12">
      <h2 className="text-xl font-semibold text-zinc-50">{t.adminBookingAutoSectionTitle}</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">{t.adminBookingAutoSectionSubtitle}</p>

      <div className="mt-8 space-y-8">
        {items.map((m, i) => (
          <div key={m.id || `new-auto-${i}`} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={(e) => updateItem(i, { enabled: e.target.checked })}
                />
                {t.adminBookingIntakeEnabled}
              </label>
              <label className="text-xs text-zinc-500">
                {t.adminBookingIntakeSort}
                <input
                  type="number"
                  className="ml-2 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                  value={m.sort_order}
                  onChange={(e) => updateItem(i, { sort_order: e.target.valueAsNumber || 0 })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={m.after_intake_complete}
                  onChange={(e) => updateItem(i, { after_intake_complete: e.target.checked })}
                />
                {t.adminBookingAutoAfterIntakeComplete}
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                {t.adminBookingAutoMessageEn}
                <textarea
                  value={m.message_en}
                  onChange={(e) => updateItem(i, { message_en: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                {t.adminBookingAutoMessageZh}
                <textarea
                  value={m.message_zh}
                  onChange={(e) => updateItem(i, { message_zh: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <BookingPostPaidMatchFilters
              locale={locale}
              values={m}
              onChange={(patch) => updateItem(i, patch)}
              filtersTitle={t.adminBookingAutoFiltersTitle}
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => saveItem(i)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {t.adminBookingAutoSave}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => duplicateItem(i)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-amber-500/40 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t.adminBookingAutoDuplicate}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeItem(i)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t.adminBookingAutoDelete}
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyAutoMessage()])}
          className="w-full rounded-xl border border-dashed border-zinc-600 py-3 text-sm text-zinc-400 hover:border-amber-500/40 hover:text-zinc-200"
        >
          + {t.adminBookingAutoAdd}
        </button>
      </div>
    </section>
  );
}
