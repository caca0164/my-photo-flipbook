"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { locales } from "@/lib/i18n";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

export type BtsVideoRow = {
  id: string;
  youtube_video_id: string;
  title_en: string;
  title_zh: string;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type BtsSettingsRow = {
  id: string;
  page_hidden: boolean;
  updated_at: string;
};

function revalidateBtsPaths() {
  for (const loc of locales) {
    revalidatePath(`/${loc}/bts`, "page");
    revalidatePath(`/${loc}/admin/bts`, "page");
  }
}

export async function getBtsSettingsPublic(): Promise<{
  error?: string;
  page_hidden?: boolean;
}> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bts_settings")
    .select("page_hidden")
    .eq("id", "default")
    .maybeSingle();

  if (error) return { error: error.message, page_hidden: false };
  return { page_hidden: Boolean(data?.page_hidden) };
}

export async function getBtsSettingsAdmin(): Promise<{
  error?: string;
  settings?: BtsSettingsRow;
}> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bts_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) return { error: error?.message ?? "Missing site_bts_settings" };
  return { settings: data as BtsSettingsRow };
}

export async function setBtsPageHiddenAdmin(
  page_hidden: boolean,
): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_bts_settings")
    .update({ page_hidden, updated_at: new Date().toISOString() })
    .eq("id", "default");

  if (error) return { error: error.message };
  revalidateBtsPaths();
  return { ok: true };
}

/** Public /bts is 404 when hidden unless viewer is admin. */
export async function canViewPublicBtsPage(): Promise<boolean> {
  const { page_hidden } = await getBtsSettingsPublic();
  if (!page_hidden) return true;
  const session = await getSessionProfile();
  return session?.role === "admin";
}

export async function listBtsVideosPublic(): Promise<{ error?: string; videos?: BtsVideoRow[] }> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bts_videos")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { videos: (data ?? []) as BtsVideoRow[] };
}

export async function listBtsVideosAdmin(): Promise<{ error?: string; videos?: BtsVideoRow[] }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bts_videos")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  return { videos: (data ?? []) as BtsVideoRow[] };
}

export async function upsertBtsVideoAdmin(input: {
  id?: string | null;
  youtubeInput: string;
  title_en: string;
  title_zh: string;
  sort_order: number;
  published: boolean;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const videoId = parseYouTubeVideoId(input.youtubeInput);
  if (!videoId) return { error: "Invalid YouTube URL or video ID" };

  const supabase = await createClient();
  const row = {
    youtube_video_id: videoId,
    title_en: input.title_en.trim(),
    title_zh: input.title_zh.trim(),
    sort_order: Math.max(0, Math.floor(input.sort_order)),
    published: input.published,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("site_bts_videos").update(row).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("site_bts_videos").insert(row);
    if (error) return { error: error.message };
  }

  revalidateBtsPaths();
  return { ok: true };
}

export async function deleteBtsVideoAdmin(id: string): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return { error: "Forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("site_bts_videos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateBtsPaths();
  return { ok: true };
}
