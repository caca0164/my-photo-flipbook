import { handleAuthCallback } from "@/lib/auth-callback";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/** Same handler as /auth/callback (middleware may prefix locale on older links). */
export async function GET(request: Request, { params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return handleAuthCallback(request);
}
