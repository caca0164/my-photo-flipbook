import StoreCartPage from "@/app/components/store/StoreCartPage";
import { listStoreProductsPublic } from "@/app/actions/store";
import { isLocale, type Locale } from "@/lib/i18n";
import type { StoreProductRow } from "@/lib/store-types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function StoreCartRoute({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const { products, error } = await listStoreProductsPublic();

  return (
    <StoreCartPage
      locale={locale}
      products={(products ?? []) as StoreProductRow[]}
      catalogFetchFailed={Boolean(error)}
    />
  );
}
