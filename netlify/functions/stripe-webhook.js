import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const subscriptionEventTypes = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

const invoiceEventTypes = new Set([
  "invoice.paid",
  "invoice.payment_failed",
]);

const accessStatuses = new Set(["active", "trialing"]);

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function stripeId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

function stripeTimestamp(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? new Date(Number(value) * 1000).toISOString()
    : null;
}

function invoiceSubscriptionId(invoice) {
  return stripeId(invoice?.subscription)
    || stripeId(invoice?.parent?.subscription_details?.subscription)
    || stripeId(invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription)
    || null;
}

async function currentSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return stripe.subscriptions.retrieve(subscriptionId);
}

async function profileForSubscription(subscription, metadata) {
  const fields = "id, subscription_status, stripe_subscription_id, stripe_subscription_created_at, subscription_activated_at";
  const userId = metadata.userId || null;
  const subscriptionId = stripeId(subscription.id);
  const customerId = stripeId(subscription.customer);

  if (userId) {
    const { data, error } = await supabase.from("profiles").select(fields).eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (subscriptionId) {
    const { data, error } = await supabase
      .from("profiles")
      .select(fields)
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (customerId && metadata.checkoutType === "membership_subscription") {
    const { data, error } = await supabase
      .from("profiles")
      .select(fields)
      .eq("stripe_customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

function isOlderSubscription(profile, subscription) {
  const incomingId = stripeId(subscription.id);
  if (!profile.stripe_subscription_id || profile.stripe_subscription_id === incomingId) return false;

  const existingCreatedAt = Date.parse(profile.stripe_subscription_created_at || "");
  const incomingCreatedAt = Date.parse(stripeTimestamp(subscription.created) || "");

  if (Number.isFinite(existingCreatedAt) && Number.isFinite(incomingCreatedAt)) {
    if (incomingCreatedAt !== existingCreatedAt) return incomingCreatedAt < existingCreatedAt;
    return !accessStatuses.has(subscription.status);
  }

  // Legacy profiles do not have a subscription creation timestamp. A new active
  // subscription may replace them, but a late cancellation for an old ID may not.
  return !accessStatuses.has(subscription.status);
}

async function syncMembershipSubscription(subscription, stripeEvent, sessionMetadata = {}, requireProfile = false) {
  const subscriptionId = stripeId(subscription.id);
  const customerId = stripeId(subscription.customer);
  const metadata = { ...sessionMetadata, ...(subscription.metadata || {}) };
  const profile = await profileForSubscription(subscription, metadata);

  if (!profile) {
    if (requireProfile || metadata.checkoutType === "membership_subscription") {
      throw new Error(`No White Glove member matches Stripe subscription ${subscriptionId || "unknown"}.`);
    }
    console.info(`Ignored unrelated Stripe subscription ${subscriptionId || "unknown"}.`);
    return;
  }

  if (isOlderSubscription(profile, subscription)) {
    console.info(`Ignored lifecycle event for superseded Stripe subscription ${subscriptionId}.`);
    return;
  }

  const status = stripeEvent.type === "customer.subscription.deleted"
    ? "canceled"
    : subscription.status;
  const now = new Date().toISOString();
  const isActive = accessStatuses.has(status);
  const wasActive = accessStatuses.has(profile.subscription_status);
  const subscriptionChanged = profile.stripe_subscription_id !== subscriptionId;
  const update = {
    subscription_status: status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_created_at: stripeTimestamp(subscription.created),
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    subscription_cancelled_at: status === "canceled"
      ? stripeTimestamp(subscription.canceled_at || subscription.ended_at) || now
      : null,
    subscription_status_updated_at: now,
    stripe_subscription_event_id: stripeEvent.id,
    updated_at: now,
  };

  if (metadata.plan) update.plan = metadata.plan;
  if (isActive && (!wasActive || subscriptionChanged || !profile.subscription_activated_at)) {
    update.subscription_activated_at = now;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", profile.id)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Could not update White Glove member ${profile.id}.`);
}

async function handleMembershipCheckout(session, stripeEvent) {
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) {
    throw new Error(`Membership checkout ${session.id} has no Stripe subscription.`);
  }

  const subscription = await currentSubscription(subscriptionId);
  await syncMembershipSubscription(subscription, stripeEvent, session.metadata || {}, true);
}

async function handleSubscriptionEvent(stripeEvent) {
  const webhookSubscription = stripeEvent.data.object;
  const subscription = await currentSubscription(stripeId(webhookSubscription.id));
  await syncMembershipSubscription(subscription, stripeEvent);
}

async function handleInvoiceEvent(stripeEvent) {
  const subscriptionId = invoiceSubscriptionId(stripeEvent.data.object);
  if (!subscriptionId) return;

  const subscription = await currentSubscription(subscriptionId);
  await syncMembershipSubscription(subscription, stripeEvent);
}

async function createPaidServiceRequest(session) {
  const metadata = session.metadata || {};
  const userId = metadata.userId || null;

  if (!userId) {
    throw new Error(`Stripe checkout session ${session.id} is missing a Supabase user id.`);
  }

  const { error } = await supabase.from("service_requests").insert({
    user_id: userId,
    vehicle_label: metadata.vehicle || "Vehicle pending",
    service_type: metadata.service || "Concierge service",
    preferred_date: metadata.date || null,
    preferred_time: metadata.time || null,
    status: "Paid / Confirmed",
    notes: [
      `Payment source: ${metadata.source || "White Glove Concierge app"}`,
      `Stripe project tag: ${metadata.project || "white_glove_concierge"}`,
      `Service option: ${metadata.serviceOption || "Not selected"}`,
      `Vehicle ID: ${metadata.vehicleId || "not provided"}`,
      `Vehicle class: ${metadata.vehicleClass || "not provided"}`,
      `Current vehicle location: ${metadata.currentLocation || "not provided"}`,
      `Drop-off / pickup: ${metadata.transportChoice || "not provided"}`,
      `Transportation direction: ${metadata.transportDirection || "not provided"}`,
      `Transportation charge: ${metadata.transportAmount || "not provided"}`,
      `Warranty: ${metadata.warrantyLabel || metadata.warrantyCoverage || "not provided"}`,
      `Payment: ${metadata.paymentTitle || "Payment"} - ${metadata.paymentAmount || "Paid through Stripe"}`,
      `Payment method: ${metadata.paymentMethod || "Stripe Checkout"}`,
      `Stripe session: ${session.id}`,
      metadata.notes,
    ].filter(Boolean).join("\n\n"),
  });

  if (error) throw error;
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
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"],
      stripeWebhookSecret,
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return response(400, { error: "Invalid webhook signature" });
  }

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      if (session.metadata?.checkoutType === "membership_subscription") {
        await handleMembershipCheckout(session, stripeEvent);
      } else {
        await createPaidServiceRequest(session);
      }
    } else if (subscriptionEventTypes.has(stripeEvent.type)) {
      await handleSubscriptionEvent(stripeEvent);
    } else if (invoiceEventTypes.has(stripeEvent.type)) {
      await handleInvoiceEvent(stripeEvent);
    }
  } catch (error) {
    console.error(`Could not process Stripe webhook ${stripeEvent.id} (${stripeEvent.type})`, error);
    return response(500, { error: "Could not process Stripe webhook" });
  }

  return response(200, { received: true });
}
