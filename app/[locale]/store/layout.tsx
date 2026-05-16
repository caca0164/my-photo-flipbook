import { StoreCartProvider } from "@/app/components/store/StoreCartProvider";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function StoreLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  return <StoreCartProvider locale={locale}>{children}</StoreCartProvider>;
}
