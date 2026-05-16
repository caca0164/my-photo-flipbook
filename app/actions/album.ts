"use server";

import type { AlbumFlipCoverSettings, FlipBookPage, SideNavTitleAlign } from "@/lib/album-types";
import { isCoverFontPreset } from "@/lib/cover-fonts";
import {
  normalizeTitleGoldPreset,
} from "@/lib/cover-gold-presets";
import {
  normalizeCoverTextFontSizePx,
  normalizeCoverTitleText,
  normalizeSideNavFontSizePx,
  normalizeSideNavTitleAlign,
  normalizeSideNavTitleText,
  normalizeTitleOpacity,
} from "@/lib/flip-cover-brand";
import { createClient } from "@/lib/supabase/server";
import { flipbookPublicUrl } from "@/lib/storage/public-url";
import { locales } from "@/lib/i18n";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

/** Home flipbook + side nav read from `[locale]/layout`; must invalidate these layouts after mutations. */
function revalidateAlbumPublicSurfaces() {
  for (const loc of locales) {
    revalidatePath(`/${loc}`, "layout");
  }
  revalidatePath("/", "layout");
}

async function requireAdminAlbum(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Forbidden" as const, user: null };
  return { error: null as null, user };
}

/** After client uploads to Storage, register one image page. */
export async function registerAlbumImage(storagePath: string) {
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) {
    return { error: "Invalid path" };
  }

  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: lastRow } = await supabase
    .from("album_images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastRow?.sort_order ?? 0) + 1;

  const { error: insErr } = await supabase.from("album_images").insert({
    page_kind: "image",
    storage_path: storagePath,
    body_text: "",
    sort_order: sortOrder,
  });

  if (insErr) {
    await supabase.storage.from("flipbook").remove([storagePath]);
    return { error: insErr.message };
  }

  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

/** Blank or caption page (no storage object). */
export async function addAlbumTextPage(bodyText: string) {
  const text = bodyText.slice(0, 12000);
  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: lastRow } = await supabase
    .from("album_images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastRow?.sort_order ?? 0) + 1;

  const { error: insErr } = await supabase.from("album_images").insert({
    page_kind: "text",
    storage_path: null,
    body_text: text,
    sort_order: sortOrder,
  });

  if (insErr) return { error: insErr.message };
  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

export async function updateAlbumTextPage(id: string, bodyText: string) {
  const text = bodyText.slice(0, 12000);
  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: row } = await supabase
    .from("album_images")
    .select("page_kind")
    .eq("id", id)
    .single();

  if (!row || row.page_kind !== "text") return { error: "Not a text page" };

  const { error } = await supabase
    .from("album_images")
    .update({ body_text: text })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

/** Full ordered id list from the admin UI (e.g. after drag-and-drop). */
export async function reorderAlbumPages(orderedIds: string[]) {
  if (!orderedIds.length) return { error: "Empty order" };

  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: existing } = await supabase.from("album_images").select("id");
  if (!existing?.length) return { error: "No pages" };

  const setIds = new Set(existing.map((e) => e.id));
  if (orderedIds.length !== setIds.size || !orderedIds.every((id) => setIds.has(id))) {
    return { error: "Order must include every page exactly once" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("album_images")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }

  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

export async function moveAlbumPage(id: string, direction: "up" | "down") {
  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: rows, error: listErr } = await supabase
    .from("album_images")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });

  if (listErr || !rows?.length) return { error: listErr?.message ?? "No pages" };

  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return { error: "Not found" };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true as const };

  const a = rows[i];
  const b = rows[j];
  const sa = a.sort_order;
  const sb = b.sort_order;

  await supabase.from("album_images").update({ sort_order: sb }).eq("id", a.id);
  await supabase.from("album_images").update({ sort_order: sa }).eq("id", b.id);

  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

export async function deleteAlbumImage(id: string) {
  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const { data: row } = await supabase
    .from("album_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!row) return { error: "Not found" };

  if (row.storage_path) {
    await supabase.storage.from("flipbook").remove([row.storage_path]);
  }
  await supabase.from("album_images").delete().eq("id", id);

  revalidateAlbumPublicSurfaces();
  return { ok: true as const };
}

export type AlbumRow = {
  id: string;
  page_kind: "image" | "text";
  storage_path: string | null;
  body_text: string;
  sort_order: number;
};

export async function listAlbumPagesForPublic(): Promise<FlipBookPage[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("album_images")
    .select("id, page_kind, storage_path, body_text, sort_order")
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return [];

  const pages: FlipBookPage[] = [];
  for (const r of data) {
    if (r.page_kind === "text") {
      pages.push({ id: r.id, kind: "text", body: r.body_text ?? "" });
    } else if (r.storage_path) {
      pages.push({
        id: r.id,
        kind: "image",
        src: flipbookPublicUrl(r.storage_path),
      });
    }
  }
  return pages;
}

export async function listAlbumImagesAdmin(): Promise<AlbumRow[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("album_images")
    .select("id, page_kind, storage_path, body_text, sort_order")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    page_kind: r.page_kind === "text" ? "text" : "image",
    storage_path: r.storage_path,
    body_text: r.body_text ?? "",
    sort_order: r.sort_order,
  }));
}

const DEFAULT_FLIP_COVER: AlbumFlipCoverSettings = {
  coverEnabled: true,
  titleText: "Drew Poon",
  fontPreset: "zhi_mang_xing",
  fontSizePx: 48,
  titleOpacity: 1,
  titleGoldPreset: "gold_01",
  sideNavTitleText: "",
  sideNavFontPreset: "zhi_mang_xing",
  sideNavFontSizePx: 22,
  sideNavTitleOpacity: 1,
  sideNavTitleGoldPreset: "gold_01",
  sideNavTitleAlign: "left",
};

