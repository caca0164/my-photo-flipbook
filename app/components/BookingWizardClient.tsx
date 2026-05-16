"use client";

import { createBookingCheckoutSession, getBookingWizardPublicData } from "@/app/actions/booking";
import type { BookingPriceSnapshot } from "@/lib/booking-types";
import {
  type BookingFemaleAssistant,
  type BookingHoursTier,
  type BookingMakeup,
  type BookingPartySize,
  type BookingShootType,
  BOOKING_TZ_OFFSET,
  bookingCalendarStep,
  bookingNeedsFemaleAssistantStep,
  bookingPayStep,
  bookingShowsBoudoirConfidentialityLink,
  bookingTodayYmdHk,
  bookingWizardMaxStep,
  bookingHourTiersForShoot,
  bookingHoursTierValidForShoot,
  computeBookingTotalCents,
  hoursTierToDurationHours,
} from "@/lib/booking-types";
import {
  busySegmentsForDayOrSiteFull,
  computeMakeupStartYmdHm,
  formatSlotRangeLabel,
  listAvailableSlotStarts,
  type BusyInterval,
} from "@/lib/booking-slots-client";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  locale: Locale;
  initialPrices: BookingPriceSnapshot;
  initialNoticesMd: string;
  initialBoudoirConfidentialityMd: string;
  initialCalendarConfigured: boolean;
  /** When true, show admin-only calendar diagnostics on the calendar step. Hidden from public customers. */
  viewerIsAdmin: boolean;
};

type CalCell = { ymd: string; dayNum: number; inCurrentMonth: boolean };

function ymd(year: number, month0: number, day: number) {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** 42 cells: Sun-first week rows, including adjacent-month days. */
function calendarCells(year: number, month0: number): CalCell[] {
  const firstDow = new Date(year, month0, 1).getDay();
  const dim = new Date(year, month0 + 1, 0).getDate();
  const prevDim = new Date(year, month0, 0).getDate();
  const out: CalCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    const day = prevDim - firstDow + 1 + i;
    const py = month0 === 0 ? year - 1 : year;
    const pm = month0 === 0 ? 11 : month0 - 1;
    out.push({ ymd: ymd(py, pm, day), dayNum: day, inCurrentMonth: false });
  }
  for (let d = 1; d <= dim; d++) {
    out.push({ ymd: ymd(year, month0, d), dayNum: d, inCurrentMonth: true });
  }
  let n = 0;
  while (out.length < 42) {
    n++;
    const ny = month0 === 11 ? year + 1 : year;
    const nm = month0 === 11 ? 0 : month0 + 1;
    out.push({ ymd: ymd(ny, nm, n), dayNum: n, inCurrentMonth: false });
  }
  return out;
}

function hkYmdToYearMonth0(ymd: string): { y: number; m0: number } {
  const [y, mo] = ymd.split("-").map(Number);
  return { y, m0: mo - 1 };
}

