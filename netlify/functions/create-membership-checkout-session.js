import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:5173";
const paymentSource = "white_glove_concierge";
const defaultMembershipPricing = {
  Silver: { amountCents: 9900, cadence: "/month" },
  "Club Drive": { amountCents: 14900, cadence: "/month" },
  Gold: { amountCents: 19900, cadence: "/month" },
  Platinum: { amountCents: 39900, cadence: "/month" },
  Collector: { amountCents: null, cadence: "" },
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function clean(value, fallback = "") {
  return String(value || fallback).slice(0, 480);
}

function billingInterval(cadence) {
  return cadence === "/year" ? "year" : "month";
}

async function pricingForPlan(planName) {
  const fallback = defaultMembershipPricing[planName];
  if (!fallback) return null;

  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from("membership_pricing")
    .select("amount_cents, cadence")
    .eq("plan_name", planName)
    .maybeSingle();

  if (error) {
    console.warn("Could not load membership pricing. Using fallback.", error);
    return fallback;
  }

  return {
    amountCents: data?.amount_cents ?? fallback.amountCents,
    cadence: data?.cadence || fallback.cadence || "/month",
  };
}

async function verifyMember(event, payload) {
  if (!supabase) return null;

  const authorization = event.headers.authorization || event.headers.Authorization || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    const error = new Error("Sign in before starting membership checkout.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    const authError = new Error("Your sign-in expired. Sign in again before starting checkout.");
    authError.statusCode = 401;
    throw authError;
  }

  if (payload.userId && data.user.id !== payload.userId) {
    const mismatchError = new Error("This checkout does not match the signed-in member.");
    mismatchError.statusCode = 403;
    throw mismatchError;
  }

  return data.user;
}

async function billingProfileForMember(userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the member's existing Stripe billing profile: ${error.message}`);
  }

  return data || null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!stripe) {
    return json(503, { error: "Stripe is not configured" });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const verifiedUser = await verifyMember(event, payload);
    const plan = clean(payload.plan, "Club Drive");
    const pricing = await pricingForPlan(plan);
    const billingProfile = await billingProfileForMember(verifiedUser?.id);
    if (!billingProfile) {
      throw new Error("The signed-in member does not have a billing profile.");
    }
    const existingCustomerId = billingProfile?.stripe_customer_id || null;

    if (["active", "trialing"].includes(billingProfile?.subscription_status)) {
      return json(409, { error: "This membership is already active." });
    }

    if (["past_due", "unpaid", "paused", "incomplete"].includes(billingProfile?.subscription_status)) {
      return json(409, { error: "Resolve the existing subscription through Stripe before starting another membership." });
    }

    if (!pricing) {
      return json(400, { error: "Choose a valid membership." });
    }

    if (!Number.isFinite(Number(pricing.amountCents)) || Number(pricing.amountCents) <= 0) {
      return json(400, { error: "This membership needs a price before checkout can start." });
    }

    const metadata = {
      checkoutType: "membership_subscription",
      project: paymentSource,
      source: "White Glove Concierge app",
      memberEmail: clean(verifiedUser?.email || payload.memberEmail),
      memberName: clean(payload.memberName, "Member"),
      plan,
      userId: clean(verifiedUser?.id || payload.userId),
    };

    const sessionOptions = {
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: clean(`white-glove-membership-${verifiedUser?.id || payload.userId || payload.memberEmail || Date.now()}`),
      success_url: `${siteUrl}/?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?membership=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: Number(pricing.amountCents),
            recurring: {
              interval: billingInterval(pricing.cadence),
            },
            product_data: {
              name: `White Glove Concierge ${plan} Membership`,
              metadata: {
                project: paymentSource,
                source: "White Glove Concierge app",
              },
            },
          },
        },
      ],
      metadata,
      subscription_data: {
        metadata,
      },
    };

    if (existingCustomerId) {
      sessionOptions.customer = existingCustomerId;
    } else {
      sessionOptions.customer_email = clean(verifiedUser?.email || payload.memberEmail);
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    return json(200, { id: session.id, url: session.url });
  } catch (error) {
    console.error("Could not create membership Stripe Checkout Session", error);
    if (error.statusCode) {
      return json(error.statusCode, { error: error.message });
    }
    return json(500, { error: "Could not start membership checkout" });
  }
}
