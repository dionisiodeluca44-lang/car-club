import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:5173";
const paymentSource = "white_glove_concierge";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function clean(value, fallback = "") {
  return String(value || fallback).slice(0, 480);
}

async function verifiedMember(event, requestedUserId) {
  const authorization = event.headers.authorization || event.headers.Authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!accessToken) {
    throw Object.assign(new Error("Sign in again before starting payment."), { statusCode: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  const user = authData?.user;
  if (authError || !user) {
    throw Object.assign(new Error("Your sign-in has expired. Sign in again before starting payment."), { statusCode: 401 });
  }

  if (requestedUserId && requestedUserId !== user.id) {
    throw Object.assign(new Error("This booking does not belong to the signed-in member."), { statusCode: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, stripe_customer_id, subscription_status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw Object.assign(new Error("We could not find your member profile."), { statusCode: 403 });
  }

  if (!["active", "trialing"].includes(profile.subscription_status)) {
    throw Object.assign(new Error("An active White Glove membership is required to book this service."), { statusCode: 403 });
  }

  return { profile, user };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!stripe || !supabase) {
    return json(503, { error: "Secure payment checkout is not configured" });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { profile, user } = await verifiedMember(event, payload.userId);
    const amountCents = Number(payload.amountCents || 0);
    const paymentDescription = clean(
      `White Glove Concierge - ${payload.serviceLabel || payload.service || "Booking"} - ${payload.memberName || payload.memberEmail || "Member"}`,
    );
    const metadata = {
      project: paymentSource,
      source: "White Glove Concierge app",
      memberEmail: clean(user.email || profile.email),
      memberName: clean(payload.memberName, "Member"),
      userId: clean(user.id),
      vehicle: clean(payload.vehicle),
      vehicleId: clean(payload.vehicleId),
      vehicleClass: clean(payload.vehicleClass),
      currentLocation: clean(payload.currentLocation),
      service: clean(payload.service),
      serviceOption: clean(payload.serviceOption),
      date: clean(payload.date),
      time: clean(payload.time),
      paymentTitle: clean(payload.paymentTitle),
      paymentAmount: clean(payload.paymentAmount),
      amountCents: clean(amountCents),
      paymentMode: clean(payload.paymentMode, "custom"),
      quotedTotalCents: clean(payload.quotedTotalCents || (payload.paymentMode === "full" ? amountCents : "")),
      paymentMethod: "Stripe Checkout",
      transportAmount: clean(payload.transportAmount),
      transportChoice: clean(payload.transportChoice),
      transportDirection: clean(payload.transportDirection),
      warrantyCoverage: clean(payload.warrantyCoverage),
      warrantyLabel: clean(payload.warrantyLabel),
      notes: clean(payload.notes),
    };

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, { error: "A valid payment amount is required" });
    }

    const sessionOptions = {
      mode: "payment",
      payment_method_types: ["card"],
      submit_type: "book",
      client_reference_id: clean(`white-glove-${user.id}`),
      success_url: `${siteUrl}/?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?booking=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: amountCents,
            product_data: {
              name: clean(payload.serviceLabel || "White Glove Concierge booking"),
              description: clean(payload.description || payload.vehicle || "Concierge service request"),
              metadata: {
                project: paymentSource,
                source: "White Glove Concierge app",
              },
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: paymentDescription,
        metadata,
      },
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
    };

    if (profile.stripe_customer_id) {
      // Passing the existing Customer lets hosted Checkout show eligible saved cards.
      sessionOptions.customer = profile.stripe_customer_id;
    } else {
      // The webhook stores this new Customer on the profile after successful payment.
      sessionOptions.customer_creation = "always";
      sessionOptions.customer_email = clean(user.email || profile.email || payload.memberEmail);
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    return json(200, { id: session.id, url: session.url });
  } catch (error) {
    console.error("Could not create Stripe Checkout Session", error);
    return json(error.statusCode || 500, { error: error.message || "Could not start payment checkout" });
  }
}
