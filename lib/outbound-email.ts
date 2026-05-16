/**
 * Transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY and EMAIL_FROM (e.g. "Acme <onboarding@resend.dev>" or your verified domain).
 * If unset, sends are skipped (logged in dev).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OutboundEmailInput = {
  subject: string;
  html: string;
  text?: string;
  /** Primary recipients */
  to: string[];
  /** Optional extra recipients (merged into `to` with dedupe) */
  cc?: string[];
};

function normalizeEmails(list: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const e = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!e || !e.includes("@")) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(String(raw).trim());
  }
  return out;
}

export async function sendOutboundEmail(input: OutboundEmailInput): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to = normalizeEmails([...input.to, ...(input.cc ?? [])]);
  if (!key || !from) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[email] RESEND_API_KEY or EMAIL_FROM missing; skip send:", input.subject, to);
    }
    return { ok: false, error: "Email not configured" };
  }
  if (!to.length) return { ok: false, error: "No recipients" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
    const j = (await res.json()) as { message?: string; id?: string };
    if (!res.ok) {
      return { ok: false, error: j.message ?? `Resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resend fetch failed" };
  }
}

export function formatMoney(cents: number, currency: string, localeTag: string): string {
  return (cents / 100).toLocaleString(localeTag, {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

export function buildBookingPaidEmailHtml(opts: {
  localeTag: string;
  orderId: string;
  customerName: string;
  totalCents: number;
  currency: string;
  shootType: string;
  partySize: string;
  hoursTier: string;
  makeup: string;
  /** Human-readable session window (e.g. Hong Kong local). */
  slotLabel: string;
  notes: string;
}): string {
  const total = formatMoney(opts.totalCents, opts.currency, opts.localeTag);
  const slot = escapeHtml(opts.slotLabel);
  const notes = opts.notes.trim() ? escapeHtml(opts.notes) : "—";
  return `
  <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
    <h1 style="font-size:18px">Invoice / booking confirmation</h1>
    <p>Hi ${escapeHtml(opts.customerName)},</p>
    <p>Thank you — your photo session payment was received.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Order</td><td>${escapeHtml(opts.orderId)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Total</td><td><strong>${escapeHtml(total)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Shoot</td><td>${escapeHtml(opts.shootType)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Party</td><td>${escapeHtml(opts.partySize)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Duration</td><td>${escapeHtml(opts.hoursTier)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Makeup</td><td>${escapeHtml(opts.makeup)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">Slot</td><td>${slot}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">Notes</td><td>${notes}</td></tr>
    </table>
    <p style="font-size:12px;color:#666">Please keep this email for your records.</p>
  </div>`;
}

export function buildStorePaidEmailHtml(opts: {
  localeTag: string;
  orderId: string;
  customerName: string;
  totalCents: number;
  currency: string;
  shippingAddress: string;
  lines: { title: string; qty: number; lineTotalCents: number }[];
}): string {
  const total = formatMoney(opts.totalCents, opts.currency, opts.localeTag);
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px;border:1px solid #ddd">${escapeHtml(l.title)}</td><td style="padding:6px;border:1px solid #ddd;text-align:center">${l.qty}</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${escapeHtml(formatMoney(l.lineTotalCents, opts.currency, opts.localeTag))}</td></tr>`,
    )
    .join("");
  return `
  <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
    <h1 style="font-size:18px">Invoice / order confirmation</h1>
    <p>Hi ${escapeHtml(opts.customerName)},</p>
    <p>Thank you — your store order payment was received.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;width:100%;max-width:560px">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Order</td><td>${escapeHtml(opts.orderId)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Total</td><td><strong>${escapeHtml(total)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">Shipping</td><td>${escapeHtml(opts.shippingAddress || "—")}</td></tr>
    </table>
    <table style="border-collapse:collapse;font-size:14px;width:100%;max-width:560px">
      <thead><tr><th style="padding:6px;border:1px solid #ddd;text-align:left">Item</th><th style="padding:6px;border:1px solid #ddd">Qty</th><th style="padding:6px;border:1px solid #ddd;text-align:right">Line</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#666">Please keep this email for your records.</p>
  </div>`;
}

export function buildNewInboxMessageEmailHtml(opts: { subject: string; preview: string }): string {
  return `
  <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
    <p>You have a new message on the site.</p>
    <p><strong>${escapeHtml(opts.subject)}</strong></p>
    <p style="font-size:14px;color:#444">${escapeHtml(opts.preview.slice(0, 400))}${opts.preview.length > 400 ? "…" : ""}</p>
    <p style="font-size:12px;color:#666">Sign in to read the full message in your inbox.</p>
  </div>`;
}
