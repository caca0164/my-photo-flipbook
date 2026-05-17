"use client";

import { signOutAction } from "@/app/actions/auth";
import type { AlbumFlipCoverSettings } from "@/lib/album-types";
import { useNavOpen } from "@/app/components/NavOpenContext";
import { coverFontCssFamily, coverFontsStylesheetHref } from "@/lib/cover-fonts";
import { coverTitleGradientTextStyle } from "@/lib/cover-gold-presets";
import { messages, withLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/** Match `FlipBook` breakpoint: at or below = phone layout. */
const DESKTOP_MIN_WIDTH_PX = 768;

function isFlipbookHome(pathname: string | null, locale: Locale): boolean {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, "") || "/";
  return n === `/${locale}`;
}

function subscribeDesktopMq(cb: () => void) {
  const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getDesktopMq(): boolean {
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`).matches;
}

type AuthMe = {
  user: { email: string | null } | null;
  isAdmin: boolean;
  /** @deprecated use unreadMemberChatCount */
  unreadMessageCount?: number;
  unreadMemberChatCount?: number;
  unreadAdminChatCount?: number;
  btsPageHidden?: boolean;
};

function NavUnreadBadge({ count, ariaTemplate }: { count: number; ariaTemplate: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="min-w-[1.25rem] shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white tabular-nums"
      aria-label={ariaTemplate.replace("{n}", String(count))}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function localeFromPath(pathname: string | null): Locale {
  if (!pathname) return "en";
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "zh" ? "zh" : "en";
}

export default function SideNav({
  initialFlipCover,
  initialBtsPageHidden,
}: {
  initialFlipCover: AlbumFlipCoverSettings;
  initialBtsPageHidden: boolean;
}) {
  const { navOpen: open, setNavOpen: setOpen } = useNavOpen();
  const pathname = usePathname();
  const locale = useMemo(() => localeFromPath(pathname), [pathname]);
  const t = messages[locale];
  const [me, setMe] = useState<AuthMe | null>(null);

  const isDesktop = useSyncExternalStore(
    subscribeDesktopMq,
    getDesktopMq,
    () => false,
  );

  const homePath = isFlipbookHome(pathname, locale);

  const prevPathRef = useRef<string | null>(null);
  const prevDeskRef = useRef(false);

  useEffect(() => {
    if (!homePath) {
      setOpen(false);
      prevPathRef.current = pathname;
      prevDeskRef.current = isDesktop;
      return;
    }
    if (!isDesktop) {
      prevPathRef.current = pathname;
      prevDeskRef.current = isDesktop;
      return;
    }

    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;
    const wasDesktop = prevDeskRef.current;
    prevDeskRef.current = isDesktop;

    const firstPaint = prevPath === null;
    const enteredHome = prevPath !== null && prevPath !== pathname;
    const becameDesktop = !wasDesktop && isDesktop;
    if (firstPaint || enteredHome || becameDesktop) {
      setOpen(true);
    }
  }, [homePath, isDesktop, pathname]);

  const navTitleFontPx = useMemo(
    () => Math.min(120, Math.max(14, Math.round(initialFlipCover.sideNavFontSizePx))),
    [initialFlipCover.sideNavFontSizePx],
  );

  const sideNavTitleTrimmed = initialFlipCover.sideNavTitleText.trim();
  const showSideNavTitle = sideNavTitleTrimmed.length > 0;
  const sideNavTitleAlignClass =
    initialFlipCover.sideNavTitleAlign === "center"
      ? "text-center"
      : initialFlipCover.sideNavTitleAlign === "right"
        ? "text-right"
        : "text-left";

  useEffect(() => {
    if (!open) return;
    const needFont =
      Boolean(initialFlipCover.sideNavFontPreset) && showSideNavTitle;
    const href = needFont
      ? coverFontsStylesheetHref([initialFlipCover.sideNavFontPreset])
      : null;
    if (!href) {
      document.getElementById("side-nav-menu-title-font")?.remove();
      return;
    }
    let link = document.getElementById("side-nav-menu-title-font") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "side-nav-menu-title-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
    return () => {
      document.getElementById("side-nav-menu-title-font")?.remove();
    };
  }, [open, initialFlipCover.sideNavFontPreset, showSideNavTitle]);

  useEffect(() => {
    let cancelled = false;
    const loadMe = () => {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => res.json())
        .then((data: AuthMe) => {
          if (!cancelled) setMe(data);
        })
        .catch(() => {
          if (!cancelled)
            setMe({
              user: null,
              isAdmin: false,
              unreadMessageCount: 0,
              unreadMemberChatCount: 0,
              unreadAdminChatCount: 0,
              btsPageHidden: false,
            });
        });
    };
    loadMe();
    const intervalId = window.setInterval(loadMe, 25_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadMe();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, initialBtsPageHidden]);

  const btsPageHidden = me?.btsPageHidden ?? initialBtsPageHidden;
  const showBtsNavLink = !btsPageHidden || me?.isAdmin === true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const enHref = useMemo(
    () => (pathname ? withLocale(pathname, "en") : "/en"),
    [pathname],
  );
  const zhHref = useMemo(
    () => (pathname ? withLocale(pathname, "zh") : "/zh"),
    [pathname],
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={t.navCloseMenu}
          className="fixed inset-0 z-[210] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="app-side-nav"
        className={`fixed inset-y-0 left-0 z-[220] flex w-[min(100vw-3rem,17rem)] flex-col border-r border-zinc-800 bg-zinc-950/98 shadow-2xl backdrop-blur-md transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="text-sm font-medium tracking-wide text-zinc-300">
            {t.navMenu}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            aria-label={t.navClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t.navFlipbookSection}
            </p>
            <Link
              href={`/${locale}`}
              scroll
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              {t.navAlbum}
            </Link>
            <Link
              href={`/${locale}/about`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              {t.navAbout}
            </Link>
            {showBtsNavLink ? (
              <Link
                href={`/${locale}/bts`}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm transition hover:bg-zinc-800 ${
                  btsPageHidden && me?.isAdmin
                    ? "text-amber-200/80"
                    : "text-zinc-200"
                }`}
              >
                {t.navBts}
                {btsPageHidden && me?.isAdmin ? (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-400/70">
                    {t.navBtsAdminOnlyBadge}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t.navMember}
            </p>
            {me?.user ? (
              <div className="flex flex-col gap-2">
                <p className="truncate px-3 text-xs text-zinc-500">
                  {me.user.email}
                </p>
                <Link
                  href={`/${locale}/member/bookings`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  {t.navMemberBookings}
                </Link>
                <Link
                  href={`/${locale}/member/chat`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  <span>{t.navMemberChat}</span>
                  <NavUnreadBadge
                    count={me.unreadMemberChatCount ?? me.unreadMessageCount ?? 0}
                    ariaTemplate={t.navMemberMessagesUnreadAria}
                  />
                </Link>
                <form action={signOutAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                  >
                    {t.navLogout}
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href={`/${locale}/login`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                {t.navMemberAuth}
              </Link>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t.navShop}
            </p>
            <Link
              href={`/${locale}/store`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              {t.navStore}
            </Link>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {t.navBookingSection}
            </p>
            <Link
              href={`/${locale}/booking`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              {t.navBooking}
            </Link>
            {!me?.user ? (
              <Link
                href={`/${locale}/chat`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                {t.navGuestChat}
              </Link>
            ) : null}
          </div>

          {me?.isAdmin ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t.navAdminSection}
              </p>
              <Link
                href={`/${locale}/admin`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-amber-200/90 transition hover:bg-zinc-800"
              >
                {t.navAdminHubEntry}
              </Link>
              <Link
                href={`/${locale}/admin/chat`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-amber-200/90 transition hover:bg-zinc-800"
              >
                <span>{t.navAdminChat}</span>
                <NavUnreadBadge
                  count={me.unreadAdminChatCount ?? 0}
                  ariaTemplate={t.navAdminChatUnreadAria}
                />
              </Link>
            </div>
          ) : null}

          <div className="mt-auto">
            {showSideNavTitle ? (
              <div className={`w-full self-stretch px-0 pb-4 ${sideNavTitleAlignClass}`}>
                <div
                  className="flip-cover-title flip-cover-title--side-nav max-w-full whitespace-pre-wrap break-words leading-snug"
                  style={{
                    fontFamily: coverFontCssFamily(initialFlipCover.sideNavFontPreset),
                    fontSize: navTitleFontPx,
                    opacity: initialFlipCover.sideNavTitleOpacity,
                    textAlign: initialFlipCover.sideNavTitleAlign,
                    ...coverTitleGradientTextStyle(initialFlipCover.sideNavTitleGoldPreset),
                  }}
                >
                  {sideNavTitleTrimmed}
                </div>
              </div>
            ) : null}

            <div className="border-t border-zinc-800 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                {t.langLabel}
              </p>
              <div className="flex gap-2">
                <Link
                  href={enHref}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    locale === "en"
                      ? "bg-zinc-800 font-medium text-white"
                      : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                  }`}
                >
                  English
                </Link>
                <Link
                  href={zhHref}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    locale === "zh"
                      ? "bg-zinc-800 font-medium text-white"
                      : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                  }`}
                >
                  中文
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="app-side-nav"
        className="fixed left-0 top-1/2 z-[230] flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-xl border border-l-0 border-zinc-700/80 bg-zinc-900/85 px-1.5 py-3 text-zinc-400 shadow-lg backdrop-blur-sm transition hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        <span className="sr-only">{open ? t.navCloseMenu : t.navOpenMenu}</span>
        <MenuChevronIcon open={open} />
      </button>
    </>
  );
}

function MenuChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`opacity-90 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
