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
    const {
      enrollment_id,
      class_id,
      swimmer_name,
      session_name,
      level,
      amount, // in cents
      credits_applied, // in cents
    } = body;

    if (!enrollment_id || !class_id || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Swim Lessons — ${session_name}`,
              description: `Level ${level} • ${swimmer_name}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        enrollment_id,
        class_id,
        user_id: user.id,
        swimmer_name,
        credits_applied: String(credits_applied ?? 0),
      },
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/book?payment=cancelled`,
    });

    // Create a pending payment record linked to this checkout session
    await supabase.from("payments").insert({
      enrollment_id,
      family_id: user.id,
      amount: amount / 100, // convert cents to dollars
      status: "pending",
      payment_method: "stripe",
      stripe_checkout_session_id: session.id,
      description: `Swim Lessons — ${session_name} • Level ${level} • ${swimmer_name}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
