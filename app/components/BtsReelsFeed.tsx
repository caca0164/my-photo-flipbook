"use client";

import type { BtsVideoSource } from "@/app/actions/bts";
import {
  cloudflareStreamIframeSrc,
  cloudflareStreamThumbnailUrl,
} from "@/lib/cloudflare-stream";
import { messages, type Locale } from "@/lib/i18n";
import { youTubeEmbedSrc, youTubeThumbnailUrl } from "@/lib/youtube";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type BtsReelsItem = {
  id: string;
  source: BtsVideoSource;
  youtubeVideoId: string | null;
  cloudflareStreamUid: string | null;
  title: string;
};

type Props = {
  locale: Locale;
  pageTitle: string;
  videos: BtsReelsItem[];
  backHref?: string;
  backLabel?: string;
  embedded?: boolean;
  leadingSlot?: ReactNode;
};

const VIDEO_COL_STYLE: CSSProperties = {
  height: "100dvh",
  width: "calc(100dvh * 9 / 16)",
};

const BLUR_BG_STYLE: CSSProperties = {
  position: "absolute",
  top: "-15%",
  right: "-15%",
  bottom: "-15%",
  left: "-15%",
  zIndex: 0,
  width: "130%",
  height: "130%",
  maxWidth: "none",
  objectFit: "cover",
  transform: "scale(1.08)",
  filter: "blur(48px) saturate(1.25) brightness(0.72)",
  opacity: 0.9,
  pointerEvents: "none",
};

const SCROLL_STYLE: CSSProperties = {
  scrollSnapType: "y mandatory",
  WebkitOverflowScrolling: "touch",
};

const SLIDE_SNAP_STYLE: CSSProperties = {
  scrollSnapAlign: "start",
  scrollSnapStop: "always",
};

