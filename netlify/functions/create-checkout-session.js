import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:5173";

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

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!stripe) {
    return json(503, { error: "Stripe is not configured" });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const amountCents = Number(payload.amountCents || 0);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, { error: "A valid payment amount is required" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      submit_type: "book",
      customer_email: clean(payload.memberEmail),
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
            },
          },
        },
      ],
      metadata: {
        memberEmail: clean(payload.memberEmail),
        memberName: clean(payload.memberName, "Member"),
        userId: clean(payload.userId),
        vehicle: clean(payload.vehicle),
        vehicleId: clean(payload.vehicleId),
        vehicleClass: clean(payload.vehicleClass),
        service: clean(payload.service),
        serviceOption: clean(payload.serviceOption),
        date: clean(payload.date),
        time: clean(payload.time),
        paymentTitle: clean(payload.paymentTitle),
        paymentAmount: clean(payload.paymentAmount),
        paymentMethod: clean(payload.paymentMethod),
        notes: clean(payload.notes),
      },
    });

    return json(200, { id: session.id, url: session.url });
  } catch (error) {
    console.error("Could not create Stripe Checkout Session", error);
    return json(500, { error: "Could not start payment checkout" });
  }
}
