import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function currentUser(event) {
  const token = String(event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !supabase) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!supabase) return json(503, { error: "Membership inquiries are not configured." });
  const user = await currentUser(event);
  if (!user) return json(401, { error: "Sign in before requesting Collector pricing." });
  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid request." }); }
  const vehicleCount = Math.max(2, Math.min(100, Number(payload.vehicleCount) || 2));
  const { data, error } = await supabase.from("collector_membership_inquiries").insert({
    user_id: user.id,
    full_name: String(payload.memberName || user.user_metadata?.full_name || "Member").trim().slice(0, 160),
    email: user.email,
    phone: String(payload.phone || "").trim().slice(0, 80) || null,
    vehicle_count: vehicleCount,
    message: String(payload.needs || "Collector membership pricing and fleet support consultation.").trim().slice(0, 1200),
    status: "new",
  }).select("id, status, created_at").single();
  if (error) {
    console.error("Could not save Collector inquiry", error);
    return json(500, { error: "Could not save the Collector pricing request." });
  }
  return json(200, { inquiry: data });
}
