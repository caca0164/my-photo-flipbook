import ChatRoomClient from "@/app/components/ChatRoomClient";
import { getMemberChatThreadByBooking } from "@/app/actions/booking-chat";
import { requireMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export default async function MemberChatRoomPage({ params }: Props) {
  const { locale: raw, bookingId } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  await requireMember(locale, `/${locale}/member/chat/${bookingId}`);

  const access = await getMemberChatThreadByBooking(bookingId);
  if (access.error || !access.threadId || !access.bookingId) notFound();

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("booking_orders")
    .select("customer_name")
    .eq("id", access.bookingId)
    .maybeSingle();

  const t = getMessages(locale);

  return (
    <ChatRoomClient
      locale={locale}
      threadId={access.threadId}
      bookingId={access.bookingId}
      mode="member"
      customerName={booking?.customer_name}
      backHref={`/${locale}/member/chat`}
      backLabel={t.chatBackList}
    />
  );
}
