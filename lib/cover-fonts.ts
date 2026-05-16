/** Preset faces for the flipbook cover (Google Fonts). */

export type CoverFontPreset = {
  id: string;
  labelEn: string;
  labelZh: string;
  /** `family` query value for Google Fonts CSS2 API */
  googleParam: string;
  /** Safe `font-family` stack for the page */
  cssFamily: string;
};

export const COVER_FONT_PRESETS: CoverFontPreset[] = [
  {
    id: "zhi_mang_xing",
    labelEn: "Zhi Mang Xing (brush)",
    labelZh: "志莽行體（行書）",
    googleParam: "Zhi+Mang+Xing",
    cssFamily: '"Zhi Mang Xing", "STKaiti", "KaiTi", "Noto Serif TC", serif',
  },
  {
    id: "long_cang",
    labelEn: "Long Cang (running script)",
    labelZh: "龍倉行書",
    googleParam: "Long+Cang",
    cssFamily: '"Long Cang", "STKaiti", "KaiTi", "Noto Serif TC", serif',
  },
  {
    id: "liu_jian_mao_cao",
    labelEn: "Liu Jian Mao Cao (cursive)",
    labelZh: "劉建毛草（草書）",
    googleParam: "Liu+Jian+Mao+Cao",
    cssFamily: '"Liu Jian Mao Cao", "STKaiti", "KaiTi", "Noto Serif TC", serif',
  },
  {
    id: "ma_shan_zheng",
    labelEn: "Ma Shan Zheng (brush)",
    labelZh: "馬善政楷筆",
    googleParam: "Ma+Shan+Zheng",
    cssFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", "Noto Serif TC", serif',
  },
  {
    id: "yuji_boku",
    labelEn: "Yuji Boku (ink)",
    labelZh: "Yuji Boku（墨意）",
    googleParam: "Yuji+Boku",
    cssFamily: '"Yuji Boku", "Hiragino Sans", "Yu Gothic", "Noto Serif TC", serif',
  },
  {
    id: "noto_serif_tc",
    labelEn: "Noto Serif TC (serif)",
    labelZh: "思源宋體 繁（端正）",
    googleParam: "Noto+Serif+TC:wght@600",
    cssFamily: '"Noto Serif TC", "Songti SC", "PMingLiU", serif',
  },
  {
    id: "great_vibes",
    labelEn: "Great Vibes (script)",
    labelZh: "Great Vibes（英文花體）",
    googleParam: "Great+Vibes",
    cssFamily: '"Great Vibes", "Snell Roundhand", "Brush Script MT", cursive',
  },
  {
    id: "allura",
    labelEn: "Allura (script)",
    labelZh: "Allura（英文花體）",
    googleParam: "Allura",
    cssFamily: '"Allura", "Snell Roundhand", "Brush Script MT", cursive',
  },
  {
    id: "noto_sans_jp",
    labelEn: "Noto Sans JP",
    labelZh: "Noto Sans 日文",
    googleParam: "Noto+Sans+JP:wght@400;700",
    cssFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Noto Sans TC", sans-serif',
  },
  {
    id: "lato",
    labelEn: "Lato",
    labelZh: "Lato",
    googleParam: "Lato:wght@400;700",
    cssFamily: '"Lato", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "dm_sans",
    labelEn: "DM Sans",
    labelZh: "DM Sans",
    googleParam: "DM+Sans:wght@400;700",
    cssFamily: '"DM Sans", system-ui, sans-serif',
  },
  {
    id: "roboto_slab",
    labelEn: "Roboto Slab",
    labelZh: "Roboto Slab",
    googleParam: "Roboto+Slab:wght@400;700",
    cssFamily: '"Roboto Slab", "Rockwell", "Noto Serif TC", serif',
  },
  {
    id: "crimson_text",
    labelEn: "Crimson Text",
    labelZh: "Crimson Text",
    googleParam: "Crimson+Text:ital,wght@0,400;0,600;1,400",
    cssFamily: '"Crimson Text", "Times New Roman", serif',
  },
  {
    id: "shadows_into_light",
    labelEn: "Shadows Into Light",
    labelZh: "Shadows Into Light",
    googleParam: "Shadows+Into+Light",
    cssFamily: '"Shadows Into Light", "Comic Sans MS", cursive',
  },
  {
    id: "goldman",
    labelEn: "Goldman",
    labelZh: "Goldman",
    googleParam: "Goldman:wght@400;700",
    cssFamily: '"Goldman", "Arial Narrow", sans-serif',
  },
  {
    id: "saira_stencil_one",
    labelEn: "Saira Stencil One",
    labelZh: "Saira Stencil One",
    googleParam: "Saira+Stencil+One",
    cssFamily: '"Saira Stencil One", "Impact", sans-serif',
  },
  {
    id: "syne",
    labelEn: "Syne",
    labelZh: "Syne",
    googleParam: "Syne:wght@400;700",
    cssFamily: '"Syne", system-ui, sans-serif',
  },
  {
    id: "yellowtail",
    labelEn: "Yellowtail",
    labelZh: "Yellowtail",
    googleParam: "Yellowtail",
    cssFamily: '"Yellowtail", "Brush Script MT", cursive',
  },
  {
    id: "zeyada",
    labelEn: "Zeyada",
    labelZh: "Zeyada",
    googleParam: "Zeyada",
    cssFamily: '"Zeyada", "Brush Script MT", cursive',
  },
  {
    id: "pt_sans_caption",
    labelEn: "PT Sans Caption",
    labelZh: "PT Sans Caption",
    googleParam: "PT+Sans+Caption:wght@400;700",
    cssFamily: '"PT Sans Caption", "Arial Narrow", sans-serif',
  },
  {
    id: "golos_text",
    labelEn: "Golos Text",
    labelZh: "Golos Text",
    googleParam: "Golos+Text:wght@400;600",
    cssFamily: '"Golos Text", system-ui, sans-serif',
  },
  {
    id: "gruppo",
    labelEn: "Gruppo",
    labelZh: "Gruppo",
    googleParam: "Gruppo",
    cssFamily: '"Gruppo", "Arial Narrow", sans-serif',
  },
];

const PRESET_IDS = new Set(COVER_FONT_PRESETS.map((p) => p.id));

export function isCoverFontPreset(id: string): boolean {
  return PRESET_IDS.has(id);
}

export function coverFontCssFamily(presetId: string): string {
  const p = COVER_FONT_PRESETS.find((x) => x.id === presetId);
  return p?.cssFamily ?? COVER_FONT_PRESETS[0].cssFamily;
}

/** Build one stylesheet href for all presets used on the cover page(s). */
export function coverFontsStylesheetHref(presetIds: string[]): string | null {
  const params = new Set<string>();
  for (const id of presetIds) {
    const p = COVER_FONT_PRESETS.find((x) => x.id === id);
    if (p) params.add(p.googleParam);
  }
  if (params.size === 0) return null;
  const q = [...params].map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
