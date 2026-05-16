"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { locales, type Locale } from "@/lib/i18n";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";

export type SiteAboutRow = {
  id: string;
  content_en: string;
  content_zh: string;
  updated_at: string;
};

export async function getSiteAboutPublic(): Promise<{ error?: string; row?: SiteAboutRow }> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_about").select("*").eq("id", "default").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Missing site_about" };
  return { row: data as SiteAboutRow };
}

export async function getSiteAboutAdmin(): Promise<{ error?: string; row?: SiteAboutRow }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_about").select("*").eq("id", "default").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Missing site_about" };
  return { row: data as SiteAboutRow };
}

export async function updateSiteAboutAdmin(input: {
  locale: Locale;
  content_en: string;
  content_zh: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_about")
    .update({
      content_en: input.content_en,
      content_zh: input.content_zh,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) return { error: error.message };
  for (const loc of locales) {
    revalidatePath(`/${loc}/about`, "page");
    revalidatePath(`/${loc}/admin/about`, "page");
  }
  return { ok: true };
}
