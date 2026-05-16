import { requireAdmin } from "@/lib/auth/admin";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminHubPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  await requireAdmin(locale, `/${locale}/admin`);
  const t = getMessages(locale);

  const sections: { href: string; title: string }[] = [
    { href: `/${locale}/admin/store`, title: t.navAdminStore },
    { href: `/${locale}/admin/album`, title: t.navAdminAlbum },
    { href: `/${locale}/admin/booking`, title: t.navAdminBooking },
    { href: `/${locale}/admin/booking/orders`, title: t.navAdminBookingOrders },
    { href: `/${locale}/admin/booking/intake`, title: t.navAdminBookingIntake },
    { href: `/${locale}/admin/chat`, title: t.navAdminChat },
    { href: `/${locale}/admin/about`, title: t.navAdminAbout },
    { href: `/${locale}/admin/bts`, title: t.navAdminBts },
  ];

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{t.adminHubTitle}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t.adminHubSubtitle}</p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {sections.map(({ href, title }) => (
            <li key={href}>
              <Link
                href={href}
                className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-sm font-medium text-amber-200/95 transition hover:border-zinc-700 hover:bg-zinc-800/60"
              >
                {title}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10">
          <Link href={`/${locale}`} className="text-sm text-zinc-500 transition hover:text-zinc-300">
            {t.adminBackHome}
          </Link>
        </p>
      </div>
    </main>
  );
}
