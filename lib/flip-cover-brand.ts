/** Text cover: DB `font_size_px` = CSS font-size (px). — see `normalizeCoverTextFontSizePx`. */

import type { SideNavTitleAlign } from "./album-types";

/** Max stored characters for cover title (supports multiple lines). */
export const COVER_TITLE_MAX_LEN = 800;

const DEFAULT_COVER_TITLE = "Drew Poon";

/** Normalize line breaks; trim outer whitespace only; empty → default. */
export function normalizeCoverTitleText(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_COVER_TITLE;
  const t = raw.replace(/\r\n/g, "\n").trim();
  if (!t) return DEFAULT_COVER_TITLE;
  return t.slice(0, COVER_TITLE_MAX_LEN);
}

/** Side nav title: may be empty; same max length as cover title. */
export function normalizeSideNavTitleText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\r\n/g, "\n").trim().slice(0, COVER_TITLE_MAX_LEN);
}

/** DB `title_opacity` = 0…1 for the gold title layer. */
export function normalizeTitleOpacity(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

export function normalizeCoverTextFontSizePx(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 48;
  if (n >= 150) return Math.min(120, Math.max(28, Math.round(n / 5)));
  return Math.min(120, Math.max(24, Math.round(n)));
}

/** Side drawer title: CSS font-size (px), slightly smaller floor than cover. */
export function normalizeSideNavFontSizePx(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 22;
  return Math.min(120, Math.max(14, Math.round(n)));
}

export function normalizeSideNavTitleAlign(raw: unknown): SideNavTitleAlign {
  if (raw === "center" || raw === "right") return raw;
  return "left";
}