export async function getAlbumFlipCoverPublic(): Promise<AlbumFlipCoverSettings> {
  noStore();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return DEFAULT_FLIP_COVER;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("album_flip_cover")
    .select(
      "cover_enabled, title_text, font_preset, font_size_px, title_opacity, title_gold_preset, side_nav_title_text, side_nav_font_preset, side_nav_font_size_px, side_nav_title_opacity, side_nav_title_gold_preset, side_nav_title_align",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_FLIP_COVER;

  const fontPreset =
    typeof data.font_preset === "string" && isCoverFontPreset(data.font_preset)
      ? data.font_preset
      : DEFAULT_FLIP_COVER.fontPreset;

  const fontSizePx = normalizeCoverTextFontSizePx(data.font_size_px);
  const titleOpacity = normalizeTitleOpacity(data.title_opacity);
  const titleGoldPreset = normalizeTitleGoldPreset(data.title_gold_preset);

  const titleText = normalizeCoverTitleText(data.title_text);
  const sideNavTitleText = normalizeSideNavTitleText(
    (data as { side_nav_title_text?: string }).side_nav_title_text,
  );

  const row = data as {
    side_nav_font_preset?: string;
    side_nav_font_size_px?: number;
    side_nav_title_opacity?: number;
    side_nav_title_gold_preset?: string;
    side_nav_title_align?: string;
  };

  const sideNavFontPreset =
    typeof row.side_nav_font_preset === "string" && isCoverFontPreset(row.side_nav_font_preset)
      ? row.side_nav_font_preset
      : DEFAULT_FLIP_COVER.sideNavFontPreset;

  const sideNavFontSizePx = normalizeSideNavFontSizePx(row.side_nav_font_size_px);
  const sideNavTitleOpacity = normalizeTitleOpacity(row.side_nav_title_opacity);
  const sideNavTitleGoldPreset = normalizeTitleGoldPreset(row.side_nav_title_gold_preset);
  const sideNavTitleAlign = normalizeSideNavTitleAlign(row.side_nav_title_align);

  return {
    coverEnabled: data.cover_enabled !== false,
    titleText,
    fontPreset,
    fontSizePx,
    titleOpacity,
    titleGoldPreset,
    sideNavTitleText,
    sideNavFontPreset,
    sideNavFontSizePx,
    sideNavTitleOpacity,
    sideNavTitleGoldPreset,
    sideNavTitleAlign,
  };
}

export async function updateAlbumFlipCover(input: {
  coverEnabled: boolean;
  titleText: string;
  fontPreset: string;
  fontSizePx: number;
  titleOpacity: number;
  titleGoldPreset: string;
  sideNavTitleText: string;
  sideNavFontPreset: string;
  sideNavFontSizePx: number;
  sideNavTitleOpacity: number;
  sideNavTitleGoldPreset: string;
  sideNavTitleAlign: SideNavTitleAlign;
}) {
  const supabase = await createClient();
  const auth = await requireAdminAlbum(supabase);
  if (auth.error) return { error: auth.error };

  const fontPreset = isCoverFontPreset(input.fontPreset)
    ? input.fontPreset
    : DEFAULT_FLIP_COVER.fontPreset;

  const raw = Math.round(Number(input.fontSizePx)) || DEFAULT_FLIP_COVER.fontSizePx;
  const fontSizePx = Math.min(120, Math.max(24, raw));

  const titleOpacity = normalizeTitleOpacity(input.titleOpacity);
  const titleGoldPreset = normalizeTitleGoldPreset(input.titleGoldPreset);

  const titleText = normalizeCoverTitleText(input.titleText);
  const sideNavTitleText = normalizeSideNavTitleText(input.sideNavTitleText);

  const sideNavFontPreset = isCoverFontPreset(input.sideNavFontPreset)
    ? input.sideNavFontPreset
    : DEFAULT_FLIP_COVER.sideNavFontPreset;

  const sideNavFontSizePx = normalizeSideNavFontSizePx(input.sideNavFontSizePx);
  const sideNavTitleOpacity = normalizeTitleOpacity(input.sideNavTitleOpacity);
  const sideNavTitleGoldPreset = normalizeTitleGoldPreset(input.sideNavTitleGoldPreset);
  const sideNavTitleAlign = normalizeSideNavTitleAlign(input.sideNavTitleAlign);

  const { error } = await supabase.from("album_flip_cover").upsert(
    {
      id: 1,
      cover_enabled: input.coverEnabled,
      title_text: titleText,
      font_preset: fontPreset,
      font_size_px: fontSizePx,
      title_opacity: titleOpacity,
      title_gold_preset: titleGoldPreset,
      side_nav_title_text: sideNavTitleText,
      side_nav_font_preset: sideNavFontPreset,
      side_nav_font_size_px: sideNavFontSizePx,
      side_nav_title_opacity: sideNavTitleOpacity,
      side_nav_title_gold_preset: sideNavTitleGoldPreset,
      side_nav_title_align: sideNavTitleAlign,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };

  const cover: AlbumFlipCoverSettings = {
    coverEnabled: input.coverEnabled,
    titleText,
    fontPreset,
    fontSizePx,
    titleOpacity,
    titleGoldPreset,
    sideNavTitleText,
    sideNavFontPreset,
    sideNavFontSizePx,
    sideNavTitleOpacity,
    sideNavTitleGoldPreset,
    sideNavTitleAlign,
  };

  for (const loc of locales) {
    revalidatePath(`/${loc}`, "page");
    revalidatePath(`/${loc}/admin/album`, "page");
  }
  revalidateAlbumPublicSurfaces();

  return { ok: true as const, cover };
}
