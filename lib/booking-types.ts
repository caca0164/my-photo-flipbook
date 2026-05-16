export type BookingShootType = "portrait" | "boudoir" | "prewedding";
export type BookingPartySize = "single" | "double";
export type BookingHoursTier = "h2" | "h3" | "h4" | "h10";

/** Portrait / Boudoir: 2–4h only. Pre-wedding: up to Full Day (h10). Values are UX + pricing; backend still validates. */
export function bookingHourTiersForShoot(shoot: BookingShootType): readonly BookingHoursTier[] {
  switch (shoot) {
    case "portrait":
    case "boudoir":
      return ["h2", "h3", "h4"];
    case "prewedding":
      return ["h2", "h3", "h10"];
  }
}

export function bookingHoursTierValidForShoot(shoot: BookingShootType, tier: BookingHoursTier): boolean {
  return (bookingHourTiersForShoot(shoot) as readonly string[]).includes(tier);
}
export type BookingMakeup = "yes" | "no";
export type BookingFemaleAssistant = "yes" | "no";

/** Boudoir + no makeup: ask whether a female assistant is needed before calendar. */
export function bookingNeedsFemaleAssistantStep(
  shoot: BookingShootType | null,
  makeup: BookingMakeup | null,
): boolean {
  return shoot === "boudoir" && makeup === "no";
}

export function bookingCalendarStep(
  shoot: BookingShootType | null,
  makeup: BookingMakeup | null,
): number {
  return bookingNeedsFemaleAssistantStep(shoot, makeup) ? 6 : 5;
}

export function bookingPayStep(
  shoot: BookingShootType | null,
  makeup: BookingMakeup | null,
): number {
  return bookingNeedsFemaleAssistantStep(shoot, makeup) ? 7 : 6;
}

export function bookingWizardMaxStep(
  shoot: BookingShootType | null,
  makeup: BookingMakeup | null,
): number {
  return bookingNeedsFemaleAssistantStep(shoot, makeup) ? 7 : 6;
}

/** All boudoir bookings (with or without makeup artist) show the confidentiality link on the pay step. */
export function bookingShowsBoudoirConfidentialityLink(
  shoot: BookingShootType | null,
): boolean {
  return shoot === "boudoir";
}

export const BOOKING_TZ_OFFSET = "+08:00"; // Hong Kong (no DST)
export const BOOKING_SLOT_STEP_MIN = 30;
export const BOOKING_DAY_START_H = 10;
/** Latest session end (Hong Kong local HH:00). Slot end must be ≤ this time (e.g. 22 ⇒ 12:00–22:00 for 10h, 19:00–22:00 for 3h). */
export const BOOKING_LAST_SESSION_END_H = 22;
/** Last clock hour for which we try :00 / :30 slot starts (inclusive). */
export const BOOKING_LAST_SLOT_START_HOUR = 22;

const HK_TZ_ID = "Asia/Hong_Kong";

/** Today's calendar date YYYY-MM-DD in Hong Kong (booking cut-offs use this, not the browser locale). */
export function bookingTodayYmdHk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TZ_ID,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type BookingPriceSnapshot = {
  currency: string;
  price_shoot_portrait_cents: number;
  price_shoot_boudoir_cents: number;
  price_shoot_prewedding_cents: number;
  price_party_single_cents: number;
  price_party_double_cents: number;
  price_party_group_cents: number;
  price_hours_2_cents: number;
  price_hours_3_cents: number;
  price_hours_4_cents: number;
  price_hours_10_cents: number;
  price_makeup_yes_cents: number;
  price_makeup_no_cents: number;
  price_female_assistant_yes_cents: number;
  price_female_assistant_no_cents: number;
};

export function hoursTierToDurationHours(tier: BookingHoursTier): number {
  switch (tier) {
    case "h2":
      return 2;
    case "h3":
      return 3;
    case "h4":
      return 4;
    case "h10":
      return 10;
    default:
      return 2;
  }
}

export function computeBookingTotalCents(
  p: BookingPriceSnapshot,
  shoot: BookingShootType,
  party: BookingPartySize,
  hours: BookingHoursTier,
  makeup: BookingMakeup,
  femaleAssistant?: BookingFemaleAssistant | null,
): number {
  const shootC =
    shoot === "portrait"
      ? p.price_shoot_portrait_cents
      : shoot === "boudoir"
        ? p.price_shoot_boudoir_cents
        : p.price_shoot_prewedding_cents;
  const partyC =
    party === "single" ? p.price_party_single_cents : p.price_party_double_cents;
  const hoursC =
    hours === "h2"
      ? p.price_hours_2_cents
      : hours === "h3"
        ? p.price_hours_3_cents
        : hours === "h4"
          ? p.price_hours_4_cents
          : p.price_hours_10_cents;
  const makeupC = makeup === "yes" ? p.price_makeup_yes_cents : p.price_makeup_no_cents;
  let total = shootC + partyC + hoursC + makeupC;
  if (bookingNeedsFemaleAssistantStep(shoot, makeup) && femaleAssistant) {
    total +=
      femaleAssistant === "yes"
        ? p.price_female_assistant_yes_cents
        : p.price_female_assistant_no_cents;
  }
  return total;
}

/** Build ISO start from YYYY-MM-DD and HH:mm in BOOKING_TZ_OFFSET. */
export function bookingLocalSlotToUtcIso(dateYmd: string, timeHm: string): string {
  return `${dateYmd}T${timeHm}:00${BOOKING_TZ_OFFSET}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** All bookable slot start times (HK), 30-minute steps (e.g. 10:00 … 22:00). */
export function bookingAllSlotStartTimesHm(): readonly string[] {
  const out: string[] = [];
  for (let h = BOOKING_DAY_START_H; h <= BOOKING_LAST_SLOT_START_HOUR; h++) {
    out.push(`${pad2(h)}:00`);
    if (h < BOOKING_LAST_SLOT_START_HOUR) {
      out.push(`${pad2(h)}:30`);
    }
  }
  return out;
}
