import { getMergedBookingBusy } from "@/lib/booking-busy-server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Max range length for freebusy query (days). */
const MAX_RANGE_DAYS = 45;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to (ISO date or datetime)" }, { status: 400 });
  }
  const tMin = new Date(from);
  const tMax = new Date(to);
  if (Number.isNaN(tMin.getTime()) || Number.isNaN(tMax.getTime()) || tMax <= tMin) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const days = (tMax.getTime() - tMin.getTime()) / (86400 * 1000);
  if (days > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Range too long" }, { status: 400 });
  }

  const merged = await getMergedBookingBusy(tMin, tMax);

  return NextResponse.json({
    busy: merged.busy,
    configured: merged.configured,
    googleIntervalCount: merged.googleIntervalCount,
    orderIntervalCount: merged.orderIntervalCount,
    ...(merged.googleError ? { googleError: merged.googleError } : {}),
    ...(merged.credentialHint ? { credentialHint: merged.credentialHint } : {}),
    siteOrderFullDayYmds: merged.siteOrderFullDayYmds,
  });
}
