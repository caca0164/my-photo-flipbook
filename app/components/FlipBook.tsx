"use client";

import type { AlbumFlipCoverSettings, FlipBookPage } from "@/lib/album-types";
import { coverFontCssFamily, coverFontsStylesheetHref } from "@/lib/cover-fonts";
import { coverTitleGradientTextStyle } from "@/lib/cover-gold-presets";
import { useNavOpen } from "@/app/components/NavOpenContext";
import { isLocale, messages, type Locale } from "@/lib/i18n";
import { PageFlip } from "page-flip";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type PageFlipWithEvents = PageFlip & {
  on(eventName: string, callback: (e: { data: unknown }) => void): PageFlip;
  off(eventName: string): PageFlip;
  getCurrentPageIndex(): number;
};

/** Runtime API on `PageFlip`; not declared in the package’s published typings. */
type PageFlipWithRender = PageFlip & {
  getRender(): {
    getRect(): { left: number; top: number; width: number; pageWidth: number; height: number };
    convertToBook(pos: { x: number; y: number }): { x: number; y: number };
  };
  getPageCollection(): {
    getCurrentSpreadIndex(): number;
    getSpread(): number[][];
  };
};

const LAST_PAGE_SWIPE_PX = 30;
const LAST_PAGE_SWIPE_MS = 500;
const LAST_PAGE_DRAG_PX = 28;

function isOnLastSpread(instance: PageFlip, pageCount: number): boolean {
  try {
    const col = (instance as PageFlipWithRender).getPageCollection();
    const spreads = col.getSpread();
    if (spreads.length === 0) return false;
    return col.getCurrentSpreadIndex() >= spreads.length - 1;
  } catch {
    return (instance as PageFlipWithEvents).getCurrentPageIndex() >= pageCount - 1;
  }
}

function isForwardFlipAtPoint(
  instance: PageFlip,
  clientX: number,
  clientY: number,
  usePortrait: boolean,
): boolean {
  const render = (instance as PageFlipWithRender).getRender();
  const rect = render.getRect();
  const bookPos = render.convertToBook({ x: clientX, y: clientY });
  if (usePortrait) {
    return bookPos.x - rect.pageWidth > rect.width / 5;
  }
  return bookPos.x >= rect.width / 2;
}

function isBackwardFlipAtPoint(
  instance: PageFlip,
  clientX: number,
  clientY: number,
  usePortrait: boolean,
): boolean {
  return !isForwardFlipAtPoint(instance, clientX, clientY, usePortrait);
}


/** After album view + cover layout are ready, wait before revealing the title (ms). */
const COVER_TITLE_ENTER_DELAY_MS = 300;
/** Typewriter: per-character delay range (ms); higher = slower typing. */
const TYPEWRITER_MIN_MS = 36;
const TYPEWRITER_MAX_MS = 100;

const titleGlyphShadow =
  "0 0.08em 0.12em rgba(0, 0, 0, 0.45), 0 0 0.35em rgba(0, 0, 0, 0.35)";
const PHONE_MAX_CSS_PX = 767;

/** Must match FlipSetting.maxWidth passed to PageFlip (library caps spread at 2× this in stretch mode). */
const MAX_PAGE_WIDTH = 1200;

