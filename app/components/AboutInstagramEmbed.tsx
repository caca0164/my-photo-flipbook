"use client";

import { isLocale, messages, type Locale } from "@/lib/i18n";
import Script from "next/script";
import { useEffect, useRef } from "react";

const IG_PROFILE_URL =
  "https://www.instagram.com/lolinphk/?utm_source=ig_embed&utm_campaign=loading";

type IgWindow = Window & {
  instgrm?: { Embeds: { process: () => void } };
};

function processEmbeds() {
  const w = window as IgWindow;
  w.instgrm?.Embeds?.process();
}

export default function AboutInstagramEmbed({ locale: raw }: { locale: string }) {
  const locale: Locale = isLocale(raw) ? raw : "en";
  const t = messages[locale];
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    const w = window as IgWindow;
    if (w.instgrm?.Embeds) {
      processEmbeds();
      processed.current = true;
    }
  }, []);

  return (
    <section className="mt-10 border-t border-zinc-800 pt-10" aria-label={t.aboutInstagramHeading}>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
        {t.aboutInstagramHeading}
      </h2>
      <div className="flex justify-center">
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={IG_PROFILE_URL}
          data-instgrm-version="14"
          style={{
            background: "#FFF",
            border: 0,
            borderRadius: "3px",
            boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
            margin: "1px",
            maxWidth: "540px",
            minWidth: "326px",
            padding: 0,
            width: "99.375%",
          }}
        />
      </div>
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onLoad={() => {
          processEmbeds();
          processed.current = true;
        }}
      />
    </section>
  );
}
