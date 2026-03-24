import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  });
}

interface LineItem {
  enrollment_id: string;
  class_id: string;
  swimmer_name: string;
  session_name: string;
  level: number;
  amount: number; // cents
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, credits_applied } = body as {
      items: LineItem[];
      credits_applied: number;
    };

    if (!items?.length) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const chargeAmount = Math.max(totalAmount - (credits_applied ?? 0), 0);

    if (chargeAmount <= 0) {
      return NextResponse.json({ error: "Use direct enrollment for zero-cost" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";
    const stripe = getStripe();

    // Distribute credit proportionally across items so each line item stays non-negative
    let remainingCredit = credits_applied ?? 0;
    const adjustedItems = items.map((item, idx) => {
      let creditForItem = 0;
      if (remainingCredit > 0 && item.amount > 0) {
        if (idx === items.length - 1) {
          // Last item gets remaining credit to avoid rounding drift
          creditForItem = Math.min(remainingCredit, item.amount);
        } else {
          creditForItem = Math.min(
            Math.round((item.amount / totalAmount) * (credits_applied ?? 0)),
            item.amount
          );
        }
        remainingCredit -= creditForItem;
      }
      return { ...item, adjustedAmount: item.amount - creditForItem, creditForItem };
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = adjustedItems
      .filter((item) => item.adjustedAmount > 0)
      .map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Swim Lessons — ${item.session_name}`,
            description: `Level ${item.level} • ${item.swimmer_name}${item.creditForItem > 0 ? ` (incl. $${(item.creditForItem / 100).toFixed(2)} credit)` : ""}`,
          },
          unit_amount: item.adjustedAmount,
        },
        quantity: 1,
      }));

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "Use direct enrollment for zero-cost" }, { status: 400 });
    }

    const enrollmentIds = items.map((i) => i.enrollment_id);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: lineItems,
      metadata: {
        enrollment_ids: enrollmentIds.join(","),
        user_id: user.id,
        credits_applied: String(credits_applied ?? 0),
        batch: "true",
      },
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/book/family-scheduler?payment=cancelled`,
    });

    // Create payment records for each enrollment
    for (const item of items) {
      await supabase.from("payments").insert({
        enrollment_id: item.enrollment_id,
        family_id: user.id,
        amount: item.amount / 100,
        status: "pending",
        payment_method: "stripe",
        stripe_checkout_session_id: session.id,
        description: `Family Batch — ${item.session_name} • Level ${item.level} • ${item.swimmer_name}`,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Batch checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
