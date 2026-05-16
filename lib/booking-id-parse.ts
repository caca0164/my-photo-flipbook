const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Accept full UUID or 32 hex chars (booking number). */
export function parseBookingOrderId(input: string): string | null {
  const raw = input.trim();
  if (UUID_RE.test(raw)) return raw.toLowerCase();

  const hex = raw.replace(/[\s-]/g, "");
  if (/^[0-9a-f]{32}$/i.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase();
  }
  return null;
}

/** Short label shown to guests (first segment of UUID). */
export function formatBookingNumber(bookingId: string): string {
  return bookingId.split("-")[0]?.toUpperCase() ?? bookingId.slice(0, 8).toUpperCase();
}
