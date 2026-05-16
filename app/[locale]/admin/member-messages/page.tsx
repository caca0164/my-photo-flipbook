import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminMemberMessagesRedirect({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) redirect("/en/admin/chat");
  redirect(`/${raw}/admin/chat`);
}
