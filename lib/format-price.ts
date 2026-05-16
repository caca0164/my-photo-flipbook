/** Display integer cents as major currency units (e.g. HKD). */
export function formatPriceFromCents(cents: number, currency: string, locale: string): string {
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(locale === "zh" ? "zh-HK" : "en-HK", {
      style: "currency",
      currency: cur,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}
