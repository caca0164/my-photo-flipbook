import ChatRoomClient from "@/app/components/ChatRoomClient";
import { getChatThreadForGuest } from "@/app/actions/booking-chat";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export default async function GuestChatRoomPage({ params }: Props) {
  const { locale: raw, bookingId } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const access = await getChatThreadForGuest(bookingId);
  if (
    access.error === "FORBIDDEN" ||
    access.error === "INVALID" ||
    access.error === "NOT_PAID"
  ) {
    redirect(`/${locale}/chat`);
  }
  if (!access.threadId || !access.bookingId) notFound();

  const svc = createServiceRoleClient();
  let customerName: string | undefined;
  if (svc) {
    const { data: booking } = await svc
      .from("booking_orders")
      .select("customer_name")
      .eq("id", access.bookingId)
      .maybeSingle();
    customerName = booking?.customer_name;
  }

  const t = getMessages(locale);

  return (
    <ChatRoomClient
      locale={locale}
      threadId={access.threadId}
      bookingId={access.bookingId}
      mode="guest"
      customerName={customerName}
      backHref={`/${locale}/chat`}
      backLabel={t.chatGuestBackLogin}
    />
  );
}
