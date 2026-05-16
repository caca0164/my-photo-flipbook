"use client";

import { updateSiteAboutAdmin, type SiteAboutRow } from "@/app/actions/about";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function AboutAdminClient({
  locale,
  initialRow,
}: {
  locale: Locale;
  initialRow: SiteAboutRow;
}) {
  const t = messages[locale];
  const router = useRouter();
  const [contentEn, setContentEn] = useState(initialRow.content_en);
  const [contentZh, setContentZh] = useState(initialRow.content_zh);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setErr(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateSiteAboutAdmin({
        locale,
        content_en: contentEn,
        content_zh: contentZh,
      });
      if (r.error) setErr(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t.adminAboutTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{t.adminAboutSubtitle}</p>
        </div>
        <Link href={`/${locale}/about`} className="text-sm text-amber-200/90 hover:underline">
          {t.adminAboutViewPublic}
        </Link>
      </div>

      <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminAboutContentEn}
          <textarea
            value={contentEn}
            onChange={(e) => {
              setContentEn(e.target.value);
              setSaved(false);
            }}
            rows={12}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-300">
          {t.adminAboutContentZh}
          <textarea
            value={contentZh}
            onChange={(e) => {
              setContentZh(e.target.value);
              setSaved(false);
            }}
            rows={12}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {saved ? <p className="text-sm text-emerald-400">{t.adminAboutSaved}</p> : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => save()}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {t.adminAboutSave}
        </button>
      </div>

      <p className="mt-10 text-center">
        <Link href={`/${locale}`} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300">
          {t.adminBookingBack}
        </Link>
      </p>
    </div>
  );
}
