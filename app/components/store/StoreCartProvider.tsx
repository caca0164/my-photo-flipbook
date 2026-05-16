"use client";

import type { CartLine } from "@/lib/store-types";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "flipbook-store-cart-v1";

type Ctx = {
  lines: CartLine[];
  ready: boolean;
  addItem: (productId: string, quantity?: number) => void;
  setQty: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  /** Drop cart lines whose product ids are not in this list (e.g. removed/deactivated products). */
  retainLinesForKnownProducts: (productIds: readonly string[]) => void;
  totalQuantity: number;
};

const StoreCartContext = createContext<Ctx | null>(null);

function readStorage(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter(
        (x): x is CartLine =>
          typeof x === "object" &&
          x !== null &&
          "productId" in x &&
          "quantity" in x &&
          typeof (x as CartLine).productId === "string" &&
          typeof (x as CartLine).quantity === "number",
      )
      .map((x) => ({
        productId: x.productId,
        quantity: Math.min(99, Math.max(1, Math.floor(x.quantity))),
      }));
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function StoreCartProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const t = messages[locale];

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setLines(readStorage());
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const q = Math.min(99, Math.max(1, Math.floor(quantity)));
      setLines((prev) => {
        const base = ready ? prev : readStorage();
        const idx = base.findIndex((l) => l.productId === productId);
        let next: CartLine[];
        if (idx === -1) next = [...base, { productId, quantity: q }];
        else {
          next = [...base];
          next[idx] = {
            productId,
            quantity: Math.min(99, next[idx].quantity + q),
          };
        }
        writeStorage(next);
        return next;
      });
    },
    [ready],
  );

  const setQty = useCallback((productId: string, quantity: number) => {
    const q = Math.min(99, Math.max(0, Math.floor(quantity)));
    setLines((prev) => {
      let next: CartLine[];
      if (q === 0) next = prev.filter((l) => l.productId !== productId);
      else {
        const idx = prev.findIndex((l) => l.productId === productId);
        if (idx === -1) next = [...prev, { productId, quantity: q }];
        else {
          next = [...prev];
          next[idx] = { productId, quantity: q };
        }
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.productId !== productId);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    writeStorage([]);
    setLines([]);
  }, []);

  const retainLinesForKnownProducts = useCallback((productIds: readonly string[]) => {
    const allowed = new Set(productIds);
    setLines((prev) => {
      const next = prev.filter((l) => allowed.has(l.productId));
      if (next.length === prev.length) return prev;
      writeStorage(next);
      return next;
    });
  }, []);

  const totalQuantity = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      ready,
      addItem,
      setQty,
      removeItem,
      clearCart,
      retainLinesForKnownProducts,
      totalQuantity,
    }),
    [lines, ready, addItem, setQty, removeItem, clearCart, retainLinesForKnownProducts, totalQuantity],
  );

  return (
    <StoreCartContext.Provider value={value}>
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href={`/${locale}`} className="text-sm font-medium text-zinc-200 hover:text-white">
            {t.storeNavHome}
          </Link>
          <Link
            href={`/${locale}/store/cart`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 hover:text-white"
          >
            {t.storeNavCart}
            {totalQuantity > 0 ? ` (${totalQuantity})` : ""}
          </Link>
        </div>
      </header>
      {children}
    </StoreCartContext.Provider>
  );
}

export function useStoreCart() {
  const ctx = useContext(StoreCartContext);
  if (!ctx) throw new Error("useStoreCart must be used under StoreCartProvider");
  return ctx;
}
