/** Extract an 11-char YouTube video id from a URL or raw id. */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1] && /^[\w-]{11}$/.test(parts[embedIdx + 1]!)) {
        return parts[embedIdx + 1]!;
      }
      const shortIdx = parts.indexOf("shorts");
      if (shortIdx >= 0 && parts[shortIdx + 1] && /^[\w-]{11}$/.test(parts[shortIdx + 1]!)) {
        return parts[shortIdx + 1]!;
      }
    }
  } catch {
    /* ignore invalid URL */
  }

  return null;
}

export type YouTubeEmbedOptions = {
  autoplay?: boolean;
  mute?: boolean;
  loop?: boolean;
  /** When false, hides the control bar. */
  controls?: boolean;
  /**
   * Reels-style chromeless player: no controls, no fullscreen, no keyboard.
   * Pair with `.bts-yt-crop` CSS to crop corner branding.
   */
  minimalUi?: boolean;
  /** Enable iframe postMessage commands (mute / unMute). */
  enableJsApi?: boolean;
  /** Site origin for embed API (client-only). */
  origin?: string;
};

export function youTubeEmbedSrc(videoId: string, options: YouTubeEmbedOptions = {}): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
  });

  const chromeless = options.minimalUi === true || options.controls === false;
  if (chromeless) {
    params.set("controls", "0");
    params.set("fs", "0");
    params.set("disablekb", "1");
  } else if (options.controls === true) {
    params.set("controls", "1");
  }

  if (options.autoplay) params.set("autoplay", "1");
  if (options.mute) params.set("mute", "1");
  if (options.enableJsApi) params.set("enablejsapi", "1");
  if (options.loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  if (options.origin) params.set("origin", options.origin);

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
