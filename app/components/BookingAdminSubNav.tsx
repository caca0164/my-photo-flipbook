"use client";

import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import Link from "next/link";

export default function BookingAdminSubNav({
  locale,
  active,
}: {
  locale: Locale;
  active: "settings" | "orders";
}) {
  const t = messages[locale];
  const base = `/${locale}/admin/booking`;
  const tab =
    "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition";
  const activeCls = "bg-amber-500/20 text-amber-100";
  const idleCls = "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200";

  return (
    <nav className="mt-4 flex flex-wrap gap-2 border-b border-zinc-800 pb-4" aria-label="Booking admin">
      <Link href={base} className={`${tab} ${active === "settings" ? activeCls : idleCls}`}>
        {t.adminBookingSubNavSettings}
      </Link>
      <Link href={`${base}/orders`} className={`${tab} ${active === "orders" ? activeCls : idleCls}`}>
        {t.adminBookingSubNavOrders}
      </Link>
    </nav>
  );
}
