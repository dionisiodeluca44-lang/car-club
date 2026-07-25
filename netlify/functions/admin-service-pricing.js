import { createClient } from "@supabase/supabase-js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function authorized(event) {
  const headerToken = event.headers["x-admin-token"];
  return adminPassword && headerToken && headerToken === adminPassword;
}

function normalizePaymentMode(paymentMode) {
  if (paymentMode === "full" || paymentMode === "free") return paymentMode;
  return "deposit";
}

export async function handler(event) {
  if (!authorized(event)) {
    return json(401, { error: "Unauthorized" });
  }

  if (!supabase) {
    return json(503, { error: "Admin backend is not configured" });
  }

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("service_pricing")
      .select("service_label, payment_mode, amount_cents, note, updated_at")
      .order("service_label", { ascending: true });

    if (error) {
      console.error("Could not load service pricing", error);
      return json(500, { error: "Could not load service pricing. Make sure the service_pricing table exists in Supabase." });
    }

    return json(200, { pricing: data || [] });
  }

  if (event.httpMethod === "PATCH" || event.httpMethod === "POST") {
    const payload = JSON.parse(event.body || "{}");
    const serviceLabel = String(payload.serviceLabel || payload.service_label || "").trim();
    const paymentMode = normalizePaymentMode(payload.paymentMode || payload.payment_mode);
    const amountCents = paymentMode === "free" ? 0 : Math.max(0, Math.round(Number(payload.amountCents ?? payload.amount_cents ?? 0)));
    const note = String(payload.note || "").trim();

    if (!serviceLabel) {
      return json(400, { error: "Service label is required" });
    }

    const { data, error } = await supabase
      .from("service_pricing")
      .upsert(
        {
          amount_cents: amountCents,
          note: note || null,
          payment_mode: paymentMode,
          service_label: serviceLabel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service_label" },
      )
      .select("service_label, payment_mode, amount_cents, note, updated_at")
      .single();

    if (error) {
      console.error("Could not update service pricing", error);
      return json(500, { error: "Could not update service pricing" });
    }

    return json(200, { pricing: data });
  }

  return json(405, { error: "Method not allowed" });
}
