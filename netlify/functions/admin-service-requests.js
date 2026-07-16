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

export async function handler(event) {
  if (!authorized(event)) {
    return json(401, { error: "Unauthorized" });
  }

  if (!supabase) {
    return json(503, { error: "Admin backend is not configured" });
  }

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("service_requests")
      .select("id, user_id, vehicle_label, service_type, preferred_date, preferred_time, notes, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Could not load service requests", error);
      return json(500, { error: "Could not load service requests" });
    }

    const userIds = [...new Set((data || []).map((request) => request.user_id).filter(Boolean))];
    const profileMap = new Map();

    if (userIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, plan")
        .in("id", userIds);

      if (profileError) {
        console.warn("Could not attach member profiles to service requests", profileError);
      }

      for (const profile of profiles || []) {
        profileMap.set(profile.id, profile);
      }
    }

    return json(200, {
      requests: (data || []).map((request) => ({
        ...request,
        member: profileMap.get(request.user_id) || null,
      })),
    });
  }

  if (event.httpMethod === "PATCH") {
    const payload = JSON.parse(event.body || "{}");
    const { id, status } = payload;

    if (!id || !status) {
      return json(400, { error: "Request id and status are required" });
    }

    const { data, error } = await supabase
      .from("service_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      console.error("Could not update service request", error);
      return json(500, { error: "Could not update service request" });
    }

    return json(200, { request: data });
  }

  return json(405, { error: "Method not allowed" });
}
