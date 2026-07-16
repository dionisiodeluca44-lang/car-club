import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  if (!stripe || !stripeWebhookSecret || !supabase) {
    return response(503, { error: "Webhook is not configured" });
  }

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      stripeWebhookSecret,
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return response(400, { error: "Invalid webhook signature" });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return response(200, { received: true });
  }

  const session = stripeEvent.data.object;
  const metadata = session.metadata || {};
  const userId = metadata.userId || null;

  if (!userId) {
    console.error("Stripe checkout session is missing a Supabase user id", session.id);
    return response(400, { error: "Missing member id" });
  }

  try {
    const { error } = await supabase.from("service_requests").insert({
      user_id: userId,
      vehicle_label: metadata.vehicle || "Vehicle pending",
      service_type: metadata.service || "Concierge service",
      preferred_date: metadata.date || null,
      preferred_time: metadata.time || null,
      status: "Paid / Confirmed",
      notes: [
        `Service option: ${metadata.serviceOption || "Not selected"}`,
        `Vehicle ID: ${metadata.vehicleId || "not provided"}`,
        `Vehicle class: ${metadata.vehicleClass || "not provided"}`,
        `Payment: ${metadata.paymentTitle || "Payment"} - ${metadata.paymentAmount || "Paid through Stripe"}`,
        `Payment method: ${metadata.paymentMethod || "Stripe Checkout"}`,
        `Stripe session: ${session.id}`,
        metadata.notes,
      ].filter(Boolean).join("\n\n"),
    });

    if (error) throw error;
  } catch (error) {
    console.error("Could not create service request from Stripe webhook", error);
    return response(500, { error: "Could not save service request" });
  }

  return response(200, { received: true });
}
