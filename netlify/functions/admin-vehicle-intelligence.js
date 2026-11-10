import { createClient } from "@supabase/supabase-js";
import { mileageCorrectionRequired, normalizeMileageUnit, normalizeOdometer } from "../../shared/vehicleIntelligence.js";
import { getMaintenanceIntelligence, runMaintenanceRecalculation } from "../lib/maintenanceIntelligence.js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
function authorized(event) {
  return Boolean(adminPassword && event.headers["x-admin-token"] === adminPassword);
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function clean(value, limit = 1000) {
  return String(value || "").trim().slice(0, limit);
}

function integerOrNull(value) {
  if (value === "" || value == null) return null;
  const integer = Number.parseInt(value, 10);
  return Number.isInteger(integer) && integer > 0 ? integer : null;
}

function stableKey(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadVehicle(vehicleId) {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
  if (error || !data) throw Object.assign(new Error("Vehicle not found."), { statusCode: 404 });
  return data;
}

async function audit({ action, entityId, entityType, nextValue, previousValue }) {
  const { error } = await supabase.from("crm_audit_logs").insert({
    actor_type: "administrator",
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_value: previousValue || null,
    new_value: nextValue || null,
  });
  if (error) console.error("Could not write Vehicle Intelligence audit log", error);
}

async function getVehicleIntelligence() {
  const [profilesResult, vehiclesResult, mileageResult, historyResult, requestsResult] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, phone, plan, subscription_status, created_at"),
    supabase.from("vehicles").select("*").order("updated_at", { ascending: false }),
    supabase.from("vehicle_mileage_readings").select("*").order("recorded_at", { ascending: false }),
    supabase.from("vehicle_service_history").select("*").order("service_date", { ascending: false }),
    supabase.from("service_requests").select("*").order("created_at", { ascending: false }),
  ]);

  const migrationError = [vehiclesResult, mileageResult, historyResult, requestsResult].find((result) => result.error)?.error;
  if (migrationError) {
    throw Object.assign(new Error(`Vehicle Intelligence data is unavailable: ${migrationError.message}`), { statusCode: 503 });
  }
  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const readingsByVehicle = new Map();
  const historyByVehicle = new Map();
  const requestsByVehicle = new Map();

  for (const reading of mileageResult.data || []) {
    const items = readingsByVehicle.get(reading.vehicle_id) || [];
    items.push(reading);
    readingsByVehicle.set(reading.vehicle_id, items);
  }
  for (const service of historyResult.data || []) {
    const items = historyByVehicle.get(service.vehicle_id) || [];
    items.push(service);
    historyByVehicle.set(service.vehicle_id, items);
  }
  for (const request of requestsResult.data || []) {
    if (!request.vehicle_id) continue;
    const items = requestsByVehicle.get(request.vehicle_id) || [];
    items.push(request);
    requestsByVehicle.set(request.vehicle_id, items);
  }

  let maintenance = { available: false, settings: null, rules: [], forecasts: [], tasks: [], jobRuns: [] };
  try {
    maintenance = await getMaintenanceIntelligence(supabase);
  } catch (error) {
    if (!["42P01", "PGRST205"].includes(error.code)) throw error;
  }
  const forecastsByVehicle = new Map();
  for (const forecast of maintenance.forecasts || []) {
    const items = forecastsByVehicle.get(forecast.vehicle_id) || [];
    items.push(forecast);
    forecastsByVehicle.set(forecast.vehicle_id, items);
  }
  const rulesById = new Map((maintenance.rules || []).map((rule) => [rule.id, rule]));

  const vehicles = (vehiclesResult.data || []).map((vehicle) => ({
    ...vehicle,
    customer: profiles.get(vehicle.user_id) || null,
    mileage_readings: readingsByVehicle.get(vehicle.id) || [],
    service_history: historyByVehicle.get(vehicle.id) || [],
    appointments: requestsByVehicle.get(vehicle.id) || [],
    maintenance_forecasts: (forecastsByVehicle.get(vehicle.id) || []).map((forecast) => ({
      ...forecast,
      rule: rulesById.get(forecast.rule_id) || null,
    })),
  }));

  const today = dateOnly(new Date().toISOString());
  const activeAppointments = (requestsResult.data || []).filter((request) => (
    request.preferred_date >= today
    && !["Cancelled", "Completed"].includes(request.status)
  ));
  const staleMileageCutoff = Date.now() - (60 * 24 * 60 * 60 * 1000);
  const customersNeedingMileage = new Set(vehicles
    .filter((vehicle) => {
      const lastReading = readingsByVehicle.get(vehicle.id)?.[0];
      return !lastReading || new Date(lastReading.recorded_at).getTime() < staleMileageCutoff;
    })
    .map((vehicle) => vehicle.user_id));
  const estimatedPotentialRevenueCents = (requestsResult.data || [])
    .filter((request) => !["Cancelled", "Completed"].includes(request.status))
    .reduce((total, request) => total + Math.max(0, Number(request.quoted_total_cents) || 0), 0);
  const activeCustomerIds = new Set(vehicles
    .filter((vehicle) => !vehicle.archived_at && ["active", "trialing"].includes(String(vehicle.customer?.subscription_status || "").toLowerCase()))
    .map((vehicle) => vehicle.user_id));
  const activeVehicles = vehicles.filter((vehicle) => !vehicle.archived_at);

  const actionableForecasts = (maintenance.forecasts || []).filter((forecast) => !forecast.archived_at);
  return {
    overview: {
      totalVehicles: activeVehicles.length,
      archivedVehicles: vehicles.length - activeVehicles.length,
      activeCustomers: activeCustomerIds.size,
      vehiclesRequiringAttention: activeVehicles.filter((vehicle) => !(readingsByVehicle.get(vehicle.id) || []).length).length,
      maintenanceDue7Days: actionableForecasts.filter((forecast) => forecast.status === "Due").length,
      maintenanceDue30Days: actionableForecasts.filter((forecast) => forecast.status === "Approaching").length,
      overdueMaintenance: actionableForecasts.filter((forecast) => forecast.status === "Overdue").length,
      customersNeedingMileage: customersNeedingMileage.size,
      upcomingAppointments: activeAppointments.length,
      pendingOutreachApprovals: 0,
      unansweredFollowUps: 0,
      estimatedPotentialRevenueCents,
      completedMaintenanceAppointments: (requestsResult.data || []).filter((request) => request.status === "Completed").length,
      pendingMaintenanceTasks: (maintenance.tasks || []).filter((task) => ["open", "in_progress", "snoozed"].includes(task.status)).length,
      forecastingAvailable: maintenance.available,
    },
    vehicles,
    maintenance,
  };
}

