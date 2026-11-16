import { createClient } from "@supabase/supabase-js";
import { runMaintenanceRecalculation } from "../lib/maintenanceIntelligence.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function bearer(event) {
  const value = event.headers.authorization || event.headers.Authorization || "";
  return value.replace(/^Bearer\s+/i, "").trim();
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!supabase) return json(503, { error: "Maintenance recalculation is not configured." });
  const token = bearer(event);
  const { data: auth, error: authError } = token ? await supabase.auth.getUser(token) : { data: null, error: true };
  if (authError || !auth?.user?.id) return json(401, { error: "Sign in before updating service timing." });
  const body = JSON.parse(event.body || "{}");
  const vehicleId = String(body.vehicleId || "").trim();
  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("user_id", auth.user.id).is("archived_at", null).maybeSingle();
  if (!vehicle) return json(404, { error: "That vehicle is not available in your Garage." });
  try {
    const result = await runMaintenanceRecalculation(supabase, {
      vehicleIds: [vehicleId],
      jobName: "member-mileage-recalculation",
      idempotencyKey: `member-mileage-recalculation:${vehicleId}:${Date.now()}`,
    });
    if (result.errors) return json(500, { error: "Mileage was saved, but service timing needs an administrator review.", result });
    return json(200, { result });
  } catch (error) {
    console.error("Member maintenance recalculation failed", error);
    return json(500, { error: "Mileage was saved, but service timing could not be refreshed right now." });
  }
}
