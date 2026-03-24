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
  const userId = metadata.user_id;
  const isBatch = metadata.batch === "true";

  // Determine enrollment IDs — single or batch
  const enrollmentIds: string[] = [];
  if (isBatch && metadata.enrollment_ids) {
    enrollmentIds.push(...metadata.enrollment_ids.split(",").filter(Boolean));
  } else if (metadata.enrollment_id) {
    enrollmentIds.push(metadata.enrollment_id);
  }

  if (enrollmentIds.length === 0) {
    console.error("No enrollment_id(s) in checkout session metadata");
    return;
  }

  // 1. Update payment records by stripe_checkout_session_id
  //    (works for both single and batch — batch creates one payment per enrollment
  //     all sharing the same stripe_checkout_session_id)
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

  // 2. Update all enrollment(s) payment status
  for (const enrollmentId of enrollmentIds) {
    const { error: enrollmentError } = await supabase
      .from("enrollments")
      .update({ payment_status: "paid" })
      .eq("id", enrollmentId);

    if (enrollmentError) {
      console.error(`Failed to update enrollment ${enrollmentId}:`, enrollmentError);
    }
  }

  // 3. Handle registration fee if included.
  //    Use the amount from the Stripe line item (session.amount_total includes it),
  //    but record the fee from metadata to avoid settings drift.
  if (metadata.registration_fee_included === "true" && userId) {
    // The registration fee amount (in cents) was recorded in metadata at checkout time
    const regFeeCents = parseInt(metadata.registration_fee_amount ?? "0", 10);
    const regFeeAmount = regFeeCents > 0 ? regFeeCents / 100 : 30; // fallback to $30

    const year = new Date().getFullYear();
    await supabase.from("registration_fees").upsert(
      {
        family_id: userId,
        year,
        amount: regFeeAmount,
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
    // credits_applied is stored in cents in metadata; convert to dollars
    await supabase.from("family_credits").insert({
      family_id: userId,
      amount: -(creditsApplied / 100),
      type: "used",
      description: `Applied to enrollment${enrollmentIds.length > 1 ? "s" : ""} ${enrollmentIds.join(", ")}`,
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
  //    Pass the batch size so we can account for enrollments we just updated
  if (userId) {
    await processReferralCredit(supabase, userId, enrollmentIds.length);
  }
}

async function processReferralCredit(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  batchSize: number = 1
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

  // Only process on the first paid enrollment(s).
  // For batch checkout, all enrollments in the batch become "paid" in this webhook,
  // so count may equal batchSize even though this is the family's first checkout.
  if ((count ?? 0) > batchSize) return;

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
