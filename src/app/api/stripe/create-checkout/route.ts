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
      amount, // in cents (lesson fee after discounts, before credits)
      registration_fee, // in cents (0 if already paid this year)
      credits_applied, // in cents
      discount_breakdown, // human-readable string
    } = body;

    if (!enrollment_id || !class_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify enrollment belongs to this user's family
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id, payment_status, swimmer:swimmers!inner(family_id)")
      .eq("id", enrollment_id)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const swimmer = Array.isArray(enrollment.swimmer)
      ? enrollment.swimmer[0]
      : enrollment.swimmer;
    if ((swimmer as { family_id: string })?.family_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";
    const stripe = getStripe();

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const lessonAmount = Math.max(amount ?? 0, 0);
    if (lessonAmount > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Swim Lessons — ${session_name}`,
            description: `Level ${level} • ${swimmer_name}${discount_breakdown ? ` | ${discount_breakdown}` : ""}`,
          },
          unit_amount: lessonAmount,
        },
        quantity: 1,
      });
    }

    const regFee = Math.max(registration_fee ?? 0, 0);
    if (regFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Annual Registration Fee",
            description: "Covers skill assessment, progress tracking, report cards, certificates & portal access. Non-refundable.",
          },
          unit_amount: regFee,
        },
        quantity: 1,
      });
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "Nothing to charge" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: lineItems,
      metadata: {
        enrollment_id,
        class_id,
        user_id: user.id,
        swimmer_name,
        credits_applied: String(credits_applied ?? 0),
        registration_fee_included: regFee > 0 ? "true" : "false",
        discount_breakdown: discount_breakdown ?? "",
      },
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/book?payment=cancelled`,
    });

    // Upsert payment record (update existing pending payment if re-paying)
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("enrollment_id", enrollment_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPayment) {
      await supabase
        .from("payments")
        .update({
          stripe_checkout_session_id: session.id,
          amount: (lessonAmount + regFee) / 100,
        })
        .eq("id", existingPayment.id);
    } else {
      await supabase.from("payments").insert({
        enrollment_id,
        family_id: user.id,
        amount: (lessonAmount + regFee) / 100,
        status: "pending",
        payment_method: "stripe",
        stripe_checkout_session_id: session.id,
        description: `Swim Lessons — ${session_name} • Level ${level} • ${swimmer_name}`,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
