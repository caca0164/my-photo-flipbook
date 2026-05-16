import { getSessionProfile } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export async function requireMember(locale: string, redirectPath?: string) {
  const session = await getSessionProfile();
  const dest = redirectPath ?? `/${locale}/member/bookings`;
  if (!session) {
    redirect(`/${locale}/login?redirect=${encodeURIComponent(dest)}`);
  }
  return session;
}
