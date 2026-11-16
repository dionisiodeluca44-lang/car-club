import { createClient } from "@supabase/supabase-js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function authorized(event) {
  const token = event.headers["x-admin-token"];
  return adminPassword && token && token === adminPassword;
}

function clean(value, limit = 500) {
  return String(value || "").trim().slice(0, limit);
}

async function notificationForBenefit(benefit, action) {
  const title = action === "removed" ? "Benefit updated" : "A new benefit is available";
  const body = action === "removed"
    ? `${benefit.label} is no longer available on your membership.`
    : `${benefit.label} has been added to your White Glove membership.`;
  const { error } = await supabase.from("member_notifications").upsert({
    user_id: benefit.user_id,
    category: "benefit_update",
    title,
    body,
    deep_link: "account:benefits",
    dedupe_key: `benefit:${benefit.id}:${action}:${benefit.updated_at || benefit.created_at}`,
    delivery_status: "in_app",
    sent_at: new Date().toISOString(),
    metadata: { assignmentId: benefit.id, action },
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) console.warn("Could not create benefit notification", error);
}

async function loadExperience() {
  const [profiles, benefits, settings, inquiries] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, phone, plan, vehicle_allowance, concierge_24_7, fleet_management, custom_membership_price_cents, custom_membership_cadence, included_services, subscription_status").order("full_name"),
    supabase.from("membership_benefit_assignments").select("*").order("created_at", { ascending: false }),
    supabase.from("notification_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("collector_membership_inquiries").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const firstError = [profiles.error, benefits.error, settings.error, inquiries.error].find(Boolean);
  if (firstError) throw firstError;
  return {
    members: profiles.data || [],
    benefits: benefits.data || [],
    notificationSettings: settings.data || null,
    collectorInquiries: inquiries.data || [],
  };
}

export async function handler(event) {
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (!supabase) return json(503, { error: "Admin backend is not configured" });

  if (event.httpMethod === "GET") {
    try {
      return json(200, await loadExperience());
    } catch (error) {
      console.error("Could not load member experience controls", error);
      return json(500, { error: "Run the complete platform update SQL in Supabase before using these controls." });
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request." });
  }

  if (event.httpMethod === "POST" && payload.action === "assign-benefit") {
    const userId = clean(payload.userId, 80);
    const benefitKey = clean(payload.benefitKey, 80);
    const label = clean(payload.label, 160);
    const quantity = Math.max(1, Math.min(100, Number(payload.quantity) || 1));
    if (!userId || !benefitKey || !label) return json(400, { error: "Choose a member and enter the benefit details." });
    const { data, error } = await supabase.from("membership_benefit_assignments").insert({
      user_id: userId,
      benefit_key: benefitKey,
      label,
      description: clean(payload.description, 600) || null,
      quantity_total: quantity,
      credit_cents: Math.max(0, Math.round(Number(payload.creditCents) || 0)),
      expires_at: payload.expiresAt || null,
      created_by: "admin-portal",
    }).select("*").single();
    if (error) return json(500, { error: "Could not assign that benefit." });
    await supabase.from("membership_benefit_audit_logs").insert({ assignment_id: data.id, user_id: userId, action: "assigned", quantity_delta: quantity, actor: "admin-portal" });
    await notificationForBenefit(data, "assigned");
    return json(200, { benefit: data });
  }

  if (event.httpMethod === "PATCH" && payload.action === "update-benefit") {
    const benefitId = clean(payload.benefitId, 80);
    const { data: existing } = await supabase.from("membership_benefit_assignments").select("*").eq("id", benefitId).maybeSingle();
    if (!existing) return json(404, { error: "Could not find that benefit." });
    const quantity = Math.max(Number(existing.quantity_redeemed) || 0, Math.min(100, Number(payload.quantityTotal) || 1));
    const update = {
      label: clean(payload.label, 160) || existing.label,
      description: clean(payload.description, 600) || null,
      quantity_total: quantity,
      credit_cents: payload.creditCents == null ? existing.credit_cents : Math.max(0, Math.round(Number(payload.creditCents) || 0)),
      expires_at: payload.expiresAt || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("membership_benefit_assignments").update(update).eq("id", benefitId).select("*").single();
    if (error) return json(500, { error: "Could not update that benefit." });
    await supabase.from("membership_benefit_audit_logs").insert({ assignment_id: benefitId, user_id: existing.user_id, action: "edited", actor: "admin-portal", details: update });
    await notificationForBenefit(data, "updated");
    return json(200, { benefit: data });
  }

  if (event.httpMethod === "PATCH" && payload.action === "update-notification-settings") {
    const update = {
      recommendation_enabled: payload.recommendationEnabled !== false,
      maintenance_enabled: payload.maintenanceEnabled !== false,
      mileage_enabled: payload.mileageEnabled !== false,
      benefit_enabled: payload.benefitEnabled !== false,
      appointment_enabled: payload.appointmentEnabled !== false,
      reminder_days: Array.from(new Set((payload.reminderDays || [7, 3, 0]).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 365))).sort((a, b) => b - a),
      overdue_repeat_days: Math.max(1, Math.min(30, Number(payload.overdueRepeatDays) || 3)),
      mileage_interval_days: Math.max(7, Math.min(365, Number(payload.mileageIntervalDays) || 60)),
      timezone: clean(payload.timezone, 80) || "America/Toronto",
      updated_by: "admin-portal",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("notification_settings").upsert({ id: true, ...update }).select("*").single();
    if (error) return json(500, { error: "Could not update notification settings." });
    return json(200, { notificationSettings: data });
  }

  if (event.httpMethod === "PATCH" && payload.action === "configure-collector") {
    const userId = clean(payload.userId, 80);
    const allowance = Math.max(2, Math.min(100, Number(payload.vehicleAllowance) || 2));
    const { data, error } = await supabase.from("profiles").update({
      plan: "Collector",
      vehicle_allowance: allowance,
      concierge_24_7: true,
      fleet_management: payload.fleetManagement !== false,
      custom_membership_price_cents: payload.priceCents == null ? null : Math.max(0, Math.round(Number(payload.priceCents) || 0)),
      custom_membership_cadence: ["/month", "/year"].includes(payload.cadence) ? payload.cadence : null,
      included_services: Array.isArray(payload.includedServices) ? payload.includedServices : [],
      updated_at: new Date().toISOString(),
    }).eq("id", userId).select("*").single();
    if (error) return json(500, { error: "Could not configure the Collector membership." });
    return json(200, { member: data });
  }

  if (event.httpMethod === "DELETE") {
    const benefitId = clean(payload.benefitId, 80);
    const { data: existing } = await supabase.from("membership_benefit_assignments").select("*").eq("id", benefitId).maybeSingle();
    if (!existing) return json(404, { error: "Could not find that benefit." });
    const update = { status: "removed", updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("membership_benefit_assignments").update(update).eq("id", benefitId).select("*").single();
    if (error) return json(500, { error: "Could not remove that benefit." });
    await supabase.from("membership_benefit_audit_logs").insert({ assignment_id: benefitId, user_id: existing.user_id, action: "removed", actor: "admin-portal" });
    await notificationForBenefit(data, "removed");
    return json(200, { benefit: data });
  }

  return json(400, { error: "Choose a supported member experience action." });
}
