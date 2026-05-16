import ChatRoomClient from "@/app/components/ChatRoomClient";
import { getAdminChatThreadByBooking } from "@/app/actions/booking-chat";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export default async function AdminChatRoomPage({ params }: Props) {
  const { locale: raw, bookingId } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  await requireAdmin(locale, `/${locale}/admin/chat/${bookingId}`);

  const access = await getAdminChatThreadByBooking(bookingId);
  if (access.error || !access.threadId || !access.bookingId) notFound();

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
      mode="admin"
      customerName={customerName}
      backHref={`/${locale}/admin/chat`}
      backLabel={t.chatBackList}
    />
  );
}
