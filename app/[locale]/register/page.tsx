import RegisterForm from "@/app/components/RegisterForm";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getMessages(locale);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t.registerTitle}</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">{t.registerHint}</p>
      </div>
      <RegisterForm locale={locale} />
      <Link
        href={`/${locale}`}
        className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white"
      >
        {t.backHome}
      </Link>
    </main>
  );
}
