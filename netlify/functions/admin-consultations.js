import { createClient } from "@supabase/supabase-js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
const allowedStatuses = new Set(["scheduled", "confirmed", "completed", "cancelled"]);

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function authorized(event) {
  return adminPassword && event.headers["x-admin-token"] === adminPassword;
}

export async function handler(event) {
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (!supabase) return json(503, { error: "Admin backend is not configured" });

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("membership_consultations")
      .select("id, user_id, email, full_name, phone, plan, consultation_date, consultation_time, timezone, call_method, call_details, notes, status, created_at")
      .order("consultation_date", { ascending: true })
      .order("consultation_time", { ascending: true });

    if (error) {
      const message = error.code === "42P01" || error.code === "PGRST205"
        ? "Run the membership consultation SQL migration in Supabase first."
        : "Could not load consultations.";
      return json(500, { error: message });
    }
    return json(200, { consultations: data || [] });
  }

  if (event.httpMethod === "PATCH") {
    const payload = JSON.parse(event.body || "{}");
    const id = String(payload.id || "").trim();
    const status = String(payload.status || "").trim().toLowerCase();
    if (!id || !allowedStatuses.has(status)) return json(400, { error: "Choose a consultation and valid status." });

    const { data, error } = await supabase
      .from("membership_consultations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return json(500, { error: "Could not update the consultation." });
    return json(200, { consultation: data });
  }

  return json(405, { error: "Method not allowed" });
}
