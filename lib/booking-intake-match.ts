import { bookingAllSlotStartTimesHm } from "@/lib/booking-types";

export type IntakeOptionJson = { id: string; label_en: string; label_zh: string };

/** All selectable values per filter row (admin UI). */
export const POST_PAID_MATCH_ALL_SHOOT = ["portrait", "boudoir", "prewedding"] as const;
export const POST_PAID_MATCH_ALL_PARTY = ["single", "double", "group"] as const;
export const POST_PAID_MATCH_ALL_HOURS = ["h2", "h3", "h4", "h10"] as const;
export const POST_PAID_MATCH_ALL_MAKEUP = ["yes", "no"] as const;
export const POST_PAID_MATCH_ALL_FA = ["yes", "no"] as const;
export const POST_PAID_MATCH_ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function postPaidMatchAllSlotTimes(): readonly string[] {
  return bookingAllSlotStartTimesHm();
}

/** Shared post-paid match filters (intake rules + auto messages). */
export type BookingPostPaidMatchFields = {
  match_shoot_types: string[] | null;
  match_party_sizes: string[] | null;
  match_hours_tiers: string[] | null;
  match_makeup: string[] | null;
  match_female_assistants: string[] | null;
  match_slot_weekdays: number[] | null;
  /** HK local slot start, e.g. "10:00", "14:30". */
  match_slot_start_times: string[] | null;
};

export type BookingIntakeRuleRow = BookingPostPaidMatchFields & {
  id: string;
  sort_order: number;
  enabled: boolean;
  question_en: string;
  question_zh: string;
  options: IntakeOptionJson[];
};

export type BookingPostPaidAutoMessageRow = BookingPostPaidMatchFields & {
  id: string;
  sort_order: number;
  enabled: boolean;
  /** When true, send only after all intake prompts in the chat are answered. */
  after_intake_complete: boolean;
  message_en: string;
  message_zh: string;
};

/** Hong Kong local weekday: 0 = Sunday … 6 = Saturday (from slot_start UTC). */
export function hkWeekday0SunFromSlot(slotStartIso: string): number {
  const d = new Date(slotStartIso);
  if (Number.isNaN(d.getTime())) return 0;
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
  }).formatToParts(d);
  const day = w.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day ?? ""] ?? 0;
}

