import type { BtsVideoRow } from "@/app/actions/bts";
import type { BtsReelsItem } from "@/app/components/BtsReelsFeed";
import type { Locale } from "@/lib/i18n";

export function mapBtsRowsToReelsItems(rows: BtsVideoRow[], locale: Locale): BtsReelsItem[] {
  return rows.map((v) => ({
    id: v.id,
    source: v.video_source,
    youtubeVideoId: v.youtube_video_id,
    cloudflareStreamUid: v.cloudflare_stream_uid,
    title: locale === "zh" ? v.title_zh || v.title_en : v.title_en || v.title_zh,
  }));
}
