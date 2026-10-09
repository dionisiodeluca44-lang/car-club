import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:5173";

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function clean(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 480);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!adminPassword || event.headers["x-admin-token"] !== adminPassword) return json(401, { error: "Unauthorized" });
  if (!stripe || !supabase) return json(503, { error: "Stripe or the admin backend is not configured." });

  try {
    const payload = JSON.parse(event.body || "{}");
    const amountCents = Number(payload.amountCents);
    const paymentType = ["deposit", "balance", "full", "manual"].includes(payload.paymentType) ? payload.paymentType : "manual";
    if (!payload.requestId || !Number.isInteger(amountCents) || amountCents <= 0) {
      return json(400, { error: "Choose a booking and enter a payment amount greater than zero." });
    }

    const { data: request, error: requestError } = await supabase
      .from("service_requests")
      .select("id, user_id, vehicle_label, service_type, preferred_date, preferred_time, quoted_total_cents")
      .eq("id", payload.requestId)
      .single();
    if (requestError || !request) return json(404, { error: "Could not find that service request." });

    const { data: member } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", request.user_id)
      .maybeSingle();

    const label = clean(payload.label, `${paymentType === "deposit" ? "Deposit" : paymentType === "balance" ? "Balance" : "Service payment"} for ${request.service_type}`);
    const metadata = {
      project: "white_glove_concierge",
      source: "White Glove admin payment link",
      serviceRequestId: request.id,
      userId: request.user_id,
      memberEmail: clean(member?.email),
      memberName: clean(member?.full_name, "Member"),
      vehicle: clean(request.vehicle_label),
      service: clean(request.service_type),
      date: clean(request.preferred_date),
      time: clean(request.preferred_time),
      paymentTitle: label,
      amountCents: clean(amountCents),
      paymentMode: paymentType === "full" ? "full" : paymentType === "deposit" ? "deposit" : "custom",
      paymentType,
      quotedTotalCents: clean(request.quoted_total_cents),
      paymentMethod: "Stripe payment link",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: clean(member?.email) || undefined,
      client_reference_id: `service-${request.id}`,
      success_url: `${siteUrl}/?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?booking=cancelled`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: amountCents,
          product_data: {
            name: label,
            description: clean(`${request.service_type} - ${request.vehicle_label}`),
          },
        },
      }],
      metadata,
      payment_intent_data: { description: label, metadata },
    });

    const createdAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({
        payment_link_amount_cents: amountCents,
        payment_link_created_at: createdAt,
        payment_link_label: label,
        payment_link_url: session.url,
        updated_at: createdAt,
      })
      .eq("id", request.id);
    if (updateError) {
      return json(500, { error: "The Stripe link was created, but it could not be saved. Run the latest service payment SQL migration." });
    }

    return json(200, {
      amountCents,
      createdAt,
      label,
      url: session.url,
    });
  } catch (error) {
    console.error("Could not create an admin service payment link", error);
    return json(500, { error: "Could not create the secure payment link." });
  }
}
