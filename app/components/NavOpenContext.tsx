"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type NavOpenContextValue = {
  navOpen: boolean;
  setNavOpen: Dispatch<SetStateAction<boolean>>;
};

const NavOpenContext = createContext<NavOpenContextValue | null>(null);

export function NavOpenProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const value = useMemo(() => ({ navOpen, setNavOpen }), [navOpen]);
  return (
    <NavOpenContext.Provider value={value}>
      <div
        className="relative min-h-full flex-1"
        onContextMenu={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </NavOpenContext.Provider>
  );
}

export function useNavOpen(): NavOpenContextValue {
  const ctx = useContext(NavOpenContext);
  if (!ctx) {
    throw new Error("useNavOpen must be used within NavOpenProvider");
  }
  return ctx;
}
