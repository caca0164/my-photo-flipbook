import ResetPasswordForm from "@/app/components/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function ResetPasswordPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t.authNewPasswordTitle}</h1>
        {!user ? (
          <p className="mt-2 max-w-md text-sm text-red-400">{t.authResetSessionExpired}</p>
        ) : (
          <p className="mt-2 max-w-md text-sm text-zinc-400">{t.authNewPasswordHint}</p>
        )}
      </div>
      {user ? (
        <ResetPasswordForm locale={locale} />
      ) : (
        <Link
          href={`/${locale}/login`}
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white"
        >
          {t.authBackToSignIn}
        </Link>
      )}
    </main>
  );
}
