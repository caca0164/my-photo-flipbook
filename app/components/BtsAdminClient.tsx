"use client";

import {
  deleteBtsVideoAdmin,
  setBtsPageHiddenAdmin,
  upsertBtsVideoAdmin,
  type BtsVideoRow,
} from "@/app/actions/bts";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function BtsAdminClient({
  locale,
  initialVideos,
  initialPageHidden,
}: {
  locale: Locale;
  initialVideos: BtsVideoRow[];
  initialPageHidden: boolean;
}) {
  const t = messages[locale];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pageHidden, setPageHidden] = useState(initialPageHidden);
  const [visibilitySaved, setVisibilitySaved] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);

  function resetForm() {
    setEditingId(null);
    setYoutubeInput("");
    setTitleEn("");
    setTitleZh("");
    setSortOrder("0");
    setPublished(true);
    setErr(null);
    setSaved(false);
  }

  function loadVideo(v: BtsVideoRow) {
    setEditingId(v.id);
    setYoutubeInput(`https://www.youtube.com/watch?v=${v.youtube_video_id}`);
    setTitleEn(v.title_en);
    setTitleZh(v.title_zh);
    setSortOrder(String(v.sort_order));
    setPublished(v.published);
    setErr(null);
    setSaved(false);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    start(async () => {
      const r = await upsertBtsVideoAdmin({
        id: editingId,
        youtubeInput,
        title_en: titleEn,
        title_zh: titleZh,
        sort_order: Number.parseInt(sortOrder, 10) || 0,
        published,
      });
      if (r.error) {
        setErr(r.error === "Invalid YouTube URL or video ID" ? t.adminBtsInvalidYoutube : r.error);
        return;
      }
      setSaved(true);
      resetForm();
      router.refresh();
    });
  }

  function onTogglePageHidden() {
    const next = !pageHidden;
    setErr(null);
    setVisibilitySaved(false);
    start(async () => {
      const r = await setBtsPageHiddenAdmin(next);
      if (r.error) setErr(r.error);
      else {
        setPageHidden(next);
        setVisibilitySaved(true);
        router.refresh();
      }
    });
  }

  function onDelete(id: string) {
    if (!window.confirm(t.adminBtsDeleteConfirm)) return;
    setErr(null);
    start(async () => {
      const r = await deleteBtsVideoAdmin(id);
      if (r.error) setErr(r.error);
      else {
        if (editingId === id) resetForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t.adminBtsTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{t.adminBtsSubtitle}</p>
        </div>
        <Link href={`/${locale}/bts`} className="text-sm text-amber-200/90 hover:underline">
          {t.adminBtsViewPublic}
        </Link>
      </div>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-medium text-zinc-200">{t.adminBtsVisibilityTitle}</h2>
        <p className="mt-2 text-sm text-zinc-500">{t.adminBtsVisibilityHint}</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={pageHidden}
            disabled={pending}
            onChange={() => onTogglePageHidden()}
            className="mt-1 rounded border-zinc-600"
          />
          <span className="text-sm text-zinc-300">{t.adminBtsPageHiddenLabel}</span>
        </label>
        <p className="mt-3 text-xs text-zinc-500">
          {pageHidden ? t.adminBtsPageHiddenStatusOn : t.adminBtsPageHiddenStatusOff}
        </p>
        {visibilitySaved ? (
          <p className="mt-2 text-sm text-emerald-400">{t.adminBtsSaved}</p>
        ) : null}
      </section>

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6"
      >
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBtsYoutube}
          <input
            type="text"
            value={youtubeInput}
            onChange={(e) => {
              setYoutubeInput(e.target.value);
              setSaved(false);
            }}
            required
            placeholder="https://www.youtube.com/watch?v=…"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBtsTitleEn}
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBtsTitleZh}
          <input
            type="text"
            value={titleZh}
            onChange={(e) => setTitleZh(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminBtsSortOrder}
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="mt-2 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded border-zinc-600"
          />
          {t.adminBtsPublished}
        </label>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {saved ? <p className="text-sm text-emerald-400">{t.adminBtsSaved}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {editingId ? t.adminBtsSave : t.adminBtsAdd}
          </button>
          {editingId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => resetForm()}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {t.adminBtsCancel}
            </button>
          ) : null}
        </div>
      </form>

      <ul className="mt-10 space-y-3">
        {initialVideos.length === 0 ? (
          <li className="text-sm text-zinc-500">{t.adminBtsListEmpty}</li>
        ) : (
          initialVideos.map((v) => {
            const title = locale === "zh" ? v.title_zh || v.title_en : v.title_en || v.title_zh;
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {title || v.youtube_video_id}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {v.youtube_video_id}
                    {!v.published ? ` · ${t.adminBtsUnpublished}` : null}
                    {` · #${v.sort_order}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => loadVideo(v)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {t.adminBtsEdit}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(v.id)}
                    className="rounded-lg border border-red-900/60 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    {t.adminBtsDelete}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <p className="mt-10 text-center">
        <Link href={`/${locale}/admin`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
          {t.adminBtsBackHub}
        </Link>
      </p>
    </div>
  );
}
