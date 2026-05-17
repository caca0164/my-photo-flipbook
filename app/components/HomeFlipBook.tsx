"use client";

import FlipBook from "@/app/components/FlipBook";
import type { AlbumFlipCoverSettings, FlipBookPage } from "@/lib/album-types";
import { useState } from "react";

/** Bumps on each client mount so the home intro replays after leaving and returning. */
let homeVisitSerial = 0;

export default function HomeFlipBook({
  locale,
  pages,
  coverOverlay,
}: {
  locale: string;
  pages: FlipBookPage[];
  coverOverlay: AlbumFlipCoverSettings;
}) {
  const [visitKey] = useState(() => ++homeVisitSerial);

  return (
    <FlipBook
      key={`${locale}-${visitKey}`}
      locale={locale}
      pages={pages}
      coverOverlay={coverOverlay}
    />
  );
}
