import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } catch (err) {
      // Log but return 200 to prevent Stripe retries
      console.error("Error handling checkout.session.completed:", err);
    }
  }

  // Always return 200 to prevent Stripe retries on transient failures
  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient();
  const metadata = session.metadata ?? {};
  const enrollmentId = metadata.enrollment_id;
  const userId = metadata.user_id;

  if (!enrollmentId) {
    console.error("No enrollment_id in checkout session metadata");
    return;
  }

  // 1. Update payment record
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      stripe_payment_intent_id: session.payment_intent as string,
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", session.id);

  if (paymentError) {
    console.error("Failed to update payment:", paymentError);
  }

  // 2. Update enrollment payment status
  const { error: enrollmentError } = await supabase
    .from("enrollments")
    .update({ payment_status: "paid" })
    .eq("id", enrollmentId);

  if (enrollmentError) {
    console.error("Failed to update enrollment:", enrollmentError);
  }

  // 3. Handle registration fee if included
  if (metadata.registration_fee_included === "true" && userId) {
    const year = new Date().getFullYear();
    await supabase.from("registration_fees").upsert(
      {
        family_id: userId,
        year,
        amount: 30,
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_id: session.payment_intent as string,
      },
      { onConflict: "family_id,year" }
    );
  }

  // 4. Apply credits if any were used
  const creditsApplied = parseInt(metadata.credits_applied ?? "0", 10);
  if (creditsApplied > 0 && userId) {
    await supabase.from("family_credits").insert({
      family_id: userId,
      amount: -(creditsApplied / 100),
      type: "used",
      description: `Applied to enrollment ${enrollmentId}`,
    });
  }

  // 5. Create notification for parent
  if (userId) {
    const discountInfo = metadata.discount_breakdown
      ? ` Discounts: ${metadata.discount_breakdown}`
      : "";
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "enrollment_confirmed",
      title: "Payment Confirmed",
      message: `Your payment of $${((session.amount_total ?? 0) / 100).toFixed(2)} has been processed. ${metadata.swimmer_name ? `${metadata.swimmer_name}'s enrollment is confirmed!` : "Your enrollment is confirmed!"}${discountInfo}`,
      link: "/dashboard",
      read: false,
      email_sent: false,
    });
  }

  // 6. Process referral credit on first paid enrollment
  if (userId) {
    await processReferralCredit(supabase, userId);
  }
}

async function processReferralCredit(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data: swimmers } = await supabase
    .from("swimmers")
    .select("id")
    .eq("family_id", userId);

  if (!swimmers?.length) return;

  const swimmerIds = swimmers.map((s) => s.id);
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("swimmer_id", swimmerIds)
    .eq("payment_status", "paid");

  // Only process on the first paid enrollment
  if ((count ?? 0) > 1) return;

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_id", userId)
    .eq("status", "signed_up")
    .single();

  if (!referral) return;

  // Get referral credit amount from settings ($25)
  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "referral_credit_amount")
    .single();

  const creditAmount = typeof setting?.value === "number" ? setting.value : 25;

  await supabase
    .from("referrals")
    .update({ status: "credited", credit_amount: creditAmount, updated_at: new Date().toISOString() })
    .eq("id", referral.id);

  // Issue $25 credit to BOTH families
  await supabase.from("family_credits").insert([
    {
      family_id: referral.referrer_id,
      amount: creditAmount,
      type: "referral",
      description: "Referral credit — friend completed first enrollment",
      referral_id: referral.id,
    },
    {
      family_id: userId,
      amount: creditAmount,
      type: "referral",
      description: "Welcome credit — referred by a friend",
      referral_id: referral.id,
    },
  ]);

  await supabase.from("notifications").insert([
    {
      user_id: referral.referrer_id,
      type: "general",
      title: "Referral Credit Earned!",
      message: `Your referral just completed their first enrollment. You've earned a $${creditAmount} credit!`,
      link: "/dashboard",
      read: false,
      email_sent: false,
    },
    {
      user_id: userId,
      type: "general",
      title: "Welcome Credit!",
      message: `Thanks for joining! You've received a $${creditAmount} referral credit toward your next enrollment.`,
      link: "/dashboard",
      read: false,
      email_sent: false,
    },
  ]);
}