export default function BookingWizardClient({
  locale,
  initialPrices,
  initialNoticesMd,
  initialBoudoirConfidentialityMd,
  initialCalendarConfigured,
  viewerIsAdmin,
}: Props) {
  const t = messages[locale];
  const [step, setStep] = useState(1);
  const [shoot, setShoot] = useState<BookingShootType | null>(null);
  const [party, setParty] = useState<BookingPartySize | null>(null);
  const [hours, setHours] = useState<BookingHoursTier | null>(null);
  const [makeup, setMakeup] = useState<BookingMakeup | null>(null);
  const [femaleAssistant, setFemaleAssistant] = useState<BookingFemaleAssistant | null>(null);
  const [calYear, setCalYear] = useState(() => hkYmdToYearMonth0(bookingTodayYmdHk()).y);
  const [calMonth0, setCalMonth0] = useState(() => hkYmdToYearMonth0(bookingTodayYmdHk()).m0);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyInterval[] | null>(null);
  const [busyErr, setBusyErr] = useState<string | null>(null);
  const [googleCalWarning, setGoogleCalWarning] = useState<string | null>(null);
  const [busyDiag, setBusyDiag] = useState<{ google: number; orders: number } | null>(null);
  const [credentialHint, setCredentialHint] = useState<{ en: string; zh: string } | null>(null);
  const [siteOrderFullDayYmds, setSiteOrderFullDayYmds] = useState<string[]>([]);
  const [calendarConfigured, setCalendarConfigured] = useState(initialCalendarConfigured);
  const [prices, setPrices] = useState(initialPrices);
  const [noticesMd, setNoticesMd] = useState(initialNoticesMd);
  const [boudoirConfidentialityMd, setBoudoirConfidentialityMd] = useState(initialBoudoirConfidentialityMd);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [confidentialityOpen, setConfidentialityOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [adminPromoInput, setAdminPromoInput] = useState("");

  const calendarStepNum = bookingCalendarStep(shoot, makeup);
  const payStepNum = bookingPayStep(shoot, makeup);
  const wizardMaxStep = bookingWizardMaxStep(shoot, makeup);
  const needsFemaleAssistant = bookingNeedsFemaleAssistantStep(shoot, makeup);
  const showBoudoirConfidentiality = bookingShowsBoudoirConfidentialityLink(shoot);

  function bookingHoursChoiceLabel(id: BookingHoursTier): string {
    switch (id) {
      case "h2":
        return t.bookingHours2;
      case "h3":
        return t.bookingHours3;
      case "h4":
        return t.bookingHours4;
      case "h10":
        return t.bookingHoursFullDay;
    }
  }

  useEffect(() => {
    if (!shoot || !hours) return;
    if (!bookingHoursTierValidForShoot(shoot, hours)) {
      setHours(null);
      setSelectedYmd(null);
      setSelectedTime(null);
    }
  }, [shoot, hours]);

  useEffect(() => {
    if (step !== payStepNum) setAdminPromoInput("");
  }, [step, payStepNum]);

  const reloadPublic = useCallback(async () => {
    const d = await getBookingWizardPublicData(locale);
    if (d.prices) setPrices(d.prices);
    setNoticesMd(d.noticesMd);
    setBoudoirConfidentialityMd(d.boudoirConfidentialityMd ?? "");
    setCalendarConfigured(d.calendarConfigured);
  }, [locale]);

  useEffect(() => {
    void reloadPublic();
  }, [reloadPublic]);

  useEffect(() => {
    if (shoot === "boudoir") void reloadPublic();
  }, [shoot, reloadPublic]);

  const initialPricesKey = useMemo(() => JSON.stringify(initialPrices), [initialPrices]);

  useEffect(() => {
    setPrices(JSON.parse(initialPricesKey) as BookingPriceSnapshot);
  }, [initialPricesKey]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void reloadPublic();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reloadPublic]);

  useEffect(() => {
    if (step === payStepNum) void reloadPublic();
  }, [step, payStepNum, reloadPublic]);

  useEffect(() => {
    if (step !== calendarStepNum) return;
    const cells = calendarCells(calYear, calMonth0);
    const fromIso = new Date(`${cells[0].ymd}T00:00:00${BOOKING_TZ_OFFSET}`).toISOString();
    const last = cells[cells.length - 1];
    const lastDayEndExclusive = new Date(`${last.ymd}T00:00:00${BOOKING_TZ_OFFSET}`);
    lastDayEndExclusive.setTime(lastDayEndExclusive.getTime() + 86400000);
    const toIso = lastDayEndExclusive.toISOString();
    let cancelled = false;
    setBusy(null);
    setBusyErr(null);
    setGoogleCalWarning(null);
    setBusyDiag(null);
    setCredentialHint(null);
    setSiteOrderFullDayYmds([]);
    (async () => {
      try {
        const res = await fetch(
          `/api/booking/busy?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        );
        const j = (await res.json()) as {
          busy?: BusyInterval[];
          configured?: boolean;
          error?: string;
          googleError?: string;
          googleIntervalCount?: number;
          orderIntervalCount?: number;
          credentialHint?: { en: string; zh: string };
          siteOrderFullDayYmds?: string[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setBusyErr(j.error ?? "Calendar error");
          setBusy([]);
          setSiteOrderFullDayYmds([]);
          setBusyDiag(null);
          setCredentialHint(null);
          return;
        }
        setBusyErr(null);
        setBusy(j.busy ?? []);
        setSiteOrderFullDayYmds(Array.isArray(j.siteOrderFullDayYmds) ? j.siteOrderFullDayYmds : []);
        if (typeof j.configured === "boolean") setCalendarConfigured(j.configured);
        const ge = typeof j.googleError === "string" ? j.googleError.trim() : "";
        setGoogleCalWarning(ge || null);
        setBusyDiag({
          google: typeof j.googleIntervalCount === "number" ? j.googleIntervalCount : 0,
          orders: typeof j.orderIntervalCount === "number" ? j.orderIntervalCount : 0,
        });
        const ch = j.credentialHint;
        setCredentialHint(
          ch && typeof ch.en === "string" && typeof ch.zh === "string" ? { en: ch.en, zh: ch.zh } : null,
        );
      } catch {
        if (!cancelled) {
          setBusyErr("Network error");
          setBusy([]);
          setSiteOrderFullDayYmds([]);
          setBusyDiag(null);
          setCredentialHint(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, calendarStepNum, calYear, calMonth0]);

  const baseTotalCents = useMemo(() => {
    if (!shoot || !party || !hours || !makeup) return 0;
    const fa =
      needsFemaleAssistant && femaleAssistant ? femaleAssistant : null;
    return computeBookingTotalCents(prices, shoot, party, hours, makeup, fa);
  }, [shoot, party, hours, makeup, prices, needsFemaleAssistant, femaleAssistant]);

  const adminPromoNormalized = adminPromoInput.trim().toLowerCase();
  const adminPromoSkip = viewerIsAdmin && adminPromoNormalized === "skip";

  const checkoutTotalCents = useMemo(() => {
    if (!viewerIsAdmin) return baseTotalCents;
    if (adminPromoNormalized === "skip") return 0;
    if (adminPromoNormalized === "pudding") return 400;
    return baseTotalCents;
  }, [viewerIsAdmin, adminPromoNormalized, baseTotalCents]);

  const siteOrderFullDaySet = useMemo(() => new Set(siteOrderFullDayYmds), [siteOrderFullDayYmds]);

  const slotStarts = useMemo(() => {
    if (!selectedYmd || !hours || busy === null || busyErr) return [];
    return listAvailableSlotStarts(selectedYmd, hours, busy, { siteOrderFullDayYmds: siteOrderFullDaySet });
  }, [selectedYmd, hours, busy, busyErr, siteOrderFullDaySet]);

  const sessionDurH = hours ? hoursTierToDurationHours(hours) : 0;

  const calCells = useMemo(() => calendarCells(calYear, calMonth0), [calYear, calMonth0]);

  const busyByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof busySegmentsForDayOrSiteFull>>();
    if (busy === null) return map;
    for (const c of calCells) {
      if (!map.has(c.ymd))
        map.set(c.ymd, busySegmentsForDayOrSiteFull(c.ymd, busy, siteOrderFullDaySet));
    }
    return map;
  }, [calCells, busy, siteOrderFullDaySet]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-HK" : "en-HK", {
        year: "numeric",
        month: "long",
      }).format(new Date(calYear, calMonth0, 1)),
    [locale, calYear, calMonth0],
  );

  const hkTodayYmd = useMemo(() => bookingTodayYmdHk(), [step, calYear, calMonth0]);

  const hkMinCalendarMonthIndex = useMemo(() => {
    const { y, m0 } = hkYmdToYearMonth0(hkTodayYmd);
    return y * 12 + m0;
  }, [hkTodayYmd]);

  const viewCalendarMonthIndex = calYear * 12 + calMonth0;
  const canGoPrevCalendarMonth = viewerIsAdmin || viewCalendarMonthIndex > hkMinCalendarMonthIndex;

  useEffect(() => {
    if (step !== calendarStepNum || viewerIsAdmin) return;
    if (viewCalendarMonthIndex < hkMinCalendarMonthIndex) {
      const { y, m0 } = hkYmdToYearMonth0(hkTodayYmd);
      setCalYear(y);
      setCalMonth0(m0);
      setSelectedYmd(null);
      setSelectedTime(null);
    }
  }, [step, calendarStepNum, viewerIsAdmin, hkTodayYmd, hkMinCalendarMonthIndex, viewCalendarMonthIndex]);

  useEffect(() => {
    if (selectedYmd && selectedYmd <= hkTodayYmd) {
      setSelectedYmd(null);
      setSelectedTime(null);
    }
  }, [selectedYmd, hkTodayYmd]);

  function prevMonth() {
    if (!canGoPrevCalendarMonth) return;
    if (calMonth0 === 0) {
      setCalYear((y) => y - 1);
      setCalMonth0(11);
    } else setCalMonth0((m) => m - 1);
    setSelectedYmd(null);
    setSelectedTime(null);
  }
  function nextMonth() {
    if (calMonth0 === 11) {
      setCalYear((y) => y + 1);
      setCalMonth0(0);
    } else setCalMonth0((m) => m + 1);
    setSelectedYmd(null);
    setSelectedTime(null);
  }

  function goToday() {
    const hk = bookingTodayYmdHk();
    const [y, mo] = hk.split("-").map(Number);
    setCalYear(y);
    setCalMonth0(mo - 1);
    setSelectedYmd(null);
    setSelectedTime(null);
  }

  async function onPay() {
    if (!shoot || !party || !hours || !makeup || !selectedYmd || !selectedTime) return;
    if (needsFemaleAssistant && !femaleAssistant) {
      setPayErr(
        locale === "zh" ? "請選擇是否需要女助手協助。" : "Please choose whether you need a female assistant.",
      );
      return;
    }
    setPayErr(null);
    setPayLoading(true);
    try {
      await reloadPublic();
      const r = await createBookingCheckoutSession({
        locale,
        shoot,
        party,
        hours,
        makeup,
        femaleAssistant: needsFemaleAssistant ? femaleAssistant : null,
        dateYmd: selectedYmd,
        timeHm: selectedTime,
        customerEmail: email,
        customerName: name,
        customerPhone: phone,
        notes,
        promoCode: viewerIsAdmin ? adminPromoInput.trim() : undefined,
      });
      if (r.error) {
        setPayErr(r.error);
        setPayLoading(false);
        return;
      }
      if (r.successUrl) {
        window.location.href = r.successUrl;
        return;
      }
      if (r.url) window.location.href = r.url;
    } catch {
      setPayErr("Something went wrong.");
      setPayLoading(false);
    }
  }

  const optClass =
    "rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-4 text-left text-sm text-zinc-100 transition hover:border-amber-500/50 hover:bg-zinc-800/80";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {t.bookingStepLabel} {step} / {wizardMaxStep}
        </p>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="text-xs text-amber-200/90 underline-offset-4 hover:underline"
          >
            {t.bookingBack}
          </button>
        ) : null}
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingShootTitle}</h2>
          {(
            [
              ["portrait", t.bookingShootPortrait],
              ["boudoir", t.bookingShootBoudoir],
              ["prewedding", t.bookingShootPrewedding],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${optClass} block w-full ${shoot === id ? "border-amber-400 ring-1 ring-amber-400/30" : ""}`}
              onClick={() => {
                setShoot(id);
                setFemaleAssistant(null);
                setHours(null);
                setSelectedYmd(null);
                setSelectedTime(null);
                setStep(2);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingPartyTitle}</h2>
          {(
            [
              ["single", t.bookingPartySingle],
              ["double", t.bookingPartyDouble],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${optClass} block w-full ${party === id ? "border-amber-400 ring-1 ring-amber-400/30" : ""}`}
              onClick={() => {
                setParty(id);
                setStep(3);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 3 && shoot ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingHoursTitle}</h2>
          {bookingHourTiersForShoot(shoot).map((id) => (
            <button
              key={id}
              type="button"
              className={`${optClass} block w-full ${hours === id ? "border-amber-400 ring-1 ring-amber-400/30" : ""}`}
              onClick={() => {
                setHours(id);
                setStep(4);
              }}
            >
              {bookingHoursChoiceLabel(id)}
            </button>
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingMakeupTitle}</h2>
          {(
            [
              ["yes", t.bookingMakeupYes],
              ["no", t.bookingMakeupNo],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${optClass} block w-full ${makeup === id ? "border-amber-400 ring-1 ring-amber-400/30" : ""}`}
              onClick={() => {
                setMakeup(id);
                setFemaleAssistant(null);
                setStep(5);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 5 && needsFemaleAssistant ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingFemaleAssistantTitle}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{t.bookingFemaleAssistantHint}</p>
          {(
            [
              ["yes", t.bookingFemaleAssistantYes],
              ["no", t.bookingFemaleAssistantNo],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${optClass} block w-full ${femaleAssistant === id ? "border-amber-400 ring-1 ring-amber-400/30" : ""}`}
              onClick={() => {
                setFemaleAssistant(id);
                setStep(calendarStepNum);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {step === calendarStepNum && hours ? (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingCalendarTitle}</h2>
          {calendarConfigured && !busyErr && viewerIsAdmin ? (
            <p className="text-[11px] leading-relaxed text-zinc-500">{t.bookingCalBusyLegend}</p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-zinc-500">{t.bookingNoSameDayRule}</p>
          {step === calendarStepNum && calendarConfigured && busy === null && !busyErr ? (
            <p className="text-xs text-zinc-400">{t.bookingCalBusyLoading}</p>
          ) : null}
          {busyErr ? <p className="text-xs text-red-400">{busyErr}</p> : null}
          {viewerIsAdmin && step === calendarStepNum && hours ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[11px] leading-relaxed text-zinc-200">
              <p className="font-medium text-amber-100">{t.bookingAdminBusyDebugTitle}</p>
              {googleCalWarning ? (
                <p className="mt-1.5 whitespace-pre-wrap text-amber-200/95">{googleCalWarning}</p>
              ) : null}
              {busyDiag && !busyErr ? (
                <>
                  <p className="mt-1.5 text-zinc-300">
                    {t.bookingAdminBusyDebugGoogle.replace("{n}", String(busyDiag.google))}
                  </p>
                  <p className="text-zinc-300">
                    {t.bookingAdminBusyDebugOrders.replace("{n}", String(busyDiag.orders))}
                  </p>
                  {credentialHint ? (
                    <p className="mt-2 whitespace-pre-wrap text-amber-100/95">
                      {locale === "zh" ? credentialHint.zh : credentialHint.en}
                    </p>
                  ) : !calendarConfigured ? (
                    <p className="mt-2 text-zinc-400">{t.bookingAdminBusyDebugNoCreds}</p>
                  ) : null}
                  {calendarConfigured && busyDiag.google === 0 && !googleCalWarning ? (
                    <p className="mt-2 text-zinc-400">{t.bookingAdminBusyDebugEmptyGoogle}</p>
                  ) : null}
                </>
              ) : busy === null && !busyErr ? (
                <p className="mt-1.5 text-zinc-500">{t.bookingCalBusyLoading}</p>
              ) : busyErr ? (
                <p className="mt-1.5 text-zinc-500">{t.bookingAdminBusyDebugFixError}</p>
              ) : null}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0d0f] shadow-2xl ring-1 ring-zinc-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/90 px-3 py-3 sm:px-4">
              <span className="text-base font-semibold capitalize tracking-tight text-zinc-100">{monthTitle}</span>
              <div className="flex items-center gap-1">
                {canGoPrevCalendarMonth ? (
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-zinc-300 hover:bg-zinc-800"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                ) : (
                  <span className="h-8 w-8 shrink-0" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-zinc-300 hover:bg-zinc-800"
                  aria-label="Next month"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="ml-1 rounded-md border border-zinc-600/90 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  {t.bookingCalToday}
                </button>
              </div>
            </div>
            <div className="border-b border-zinc-800/90 bg-zinc-950/80">
              <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {t.bookingWeekdays.split(",").map((d) => (
                  <div key={d} className="border-r border-zinc-800/60 py-2 last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-zinc-800/80 p-px">
              {calCells.map((cell) => {
                const isPastOrSameDayHk = cell.ymd <= hkTodayYmd;
                const slots =
                  cell.inCurrentMonth && busy !== null && !busyErr
                    ? listAvailableSlotStarts(cell.ymd, hours, busy, { siteOrderFullDayYmds: siteOrderFullDaySet })
                    : [];
                const disabled = !cell.inCurrentMonth || isPastOrSameDayHk || slots.length === 0;
                const isTodayHk = cell.ymd === hkTodayYmd;
                const isSelected = selectedYmd === cell.ymd;
                const segments = busyByDay.get(cell.ymd) ?? [];
                const maxPills = 3;
                const pills = segments.slice(0, maxPills);
                const moreBusy = segments.length - pills.length;
                const pillTone = ["bg-sky-700/95", "bg-violet-700/95", "bg-rose-800/95"] as const;

                function pick() {
                  if (disabled) return;
                  setSelectedYmd(cell.ymd);
                  setSelectedTime(null);
                }

                return (
                  <div
                    key={cell.ymd}
                    role={disabled ? undefined : "button"}
                    tabIndex={disabled ? -1 : 0}
                    onClick={pick}
                    onKeyDown={(e) => {
                      if (disabled) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pick();
                      }
                    }}
                    className={`flex min-h-[4.75rem] flex-col bg-zinc-950 text-left outline-none transition sm:min-h-[6.25rem] md:min-h-[7rem] ${
                      !cell.inCurrentMonth ? "opacity-[0.45]" : ""
                    } ${
                      disabled
                        ? cell.inCurrentMonth
                          ? "cursor-not-allowed"
                          : "cursor-default"
                        : "cursor-pointer hover:bg-zinc-900/90 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-amber-500/50"
                    } ${
                      isSelected && cell.inCurrentMonth
                        ? "ring-2 ring-inset ring-amber-500/70 ring-offset-0 ring-offset-transparent"
                        : ""
                    } `}
                  >
                    <div className="flex shrink-0 justify-end px-1.5 pt-1.5">
                      <span
                        className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                          isTodayHk
                            ? "bg-rose-600 text-white shadow-md"
                            : !cell.inCurrentMonth
                              ? "text-zinc-500"
                              : disabled
                                ? "text-zinc-500"
                                : "text-zinc-100"
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-1.5">
                      {pills.map((seg, pi) => (
                        <div
                          key={`${cell.ymd}-${seg.startHm}-${seg.endHm}-${seg.fullDay ? "fd" : ""}-${pi}`}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm ${pillTone[pi % 3]}`}
                          title={
                            seg.fullDay
                              ? t.bookingCalFullDayBusy
                              : `${seg.startHm}–${seg.endHm}`
                          }
                        >
                          {seg.fullDay ? t.bookingCalFullDayBusy : `${seg.startHm}–${seg.endHm}`}
                        </div>
                      ))}
                      {moreBusy > 0 ? (
                        <div className="truncate pl-0.5 text-[10px] text-zinc-500">
                          {t.bookingCalMoreBusy.replace("{n}", String(moreBusy))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {selectedYmd ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
              <p className="mb-2 text-xs text-zinc-400">{t.bookingPickTime}</p>
              <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto">
                {slotStarts.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.bookingNoSlotsDay}</p>
                ) : (
                  slotStarts.map((hm) => (
                    <button
                      key={hm}
                      type="button"
                      onClick={() => setSelectedTime(hm)}
                      className={`rounded-lg border px-2.5 py-2 text-left text-xs leading-tight sm:px-3 ${
                        selectedTime === hm
                          ? "border-amber-400 bg-amber-500/15 text-amber-100"
                          : "border-zinc-600 bg-zinc-950 text-zinc-200 hover:border-zinc-500"
                      }`}
                    >
                      <span className="block font-medium tabular-nums">{formatSlotRangeLabel(hm, sessionDurH)}</span>
                      <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                        {sessionDurH}h · UTC+8
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!selectedYmd || !selectedTime}
            onClick={() => setStep(payStepNum)}
            className="w-full rounded-lg bg-zinc-100 py-3 text-sm font-medium text-zinc-950 disabled:opacity-40"
          >
            {t.bookingContinuePay}
          </button>
        </div>
      ) : null}

      {step === payStepNum && shoot && party && hours && makeup && selectedYmd && selectedTime ? (
        <div className="space-y-5">
          <h2 className="text-lg font-medium text-zinc-100">{t.bookingPayTitle}</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">{t.bookingSummaryShoot}</span>{" "}
              {shoot === "portrait"
                ? t.bookingShootPortrait
                : shoot === "boudoir"
                  ? t.bookingShootBoudoir
                  : t.bookingShootPrewedding}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">{t.bookingSummaryParty}</span>{" "}
              {party === "single" ? t.bookingPartySingle : t.bookingPartyDouble}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">{t.bookingSummaryDuration}</span>{" "}
              {bookingHoursChoiceLabel(hours)}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">{t.bookingSummaryMakeup}</span>{" "}
              {makeup === "yes" ? t.bookingMakeupYes : t.bookingMakeupNo}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">{t.bookingSummaryWhen}</span> {selectedYmd}{" "}
              {formatSlotRangeLabel(selectedTime, hoursTierToDurationHours(hours))} (UTC+8)
            </p>
            {makeup === "yes" ? (
              <p className="mt-1">
                <span className="text-zinc-500">{t.bookingSummaryMakeupStart}</span>{" "}
                {computeMakeupStartYmdHm(selectedYmd, selectedTime, shoot)} (UTC+8)
              </p>
            ) : null}
            {needsFemaleAssistant && femaleAssistant ? (
              <p className="mt-1">
                <span className="text-zinc-500">{t.bookingSummaryFemaleAssistant}</span>{" "}
                {femaleAssistant === "yes" ? t.bookingFemaleAssistantYes : t.bookingFemaleAssistantNo}
              </p>
            ) : null}
            <p className="mt-2 text-base font-medium text-amber-100/90">
              {t.bookingSummaryTotal}{" "}
              {(checkoutTotalCents / 100).toLocaleString(locale === "zh" ? "zh-HK" : "en-HK", {
                style: "currency",
                currency: prices.currency.toUpperCase(),
              })}
            </p>
          </div>
          {viewerIsAdmin ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm">
              <label className="block text-amber-100/95" htmlFor="booking-admin-promo">
                {t.bookingAdminPromoLabel}
              </label>
              <input
                id="booking-admin-promo"
                type="text"
                autoComplete="off"
                value={adminPromoInput}
                onChange={(e) => setAdminPromoInput(e.target.value)}
                placeholder={t.bookingAdminPromoPlaceholder}
                className="mt-2 w-full rounded-lg border border-amber-500/25 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">{t.bookingAdminPromoHint}</p>
            </div>
          ) : null}
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.bookingName}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.bookingEmail}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.bookingPhone}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.bookingNotes}
              rows={3}
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setNoticesOpen(true)}
              className="block text-sm text-amber-200/90 underline underline-offset-4"
            >
              {t.bookingNoticesLink}
            </button>
            {showBoudoirConfidentiality ? (
              <button
                type="button"
                onClick={() => setConfidentialityOpen(true)}
                className="block text-sm text-amber-200/90 underline underline-offset-4"
              >
                {t.bookingConfidentialityLink}
              </button>
            ) : null}
          </div>
          {payErr ? <p className="text-xs text-red-400">{payErr}</p> : null}
          <button
            type="button"
            disabled={
              payLoading || !email.trim() || !name.trim() || (!adminPromoSkip && checkoutTotalCents <= 0)
            }
            onClick={() => void onPay()}
            className="w-full rounded-lg bg-amber-500 py-3 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {payLoading ? "…" : adminPromoSkip ? t.bookingAdminPromoSkipConfirm : t.bookingPayStripe}
          </button>
          <p className="text-xs text-zinc-500">{t.bookingPrivacy}</p>
        </div>
      ) : null}

      {noticesOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-zinc-50">{t.bookingNoticesModalTitle}</h3>
              <button
                type="button"
                onClick={() => setNoticesOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
              {noticesMd.trim() || t.bookingNoticesEmpty}
            </pre>
          </div>
        </div>
      ) : null}

      {confidentialityOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-zinc-50">{t.bookingConfidentialityModalTitle}</h3>
              <button
                type="button"
                onClick={() => setConfidentialityOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
              {boudoirConfidentialityMd.trim() || t.bookingConfidentialityEmpty}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
