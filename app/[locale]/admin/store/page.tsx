import StoreAdminClient from "@/app/components/store/StoreAdminClient";
import { listStoreOrdersAdmin, listStoreProductsAdmin } from "@/app/actions/store-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { isLocale, type Locale } from "@/lib/i18n";
import type { StoreAdminOrderBundle, StoreProductRow } from "@/lib/store-types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminStorePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin/store`);
  const [pr, or] = await Promise.all([listStoreProductsAdmin(), listStoreOrdersAdmin()]);

  const productError = "error" in pr ? pr.error : null;
  const orderError = "error" in or ? or.error : null;

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      {productError || orderError ? (
        <p className="px-4 py-6 text-center text-sm text-red-400">
          {String(productError ?? orderError)}
        </p>
      ) : null}
      <StoreAdminClient
        locale={locale}
        initialProducts={(pr.products ?? []) as StoreProductRow[]}
        initialOrders={(or.orders ?? []) as StoreAdminOrderBundle[]}
      />
    </main>
  );
}
