"use client";

import type { BtsVideoSource } from "@/app/actions/bts";
import {
  cloudflareStreamIframeSrc,
  cloudflareStreamThumbnailUrl,
} from "@/lib/cloudflare-stream";
import { messages, type Locale } from "@/lib/i18n";
import { youTubeEmbedSrc, youTubeThumbnailUrl } from "@/lib/youtube";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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

const SCROLL_STYLE: CSSProperties = {
  scrollSnapType: "y mandatory",
  WebkitOverflowScrolling: "touch",
};

function btsPlayingEmbedSrc(video: BtsReelsItem): string {
  if (video.source === "cloudflare" && video.cloudflareStreamUid) {
    return cloudflareStreamIframeSrc(video.cloudflareStreamUid, {
      autoplay: true,
      muted: true,
      loop: true,
      controls: true,
    });
  }
  if (video.youtubeVideoId) {
    return youTubeEmbedSrc(video.youtubeVideoId, {
      autoplay: true,
      mute: true,
      loop: true,
      controls: true,
      enableJsApi: true,
    });
  }
  return "";
}

function applySoundToIframe(iframe: HTMLIFrameElement, video: BtsReelsItem, soundOn: boolean) {
  if (video.source === "youtube") {
    iframe.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: soundOn ? "unMute" : "mute",
        args: "",
      }),
      "*",
    );
    return;
  }

  if (video.source === "cloudflare") {
    void bindCloudflareStreamPlayer(iframe).then((player) => {
      if (player) player.muted = !soundOn;
    });
  }
}

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
  const slideSnapStyle: CSSProperties = {
    scrollSnapAlign: "start",
    scrollSnapStop: embedded ? "normal" : "always",
  };

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
    if (!isPlaying) return "";
    return btsPlayingEmbedSrc(video);
  }

  function renderVideoStage(video: BtsReelsItem, slideIndex: number) {
    const thumb = btsThumbnail(video);
    const isPlaying = slideIndex === playingIndex;
    const embedSrc = btsEmbedSrc(video, isPlaying);
    const eagerThumb = slideIndex === videoOffset;
    const playerKey =
      video.source === "cloudflare" ? video.cloudflareStreamUid : video.youtubeVideoId;

    return (
      <div className="bts-reels-stage">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            aria-hidden
            className="bts-reels-bg"
            loading={eagerThumb ? "eager" : "lazy"}
            decoding="async"
          />
        ) : null}
        <div className="bts-reels-video">
          {!isPlaying && thumb ? (
            <img
              src={thumb}
              alt=""
              aria-hidden
              className="absolute inset-0 z-[1] h-full w-full object-cover"
              loading={eagerThumb ? "eager" : "lazy"}
              decoding="async"
            />
          ) : null}
          {isPlaying && embedSrc ? (
            <BtsVideoIframe
              key={playerKey}
              video={video}
              embedSrc={embedSrc}
              title={video.title.trim() || "BTS video"}
              soundOn={soundOn}
            />
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
        style={slideSnapStyle}
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

        {index < videos.length - 1 ? <BtsSwipeHint label={t.btsSwipeHint} /> : null}
      </section>
    );
  });

  const soundControls =
    playingIndex >= videoOffset ? (
      <>
        <div
          className={`${
            embedded ? "fixed" : "absolute"
          } right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-30`}
        >
          <button
            type="button"
            onClick={toggleSound}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-zinc-200 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/70"
            aria-label={soundOn ? t.btsMute : t.btsUnmute}
            title={soundOn ? t.btsMute : t.btsUnmute}
          >
            {soundOn ? <VolumeOnIcon /> : <VolumeOffIcon />}
          </button>
        </div>
        {videos.length > 1 ? (
          <div
            className={`${
              embedded ? "fixed" : "absolute"
            } bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex flex-col gap-1.5`}
            aria-hidden
          >
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
      </>
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
            className="relative flex h-[100dvh] w-full shrink-0 flex-col justify-center overflow-hidden"
            style={slideSnapStyle}
            aria-current={playingIndex === 0 ? "true" : undefined}
          >
            <div className="max-h-full overflow-hidden">{leadingSlot}</div>
            {videos.length > 0 ? <BtsSwipeHint label={t.btsSwipeHint} /> : null}
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

function BtsVideoIframe({
  video,
  embedSrc,
  title,
  soundOn,
}: {
  video: BtsReelsItem;
  embedSrc: string;
  title: string;
  soundOn: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    applySoundToIframe(iframe, video, soundOn);
  }, [soundOn, video]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title}
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
        onLoad={(event) => {
          applySoundToIframe(event.currentTarget, video, soundOn);
        }}
      />
    </div>
  );
}

type CloudflareStreamPlayer = { muted: boolean };

declare global {
  interface Window {
    Stream?: (element: HTMLIFrameElement) => CloudflareStreamPlayer;
  }
}

let streamSdkPromise: Promise<void> | null = null;

function loadCloudflareStreamSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Stream) return Promise.resolve();
  if (!streamSdkPromise) {
    streamSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Cloudflare Stream SDK failed to load"));
      document.head.appendChild(script);
    });
  }
  return streamSdkPromise;
}

const cloudflarePlayerCache = new WeakMap<HTMLIFrameElement, CloudflareStreamPlayer>();

async function bindCloudflareStreamPlayer(
  iframe: HTMLIFrameElement,
): Promise<CloudflareStreamPlayer | null> {
  const cached = cloudflarePlayerCache.get(iframe);
  if (cached) return cached;
  try {
    await loadCloudflareStreamSdk();
    if (!window.Stream) return null;
    const player = window.Stream(iframe);
    cloudflarePlayerCache.set(iframe, player);
    return player;
  } catch {
    return null;
  }
}

function BtsSwipeHint({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-zinc-500/80"
      aria-hidden
    >
      <p className="text-[10px] uppercase tracking-widest">{label}</p>
      <ChevronDownIcon />
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function VolumeOnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}
