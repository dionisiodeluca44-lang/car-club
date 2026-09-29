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

function effectivePlan(profile) {
  return profile?.collector_access_override ? "Collector" : profile?.plan;
}

async function memberWithVehicleCount(profile) {
  const { count, error } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id);

  if (error) throw error;
  return {
    ...profile,
    plan: effectivePlan(profile),
    vehicle_count: count || 0,
  };
}

export async function handler(event) {
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (!supabase) return json(503, { error: "Admin backend is not configured" });

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, plan, collector_access_override, extra_vehicle_slots, subscription_status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load member Garage access", error);
      return json(500, { error: "Could not load member Garage access. Make sure the Garage capacity migration has been run." });
    }

    try {
      const members = await Promise.all((data || []).map(memberWithVehicleCount));
      return json(200, { members });
    } catch (countError) {
      console.error("Could not count member vehicles", countError);
      return json(500, { error: "Could not count member vehicles." });
    }
  }

  if (event.httpMethod === "PATCH") {
    const payload = JSON.parse(event.body || "{}");
    const memberId = String(payload.memberId || "").trim();
    const extraVehicleSlots = Number(payload.extraVehicleSlots);

    if (!memberId || !Number.isInteger(extraVehicleSlots) || extraVehicleSlots < 0 || extraVehicleSlots > 100) {
      return json(400, { error: "Choose a member and enter between 0 and 100 extra vehicle spots." });
    }

    const { data: existing, error: loadError } = await supabase
      .from("profiles")
      .select("id, email, full_name, plan, collector_access_override, extra_vehicle_slots, subscription_status, created_at")
      .eq("id", memberId)
      .single();

    if (loadError || !existing) return json(404, { error: "Could not find that member." });
    if (effectivePlan(existing) !== "Collector") {
      return json(409, { error: "Extra Garage spots can only be added to a Collector account." });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ extra_vehicle_slots: extraVehicleSlots, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .select("id, email, full_name, plan, collector_access_override, extra_vehicle_slots, subscription_status, created_at")
      .single();

    if (error) {
      console.error("Could not update member Garage capacity", error);
      return json(500, { error: "Could not update Garage capacity." });
    }

    try {
      return json(200, { member: await memberWithVehicleCount(data) });
    } catch {
      return json(200, { member: { ...data, plan: effectivePlan(data) } });
    }
  }

  return json(405, { error: "Method not allowed" });
}
