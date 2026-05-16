"use client";

import {
  addAlbumTextPage,
  deleteAlbumImage,
  moveAlbumPage,
  registerAlbumImage,
  reorderAlbumPages,
  updateAlbumFlipCover,
  updateAlbumTextPage,
  type AlbumRow,
} from "@/app/actions/album";
import type { AlbumFlipCoverSettings, SideNavTitleAlign } from "@/lib/album-types";
import { COVER_FONT_PRESETS, coverFontCssFamily, coverFontsStylesheetHref } from "@/lib/cover-fonts";
import { COVER_GOLD_PRESETS, coverTitleGradientTextStyle } from "@/lib/cover-gold-presets";
import { COVER_TITLE_MAX_LEN } from "@/lib/flip-cover-brand";
import { compressImageFileForAlbum } from "@/lib/images/compress-client";
import { createClient } from "@/lib/supabase/client";
import { flipbookPublicUrl } from "@/lib/storage/public-url";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

function baseNameWithoutExt(filename: string) {
  const s = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
  return s.replace(/\.[^.]+$/, "") || "image";
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const n = [...arr];
  const [item] = n.splice(from, 1);
  n.splice(to, 0, item);
  return n;
}

export default function AlbumAdminClient({
  locale,
  initialRows,
  initialCover,
}: {
  locale: Locale;
  initialRows: AlbumRow[];
  initialCover: AlbumFlipCoverSettings;
}) {
  const t = messages[locale];
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [coverEnabled, setCoverEnabled] = useState(initialCover.coverEnabled);
  const [coverTitle, setCoverTitle] = useState(initialCover.titleText);
  const [coverFontPreset, setCoverFontPreset] = useState(initialCover.fontPreset);
  const [coverSize, setCoverSize] = useState(String(initialCover.fontSizePx));

  const [coverOpacityPct, setCoverOpacityPct] = useState(
    String(Math.round((initialCover.titleOpacity ?? 1) * 100)),
  );

  const [coverGoldPreset, setCoverGoldPreset] = useState(initialCover.titleGoldPreset);
  const [sideNavTitleText, setSideNavTitleText] = useState(initialCover.sideNavTitleText);
  const [sideNavGoldPreset, setSideNavGoldPreset] = useState(initialCover.sideNavTitleGoldPreset);
  const [sideNavFontPreset, setSideNavFontPreset] = useState(initialCover.sideNavFontPreset);
  const [sideNavSize, setSideNavSize] = useState(String(initialCover.sideNavFontSizePx));
  const [sideNavOpacityPct, setSideNavOpacityPct] = useState(
    String(Math.round((initialCover.sideNavTitleOpacity ?? 1) * 100)),
  );
  const [sideNavTitleAlign, setSideNavTitleAlign] = useState<SideNavTitleAlign>(
    initialCover.sideNavTitleAlign,
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCoverEnabled(initialCover.coverEnabled);
      setCoverTitle(initialCover.titleText);
      setCoverFontPreset(initialCover.fontPreset);
      setCoverSize(String(initialCover.fontSizePx));
      setCoverOpacityPct(String(Math.round((initialCover.titleOpacity ?? 1) * 100)));
      setCoverGoldPreset(initialCover.titleGoldPreset);
      setSideNavTitleText(initialCover.sideNavTitleText);
      setSideNavGoldPreset(initialCover.sideNavTitleGoldPreset);
      setSideNavFontPreset(initialCover.sideNavFontPreset);
      setSideNavSize(String(initialCover.sideNavFontSizePx));
      setSideNavOpacityPct(String(Math.round((initialCover.sideNavTitleOpacity ?? 1) * 100)));
      setSideNavTitleAlign(initialCover.sideNavTitleAlign);
    });
    return () => cancelAnimationFrame(id);
  }, [
    initialCover.coverEnabled,
    initialCover.titleText,
    initialCover.fontPreset,
    initialCover.fontSizePx,
    initialCover.titleOpacity,
    initialCover.titleGoldPreset,
    initialCover.sideNavTitleText,
    initialCover.sideNavFontPreset,
    initialCover.sideNavFontSizePx,
    initialCover.sideNavTitleOpacity,
    initialCover.sideNavTitleGoldPreset,
    initialCover.sideNavTitleAlign,
  ]);

  useEffect(() => {
    const href = coverFontsStylesheetHref([coverFontPreset, sideNavFontPreset]);
    if (!href) return;
    let link = document.getElementById("admin-album-cover-font") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "admin-album-cover-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
    return () => {
      document.getElementById("admin-album-cover-font")?.remove();
    };
  }, [coverFontPreset, sideNavFontPreset]);

  const sorted = useMemo(
    () => [...initialRows].sort((a, b) => a.sort_order - b.sort_order),
    [initialRows],
  );

  const sideNavPreviewPx = useMemo(
    () => Math.min(120, Math.max(14, Number.parseInt(sideNavSize, 10) || 22)),
    [sideNavSize],
  );

  const sideNavPreviewAlignClass =
    sideNavTitleAlign === "center"
      ? "text-center"
      : sideNavTitleAlign === "right"
        ? "text-right"
        : "text-left";

  async function onSaveCover() {
    setError(null);
    const n = Number.parseInt(coverSize, 10);
    const op = Number.parseInt(coverOpacityPct, 10);
    const fontSizePx = Number.isFinite(n)
      ? Math.min(120, Math.max(24, n))
      : initialCover.fontSizePx;
    const titleOpacity = Number.isFinite(op)
      ? Math.min(100, Math.max(0, op)) / 100
      : initialCover.titleOpacity;
    const snOp = Number.parseInt(sideNavOpacityPct, 10);
    const sideNavTitleOpacity = Number.isFinite(snOp)
      ? Math.min(100, Math.max(0, snOp)) / 100
      : initialCover.sideNavTitleOpacity;
    const snSize = Number.parseInt(sideNavSize, 10);
    const sideNavFontSizePx = Number.isFinite(snSize)
      ? Math.min(120, Math.max(14, snSize))
      : initialCover.sideNavFontSizePx;
    startTransition(async () => {
      const r = await updateAlbumFlipCover({
        coverEnabled,
        titleText: coverTitle,
        fontPreset: coverFontPreset,
        fontSizePx,
        titleOpacity,
        titleGoldPreset: coverGoldPreset,
        sideNavTitleText,
        sideNavFontPreset,
        sideNavFontSizePx,
        sideNavTitleOpacity,
        sideNavTitleGoldPreset: sideNavGoldPreset,
        sideNavTitleAlign,
      });
      if ("error" in r && r.error) setError(r.error);
      else if ("ok" in r && r.ok && "cover" in r) {
        const c = r.cover;
        setCoverEnabled(c.coverEnabled);
        setCoverTitle(c.titleText);
        setCoverFontPreset(c.fontPreset);
        setCoverSize(String(c.fontSizePx));
        setCoverOpacityPct(String(Math.round(c.titleOpacity * 100)));
        setCoverGoldPreset(c.titleGoldPreset);
        setSideNavTitleText(c.sideNavTitleText);
        setSideNavGoldPreset(c.sideNavTitleGoldPreset);
        setSideNavFontPreset(c.sideNavFontPreset);
        setSideNavSize(String(c.sideNavFontSizePx));
        setSideNavOpacityPct(String(Math.round(c.sideNavTitleOpacity * 100)));
        setSideNavTitleAlign(c.sideNavTitleAlign);
        queueMicrotask(() => router.refresh());
      }
    });
  }

  async function onDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAlbumImage(id);
      if ("error" in result && result.error) setError(result.error);
      else router.refresh();
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = fileRef.current;
    const list = input?.files;
    if (!list?.length) {
      setError(locale === "zh" ? "請選擇檔案。" : "Choose one or more files.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError(locale === "zh" ? "請先登入。" : "Please sign in.");
          return;
        }

        for (let i = 0; i < list.length; i++) {
          const file = list.item(i);
          if (!file || file.size === 0) continue;

          const { blob, useJpegName } = await compressImageFileForAlbum(file);
          const base = baseNameWithoutExt(file.name);
          const ext = useJpegName ? ".jpg" : file.name.match(/\.[^.]+$/)?.[0] || ".jpg";
          const path = `${Date.now()}-${i}-${base}${ext}`;
          const contentType = useJpegName ? "image/jpeg" : file.type || "image/jpeg";

          const { error: upErr } = await supabase.storage
            .from("flipbook")
            .upload(path, blob, { contentType, upsert: false });

          if (upErr) {
            setError(upErr.message);
            return;
          }

          const reg = await registerAlbumImage(path);
          if ("error" in reg && reg.error) {
            setError(reg.error);
            return;
          }
        }

        if (input) input.value = "";
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function applyReorder(next: AlbumRow[]) {
    startTransition(async () => {
      const r = await reorderAlbumPages(next.map((x) => x.id));
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  function onDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const from = Number.parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(from) || from === dropIndex) return;
    const next = moveItem(sorted, from, dropIndex);
    applyReorder(next);
  }

  async function onMove(id: string, dir: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const r = await moveAlbumPage(id, dir);
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  async function onAddTextPage() {
    setError(null);
    startTransition(async () => {
      const r = await addAlbumTextPage("");
      if ("error" in r && r.error) setError(r.error);
      else router.refresh();
    });
  }

  async function onSaveText(id: string, body: string) {
    setError(null);
    const r = await updateAlbumTextPage(id, body);
    if ("error" in r && r.error) setError(r.error);
    else router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-50">{t.adminAlbumTitle}</h1>
      <p className="mt-2 text-sm text-zinc-400">{t.adminAlbumSubtitle}</p>

      <section className="mt-8 rounded-xl border border-amber-900/40 bg-zinc-900/50 p-6">
        <h2 className="text-sm font-semibold tracking-wide text-amber-200/90">
          {t.adminCoverSectionTitle}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">{t.adminCoverSectionHint}</p>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_min(17.5rem,30vw)] lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={coverEnabled}
                onChange={(e) => setCoverEnabled(e.target.checked)}
                className="rounded border-zinc-600"
              />
              {t.adminCoverEnabled}
            </label>

            <label className="block text-sm font-medium text-zinc-300">
              {t.adminCoverTitleLabel}
              <textarea
                value={coverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                rows={6}
                maxLength={COVER_TITLE_MAX_LEN}
                spellCheck={locale === "zh" ? false : true}
                className="mt-2 block w-full max-w-xl resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-100"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                {coverTitle.length}/{COVER_TITLE_MAX_LEN} · {t.adminCoverTitleHint}
              </span>
            </label>
            <div>
              <span className="text-sm font-medium text-zinc-300">{t.adminCoverGoldPresetLabel}</span>
              <div className="mt-2 grid max-w-xl grid-cols-5 gap-2 sm:grid-cols-6">
                {COVER_GOLD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={locale === "zh" ? p.labelZh : p.labelEn}
                    aria-label={locale === "zh" ? p.labelZh : p.labelEn}
                    onClick={() => setCoverGoldPreset(p.id)}
                    aria-pressed={coverGoldPreset === p.id}
                    className={`admin-gold-preset-swatch h-11 shrink-0 rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      coverGoldPreset === p.id
                        ? "border-amber-400 ring-1 ring-amber-400/40"
                        : "border-zinc-700 hover:border-zinc-500"
                    }`}
                    style={{
                      backgroundImage: p.gradient,
                    }}
                  >
                    <span className="sr-only">
                      {locale === "zh" ? p.labelZh : p.labelEn}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {(() => {
                  const p = COVER_GOLD_PRESETS.find((x) => x.id === coverGoldPreset);
                  return p ? (locale === "zh" ? p.labelZh : p.labelEn) : "";
                })()}
              </p>
            </div>
            <label className="block text-sm font-medium text-zinc-300">
              {t.adminCoverFontLabel}
              <select
                value={coverFontPreset}
                onChange={(e) => setCoverFontPreset(e.target.value)}
                className="mt-2 block w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              >
                {COVER_FONT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {locale === "zh" ? p.labelZh : p.labelEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-300">
              {t.adminCoverTextSizeLabel}
              <input
                type="number"
                min={24}
                max={120}
                step={2}
                value={coverSize}
                onChange={(e) => setCoverSize(e.target.value)}
                className="mt-2 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
              <span className="ml-2 text-xs text-zinc-500">px · 24–120</span>
            </label>
            <label className="block text-sm font-medium text-zinc-300">
              {t.adminCoverTitleOpacityLabel}
              <div className="mt-2 flex max-w-xl flex-wrap items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.min(100, Math.max(0, Number.parseInt(coverOpacityPct, 10) || 0))}
                  onChange={(e) => setCoverOpacityPct(e.target.value)}
                  className="h-2 min-w-[10rem] flex-1 cursor-pointer accent-amber-500"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={coverOpacityPct}
                  onChange={(e) => setCoverOpacityPct(e.target.value)}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-sm text-zinc-100"
                />
                <span className="text-xs text-zinc-500">0–100%</span>
              </div>
            </label>

            <div className="space-y-4 border-t border-zinc-800/60 pt-6">
              <div>
                <h3 className="text-sm font-semibold text-amber-200/85">
                  {t.adminSideNavTitleHeading}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">{t.adminSideNavTitleLabel}</p>
              </div>
              <label htmlFor="admin-side-nav-title" className="block text-sm font-medium text-zinc-300">
                <textarea
                  id="admin-side-nav-title"
                  value={sideNavTitleText}
                  onChange={(e) => setSideNavTitleText(e.target.value)}
                  rows={6}
                  maxLength={COVER_TITLE_MAX_LEN}
                  spellCheck={locale === "zh" ? false : true}
                  className="mt-2 block w-full max-w-xl resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-100"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  {sideNavTitleText.length}/{COVER_TITLE_MAX_LEN} · {t.adminSideNavTitleHint}
                </span>
              </label>
              <div>
                <span className="text-sm font-medium text-zinc-300">{t.adminSideNavGoldPresetLabel}</span>
                <div className="mt-2 grid max-w-xl grid-cols-5 gap-2 sm:grid-cols-6">
                  {COVER_GOLD_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={locale === "zh" ? p.labelZh : p.labelEn}
                      aria-label={locale === "zh" ? p.labelZh : p.labelEn}
                      onClick={() => setSideNavGoldPreset(p.id)}
                      aria-pressed={sideNavGoldPreset === p.id}
                      className={`admin-gold-preset-swatch h-11 shrink-0 rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        sideNavGoldPreset === p.id
                          ? "border-amber-400 ring-1 ring-amber-400/40"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                      style={{
                        backgroundImage: p.gradient,
                      }}
                    >
                      <span className="sr-only">
                        {locale === "zh" ? p.labelZh : p.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">
                  {(() => {
                    const p = COVER_GOLD_PRESETS.find((x) => x.id === sideNavGoldPreset);
                    return p ? (locale === "zh" ? p.labelZh : p.labelEn) : "";
                  })()}
                </p>
              </div>
              <label className="block text-sm font-medium text-zinc-300">
                {t.adminSideNavFontLabel}
                <select
                  value={sideNavFontPreset}
                  onChange={(e) => setSideNavFontPreset(e.target.value)}
                  className="mt-2 block w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                >
                  {COVER_FONT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {locale === "zh" ? p.labelZh : p.labelEn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-zinc-300">
                {t.adminSideNavTextSizeLabel}
                <input
                  type="number"
                  min={14}
                  max={120}
                  step={1}
                  value={sideNavSize}
                  onChange={(e) => setSideNavSize(e.target.value)}
                  className="mt-2 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                />
                <span className="ml-2 text-xs text-zinc-500">px · 14–120</span>
              </label>
              <label className="block text-sm font-medium text-zinc-300">
                {t.adminSideNavTitleOpacityLabel}
                <div className="mt-2 flex max-w-xl flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.min(100, Math.max(0, Number.parseInt(sideNavOpacityPct, 10) || 0))}
                    onChange={(e) => setSideNavOpacityPct(e.target.value)}
                    className="h-2 min-w-[10rem] flex-1 cursor-pointer accent-amber-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={sideNavOpacityPct}
                    onChange={(e) => setSideNavOpacityPct(e.target.value)}
                    className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-sm text-zinc-100"
                  />
                  <span className="text-xs text-zinc-500">0–100%</span>
                </div>
              </label>
              <div>
                <span className="text-sm font-medium text-zinc-300">{t.adminSideNavTitleAlignLabel}</span>
                <div className="mt-2 flex max-w-xl flex-wrap gap-2">
                  {(
                    [
                      ["left", t.adminSideNavAlignLeft],
                      ["center", t.adminSideNavAlignCenter],
                      ["right", t.adminSideNavAlignRight],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSideNavTitleAlign(value)}
                      aria-pressed={sideNavTitleAlign === value}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        sideNavTitleAlign === value
                          ? "border-amber-400 bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/35"
                          : "border-zinc-600 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveCover}
              disabled={pending}
              className="mt-2 rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
            >
              {t.adminCoverSave}
            </button>
          </div>

          <aside className="lg:sticky lg:top-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">
              {t.adminCoverPreviewTitle}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">{t.adminCoverPreviewHint}</p>
            <div
              className="mt-3 flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-xl border border-zinc-700 bg-black px-4 py-8 shadow-inner lg:max-w-none"
              aria-hidden
            >
              <div
                className="flip-cover-title flip-cover-title--preview-inline max-w-full whitespace-pre-wrap text-center"
                style={{
                  fontFamily: coverFontCssFamily(coverFontPreset),
                  fontSize: `${Math.min(120, Math.max(24, Number.parseInt(coverSize, 10) || 48))}px`,
                  opacity: Math.min(100, Math.max(0, Number.parseInt(coverOpacityPct, 10) || 0)) / 100,
                  ...coverTitleGradientTextStyle(coverGoldPreset),
                }}
              >
                {coverTitle.trim() ? coverTitle : "Drew Poon"}
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">
                {t.adminSideNavPreviewTitle}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">{t.adminSideNavPreviewHint}</p>
              <div
                className={`mt-2 rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-4 shadow-inner ${sideNavPreviewAlignClass}`}
                aria-hidden
              >
                <div
                  className="flip-cover-title flip-cover-title--side-nav flip-cover-title--preview-inline max-w-full whitespace-pre-wrap break-words leading-snug"
                  style={{
                    fontFamily: coverFontCssFamily(sideNavFontPreset),
                    fontSize: sideNavPreviewPx,
                    opacity:
                      Math.min(100, Math.max(0, Number.parseInt(sideNavOpacityPct, 10) || 0)) / 100,
                    textAlign: sideNavTitleAlign,
                    ...coverTitleGradientTextStyle(sideNavGoldPreset),
                  }}
                >
                  {sideNavTitleText.trim()
                    ? sideNavTitleText
                    : locale === "zh"
                      ? "（空白）"
                      : "Empty"}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddTextPage}
          disabled={pending}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {t.adminAddTextPage}
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <label className="text-sm font-medium text-zinc-300">
          {t.adminPickFiles}
          <input
            ref={fileRef}
            type="file"
            name="files"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-2 block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-zinc-100"
            disabled={pending}
          />
        </label>
        <p className="text-xs text-zinc-500">{t.adminUploadHint}</p>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {pending ? "…" : t.adminUploadBtn}
        </button>
      </form>

      <h2 className="mb-2 mt-10 text-sm font-medium uppercase tracking-wider text-zinc-500">
        {t.adminCurrentImages}
      </h2>
      <p className="mb-4 text-xs text-zinc-600">{t.adminReorderHint}</p>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">{t.adminEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((row, index) => (
            <li
              key={row.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, index)}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 ring-zinc-500/0 transition hover:ring-1 hover:ring-zinc-600"
            >
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="cursor-grab select-none text-zinc-500 active:cursor-grabbing"
                  title={t.adminDragHandle}
                >
                  ⋮⋮
                </span>

                {row.page_kind === "image" && row.storage_path ? (
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={flipbookPublicUrl(row.storage_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-400">
                    {t.adminPageTypeText}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">
                    {row.page_kind === "image"
                      ? `${t.adminPageTypeImage} · ${row.storage_path}`
                      : t.adminPageTypeText}
                  </p>
                  <p className="text-xs text-zinc-600">order #{row.sort_order}</p>

                  {row.page_kind === "text" ? (
                    <textarea
                      key={row.id}
                      defaultValue={row.body_text}
                      rows={4}
                      className="mt-2 w-full max-w-xl rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-200"
                      placeholder={t.adminTextPlaceholder}
                      onBlur={(e) => {
                        if (e.target.value !== row.body_text) {
                          onSaveText(row.id, e.target.value);
                        }
                      }}
                    />
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || index === 0}
                      onClick={() => onMove(row.id, "up")}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                    >
                      {t.adminMoveUp}
                    </button>
                    <button
                      type="button"
                      disabled={pending || index >= sorted.length - 1}
                      onClick={() => onMove(row.id, "down")}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
                    >
                      {t.adminMoveDown}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      disabled={pending}
                      className="rounded bg-zinc-900 px-2 py-1 text-xs text-red-400 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {t.adminDelete}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/${locale}`}
        className="mt-10 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
      >
        {t.adminBackHome}
      </Link>
    </div>
  );
}