/** HK local slot start HH:mm from stored UTC instant. */
export function hkSlotStartHmFromIso(slotStartIso: string): string {
  const d = new Date(slotStartIso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** Whole row empty, or every option in the row ticked → do not filter on this dimension. */
export function isPostPaidDimensionUnrestricted<T extends string | number>(
  selected: readonly T[] | null | undefined,
  all: readonly T[],
): boolean {
  if (!selected || selected.length === 0) return true;
  if (selected.length < all.length) return false;
  return all.every((v) => selected.includes(v));
}

/**
 * Partial selection: order value must be in the checked list.
 * Empty or full row: no restriction.
 */
function matchesArrayFilter(
  arr: string[] | null | undefined,
  value: string | null | undefined,
  all: readonly string[],
): boolean {
  if (isPostPaidDimensionUnrestricted(arr, all)) return true;
  if (value == null || value === "") return false;
  return arr!.includes(String(value));
}

function matchesNumFilter(
  arr: number[] | null | undefined,
  value: number,
  all: readonly number[],
): boolean {
  if (isPostPaidDimensionUnrestricted(arr, all)) return true;
  return arr!.includes(value);
}

/**
 * Female assistant only exists on boudoir + no makeup bookings.
 * Full row ticked (yes+no) or empty → no FA filter.
 * Partial tick: only constrains boudoir+no makeup; other shoot/makeup combos pass this row.
 */
function matchesFemaleAssistantFilter(
  arr: string[] | null | undefined,
  order: BookingOrderMatchFields,
): boolean {
  if (isPostPaidDimensionUnrestricted(arr, [...POST_PAID_MATCH_ALL_FA])) return true;
  if (order.shoot_type !== "boudoir" || order.makeup !== "no") return true;
  if (!order.female_assistant) return false;
  return arr!.includes(order.female_assistant);
}

export type BookingOrderMatchFields = {
  shoot_type: string;
  party_size: string;
  hours_tier: string;
  makeup: string;
  female_assistant: string | null;
  slot_start: string;
};

export function bookingPostPaidMatchesOrder(
  rule: BookingPostPaidMatchFields,
  order: BookingOrderMatchFields,
): boolean {
  if (!matchesArrayFilter(rule.match_shoot_types, order.shoot_type, POST_PAID_MATCH_ALL_SHOOT)) return false;
  if (!matchesArrayFilter(rule.match_party_sizes, order.party_size, POST_PAID_MATCH_ALL_PARTY)) return false;
  if (!matchesArrayFilter(rule.match_hours_tiers, order.hours_tier, POST_PAID_MATCH_ALL_HOURS)) return false;
  if (!matchesArrayFilter(rule.match_makeup, order.makeup, POST_PAID_MATCH_ALL_MAKEUP)) return false;
  if (!matchesFemaleAssistantFilter(rule.match_female_assistants, order)) return false;

  const hkD = hkWeekday0SunFromSlot(order.slot_start);
  if (!matchesNumFilter(rule.match_slot_weekdays, hkD, POST_PAID_MATCH_ALL_WEEKDAYS)) return false;

  const hm = hkSlotStartHmFromIso(order.slot_start);
  if (!matchesArrayFilter(rule.match_slot_start_times, hm, postPaidMatchAllSlotTimes())) return false;

  return true;
}

export function bookingIntakeRuleMatchesOrder(
  rule: BookingIntakeRuleRow,
  order: BookingOrderMatchFields,
): boolean {
  return bookingPostPaidMatchesOrder(rule, order);
}

/** Admin/debug: why a rule did or did not match an order. */
export function explainPostPaidMatch(
  rule: BookingPostPaidMatchFields,
  order: BookingOrderMatchFields,
): { matches: boolean; failed: string[] } {
  const failed: string[] = [];

  const checkStr = (
    label: string,
    arr: string[] | null | undefined,
    value: string,
    all: readonly string[],
  ) => {
    if (!matchesArrayFilter(arr, value, all)) {
      if (isPostPaidDimensionUnrestricted(arr, all)) return;
      failed.push(
        arr?.length
          ? `${label}: ${value} not in [${arr.join(", ")}]`
          : `${label}: ${value}`,
      );
    }
  };

  checkStr("shoot_type", rule.match_shoot_types, order.shoot_type, POST_PAID_MATCH_ALL_SHOOT);
  checkStr("party_size", rule.match_party_sizes, order.party_size, POST_PAID_MATCH_ALL_PARTY);
  checkStr("hours_tier", rule.match_hours_tiers, order.hours_tier, POST_PAID_MATCH_ALL_HOURS);
  checkStr("makeup", rule.match_makeup, order.makeup, POST_PAID_MATCH_ALL_MAKEUP);

  if (!matchesFemaleAssistantFilter(rule.match_female_assistants, order)) {
    const fa = rule.match_female_assistants;
    if (isPostPaidDimensionUnrestricted(fa, [...POST_PAID_MATCH_ALL_FA])) {
      /* no-op */
    } else if (order.shoot_type !== "boudoir" || order.makeup !== "no") {
      /* should not fail — N/A */
    } else {
      failed.push(
        fa?.length
          ? `female_assistant: ${order.female_assistant ?? "—"} not in [${fa.join(", ")}]`
          : `female_assistant: ${order.female_assistant ?? "—"}`,
      );
    }
  }

  const hkD = hkWeekday0SunFromSlot(order.slot_start);
  if (!matchesNumFilter(rule.match_slot_weekdays, hkD, POST_PAID_MATCH_ALL_WEEKDAYS)) {
    if (!isPostPaidDimensionUnrestricted(rule.match_slot_weekdays, POST_PAID_MATCH_ALL_WEEKDAYS)) {
      failed.push(
        rule.match_slot_weekdays?.length
          ? `weekday(HK): ${hkD} not in [${rule.match_slot_weekdays.join(", ")}]`
          : `weekday(HK): ${hkD}`,
      );
    }
  }

  const hm = hkSlotStartHmFromIso(order.slot_start);
  const allSlots = postPaidMatchAllSlotTimes();
  if (!matchesArrayFilter(rule.match_slot_start_times, hm, allSlots)) {
    if (!isPostPaidDimensionUnrestricted(rule.match_slot_start_times, allSlots)) {
      failed.push(
        rule.match_slot_start_times?.length
          ? `slot_start(HK): ${hm || "—"} not in [${rule.match_slot_start_times.join(", ")}]`
          : `slot_start(HK): ${hm || "—"}`,
      );
    }
  }

  return { matches: failed.length === 0, failed };
}
