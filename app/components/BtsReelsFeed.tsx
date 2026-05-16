"use client";

import { youTubeEmbedSrc, youTubeThumbnailUrl } from "@/lib/youtube";
import { messages, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type BtsReelsItem = {
  id: string;
  videoId: string;
  title: string;
};

type Props = {
  locale: Locale;
  pageTitle: string;
  videos: BtsReelsItem[];
  backHref: string;
  backLabel: string;
};

export default function BtsReelsFeed({
  locale,
  pageTitle,
  videos,
  backHref,
  backLabel,
}: Props) {
  const t = messages[locale];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [embedOrigin, setEmbedOrigin] = useState("");

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const observeSlides = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;

    const slides = root.querySelectorAll<HTMLElement>("[data-bts-slide]");
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const index = Number(el.dataset.btsIndex);
          if (Number.isNaN(index)) continue;
          const ratio = entry.intersectionRatio;
          if (!best || ratio > best.ratio) best = { index, ratio };
        }
        if (best && best.ratio >= 0.5) setActiveIndex(best.index);
      },
      { root, threshold: [0.35, 0.5, 0.65, 0.85] },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    return observeSlides();
  }, [observeSlides]);

  function toggleSound() {
    setSoundOn((on) => !on);
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-black text-zinc-100">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="pointer-events-auto text-sm font-semibold tracking-wide text-zinc-100/95">
          {pageTitle}
        </h1>
        <Link
          href={backHref}
          className="pointer-events-auto shrink-0 rounded-full bg-black/40 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
        >
          {backLabel}
        </Link>
      </header>

      <div
        ref={scrollRef}
        className="bts-reels-scroll h-full w-full overflow-y-auto overscroll-y-contain"
        aria-label={pageTitle}
      >
        {videos.map((video, index) => {
          const isActive = index === activeIndex;
          const embedSrc = youTubeEmbedSrc(video.videoId, {
            autoplay: isActive,
            mute: !soundOn,
            loop: true,
            controls: true,
          });

          return (
            <section
              key={video.id}
              data-bts-slide
              data-bts-index={index}
              className="bts-reels-slide relative flex h-[100dvh] w-full shrink-0 snap-start snap-always items-center justify-center"
              aria-current={isActive ? "true" : undefined}
            >
              <div className="relative flex h-full w-full max-w-lg items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14">
                <div className="relative aspect-[9/16] h-[min(88dvh,calc(100dvh-5rem))] w-auto max-w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl ring-1 ring-white/10">
                  {isActive ? (
                    <div className="bts-yt-crop absolute inset-0">
                      <iframe
                        key={`${video.videoId}-${soundOn ? "sound" : "muted"}`}
                        src={embedSrc}
                        title={video.title.trim() || "YouTube video"}
                        className="bts-yt-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                      <div className="bts-yt-chrome-mask" aria-hidden />
                    </div>
                  ) : (
                    <img
                      src={youTubeThumbnailUrl(video.videoId)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  {video.title.trim() ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-16">
                      <p className="text-sm font-medium leading-snug text-zinc-50 drop-shadow-sm">
                        {video.title}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {index < videos.length - 1 ? (
                <p
                  className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-zinc-500/80"
                  aria-hidden
                >
                  {t.btsSwipeHint}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-20 flex flex-col items-center gap-3">
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
                  i === activeIndex ? "scale-125 bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
