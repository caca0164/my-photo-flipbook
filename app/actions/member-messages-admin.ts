"use server";

import { getSessionProfile } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { findUserIdByEmail } from "@/lib/supabase/admin-auth-users";
import { sendMemberInboxNotificationEmail } from "@/lib/email-order-receipts";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import type { Locale } from "@/lib/i18n";

export async function adminSendMemberMessage(input: {
  locale: Locale;
  memberEmail: string;
  subject: string;
  body: string;
}): Promise<{ error?: string; ok?: boolean }> {
  noStore();
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") {
    return { error: "Forbidden" };
  }
  const email = input.memberEmail.trim().toLowerCase();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid member email." };
  }
  if (!subject) return { error: "Subject is required." };
  if (!body) return { error: "Message body is required." };

  const svc = createServiceRoleClient();
  if (!svc) return { error: "Server misconfigured (service role)." };

  const userId = await findUserIdByEmail(svc, email);
  if (!userId) return { error: "NO_USER" };

  const { error: insErr } = await svc.from("member_messages").insert({
    user_id: userId,
    subject,
    body,
    created_by: session.user.id,
  });
  if (insErr) return { error: insErr.message };

  try {
    await sendMemberInboxNotificationEmail(svc, userId, subject, body, input.locale);
  } catch {
    // non-fatal
  }

  revalidatePath(`/${input.locale}/admin/member-messages`);
  revalidatePath(`/${input.locale}/member/messages`);
  return { ok: true };
}
