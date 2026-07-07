"use client";

import FlipBook from "@/app/components/FlipBook";
import type { AlbumFlipCoverSettings, FlipBookPage } from "@/lib/album-types";
import type { Locale } from "@/lib/i18n";
import type { ReactNode } from "react";

type Props = {
  locale: Locale;
  pages: FlipBookPage[];
  coverOverlay: AlbumFlipCoverSettings | null;
  children: ReactNode;
  /** Full-viewport snap scroll (e.g. About + BTS reels); drops outer padding. */
  fullBleed?: boolean;
};

/** Full-viewport flip album behind a deep translucent scrim; content scrolls on top. */
export default function AboutPageShell({
  locale,
  pages,
  coverOverlay,
  children,
  fullBleed = false,
}: Props) {
  return (
    <main className={`relative text-zinc-100 ${fullBleed ? "h-[100dvh]" : "min-h-[100dvh]"}`}>
      <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <FlipBook locale={locale} pages={pages} coverOverlay={coverOverlay} ambient />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-[1] bg-zinc-950/82 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        className={`relative z-10 ${fullBleed ? "h-[100dvh]" : "min-h-[100dvh] px-4 py-12"}`}
      >
        {children}
      </div>
    </main>
  );
}