async function recordMileage(payload) {
  const vehicle = await loadVehicle(clean(payload.vehicleId, 80));
  const odometerValue = normalizeOdometer(payload.odometerValue);
  if (odometerValue === null) {
    throw Object.assign(new Error("Enter a valid odometer reading."), { statusCode: 400 });
  }
  const recordedAt = payload.recordedAt || new Date().toISOString();
  if (Number.isNaN(new Date(recordedAt).getTime()) || new Date(recordedAt).getTime() > Date.now() + (24 * 60 * 60 * 1000)) {
    throw Object.assign(new Error("Mileage cannot be recorded with a future date."), { statusCode: 400 });
  }
  const { data: latest } = await supabase
    .from("vehicle_mileage_readings")
    .select("id, odometer_value, unit, recorded_at")
    .eq("vehicle_id", vehicle.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isCorrection = Boolean(payload.isCorrection);
  if (latest && mileageCorrectionRequired(latest.odometer_value, odometerValue) && !isCorrection) {
    throw Object.assign(new Error("This reading is lower than the latest odometer. Mark it as a correction to continue."), { statusCode: 409 });
  }

  const record = {
    vehicle_id: vehicle.id,
    user_id: vehicle.user_id,
    odometer_value: odometerValue,
    unit: normalizeMileageUnit(payload.unit),
    recorded_at: recordedAt,
    source: "administrator",
    verification_status: isCorrection ? "corrected" : "verified",
    note: clean(payload.note) || null,
  };
  const { data, error } = await supabase.from("vehicle_mileage_readings").insert(record).select("*").single();
  if (error) throw error;
  await audit({
    action: isCorrection ? "correct_mileage" : "record_mileage",
    entityId: vehicle.id,
    entityType: "vehicle",
    previousValue: latest || null,
    nextValue: data,
  });
  return data;
}

async function recordService(payload) {
  const vehicle = await loadVehicle(clean(payload.vehicleId, 80));
  const serviceType = clean(payload.serviceType, 180);
  const serviceDate = dateOnly(payload.serviceDate);
  if (!serviceType || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw Object.assign(new Error("Enter the service performed and service date."), { statusCode: 400 });
  }
  if (serviceDate > dateOnly(new Date().toISOString())) {
    throw Object.assign(new Error("Completed service history cannot use a future date."), { statusCode: 400 });
  }
  const serviceMileage = payload.serviceMileage === "" || payload.serviceMileage == null ? null : normalizeOdometer(payload.serviceMileage);
  if (payload.serviceMileage !== "" && payload.serviceMileage != null && serviceMileage === null) {
    throw Object.assign(new Error("Enter a valid service mileage."), { statusCode: 400 });
  }
  const appointmentId = clean(payload.appointmentId, 80) || null;
  if (appointmentId) {
    const { data: appointment, error: appointmentError } = await supabase
      .from("service_requests")
      .select("id, vehicle_id, status")
      .eq("id", appointmentId)
      .single();
    if (appointmentError || appointment?.vehicle_id !== vehicle.id || appointment?.status !== "Completed") {
      throw Object.assign(new Error("Only a completed appointment for this vehicle can be linked to performed service."), { statusCode: 400 });
    }
  }
  const record = {
    vehicle_id: vehicle.id,
    user_id: vehicle.user_id,
    service_type: serviceType,
    appointment_id: appointmentId,
    service_date: serviceDate,
    service_mileage: serviceMileage,
    mileage_unit: normalizeMileageUnit(payload.mileageUnit),
    provider: clean(payload.provider, 240) || null,
    service_description: clean(payload.description, 2000) || null,
    verification_status: "verified",
    invoice_reference: clean(payload.invoiceReference, 400) || null,
  };
  const { data, error } = await supabase.from("vehicle_service_history").insert(record).select("*").single();
  if (error) throw error;
  await audit({ action: "record_service_history", entityId: vehicle.id, entityType: "vehicle", nextValue: data });
  return data;
}

async function updateVehicleMaintenanceProfile(payload) {
  const vehicle = await loadVehicle(clean(payload.vehicleId, 80));
  const preferences = {
    ...(vehicle.service_preferences || {}),
    severeService: Boolean(payload.severeService),
    severeServiceNote: clean(payload.severeServiceNote, 1000) || null,
  };
  if (preferences.severeService && !preferences.severeServiceNote) {
    throw Object.assign(new Error("Document why this vehicle should use a severe-service schedule."), { statusCode: 400 });
  }
  const { data, error } = await supabase.from("vehicles").update({
    service_preferences: preferences,
    maintenance_recalculation_required: true,
    maintenance_recalculation_requested_at: new Date().toISOString(),
  }).eq("id", vehicle.id).select("*").single();
  if (error) throw error;
  await audit({ action: "update_vehicle_maintenance_profile", entityId: vehicle.id, entityType: "vehicle", previousValue: vehicle.service_preferences, nextValue: preferences });
  return data;
}

async function createRuleVersion(payload) {
  const key = stableKey(payload.stableKey || payload.ruleName);
  const ruleName = clean(payload.ruleName, 180);
  const serviceType = clean(payload.serviceType, 180);
  const sourceType = clean(payload.sourceType, 40);
  const sourceReference = clean(payload.sourceReference, 1000);
  const sourceVersion = clean(payload.sourceVersion, 200) || null;
  const explanation = clean(payload.customerExplanation, 1500);
  const allowedCategories = new Set(["mechanical", "tires", "preventative", "concierge"]);
  const allowedSources = new Set(["manufacturer", "verified_provider", "internal_inspection", "optional_concierge"]);
  const allowedTypes = new Set(["scheduled_maintenance", "inspection", "customer_issue", "optional_concierge", "promotion"]);
  if (!key || !ruleName || !serviceType || !sourceReference || !explanation) {
    throw Object.assign(new Error("Rule name, service, source reference, and explanation are required."), { statusCode: 400 });
  }
  if (!allowedCategories.has(payload.serviceCategory) || !allowedSources.has(sourceType) || !allowedTypes.has(payload.recommendationType)) {
    throw Object.assign(new Error("Choose valid rule category, type, and source values."), { statusCode: 400 });
  }
  const applicability = payload.vehicleApplicability && typeof payload.vehicleApplicability === "object"
    ? payload.vehicleApplicability
    : {};
  if (sourceType === "manufacturer" && (!sourceVersion || (!applicability.makes?.length && !applicability.models?.length))) {
    throw Object.assign(new Error("Manufacturer rules require a source version and exact vehicle applicability."), { statusCode: 400 });
  }
  const mileageIntervalKm = integerOrNull(payload.mileageIntervalKm);
  const timeIntervalMonths = integerOrNull(payload.timeIntervalMonths);
  const requiresInspection = Boolean(payload.requiresInspection);
  if (!mileageIntervalKm && !timeIntervalMonths && !requiresInspection && !["customer_issue", "optional_concierge", "promotion"].includes(payload.recommendationType)) {
    throw Object.assign(new Error("Add a sourced interval or mark the rule as inspection required."), { statusCode: 400 });
  }
  const severeConditions = payload.severeServiceConditions && typeof payload.severeServiceConditions === "object"
    ? {
        mileageIntervalKm: integerOrNull(payload.severeServiceConditions.mileageIntervalKm),
        timeIntervalMonths: integerOrNull(payload.severeServiceConditions.timeIntervalMonths),
        condition: clean(payload.severeServiceConditions.condition, 1000),
      }
    : {};
  if ((severeConditions.mileageIntervalKm || severeConditions.timeIntervalMonths) && !severeConditions.condition) {
    throw Object.assign(new Error("Document the sourced severe-service condition before using an adjusted interval."), { statusCode: 400 });
  }
  const { data: latest, error: latestError } = await supabase
    .from("vehicle_maintenance_rules")
    .select("id, version")
    .eq("stable_key", key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  const record = {
    stable_key: key,
    version: Number(latest?.version || 0) + 1,
    rule_name: ruleName,
    service_type: serviceType,
    service_aliases: Array.isArray(payload.serviceAliases) ? payload.serviceAliases.map((item) => clean(item, 180)).filter(Boolean) : [],
    service_category: payload.serviceCategory,
    recommendation_type: payload.recommendationType,
    vehicle_applicability: applicability,
    mileage_interval_km: mileageIntervalKm,
    time_interval_months: timeIntervalMonths,
    severe_service_conditions: severeConditions,
    source_type: sourceType,
    source_reference: sourceReference,
    source_version: sourceVersion,
    confidence_level: ["High", "Medium", "Low"].includes(payload.confidenceLevel) ? payload.confidenceLevel : "Low",
    customer_explanation: explanation,
    requires_inspection: requiresInspection,
    safety_related: Boolean(payload.safetyRelated),
    approval_status: "draft",
    active: false,
    supersedes_rule_id: latest?.id || null,
  };
  const { data, error } = await supabase.from("vehicle_maintenance_rules").insert(record).select("*").single();
  if (error) throw error;
  await audit({ action: "create_maintenance_rule_version", entityId: data.id, entityType: "maintenance_rule", nextValue: data });
  return data;
}

async function approveRule(payload) {
  const ruleId = clean(payload.ruleId, 80);
  if (!ruleId) throw Object.assign(new Error("Choose a draft rule to approve."), { statusCode: 400 });
  const { data: current, error: currentError } = await supabase.from("vehicle_maintenance_rules").select("*").eq("id", ruleId).single();
  if (currentError) throw currentError;
  if (current.approval_status !== "draft") throw Object.assign(new Error("Only a draft rule can be approved."), { statusCode: 409 });
  const { data, error } = await supabase.rpc("approve_vehicle_maintenance_rule", { p_rule_id: ruleId });
  if (error) throw error;
  await audit({ action: "approve_maintenance_rule", entityId: ruleId, entityType: "maintenance_rule", previousValue: current, nextValue: data });
  return data;
}

async function retireRule(payload) {
  const ruleId = clean(payload.ruleId, 80);
  if (!ruleId) throw Object.assign(new Error("Choose a rule to retire."), { statusCode: 400 });
  const { data: current, error: currentError } = await supabase.from("vehicle_maintenance_rules").select("*").eq("id", ruleId).single();
  if (currentError) throw currentError;
  const { data, error } = await supabase.from("vehicle_maintenance_rules").update({
    approval_status: "retired",
    active: false,
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", ruleId).select("*").single();
  if (error) throw error;
  await audit({ action: "retire_maintenance_rule", entityId: ruleId, entityType: "maintenance_rule", previousValue: current, nextValue: data });
  return data;
}

async function updateMaintenanceTask(payload) {
  const taskId = clean(payload.taskId, 80);
  const status = clean(payload.status, 30);
  if (!taskId || !["open", "in_progress", "snoozed", "completed", "dismissed"].includes(status)) {
    throw Object.assign(new Error("Choose a valid task and status."), { statusCode: 400 });
  }
  const update = {
    status,
    updated_at: new Date().toISOString(),
    completed_at: status === "completed" ? new Date().toISOString() : null,
    snoozed_until: status === "snoozed" && payload.snoozedUntil ? payload.snoozedUntil : null,
  };
  const { data, error } = await supabase.from("crm_tasks").update(update).eq("id", taskId).select("*").single();
  if (error) throw error;
  await audit({ action: "update_maintenance_task", entityId: taskId, entityType: "crm_task", nextValue: data });
  return data;
}

async function updateMaintenanceSettings(payload) {
  const values = {
    approaching_days: integerOrNull(payload.approachingDays),
    due_days: Number.parseInt(payload.dueDays, 10),
    approaching_km: integerOrNull(payload.approachingKm),
    due_km: Number.parseInt(payload.dueKm, 10),
    high_usage_reminder_days: integerOrNull(payload.highUsageReminderDays),
    average_usage_reminder_days: integerOrNull(payload.averageUsageReminderDays),
    low_usage_reminder_days: integerOrNull(payload.lowUsageReminderDays),
    insufficient_data_reminder_days: integerOrNull(payload.insufficientDataReminderDays),
    high_confidence_min_verified_readings: integerOrNull(payload.highConfidenceMinVerifiedReadings),
    high_confidence_min_span_days: integerOrNull(payload.highConfidenceMinSpanDays),
    recent_verified_mileage_days: integerOrNull(payload.recentVerifiedMileageDays),
    medium_confidence_min_readings: integerOrNull(payload.mediumConfidenceMinReadings),
  };
  if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0)) {
    throw Object.assign(new Error("Enter valid maintenance thresholds."), { statusCode: 400 });
  }
  const { data: current, error: currentError } = await supabase.from("maintenance_settings").select("*").eq("setting_key", "default").eq("active", true).single();
  if (currentError) throw currentError;
  if (values.due_days > values.approaching_days || values.due_km > values.approaching_km) {
    throw Object.assign(new Error("Due thresholds cannot be greater than approaching thresholds."), { statusCode: 400 });
  }
  const { data: inserted, error: insertError } = await supabase.from("maintenance_settings").insert({
    ...current,
    ...values,
    id: undefined,
    version: current.version + 1,
    active: false,
    created_at: undefined,
  }).select("*").single();
  if (insertError) throw insertError;
  const { error: deactivateError } = await supabase.from("maintenance_settings").update({ active: false }).eq("id", current.id);
  if (deactivateError) throw deactivateError;
  const { data, error } = await supabase.from("maintenance_settings").update({ active: true }).eq("id", inserted.id).select("*").single();
  if (error) throw error;
  await audit({ action: "update_maintenance_settings", entityId: data.id, entityType: "maintenance_settings", previousValue: current, nextValue: data });
  return data;
}

export async function handler(event) {
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (!supabase) return json(503, { error: "Admin backend is not configured" });

  try {
    if (event.httpMethod === "GET") return json(200, await getVehicleIntelligence());
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const payload = JSON.parse(event.body || "{}");
    if (payload.action === "record-mileage") return json(200, { reading: await recordMileage(payload) });
    if (payload.action === "record-service") return json(200, { service: await recordService(payload) });
    if (payload.action === "update-vehicle-maintenance-profile") return json(200, { vehicle: await updateVehicleMaintenanceProfile(payload) });
    if (payload.action === "create-rule-version") return json(200, { rule: await createRuleVersion(payload) });
    if (payload.action === "approve-rule") return json(200, { rule: await approveRule(payload) });
    if (payload.action === "retire-rule") return json(200, { rule: await retireRule(payload) });
    if (payload.action === "update-maintenance-task") return json(200, { task: await updateMaintenanceTask(payload) });
    if (payload.action === "update-maintenance-settings") return json(200, { settings: await updateMaintenanceSettings(payload) });
    if (payload.action === "recalculate-maintenance") {
      const result = await runMaintenanceRecalculation(supabase, {
        vehicleIds: payload.vehicleId ? [clean(payload.vehicleId, 80)] : undefined,
        includeAll: Boolean(payload.includeAll),
        jobName: "admin-maintenance-recalculation",
      });
      return json(200, { result });
    }
    return json(400, { error: "Choose a valid Vehicle Intelligence action." });
  } catch (error) {
    console.error("Vehicle Intelligence admin request failed", error);
    return json(error.statusCode || 500, { error: error.message || "Vehicle Intelligence request failed." });
  }
}
