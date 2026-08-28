import { createClient } from "@supabase/supabase-js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const allowedPlans = ["Silver", "Club Drive", "Gold", "Platinum", "Collector"];

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

function normalizeCadence(cadence) {
  return cadence === "/year" ? "/year" : "/month";
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
      .from("membership_pricing")
      .select("plan_name, amount_cents, cadence, note, updated_at")
      .order("plan_name", { ascending: true });

    if (error) {
      console.error("Could not load membership pricing", error);
      return json(500, { error: "Could not load membership pricing. Make sure the membership_pricing table exists in Supabase." });
    }

    return json(200, { pricing: data || [] });
  }

  if (event.httpMethod === "PATCH" || event.httpMethod === "POST") {
    const payload = JSON.parse(event.body || "{}");
    const planName = String(payload.planName || payload.plan_name || "").trim();
    const amountCents = payload.amountCents === null || payload.amount_cents === null
      ? null
      : Math.max(0, Math.round(Number(payload.amountCents ?? payload.amount_cents ?? 0)));
    const cadence = normalizeCadence(payload.cadence);
    const note = String(payload.note || "").trim();

    if (!allowedPlans.includes(planName)) {
      return json(400, { error: "Choose a valid membership plan." });
    }

    const { data, error } = await supabase
      .from("membership_pricing")
      .upsert(
        {
          amount_cents: amountCents,
          cadence,
          note: note || null,
          plan_name: planName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plan_name" },
      )
      .select("plan_name, amount_cents, cadence, note, updated_at")
      .single();

    if (error) {
      console.error("Could not update membership pricing", error);
      return json(500, { error: "Could not update membership pricing" });
    }

    return json(200, { pricing: data });
  }

  return json(405, { error: "Method not allowed" });
}
