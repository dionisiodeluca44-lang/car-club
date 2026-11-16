import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
const oneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;

export const config = { schedule: "@daily" };

function daysBetween(left, right) {
  return Math.round((new Date(`${right}T12:00:00Z`) - new Date(`${left}T12:00:00Z`)) / 86400000);
}

function vehicleLabel(vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "your vehicle";
}

function reminderAllowed(profile, category) {
  const preferences = profile?.notifications || {};
  if (category === "mileage_reminder") return preferences.mileageReminders !== false && preferences.serviceReminders !== false;
  if (category === "service_recommendation") return preferences.recommendationUpdates !== false && preferences.serviceReminders !== false;
  if (category === "maintenance_reminder") return preferences.serviceReminders !== false;
  if (category === "appointment_update") return preferences.bookingUpdates !== false;
  if (category === "benefit_update") return preferences.benefitUpdates !== false;
  return true;
}

async function insertNotification(supabase, notification) {
  const { data, error } = await supabase.from("member_notifications").upsert(notification, {
    onConflict: "dedupe_key",
    ignoreDuplicates: true,
  }).select("*").maybeSingle();
  if (error) throw error;
  return data || null;
}

async function sendOneSignal(notification) {
  if (!notification || !oneSignalAppId || !oneSignalRestApiKey) return { sent: false, reason: "provider_not_configured" };
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      Authorization: `Key ${oneSignalRestApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      include_aliases: { external_id: [notification.user_id] },
      target_channel: "push",
      headings: { en: notification.title },
      contents: { en: notification.body },
      data: { deepLink: notification.deep_link, notificationId: notification.id },
    }),
  });
  if (!response.ok) throw new Error(`OneSignal returned ${response.status}`);
  return { sent: true };
}

export async function handler() {
  if (!supabaseUrl || !serviceRoleKey) return { statusCode: 503 };
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = new Date().toISOString().slice(0, 10);
  const stats = { created: 0, sent: 0, inAppOnly: 0, errors: 0 };

  try {
    const [settingsResult, profilesResult, vehiclesResult, forecastsResult, rulesResult, appointmentsResult] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("profiles").select("id, notifications, subscription_status"),
      supabase.from("vehicles").select("id, user_id, year, make, model, trim, mileage, mileage_unit, last_mileage_update, archived_at, created_at").is("archived_at", null),
      supabase.from("vehicle_maintenance_forecasts").select("id, vehicle_id, rule_id, next_due_date, next_due_mileage_km, status, confidence, calculated_at, archived_at").is("archived_at", null),
      supabase.from("vehicle_maintenance_rules").select("id, service_type, name"),
      supabase.from("service_requests").select("id, user_id, vehicle_id, service_type, preferred_date, preferred_time, status").gte("preferred_date", today).neq("status", "Cancelled").neq("status", "Canceled").neq("status", "Archived"),
    ]);
    const error = [settingsResult.error, profilesResult.error, vehiclesResult.error, forecastsResult.error, rulesResult.error, appointmentsResult.error].find(Boolean);
    if (error) throw error;

    const settings = settingsResult.data || { reminder_days: [7, 3, 0], overdue_repeat_days: 3, mileage_interval_days: 60 };
    const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
    const vehicleById = new Map((vehiclesResult.data || []).map((vehicle) => [vehicle.id, vehicle]));
    const ruleById = new Map((rulesResult.data || []).map((rule) => [rule.id, rule]));
    const candidates = [];

    if (settings.recommendation_enabled !== false || settings.maintenance_enabled !== false) {
      (forecastsResult.data || []).forEach((forecast) => {
        const vehicle = vehicleById.get(forecast.vehicle_id);
        const profile = profileById.get(vehicle?.user_id);
        if (!vehicle || !profile || !["active", "trialing"].includes(profile.subscription_status)) return;
        if (["Scheduled", "Completed", "Dismissed", "Not Applicable"].includes(forecast.status)) return;
        const rule = ruleById.get(forecast.rule_id);
        const service = rule?.service_type || rule?.name || "recommended service";
        const label = vehicleLabel(vehicle);
        if (settings.recommendation_enabled !== false && reminderAllowed(profile, "service_recommendation") && ["Approaching", "Due", "Overdue"].includes(forecast.status)) {
          candidates.push({
            user_id: vehicle.user_id, vehicle_id: vehicle.id, category: "service_recommendation",
            title: `Service recommendation for ${label}`,
            body: `${service} is now ${forecast.status.toLowerCase()}. Review the recommendation and book when ready.`,
            deep_link: `schedule:${vehicle.id}:${forecast.id}`,
            dedupe_key: `recommendation:${forecast.id}:${forecast.status}`,
            delivery_status: "in_app", sent_at: new Date().toISOString(), metadata: { forecastId: forecast.id, status: forecast.status },
          });
        }
        if (settings.maintenance_enabled === false || !reminderAllowed(profile, "maintenance_reminder") || !forecast.next_due_date) return;
        const daysUntil = daysBetween(today, forecast.next_due_date);
        const configuredDays = settings.reminder_days || [7, 3, 0];
        let cadenceKey = "";
        if (configuredDays.includes(daysUntil)) cadenceKey = `before:${daysUntil}`;
        else if (daysUntil < 0 && Math.abs(daysUntil) % Number(settings.overdue_repeat_days || 3) === 0) cadenceKey = `overdue:${Math.abs(daysUntil)}`;
        if (!cadenceKey) return;
        candidates.push({
          user_id: vehicle.user_id, vehicle_id: vehicle.id, category: "maintenance_reminder",
          title: daysUntil < 0 ? `${service} is overdue` : daysUntil === 0 ? `${service} is due today` : `${service} is due soon`,
          body: daysUntil < 0 ? `${label} is ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue.` : `${label} is due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`,
          deep_link: `schedule:${vehicle.id}:${forecast.id}`,
          dedupe_key: `maintenance:${forecast.id}:${forecast.next_due_date}:${cadenceKey}`,
          delivery_status: "in_app", sent_at: new Date().toISOString(), metadata: { forecastId: forecast.id, dueDate: forecast.next_due_date },
        });
      });
    }

    if (settings.mileage_enabled !== false) {
      (vehiclesResult.data || []).forEach((vehicle) => {
        const profile = profileById.get(vehicle.user_id);
        if (!profile || !["active", "trialing"].includes(profile.subscription_status) || !reminderAllowed(profile, "mileage_reminder")) return;
        const lastUpdate = vehicle.last_mileage_update ? String(vehicle.last_mileage_update).slice(0, 10) : String(vehicle.created_at || "").slice(0, 10);
        if (!lastUpdate) return;
        const elapsed = daysBetween(lastUpdate, today);
        const interval = Number(settings.mileage_interval_days || 60);
        if (elapsed < interval || elapsed % interval !== 0) return;
        candidates.push({
          user_id: vehicle.user_id, vehicle_id: vehicle.id, category: "mileage_reminder",
          title: "Quick mileage check-in",
          body: `Update the odometer for ${vehicleLabel(vehicle)} so service timing stays accurate.`,
          deep_link: `garage:${vehicle.id}:mileage`,
          dedupe_key: `mileage:${vehicle.id}:${today}`,
          delivery_status: "in_app", sent_at: new Date().toISOString(), metadata: { lastMileageUpdate: lastUpdate },
        });
      });
    }

    if (settings.appointment_enabled !== false) {
      (appointmentsResult.data || []).forEach((appointment) => {
        const profile = profileById.get(appointment.user_id);
        if (!profile || !reminderAllowed(profile, "appointment_update")) return;
        const daysUntil = daysBetween(today, appointment.preferred_date);
        if (![7, 3, 1, 0].includes(daysUntil)) return;
        candidates.push({
          user_id: appointment.user_id, vehicle_id: appointment.vehicle_id, category: "appointment_update",
          title: daysUntil === 0 ? "Appointment today" : "Upcoming appointment",
          body: `${appointment.service_type} is ${daysUntil === 0 ? "scheduled for today" : `coming up in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}.`,
          deep_link: `schedule:${appointment.vehicle_id || ""}:${appointment.id}`,
          dedupe_key: `appointment:${appointment.id}:${appointment.preferred_date}:${daysUntil}`,
          delivery_status: "in_app", sent_at: new Date().toISOString(), metadata: { appointmentId: appointment.id },
        });
      });
    }

    for (const candidate of candidates) {
      try {
        const saved = await insertNotification(supabase, candidate);
        if (!saved) continue;
        stats.created += 1;
        const delivery = await sendOneSignal(saved);
        if (delivery.sent) {
          stats.sent += 1;
          await supabase.from("member_notifications").update({ delivery_status: "sent", attempts: 1, sent_at: new Date().toISOString() }).eq("id", saved.id);
        } else {
          stats.inAppOnly += 1;
        }
      } catch (error) {
        stats.errors += 1;
        console.error("Notification candidate failed", error);
      }
    }
    console.log("Member notification job complete", stats);
    return { statusCode: 200, body: JSON.stringify(stats) };
  } catch (error) {
    console.error("Member notification job failed", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