function usePhoneViewport() {
  const query = `(max-width: ${PHONE_MAX_CSS_PX}px)`;
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type FlipSettings = {
  width: number;
  height: number;
  size: "fixed" | "stretch";
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  drawShadow: boolean;
  flippingTime: number;
  usePortrait: boolean;
  mobileScrollSupport: boolean;
  showCover: boolean;
  maxShadowOpacity?: number;
};

function buildPageElement(p: FlipBookPage): HTMLElement {
  const page = document.createElement("div");
  page.className = "flip-page-paper";

  const mat = document.createElement("div");
  mat.className = "flip-photo-mat";

  if (p.kind === "image") {
    const print = document.createElement("div");
    print.className = "flip-photo-print";
    const img = document.createElement("img");
    img.src = p.src;
    img.alt = "";
    img.draggable = false;
    print.appendChild(img);
    mat.appendChild(print);
  } else {
    const print = document.createElement("div");
    print.className = "flip-photo-print flip-text-print";
    const body = document.createElement("div");
    body.className = "flip-text-body";
    body.textContent = p.body;
    print.appendChild(body);
    mat.appendChild(print);
  }

  page.appendChild(mat);
  return page;
}

function coverOverlayKey(c: AlbumFlipCoverSettings | null | undefined): string {
  if (!c) return "";
  return `${c.coverEnabled}:${c.fontPreset}:${c.titleText}:${c.fontSizePx}:${c.titleOpacity}:${c.titleGoldPreset}`;
}

export default function FlipBook({
  pages,
  coverOverlay,
  locale = "en",
  width = 800,
  height = 1131,
  ambient = false,
}: {
  pages: FlipBookPage[];
  coverOverlay?: AlbumFlipCoverSettings | null;
  locale?: string;
  width?: number;
  height?: number;
  /** Fixed backdrop (e.g. About page); no interaction, static cover title. */
  ambient?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const bookingNavLockRef = useRef(false);
  const mountKey = `${coverOverlayKey(coverOverlay)}\0${pages
    .map((p) => {
      if (p.kind === "image") return `${p.id}:${p.src}`;
      return `${p.id}:text:${p.body}`;
    })
    .join("\0")}`;

  const phoneViewport = usePhoneViewport();
  const { navOpen } = useNavOpen();
  const loc: Locale = isLocale(locale) ? locale : "en";
  const t = messages[loc];

  const [leftSlotOverlay, setLeftSlotOverlay] = useState(true);
  const [titleBlockEl, setTitleBlockEl] = useState<HTMLElement | null>(null);
  /** Pixel box for the left page of the spread inside `.stf__block` (library may inset the book). */
  const [titleSlotLayout, setTitleSlotLayout] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  /** True only after mount on album + delay; resets when leaving cover spread or remounting. */
  const [albumTitleEntered, setAlbumTitleEntered] = useState(false);
  /** Codepoint count revealed (Array.from length). */
  const [typewriterLen, setTypewriterLen] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLeftSlotOverlay(true));
    return () => cancelAnimationFrame(id);
  }, [mountKey]);

  useEffect(() => {
    if (!coverOverlay?.coverEnabled) {
      document.getElementById("flip-cover-font-link")?.remove();
      return;
    }
    const href = coverFontsStylesheetHref([coverOverlay.fontPreset]);
    if (!href) return;
    let link = document.getElementById("flip-cover-font-link") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "flip-cover-font-link";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
    return () => {
      document.getElementById("flip-cover-font-link")?.remove();
    };
  }, [coverOverlay?.coverEnabled, coverOverlay?.fontPreset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pages.length === 0) return;

    let instance: PageFlip | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let flipBlock: HTMLElement | null = null;
    let pointerStart: {
      x: number;
      y: number;
      t: number;
      wasOnLastSpread: boolean;
    } | null = null;

    const goToBooking = () => {
      if (ambient || bookingNavLockRef.current) return;
      bookingNavLockRef.current = true;
      router.push(`/${loc}/booking`);
    };

    const isEventOnBook = (e: PointerEvent) => {
      const host = containerRef.current;
      if (!host || !(e.target instanceof Node)) return false;
      return host.contains(e.target);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (ambient || !instance || e.button !== 0 || !isEventOnBook(e)) return;
      pointerStart = {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
        wasOnLastSpread: isOnLastSpread(instance, pages.length),
      };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (ambient || !instance) return;
      const start = pointerStart;
      pointerStart = null;
      if (!start?.wasOnLastSpread || e.button !== 0) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const elapsed = Date.now() - start.t;
      const isSwipe =
        Math.abs(dx) > LAST_PAGE_SWIPE_PX &&
        Math.abs(dy) < LAST_PAGE_SWIPE_PX * 2 &&
        elapsed < LAST_PAGE_SWIPE_MS;
      const isTap = Math.abs(dx) < 14 && Math.abs(dy) < 14;

      if (isSwipe && dx > 0) return;
      if (isTap && isBackwardFlipAtPoint(instance, e.clientX, e.clientY, phoneViewport)) return;

      const forward =
        (isSwipe && dx < 0) ||
        (isTap && isForwardFlipAtPoint(instance, e.clientX, e.clientY, phoneViewport)) ||
        dx < -LAST_PAGE_DRAG_PX ||
        (!isTap &&
          isForwardFlipAtPoint(instance, start.x, start.y, phoneViewport) &&
          dx < 0);

      if (forward) goToBooking();
    };

    const syncTitleSlotLayout = () => {
      if (cancelled || !instance) return;
      try {
        const r = (instance as PageFlipWithRender).getRender().getRect();
        setTitleSlotLayout({
          left: r.left,
          top: r.top,
          width: r.pageWidth,
          height: r.height,
        });
      } catch {
        setTitleSlotLayout(null);
      }
    };

    const viewportH =
      typeof window !== "undefined"
        ? Math.ceil(window.innerHeight || document.documentElement.clientHeight)
        : 900;

    const settings: FlipSettings = {
      width,
      height,
      size: "stretch",
      minWidth: 300,
      maxWidth: MAX_PAGE_WIDTH,
      minHeight: 400,
      maxHeight: Math.max(400, viewportH),
      drawShadow: true,
      flippingTime: 1000,
      usePortrait: phoneViewport,
      mobileScrollSupport: true,
      showCover: true,
      maxShadowOpacity: 0.55,
    };

    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    container.style.height = "100%";
    container.appendChild(mount);

    const domPages = pages.map((p) => buildPageElement(p));

    const onFlip = (e: { data: unknown }) => {
      if (cancelled) return;
      const idx = typeof e.data === "number" ? e.data : 0;
      setLeftSlotOverlay(idx === 0);
      queueMicrotask(syncTitleSlotLayout);
    };

    const syncStackMinHeight = () => {
      const host = containerRef.current;
      const stack = host?.parentElement;
      if (!host || !stack?.classList.contains("flip-cover-book-stack")) return;
      if (!ambient) {
        (stack as HTMLElement).style.minHeight = "100%";
        host.style.minHeight = "100%";
        return;
      }
      const wrap = host.querySelector(".stf__wrapper") as HTMLElement | null;
      const hWrap = wrap?.getBoundingClientRect().height ?? 0;
      const hHost = host.getBoundingClientRect().height;
      const h = Math.max(hWrap, hHost, 120);
      (stack as HTMLElement).style.minHeight = `${Math.ceil(h)}px`;
    };

    const onWinResize = () => {
      try {
        instance?.update();
      } catch {
        /* ignore */
      }
      syncStackMinHeight();
      syncTitleSlotLayout();
    };

    const init = () => {
      if (cancelled || !container.isConnected) return;
      try {
        instance = new PageFlip(mount, settings);
        instance.loadFromHTML(domPages);
        const block = mount.querySelector(".stf__block");
        flipBlock = block instanceof HTMLElement ? block : null;
        setTitleBlockEl(flipBlock);
        if (!ambient) {
          window.addEventListener("pointerdown", onPointerDown, true);
          window.addEventListener("pointerup", onPointerUp, true);
          window.addEventListener("pointercancel", onPointerUp, true);
        }
        if (typeof ResizeObserver !== "undefined" && block instanceof HTMLElement) {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled) return;
            syncTitleSlotLayout();
            syncStackMinHeight();
          });
          resizeObserver.observe(block);
        }
        (instance as PageFlipWithEvents).on("flip", onFlip);
        (instance as PageFlipWithEvents).on("init", () => {
          if (cancelled) return;
          queueMicrotask(() => {
            syncStackMinHeight();
            syncTitleSlotLayout();
          });
        });
        queueMicrotask(() => {
          if (cancelled || !instance) return;
          setLeftSlotOverlay((instance as PageFlipWithEvents).getCurrentPageIndex() === 0);
          syncStackMinHeight();
          syncTitleSlotLayout();
        });
      } catch {
        setTitleBlockEl(null);
        setTitleSlotLayout(null);
        container.replaceChildren();
      }
    };

    window.addEventListener("resize", onWinResize);

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(init);
    });

    return () => {
      cancelled = true;
      bookingNavLockRef.current = false;
      pointerStart = null;
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      flipBlock = null;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("resize", onWinResize);
      resizeObserver?.disconnect();
      resizeObserver = null;
      setTitleSlotLayout(null);
      const host = containerRef.current;
      const stack = host?.parentElement;
      if (stack?.classList.contains("flip-cover-book-stack")) {
        (stack as HTMLElement).style.minHeight = "";
      }
      if (host) host.style.minHeight = "";
      try {
        (instance as PageFlipWithEvents | null)?.off("flip");
        (instance as PageFlipWithEvents | null)?.off("init");
      } catch {
        /* ignore */
      }
      try {
        instance?.destroy();
      } catch {
        /* ignore */
      }
      instance = null;
      setTitleBlockEl(null);
      container.replaceChildren();
    };
  }, [mountKey, width, height, phoneViewport, locale, ambient, loc, router, pages.length]);

  const showGoldOverlay = Boolean(
    coverOverlay?.coverEnabled && !phoneViewport && leftSlotOverlay && pages.length > 0,
  );

  const coverTitle = useMemo(
    () =>
      coverOverlay?.titleText?.trim()
        ? (coverOverlay.titleText ?? "").replace(/\r\n/g, "\n")
        : "Drew Poon",
    [coverOverlay?.titleText],
  );
  const titleChars = useMemo(() => Array.from(coverTitle), [coverTitle]);

  useEffect(() => {
    if (!showGoldOverlay || !titleSlotLayout || navOpen) {
      setAlbumTitleEntered(false);
      setTypewriterLen(0);
      return;
    }
    if (ambient) {
      setAlbumTitleEntered(true);
      setTypewriterLen(titleChars.length);
      return;
    }
    setAlbumTitleEntered(false);
    setTypewriterLen(0);
    const t = window.setTimeout(() => setAlbumTitleEntered(true), COVER_TITLE_ENTER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [showGoldOverlay, titleSlotLayout, mountKey, coverTitle, navOpen, ambient, titleChars.length]);

  useEffect(() => {
    if (!albumTitleEntered) {
      setTypewriterLen(0);
      return;
    }
    if (ambient) {
      setTypewriterLen(titleChars.length);
      return;
    }
    const n = titleChars.length;
    if (n === 0) {
      setTypewriterLen(0);
      return;
    }
    setTypewriterLen(0);
    const stepMs = Math.max(
      TYPEWRITER_MIN_MS,
      Math.min(TYPEWRITER_MAX_MS, Math.round(1550 / Math.max(n, 8))),
    );
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= n) {
        setTypewriterLen(n);
        window.clearInterval(id);
      } else {
        setTypewriterLen(i);
      }
    }, stepMs);
    return () => window.clearInterval(id);
  }, [albumTitleEntered, coverTitle, ambient, titleChars.length]);

  const vhFull = "min(100dvh, 100svh)";
  const spreadMaxCss = `${2 * MAX_PAGE_WIDTH}px`;
  const fitMaxWidth = phoneViewport
    ? `min(100vw, ${spreadMaxCss}, calc(${vhFull} * ${width} / ${height}))`
    : `min(100vw, ${spreadMaxCss}, calc(${vhFull} * ${2 * width} / ${height}))`;

  if (pages.length === 0) {
    return (
      <div
        className={
          ambient
            ? "pointer-events-none fixed inset-0 flex h-[100dvh] items-stretch justify-center bg-transparent"
            : "flex h-[min(100dvh,100svh)] items-stretch justify-center bg-zinc-950"
        }
      >
        {ambient ? null : t.flipEmptyNoPages}
      </div>
    );
  }

  const titleFontPx = Math.min(120, Math.max(24, Math.round(coverOverlay?.fontSizePx ?? 48) || 48));
  const titleOpacity = Math.min(1, Math.max(0, coverOverlay?.titleOpacity ?? 1));
  const typewriterDone = typewriterLen >= titleChars.length && titleChars.length > 0;
  const typewriterVisible = titleChars.slice(0, typewriterLen).join("");
  const showTypeCaret =
    !ambient && albumTitleEntered && !typewriterDone && titleChars.length > 0;

  const outerClass = ambient
    ? "pointer-events-none fixed inset-0 z-0 flex h-[100dvh] w-full items-stretch justify-center overflow-hidden bg-transparent"
    : "box-border flex h-[min(100dvh,100svh)] w-full flex-col items-stretch overflow-hidden bg-zinc-950";

  return (
    <div className={outerClass}>
      <div
        className="relative mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden shadow-2xl ring-1 ring-black/20"
        style={{
          maxWidth: ambient ? fitMaxWidth : "100%",
          width: ambient ? undefined : "100%",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 2px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <div
          className="flip-cover-book-stack mx-auto h-full min-h-0 w-full"
          style={{ maxWidth: fitMaxWidth }}
        >
          <div
            ref={containerRef}
            className="flip-cover-book-mount relative z-0 h-full min-h-0 w-full"
            aria-busy="true"
            aria-label={t.navAlbum}
          />
          {titleBlockEl && titleSlotLayout && showGoldOverlay && coverOverlay
            ? createPortal(
                <div
                  className="flip-cover-title-slot"
                  style={{
                    left: titleSlotLayout.left,
                    top: titleSlotLayout.top,
                    width: titleSlotLayout.width,
                    height: titleSlotLayout.height,
                  }}
                >
                  <div
                    className="flip-cover-title text-center"
                    style={{
                      fontFamily: coverFontCssFamily(coverOverlay.fontPreset),
                      fontSize: `${titleFontPx}px`,
                      opacity: titleOpacity,
                    }}
                    aria-live="polite"
                  >
                    {albumTitleEntered ? (
                      <>
                        <span
                          className="inline align-middle"
                          style={{
                            ...coverTitleGradientTextStyle(coverOverlay.titleGoldPreset),
                            textShadow: titleGlyphShadow,
                          }}
                        >
                          {typewriterVisible}
                        </span>
                        {showTypeCaret ? (
                          <span
                            className="flip-cover-title__caret ml-[0.06em] inline-block h-[0.82em] w-[2px] shrink-0 animate-pulse rounded-sm bg-amber-100/90 align-middle"
                            aria-hidden
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>,
                titleBlockEl,
              )
            : null}
        </div>
      </div>
    </div>
  );
}
