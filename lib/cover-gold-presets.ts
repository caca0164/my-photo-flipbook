/** Gold / metallic paint gradients for the flipbook cover title (CSS `background` values). */

export type CoverGoldPreset = {
  id: string;
  labelEn: string;
  labelZh: string;
  /** Full value for `background:` (linear-gradient…) */
  gradient: string;
};

export const COVER_GOLD_PRESETS: CoverGoldPreset[] = [
  { id: "gold_01", labelEn: "Classic gold", labelZh: "經典金", gradient: "linear-gradient(160deg,#fff9ec 0%,#e8c76b 22%,#d4af37 40%,#f0deb0 55%,#b8891a 72%,#f5e6b8 100%)" },
  { id: "gold_02", labelEn: "Warm honey", labelZh: "蜜金", gradient: "linear-gradient(145deg,#fff4d6 0%,#f0c14d 30%,#d4a017 55%,#ffe8a8 80%,#c99500 100%)" },
  { id: "gold_03", labelEn: "Pale champagne", labelZh: "香檳淡金", gradient: "linear-gradient(170deg,#fffef5 0%,#f5e6c8 35%,#e0c9a0 60%,#fff8e7 100%)" },
  { id: "gold_04", labelEn: "Deep antique", labelZh: "古銅深金", gradient: "linear-gradient(155deg,#c9a227 0%,#8b6914 40%,#d4af37 65%,#5c4a0a 100%)" },
  { id: "gold_05", labelEn: "Rose gold", labelZh: "玫瑰金", gradient: "linear-gradient(165deg,#fff0f0 0%,#e8b4b8 28%,#c48a8e 52%,#f5d0d4 78%,#b87a7e 100%)" },
  { id: "gold_06", labelEn: "Copper flame", labelZh: "赤銅金", gradient: "linear-gradient(150deg,#ffd4a8 0%,#d97836 35%,#b85c1f 60%,#f4a460 100%)" },
  { id: "gold_07", labelEn: "Green gold", labelZh: "青金", gradient: "linear-gradient(158deg,#f5ffe8 0%,#c4d67a 30%,#9aab3a 55%,#e8f0b8 100%)" },
  { id: "gold_08", labelEn: "Lemon bright", labelZh: "亮檸金", gradient: "linear-gradient(140deg,#fffacd 0%,#ffec8b 25%,#ffd700 50%,#fff8dc 100%)" },
  { id: "gold_09", labelEn: "Sunset amber", labelZh: "琥珀夕金", gradient: "linear-gradient(175deg,#ffe4c4 0%,#ffb347 40%,#cc7722 70%,#ffd59a 100%)" },
  { id: "gold_10", labelEn: "Platinum frost", labelZh: "鉑白霜金", gradient: "linear-gradient(165deg,#f8fafc 0%,#e2e8f0 35%,#cbd5e1 55%,#fefce8 90%,#94a3b8 100%)" },
  { id: "gold_11", labelEn: "Imperial yellow", labelZh: "御黃金", gradient: "linear-gradient(152deg,#fff8dc 0%,#f0d060 30%,#daa520 55%,#b8860b 100%)" },
  { id: "gold_12", labelEn: "Burnished bronze", labelZh: "磨銅金", gradient: "linear-gradient(168deg,#d4a574 0%,#8b5a2b 45%,#cd853f 75%,#5c3d1e 100%)" },
  { id: "gold_13", labelEn: "Silk moon", labelZh: "月絲金", gradient: "linear-gradient(180deg,#faf8f3 0%,#e8dcc4 50%,#c4b59a 100%)" },
  { id: "gold_14", labelEn: "Molten core", labelZh: "熔芯金", gradient: "linear-gradient(135deg,#ffd700 0%,#ff8c00 40%,#b8860b 100%)" },
  { id: "gold_15", labelEn: "Olive gilt", labelZh: "橄欖鎏金", gradient: "linear-gradient(160deg,#f5f5dc 0%,#bdb76b 40%,#6b8e23 70%,#eee8aa 100%)" },
  { id: "gold_16", labelEn: "Peach gilt", labelZh: "蜜桃鎏金", gradient: "linear-gradient(155deg,#fff5ee 0%,#ffdab9 35%,#f4a460 60%,#deb887 100%)" },
  { id: "gold_17", labelEn: "Teal edge", labelZh: "青邊金", gradient: "linear-gradient(165deg,#fffef0 0%,#d4af37 40%,#2dd4bf 85%,#d4af37 100%)" },
  { id: "gold_18", labelEn: "Wine & gold", labelZh: "酒紅金", gradient: "linear-gradient(150deg,#f5e6d3 0%,#d4af37 35%,#722f37 70%,#e8c547 100%)" },
  { id: "gold_19", labelEn: "Arctic gold", labelZh: "極地金", gradient: "linear-gradient(170deg,#f0f9ff 0%,#e0f2fe 30%,#bae6fd 55%,#fde68a 90%,#94a3b8 100%)" },
  { id: "gold_20", labelEn: "Graphite gold", labelZh: "石墨金", gradient: "linear-gradient(158deg,#e7e5e4 0%,#d4af37 45%,#57534e 80%,#fcd34d 100%)" },
  { id: "gold_21", labelEn: "Soft butter", labelZh: "奶油金", gradient: "linear-gradient(175deg,#fffbeb 0%,#fde68a 50%,#d97706 100%)" },
  { id: "gold_22", labelEn: "Crimson leaf", labelZh: "秋葉赤金", gradient: "linear-gradient(160deg,#fff8e7 0%,#eab308 40%,#b45309 75%,#fcd34d 100%)" },
  { id: "gold_23", labelEn: "Lilac mist", labelZh: "紫霧金", gradient: "linear-gradient(165deg,#faf5ff 0%,#e9d5ff 35%,#d4af37 60%,#c4b5fd 100%)" },
  { id: "gold_24", labelEn: "Sage gilt", labelZh: "鼠尾草金", gradient: "linear-gradient(155deg,#f7fee7 0%,#d4af37 40%,#84cc16 75%,#eab308 100%)" },
  { id: "gold_25", labelEn: "Midnight gilt", labelZh: "午夜鎏金", gradient: "linear-gradient(145deg,#fef3c7 0%,#d4af37 35%,#1e293b 70%,#fbbf24 100%)" },
  { id: "gold_26", labelEn: "Sand dune", labelZh: "沙丘金", gradient: "linear-gradient(170deg,#fffaf0 0%,#edc9af 40%,#c19a6b 70%,#f5deb3 100%)" },
  { id: "gold_27", labelEn: "Verdigris patina", labelZh: "銅綠古金", gradient: "linear-gradient(160deg,#ecfdf5 0%,#d4af37 40%,#0d9488 72%,#fcd34d 100%)" },
  { id: "gold_28", labelEn: "Royal purple", labelZh: "紫金", gradient: "linear-gradient(150deg,#fefce8 0%,#facc15 35%,#6b21a8 68%,#fde047 100%)" },
  { id: "gold_29", labelEn: "Steel blue gold", labelZh: "鋼藍金", gradient: "linear-gradient(168deg,#f8fafc 0%,#d4af37 42%,#3b82f6 75%,#e2e8f0 100%)" },
  { id: "gold_30", labelEn: "Ink wash gold", labelZh: "水墨金", gradient: "linear-gradient(175deg,#fafaf9 0%,#d6d3d1 25%,#d4af37 50%,#292524 85%,#f5f5f4 100%)" },
];

const GOLD_IDS = new Set(COVER_GOLD_PRESETS.map((p) => p.id));

export function isTitleGoldPreset(id: string): boolean {
  return GOLD_IDS.has(id);
}

export function coverGoldGradientCss(presetId: string): string {
  const p = COVER_GOLD_PRESETS.find((x) => x.id === presetId);
  return p?.gradient ?? COVER_GOLD_PRESETS[0].gradient;
}

/**
 * Use `backgroundImage` (not `background` shorthand) so `background-clip: text` is not reset.
 * Spread onto the element that also carries font size / opacity.
 */
export function coverTitleGradientTextStyle(presetId: string): {
  backgroundImage: string;
  WebkitBackgroundClip: "text";
  backgroundClip: "text";
  WebkitTextFillColor: "transparent";
  color: "transparent";
} {
  return {
    backgroundImage: coverGoldGradientCss(presetId),
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

/** Valid stored preset id or default `gold_01`. */
export function normalizeTitleGoldPreset(raw: unknown): string {
  if (typeof raw === "string" && GOLD_IDS.has(raw)) return raw;
  return COVER_GOLD_PRESETS[0].id;
}
