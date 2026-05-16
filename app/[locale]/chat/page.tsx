import BookingChatGuestLogin from "@/app/components/BookingChatGuestLogin";
import { isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function GuestChatLoginPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  return <BookingChatGuestLogin locale={raw as Locale} />;
}
