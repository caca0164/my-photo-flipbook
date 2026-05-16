export type FlipBookPage =
  | { id: string; kind: "image"; src: string }
  | { id: string; kind: "text"; body: string };

/** Horizontal alignment for the gold title in the side drawer (above Languages). */
export type SideNavTitleAlign = "left" | "center" | "right";

export type AlbumFlipCoverSettings = {
  coverEnabled: boolean;
  titleText: string;
  fontPreset: string;
  /** CSS font-size for the gold title on the first spread (px). */
  fontSizePx: number;
  /** 0 = invisible, 1 = fully opaque (CSS opacity on the title). */
  titleOpacity: number;
  /** One of `COVER_GOLD_PRESETS` ids (e.g. gold_01). */
  titleGoldPreset: string;
  /** Side drawer gold title (text + styling independent from home cover). */
  sideNavTitleText: string;
  sideNavFontPreset: string;
  sideNavFontSizePx: number;
  sideNavTitleOpacity: number;
  sideNavTitleGoldPreset: string;
  sideNavTitleAlign: SideNavTitleAlign;
};