export default function BtsReelsFeed({
  locale,
  pageTitle,
  videos,
  backHref,
  backLabel,
  embedded = false,
  leadingSlot,
}: Props) {
  const t = messages[locale];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const videoOffset = leadingSlot ? 1 : 0;
  const slideCount = videos.length + videoOffset;

  useEffect(() => {
    const shouldLock = !embedded || Boolean(leadingSlot);
    if (!shouldLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [embedded, leadingSlot]);

  const syncPlayingFromScroll = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const slideHeight = root.clientHeight;
    if (!slideHeight) return;
    const idx = Math.min(
      Math.max(0, Math.round(root.scrollTop / slideHeight)),
      slideCount - 1,
    );
    setPlayingIndex(idx);
  }, [slideCount]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    syncPlayingFromScroll();

    let scrollEndTimer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(syncPlayingFromScroll, 160);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("scrollend", syncPlayingFromScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("scrollend", syncPlayingFromScroll);
      window.clearTimeout(scrollEndTimer);
    };
  }, [syncPlayingFromScroll, videos.length, leadingSlot]);

  function toggleSound() {
    setSoundOn((on) => !on);
  }

  function btsThumbnail(video: BtsReelsItem): string {
    if (video.source === "cloudflare" && video.cloudflareStreamUid) {
      return cloudflareStreamThumbnailUrl(video.cloudflareStreamUid);
    }
    if (video.youtubeVideoId) return youTubeThumbnailUrl(video.youtubeVideoId);
    return "";
  }

  function btsEmbedSrc(video: BtsReelsItem, isPlaying: boolean): string {
    const opts = {
      autoplay: isPlaying,
      mute: !soundOn,
      loop: true,
      controls: true as const,
    };
    if (video.source === "cloudflare" && video.cloudflareStreamUid) {
      return cloudflareStreamIframeSrc(video.cloudflareStreamUid, opts);
    }
    if (video.youtubeVideoId) return youTubeEmbedSrc(video.youtubeVideoId, opts);
    return "";
  }

  function renderVideoStage(video: BtsReelsItem, slideIndex: number) {
    const thumb = btsThumbnail(video);
    const isPlaying = slideIndex === playingIndex;
    const embedSrc = btsEmbedSrc(video, isPlaying);
    const playerKey =
      video.source === "cloudflare"
        ? `${video.cloudflareStreamUid}-${soundOn ? "sound" : "muted"}`
        : `${video.youtubeVideoId}-${soundOn ? "sound" : "muted"}`;

    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {thumb ? <img src={thumb} alt="" aria-hidden style={BLUR_BG_STYLE} /> : null}
        <div className="relative z-[1] mx-auto shrink-0 overflow-hidden bg-black" style={VIDEO_COL_STYLE}>
          {isPlaying && embedSrc ? (
            <div className="absolute inset-0 overflow-hidden">
              <iframe
                key={playerKey}
                src={embedSrc}
                title={video.title.trim() || "BTS video"}
                className="absolute left-1/2 top-1/2 h-full w-full border-0"
                style={{
                  transform:
                    video.source === "youtube"
                      ? "translate(-50%, -50%) scale(1.42)"
                      : "translate(-50%, -50%)",
                  transformOrigin: "center center",
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : null}

          {video.title.trim() ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-12">
              <p className="text-sm font-medium leading-snug text-zinc-50 drop-shadow-sm">
                {video.title}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const slideList = videos.map((video, index) => {
    const slideIndex = index + videoOffset;
    const isPlaying = slideIndex === playingIndex;

    return (
      <section
        key={video.id}
        data-bts-slide
        data-bts-index={slideIndex}
        className="relative h-[100dvh] w-full shrink-0 overflow-hidden bg-black"
        style={SLIDE_SNAP_STYLE}
        aria-current={isPlaying ? "true" : undefined}
      >
        {embedded && index === 0 ? (
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-12 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="pointer-events-auto text-sm font-semibold tracking-wide text-zinc-100/95">
              {pageTitle}
            </h2>
          </header>
        ) : null}

        {renderVideoStage(video, slideIndex)}

        {index < videos.length - 1 ? (
          <p
            className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-500/80"
            aria-hidden
          >
            {t.btsSwipeHint}
          </p>
        ) : null}
      </section>
    );
  });

  const soundControls =
    playingIndex >= videoOffset ? (
      <div
        className={`${
          embedded ? "fixed" : "absolute"
        } bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex flex-col items-center gap-3`}
      >
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-full bg-black/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-200 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/70"
          aria-label={soundOn ? t.btsMute : t.btsUnmute}
          title={soundOn ? t.btsMute : t.btsUnmute}
        >
          {soundOn ? t.btsMute : t.btsUnmute}
        </button>
        {videos.length > 1 ? (
          <div className="flex flex-col gap-1.5" aria-hidden>
            {videos.map((v, i) => (
              <span
                key={v.id}
                className={`block h-1.5 w-1.5 rounded-full transition ${
                  i + videoOffset === playingIndex ? "scale-125 bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    ) : null;

  if (embedded) {
    return (
      <div
        ref={scrollRef}
        className="bts-reels-scroll h-[100dvh] w-full overflow-y-auto overscroll-y-contain"
        style={SCROLL_STYLE}
        aria-label={pageTitle}
      >
        {leadingSlot ? (
          <section
            data-bts-slide
            data-bts-index={0}
            className="relative h-[100dvh] w-full shrink-0 overflow-hidden"
            style={SLIDE_SNAP_STYLE}
            aria-current={playingIndex === 0 ? "true" : undefined}
          >
            <div className="h-full overflow-y-auto">{leadingSlot}</div>
            {videos.length > 0 ? (
              <p
                className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-500/80"
                aria-hidden
              >
                {t.btsSwipeHint}
              </p>
            ) : null}
          </section>
        ) : null}
        {slideList}
        {soundControls}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-black text-zinc-100">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="pointer-events-auto text-sm font-semibold tracking-wide text-zinc-100/95">
          {pageTitle}
        </h1>
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="pointer-events-auto shrink-0 rounded-full bg-black/40 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
          >
            {backLabel}
          </Link>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        className="bts-reels-scroll h-full w-full overflow-y-auto overscroll-y-contain"
        style={SCROLL_STYLE}
        aria-label={pageTitle}
      >
        {slideList}
      </div>

      {soundControls}
    </div>
  );
}
