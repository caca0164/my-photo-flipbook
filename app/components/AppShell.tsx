import type { AlbumFlipCoverSettings } from "@/lib/album-types";
import type { ReactNode } from "react";
import { NavOpenProvider } from "./NavOpenContext";
import SideNav from "./SideNav";

export default function AppShell({
  children,
  initialFlipCover,
}: {
  children: ReactNode;
  initialFlipCover: AlbumFlipCoverSettings;
}) {
  return (
    <NavOpenProvider>
      <SideNav initialFlipCover={initialFlipCover} />
      {children}
    </NavOpenProvider>
  );
}
