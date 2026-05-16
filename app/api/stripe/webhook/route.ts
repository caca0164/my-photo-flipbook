import {
  sendBookingOrderPaidEmails,
  sendStoreOrderPaidEmails,
  type StoreOrderItemRow,
  type StoreOrderPaidRow,
} from "@/lib/email-order-receipts";
import { seedPaidBookingPostChat } from "@/lib/booking-post-paid-chat";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe-server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    return new NextResponse("Stripe webhook not configured", { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingOrderId = session.metadata?.booking_order_id;
    const storeOrderId = session.metadata?.order_id;

    if (bookingOrderId && session.payment_status === "paid") {
      const svc = createServiceRoleClient();
      if (svc) {
        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent && typeof session.payment_intent === "object"
              ? session.payment_intent.id
              : null;
        const { data: booking } = await svc
          .from("booking_orders")
          .update({
            status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: pi,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bookingOrderId)
          .eq("status", "pending_payment")
          .select("*")
          .maybeSingle();

        if (booking) {
          try {
            await sendBookingOrderPaidEmails(svc, booking);
          } catch (e) {
            console.error("[stripe webhook] booking receipt email", e);
          }
          try {
            await seedPaidBookingPostChat(svc, bookingOrderId);
          } catch (e) {
            console.error("[stripe webhook] booking post-paid chat", e);
          }
        }
      }
    } else if (storeOrderId && session.payment_status === "paid") {
      const svc = createServiceRoleClient();
      if (svc) {
        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent && typeof session.payment_intent === "object"
              ? session.payment_intent.id
              : null;
        const { data: order } = await svc
          .from("store_orders")
          .update({
            status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: pi,
            updated_at: new Date().toISOString(),
          })
          .eq("id", storeOrderId)
          .eq("status", "pending_payment")
          .select("*")
          .maybeSingle();

        if (order) {
          const { data: items } = await svc
            .from("store_order_items")
            .select("quantity, unit_price_cents, title_en_snapshot, title_zh_snapshot")
            .eq("order_id", storeOrderId);
          try {
            await sendStoreOrderPaidEmails(
              svc,
              order as StoreOrderPaidRow,
              (items ?? []) as StoreOrderItemRow[],
            );
          } catch (e) {
            console.error("[stripe webhook] store receipt email", e);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
