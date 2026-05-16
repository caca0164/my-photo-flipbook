import { countUnreadChatsForAdmin, countUnreadChatsForMember } from "@/app/actions/booking-chat";
import { getBtsSettingsPublic } from "@/app/actions/bts";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const btsSettings = await getBtsSettingsPublic();
  const btsPageHidden = btsSettings.page_hidden ?? false;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      user: null,
      isAdmin: false,
      unreadMessageCount: 0,
      unreadMemberChatCount: 0,
      unreadAdminChatCount: 0,
      btsPageHidden,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  const [unreadMemberChatCount, unreadAdminChatCount] = await Promise.all([
    countUnreadChatsForMember(),
    isAdmin ? countUnreadChatsForAdmin() : Promise.resolve(0),
  ]);

  return NextResponse.json({
    user: { email: user.email },
    isAdmin,
    unreadMessageCount: unreadMemberChatCount,
    unreadMemberChatCount,
    unreadAdminChatCount,
    btsPageHidden,
  });
}
