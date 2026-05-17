import type { AlbumFlipCoverSettings } from "@/lib/album-types";
import type { ReactNode } from "react";
import { NavOpenProvider } from "./NavOpenContext";
import SideNav from "./SideNav";

export default function AppShell({
  children,
  initialFlipCover,
  initialBtsPageHidden,
}: {
  children: ReactNode;
  initialFlipCover: AlbumFlipCoverSettings;
  initialBtsPageHidden: boolean;
}) {
  return (
    <NavOpenProvider>
      <SideNav
        initialFlipCover={initialFlipCover}
        initialBtsPageHidden={initialBtsPageHidden}
      />
      {children}
    </NavOpenProvider>
  );
}
