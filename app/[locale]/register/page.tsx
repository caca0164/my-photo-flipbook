import { isLocale, type Locale } from "@/lib/i18n";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
};

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (typeof sp.redirect === "string" && sp.redirect.startsWith("/")) {
    q.set("redirect", sp.redirect);
  }
  const suffix = q.toString();
  redirect(suffix ? `/${locale}/login?${suffix}` : `/${locale}/login`);
}
