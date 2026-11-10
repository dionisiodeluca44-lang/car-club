import { createClient } from "@supabase/supabase-js";
import { mileageCorrectionRequired, normalizeMileageUnit, normalizeOdometer } from "../../shared/vehicleIntelligence.js";
import { buildOutreachDraft, communicationEligibility, isMaterialMessageChange, normalizePreferredLanguage } from "../../shared/outreachIntelligence.js";
import { getMaintenanceIntelligence, runMaintenanceRecalculation } from "../lib/maintenanceIntelligence.js";
import { discoverVehicleMaintenanceRules } from "../lib/maintenanceRuleAutomation.js";
import { getOutreachIntelligence, runOutreachIntelligence } from "../lib/outreachIntelligence.js";
import { unresolvedAutomaticRule, vehicleRuleSignature, verifiedRuleCanAutoActivate } from "../../shared/maintenanceRuleAutomation.js";

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
    supabase.from("service_requests").select("*").neq("status", "Archived").order("created_at", { ascending: false }),
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
    maintenance.automation = {
      mode: process.env.MAINTENANCE_RULE_PROVIDER_URL
        ? "verified_provider"
        : process.env.OPENAI_API_KEY ? "official_web_research" : "review_only",
      providerConfigured: Boolean(process.env.MAINTENANCE_RULE_PROVIDER_URL),
      officialResearchConfigured: Boolean(process.env.OPENAI_API_KEY),
    };
  } catch (error) {
    if (!["42P01", "PGRST205"].includes(error.code)) throw error;
  }
  let outreach = { available: false, settings: null, preferences: [], opportunities: [], messages: [], events: [], jobRuns: [] };
  try {
    outreach = await getOutreachIntelligence(supabase);
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
  const estimatedPotentialRevenueCents = (outreach.opportunities || [])
    .filter((opportunity) => ["open", "qualified", "contacted"].includes(opportunity.status) && !opportunity.quote_required)
    .reduce((total, opportunity) => total + Math.max(0, Number(opportunity.estimated_revenue_cents) || 0), 0);
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
      pendingOutreachApprovals: (outreach.messages || []).filter((message) => message.approval_status === "pending_approval").length,
      unansweredFollowUps: (outreach.messages || []).filter((message) => ["sent", "delivered"].includes(message.delivery_status) && message.response_status === "none").length,
      estimatedPotentialRevenueCents,
      completedMaintenanceAppointments: (requestsResult.data || []).filter((request) => request.status === "Completed").length,
      pendingMaintenanceTasks: (maintenance.tasks || []).filter((task) => ["open", "in_progress", "snoozed"].includes(task.status)).length,
      forecastingAvailable: maintenance.available,
    },
    vehicles,
    maintenance,
    outreach: { ...outreach, deliveryProviderConfigured: Boolean(process.env.OUTREACH_DELIVERY_PROVIDER_URL) },
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

async function updateDraftRule(payload) {
  const ruleId = clean(payload.ruleId, 80);
  if (!ruleId) throw Object.assign(new Error("Choose a draft rule to edit."), { statusCode: 400 });
  const { data: current, error: currentError } = await supabase.from("vehicle_maintenance_rules").select("*").eq("id", ruleId).single();
  if (currentError) throw currentError;
  if (current.approval_status !== "draft") throw Object.assign(new Error("Only an unapproved draft can be edited."), { statusCode: 409 });

  const ruleName = clean(payload.ruleName, 180);
  const serviceType = clean(payload.serviceType, 180);
  const sourceReference = clean(payload.sourceReference, 1000);
  const sourceVersion = clean(payload.sourceVersion, 200) || null;
  const explanation = clean(payload.customerExplanation, 1500);
  const mileageIntervalKm = integerOrNull(payload.mileageIntervalKm);
  const timeIntervalMonths = integerOrNull(payload.timeIntervalMonths);
  const requiresInspection = Boolean(payload.requiresInspection);
  if (!ruleName || !serviceType || !sourceReference || !explanation) {
    throw Object.assign(new Error("Rule name, service, source reference, and explanation are required."), { statusCode: 400 });
  }
  if (current.source_type === "manufacturer" && !sourceVersion) {
    throw Object.assign(new Error("Manufacturer rules require an exact source version."), { statusCode: 400 });
  }
  if (!mileageIntervalKm && !timeIntervalMonths && !requiresInspection) {
    throw Object.assign(new Error("Add a sourced interval or keep inspection required selected."), { statusCode: 400 });
  }
  const update = {
    rule_name: ruleName,
    service_type: serviceType,
    mileage_interval_km: mileageIntervalKm,
    time_interval_months: timeIntervalMonths,
    source_reference: sourceReference,
    source_version: sourceVersion,
    confidence_level: ["High", "Medium", "Low"].includes(payload.confidenceLevel) ? payload.confidenceLevel : "Low",
    customer_explanation: explanation,
    requires_inspection: requiresInspection,
    safety_related: Boolean(payload.safetyRelated),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("vehicle_maintenance_rules").update(update).eq("id", ruleId).select("*").single();
  if (error) throw error;
  await audit({ action: "edit_maintenance_rule_draft", entityId: ruleId, entityType: "maintenance_rule", previousValue: current, nextValue: data });
  return data;
}

async function autoDraftMaintenanceRules(payload) {
  let query = supabase.from("vehicles").select("*").is("archived_at", null).order("created_at", { ascending: true });
  if (payload.vehicleId) query = query.eq("id", clean(payload.vehicleId, 80));
  const { data: vehicles, error: vehicleError } = await query;
  if (vehicleError) throw vehicleError;
  const representatives = [];
  const seenSignatures = new Set();
  for (const vehicle of vehicles || []) {
    const signature = vehicleRuleSignature(vehicle) || `vehicle-${vehicle.id}`;
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    representatives.push(vehicle);
  }

  const { data: existing, error: existingError } = await supabase
    .from("vehicle_maintenance_rules")
    .select("id, stable_key, source_type, approval_status, archived_at");
  if (existingError) throw existingError;
  const currentKeys = new Set((existing || [])
    .filter((rule) => !rule.archived_at && ["draft", "approved"].includes(rule.approval_status))
    .map((rule) => rule.stable_key));
  const result = {
    vehiclesScanned: vehicles?.length || 0,
    vehicleConfigurations: representatives.length,
    draftsCreated: 0,
    readyToApprove: 0,
    needsReview: 0,
    noReliableSource: 0,
    skippedExisting: 0,
    errors: [],
  };

  for (const vehicle of representatives) {
    try {
      const signature = vehicleRuleSignature(vehicle) || `vehicle-${vehicle.id}`;
      const prefix = `auto-${signature}-`;
      const existingForVehicle = (existing || []).filter((rule) => !rule.archived_at && rule.stable_key.startsWith(prefix));
      const exactSourceAlreadyCovered = existingForVehicle.some((rule) => rule.source_type === "manufacturer");
      const reviewOnlyAlreadyChecked = !process.env.MAINTENANCE_RULE_PROVIDER_URL && !process.env.OPENAI_API_KEY && existingForVehicle.length > 0;
      if (exactSourceAlreadyCovered || reviewOnlyAlreadyChecked) {
        result.skippedExisting += existingForVehicle.length || 1;
        continue;
      }
      const discovery = await discoverVehicleMaintenanceRules(vehicle);
      for (const rule of discovery.rules) {
        const key = stableKey(rule.stableKey || rule.ruleName);
        if (currentKeys.has(key)) {
          result.skippedExisting += 1;
          continue;
        }
        const created = await createRuleVersion(rule);
        currentKeys.add(created.stable_key);
        result.draftsCreated += 1;
        if (rule.automationStatus === "ready_to_approve") result.readyToApprove += 1;
        else if (rule.automationStatus === "no_reliable_source") result.noReliableSource += 1;
        else result.needsReview += 1;
      }
      if (discovery.errors?.length) result.errors.push(...discovery.errors.map((message) => `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}: ${message}`.trim()));
    } catch (error) {
      result.errors.push(`${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || "Vehicle"}: ${error.message}`.trim());
    }
  }
  await audit({ action: "auto_draft_maintenance_rules", entityId: null, entityType: "maintenance_automation", nextValue: result });
  return result;
}

async function approveRule(payload) {
  const ruleId = clean(payload.ruleId, 80);
  if (!ruleId) throw Object.assign(new Error("Choose a draft rule to approve."), { statusCode: 400 });
  const { data: current, error: currentError } = await supabase.from("vehicle_maintenance_rules").select("*").eq("id", ruleId).single();
  if (currentError) throw currentError;
  if (current.approval_status !== "draft") throw Object.assign(new Error("Only a draft rule can be approved."), { statusCode: 409 });
  if (unresolvedAutomaticRule(current)) {
    throw Object.assign(new Error("This automatic placeholder has no verified schedule. Add and verify an exact source and interval before approval."), { statusCode: 409 });
  }
  const { data, error } = await supabase.rpc("approve_vehicle_maintenance_rule", { p_rule_id: ruleId });
  if (error) throw error;
  await audit({ action: "approve_maintenance_rule", entityId: ruleId, entityType: "maintenance_rule", previousValue: current, nextValue: data });
  return data;
}

async function autoActivateVerifiedRules() {
  const { data: drafts, error } = await supabase
    .from("vehicle_maintenance_rules")
    .select("*")
    .eq("approval_status", "draft")
    .is("archived_at", null);
  if (error) throw error;
  const eligible = (drafts || []).filter(verifiedRuleCanAutoActivate);
  const result = { eligible: eligible.length, activated: 0, heldForReview: (drafts || []).length - eligible.length, errors: [] };
  for (const rule of eligible) {
    try {
      await approveRule({ ruleId: rule.id });
      result.activated += 1;
    } catch (activationError) {
      result.errors.push(`${rule.rule_name || rule.service_type || rule.id}: ${activationError.message}`);
    }
  }
  await audit({ action: "auto_activate_verified_maintenance_rules", entityId: null, entityType: "maintenance_automation", nextValue: result });
  return result;
}

async function runPhase4Crm(payload) {
  const vehicleId = clean(payload.vehicleId, 80) || null;
  const drafting = await autoDraftMaintenanceRules(vehicleId ? { vehicleId } : {});
  const activation = await autoActivateVerifiedRules();
  const maintenance = await runMaintenanceRecalculation(supabase, {
    vehicleIds: vehicleId ? [vehicleId] : undefined,
    includeAll: !vehicleId,
    jobName: "phase4-crm-maintenance",
  });
  const outreach = await runOutreachIntelligence(supabase, {
    vehicleIds: vehicleId ? [vehicleId] : undefined,
    includeAll: !vehicleId,
    jobName: "phase4-crm-opportunities",
  });
  const result = { drafting, activation, maintenance, outreach };
  await audit({ action: "run_phase4_crm", entityId: vehicleId, entityType: vehicleId ? "vehicle" : "maintenance_automation", nextValue: result });
  return result;
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

async function outreachEvent(messageId, eventType, detail = {}) {
  const { error } = await supabase.from("outreach_events").insert({
    outreach_message_id: messageId,
    event_type: eventType,
    actor_type: "administrator",
    detail,
  });
  if (error) throw error;
}

async function loadOutreachMessage(messageId) {
  const { data: message, error } = await supabase.from("outreach_messages").select("*").eq("id", clean(messageId, 80)).single();
  if (error || !message) throw Object.assign(new Error("Outreach message not found."), { statusCode: 404 });
  const [{ data: preferences }, { data: profile }] = await Promise.all([
    supabase.from("communication_preferences").select("*").eq("customer_id", message.customer_id).maybeSingle(),
    supabase.from("profiles").select("id, email, phone, full_name").eq("id", message.customer_id).maybeSingle(),
  ]);
  return { message, preferences, profile };
}

function requireCommunicationEligibility(message, preferences) {
  const eligibility = communicationEligibility(preferences, { channel: message.channel, purpose: message.purpose });
  if (!eligibility.eligible) throw Object.assign(new Error(`Delivery blocked: ${eligibility.reason}`), { statusCode: 409 });
  return eligibility;
}

function withinQuietHours(preferences, now = new Date()) {
  if (!preferences) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences.timezone || "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;
  const toMinutes = (value) => {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  const start = toMinutes(preferences.quiet_hours_start);
  const end = toMinutes(preferences.quiet_hours_end);
  return start > end ? current >= start || current < end : current >= start && current < end;
}

async function updateCommunicationPreferences(payload) {
  const customerId = clean(payload.customerId, 80);
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", customerId).maybeSingle();
  if (profileError || !profile) throw Object.assign(new Error("Customer not found."), { statusCode: 404 });
  const transactionalConsent = Boolean(payload.transactionalConsent);
  const promotionalConsent = Boolean(payload.promotionalConsent);
  const suppressed = Boolean(payload.suppressed);
  const timezone = clean(payload.timezone, 100) || "America/Toronto";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    throw Object.assign(new Error("Enter a valid IANA timezone, such as America/Toronto."), { statusCode: 400 });
  }
  const record = {
    customer_id: customerId,
    preferred_language: normalizePreferredLanguage(payload.preferredLanguage),
    email_enabled: Boolean(payload.emailEnabled),
    sms_enabled: Boolean(payload.smsEnabled),
    transactional_consent: transactionalConsent,
    promotional_consent: promotionalConsent,
    consent_source: clean(payload.consentSource, 500) || null,
    consent_timestamp: transactionalConsent || promotionalConsent ? (payload.consentTimestamp || new Date().toISOString()) : null,
    unsubscribe_timestamp: suppressed ? (payload.unsubscribeTimestamp || new Date().toISOString()) : null,
    suppressed_at: suppressed ? new Date().toISOString() : null,
    suppression_reason: suppressed ? (clean(payload.suppressionReason, 500) || "Administrator recorded suppression") : null,
    quiet_hours_start: clean(payload.quietHoursStart, 8) || "21:00",
    quiet_hours_end: clean(payload.quietHoursEnd, 8) || "09:00",
    timezone,
    updated_at: new Date().toISOString(),
  };
  const { data: previous } = await supabase.from("communication_preferences").select("*").eq("customer_id", customerId).maybeSingle();
  const { data, error } = await supabase.from("communication_preferences").upsert(record, { onConflict: "customer_id" }).select("*").single();
  if (error) throw error;
  await supabase.from("vehicles").update({ outreach_recalculation_required: true, outreach_recalculation_requested_at: new Date().toISOString() }).eq("user_id", customerId);
  await audit({ action: "update_communication_preferences", entityId: data.id, entityType: "communication_preferences", previousValue: previous, nextValue: data });
  return data;
}

async function editOutreachMessage(payload) {
  const { message } = await loadOutreachMessage(payload.messageId);
  const subject = clean(payload.subject, 240) || null;
  const body = clean(payload.messageBody, 4000);
  if (!body) throw Object.assign(new Error("Message body is required."), { statusCode: 400 });
  const material = isMaterialMessageChange(message, subject, body);
  const update = { subject, message_body: body, draft_method: "administrator", updated_at: new Date().toISOString() };
  if (material) Object.assign(update, { approval_status: "pending_approval", approved_by: null, approved_by_label: null, approved_at: null, scheduled_at: null, delivery_status: "not_scheduled" });
  const { data, error } = await supabase.from("outreach_messages").update(update).eq("id", message.id).select("*").single();
  if (error) throw error;
  await outreachEvent(message.id, material ? "draft_materially_edited_reapproval_required" : "draft_edited", { revision: data.revision });
  await audit({ action: "edit_outreach_message", entityId: message.id, entityType: "outreach_message", previousValue: message, nextValue: data });
  if (material) {
    await supabase.from("crm_tasks").upsert({
      customer_id: data.customer_id,
      vehicle_id: data.vehicle_id,
      related_forecast_id: data.forecast_id,
      task_type: "outreach_approval",
      title: `Review edited ${String(data.outreach_type).replaceAll("_", " ")} draft`,
      detail: "The message changed after approval and requires a new explicit review.",
      priority: "high",
      due_at: new Date().toISOString(),
      status: "open",
      idempotency_key: `outreach-approval:${data.id}:r${data.revision}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  }
  return data;
}

async function regenerateOutreachMessage(payload) {
  const { message, profile, preferences } = await loadOutreachMessage(payload.messageId);
  const [{ data: vehicle }, { data: forecast }, { data: opportunity }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", message.vehicle_id).maybeSingle(),
    supabase.from("vehicle_maintenance_forecasts").select("*").eq("id", message.forecast_id).maybeSingle(),
    supabase.from("service_opportunities").select("*").eq("id", message.opportunity_id).maybeSingle(),
  ]);
  const draft = buildOutreachDraft({
    customerName: profile?.full_name,
    vehicle,
    serviceName: opportunity?.service_type || "recommended service",
    forecast,
    language: preferences?.preferred_language || message.language,
    bookingUrl: clean(payload.bookingUrl, 1000),
  });
  return editOutreachMessage({ messageId: message.id, subject: draft.subject, messageBody: draft.body });
}

async function approveOutreachMessage(payload) {
  const { message, preferences } = await loadOutreachMessage(payload.messageId);
  if (!["draft", "pending_approval", "rejected"].includes(message.approval_status)) {
    throw Object.assign(new Error("Only an unapproved draft can be approved."), { statusCode: 409 });
  }
  requireCommunicationEligibility(message, preferences);
  const { data, error } = await supabase.from("outreach_messages").update({
    approval_status: "approved",
    approved_by_label: clean(payload.approvedByLabel, 160) || "Admin portal",
    approved_at: new Date().toISOString(),
    rejected_reason: null,
    updated_at: new Date().toISOString(),
  }).eq("id", message.id).select("*").single();
  if (error) throw error;
  if (message.task_id) await supabase.from("crm_tasks").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", message.task_id);
  if (message.opportunity_id) await supabase.from("service_opportunities").update({ contact_status: "approved", updated_at: new Date().toISOString() }).eq("id", message.opportunity_id);
  await outreachEvent(message.id, "approved", { approvedBy: data.approved_by_label, revision: data.revision });
  await audit({ action: "approve_outreach_message", entityId: message.id, entityType: "outreach_message", previousValue: message, nextValue: data });
  return data;
}

async function rejectOutreachMessage(payload) {
  const { message } = await loadOutreachMessage(payload.messageId);
  const reason = clean(payload.reason, 1000);
  if (!reason) throw Object.assign(new Error("Add a rejection reason."), { statusCode: 400 });
  const { data, error } = await supabase.from("outreach_messages").update({ approval_status: "rejected", rejected_reason: reason, scheduled_at: null, delivery_status: "not_scheduled", updated_at: new Date().toISOString() }).eq("id", message.id).select("*").single();
  if (error) throw error;
  if (message.task_id) await supabase.from("crm_tasks").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("id", message.task_id);
  await outreachEvent(message.id, "rejected", { reason });
  await audit({ action: "reject_outreach_message", entityId: message.id, entityType: "outreach_message", previousValue: message, nextValue: data });
  return data;
}

async function scheduleOutreachMessage(payload) {
  const { message, preferences } = await loadOutreachMessage(payload.messageId);
  requireCommunicationEligibility(message, preferences);
  if (message.approval_status !== "approved") throw Object.assign(new Error("Approve the message before scheduling it."), { statusCode: 409 });
  const scheduledAt = new Date(payload.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) throw Object.assign(new Error("Choose a future send time."), { statusCode: 400 });
  const { data, error } = await supabase.from("outreach_messages").update({ scheduled_at: scheduledAt.toISOString(), delivery_status: "scheduled", updated_at: new Date().toISOString() }).eq("id", message.id).select("*").single();
  if (error) throw error;
  await outreachEvent(message.id, "scheduled", { scheduledAt: data.scheduled_at });
  return data;
}

async function sendApprovedOutreachMessage(payload) {
  const { message, preferences, profile } = await loadOutreachMessage(payload.messageId);
  requireCommunicationEligibility(message, preferences);
  if (message.approval_status !== "approved") throw Object.assign(new Error("Approve the message before sending it."), { statusCode: 409 });
  if (withinQuietHours(preferences)) throw Object.assign(new Error("Delivery is blocked during the customer's recorded quiet hours."), { statusCode: 409 });
  const endpoint = process.env.OUTREACH_DELIVERY_PROVIDER_URL;
  if (!endpoint) throw Object.assign(new Error("No delivery provider is configured. Copy the approved draft or record a verified manual send."), { statusCode: 409 });
  const destination = message.channel === "sms" ? profile?.phone : profile?.email;
  if (!destination) throw Object.assign(new Error(`Customer does not have a ${message.channel === "sms" ? "phone number" : "email address"} on file.`), { statusCode: 409 });
  await supabase.from("outreach_messages").update({ delivery_status: "sending", delivery_error: null }).eq("id", message.id);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.OUTREACH_DELIVERY_PROVIDER_SECRET ? { Authorization: `Bearer ${process.env.OUTREACH_DELIVERY_PROVIDER_SECRET}` } : {}) },
      body: JSON.stringify({ idempotencyKey: message.idempotency_key, channel: message.channel, to: destination, subject: message.subject, body: message.message_body }),
    });
    const providerResult = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(providerResult.error || `Delivery provider returned ${response.status}.`);
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("outreach_messages").update({ delivery_status: providerResult.delivered ? "delivered" : "sent", sent_at: now, delivery_provider: providerResult.provider || "configured_provider", provider_message_id: providerResult.messageId || providerResult.id || null, delivery_error: null }).eq("id", message.id).select("*").single();
    if (error) throw error;
    if (message.opportunity_id) await supabase.from("service_opportunities").update({ contact_status: "contacted", status: "contacted", updated_at: now }).eq("id", message.opportunity_id);
    await outreachEvent(message.id, data.delivery_status, { provider: data.delivery_provider, providerMessageId: data.provider_message_id });
    return data;
  } catch (error) {
    await supabase.from("outreach_messages").update({ delivery_status: "failed", delivery_error: clean(error.message, 2000) }).eq("id", message.id);
    await outreachEvent(message.id, "delivery_failed", { error: clean(error.message, 1000) });
    throw Object.assign(error, { statusCode: 502 });
  }
}

async function markOutreachManuallySent(payload) {
  const { message, preferences } = await loadOutreachMessage(payload.messageId);
  requireCommunicationEligibility(message, preferences);
  if (message.approval_status !== "approved") throw Object.assign(new Error("Approve the message before recording delivery."), { statusCode: 409 });
  const reference = clean(payload.manualReference, 500);
  if (!reference) throw Object.assign(new Error("Add a manual delivery reference."), { statusCode: 400 });
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("outreach_messages").update({ delivery_status: "sent", sent_at: now, delivery_provider: "manual", provider_message_id: reference, delivery_error: null }).eq("id", message.id).select("*").single();
  if (error) throw error;
  if (message.opportunity_id) await supabase.from("service_opportunities").update({ contact_status: "contacted", status: "contacted", updated_at: now }).eq("id", message.opportunity_id);
  await outreachEvent(message.id, "manual_send_recorded", { reference });
  await audit({ action: "record_manual_outreach_send", entityId: message.id, entityType: "outreach_message", previousValue: message, nextValue: data });
  return data;
}

async function recordOutreachResponse(payload) {
  const { message } = await loadOutreachMessage(payload.messageId);
  const responseStatus = ["replied", "booked", "declined", "no_response"].includes(payload.responseStatus) ? payload.responseStatus : "replied";
  const update = { response_status: responseStatus, customer_response: clean(payload.customerResponse, 4000) || null, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("outreach_messages").update(update).eq("id", message.id).select("*").single();
  if (error) throw error;
  if (message.opportunity_id) await supabase.from("service_opportunities").update({ contact_status: "responded", status: responseStatus === "booked" ? "won" : "contacted", booking_status: responseStatus === "booked" ? "booked" : "not_booked", updated_at: new Date().toISOString() }).eq("id", message.opportunity_id);
  await outreachEvent(message.id, "customer_response_recorded", { responseStatus, response: update.customer_response });
  return data;
}

async function updateServiceOpportunity(payload) {
  const opportunityId = clean(payload.opportunityId, 80);
  const update = {};
  if (["open", "qualified", "contacted", "won", "lost", "dismissed", "expired"].includes(payload.status)) update.status = payload.status;
  if (["not_booked", "requested", "booked", "completed", "cancelled"].includes(payload.bookingStatus)) update.booking_status = payload.bookingStatus;
  if (["not_contacted", "drafted", "approved", "contacted", "responded", "suppressed"].includes(payload.contactStatus)) update.contact_status = payload.contactStatus;
  update.updated_at = new Date().toISOString();
  const { data: previous } = await supabase.from("service_opportunities").select("*").eq("id", opportunityId).maybeSingle();
  if (!previous) throw Object.assign(new Error("Service opportunity not found."), { statusCode: 404 });
  const { data, error } = await supabase.from("service_opportunities").update(update).eq("id", opportunityId).select("*").single();
  if (error) throw error;
  await audit({ action: "update_service_opportunity", entityId: opportunityId, entityType: "service_opportunity", previousValue: previous, nextValue: data });
  return data;
}

async function updateOutreachSettings(payload) {
  const { data: current, error: currentError } = await supabase.from("outreach_settings").select("*").eq("setting_key", "default").eq("active", true).single();
  if (currentError) throw currentError;
  const record = {
    setting_key: "default",
    version: Number(current.version || 0) + 1,
    draft_generation_enabled: payload.draftGenerationEnabled !== false && payload.draftGenerationEnabled !== "false",
    approval_required: true,
    max_customer_contacts_per_30_days: Math.min(30, Math.max(1, Number(payload.maxCustomerContactsPer30Days) || 4)),
    minimum_days_between_contacts: Math.min(90, Math.max(1, Number(payload.minimumDaysBetweenContacts) || 7)),
    opportunity_min_confidence: ["High", "Medium", "Low"].includes(payload.opportunityMinConfidence) ? payload.opportunityMinConfidence : "Medium",
    default_channel: payload.defaultChannel === "sms" ? "sms" : "email",
    booking_url: clean(payload.bookingUrl, 1000) || null,
    active: false,
  };
  const { data: inserted, error: insertError } = await supabase.from("outreach_settings").insert(record).select("*").single();
  if (insertError) throw insertError;
  await supabase.from("outreach_settings").update({ active: false }).eq("id", current.id);
  const { data, error } = await supabase.from("outreach_settings").update({ active: true }).eq("id", inserted.id).select("*").single();
  if (error) throw error;
  await audit({ action: "update_outreach_settings", entityId: data.id, entityType: "outreach_settings", previousValue: current, nextValue: data });
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
    if (payload.action === "update-rule-draft") return json(200, { rule: await updateDraftRule(payload) });
    if (payload.action === "auto-draft-maintenance-rules") {
      const result = await autoDraftMaintenanceRules(payload);
      result.autoActivation = await autoActivateVerifiedRules();
      return json(200, { result });
    }
    if (payload.action === "run-phase4-crm") return json(200, { result: await runPhase4Crm(payload) });
    if (payload.action === "approve-rule") return json(200, { rule: await approveRule(payload) });
    if (payload.action === "retire-rule") return json(200, { rule: await retireRule(payload) });
    if (payload.action === "update-maintenance-task") return json(200, { task: await updateMaintenanceTask(payload) });
    if (payload.action === "update-maintenance-settings") return json(200, { settings: await updateMaintenanceSettings(payload) });
    if (payload.action === "update-communication-preferences") return json(200, { preferences: await updateCommunicationPreferences(payload) });
    if (payload.action === "edit-outreach-message") return json(200, { message: await editOutreachMessage(payload) });
    if (payload.action === "regenerate-outreach-message") return json(200, { message: await regenerateOutreachMessage(payload) });
    if (payload.action === "approve-outreach-message") return json(200, { message: await approveOutreachMessage(payload) });
    if (payload.action === "reject-outreach-message") return json(200, { message: await rejectOutreachMessage(payload) });
    if (payload.action === "schedule-outreach-message") return json(200, { message: await scheduleOutreachMessage(payload) });
    if (payload.action === "send-approved-outreach-message") return json(200, { message: await sendApprovedOutreachMessage(payload) });
    if (payload.action === "mark-outreach-manually-sent") return json(200, { message: await markOutreachManuallySent(payload) });
    if (payload.action === "record-outreach-response") return json(200, { message: await recordOutreachResponse(payload) });
    if (payload.action === "update-service-opportunity") return json(200, { opportunity: await updateServiceOpportunity(payload) });
    if (payload.action === "update-outreach-settings") return json(200, { settings: await updateOutreachSettings(payload) });
    if (payload.action === "recalculate-maintenance") {
      const result = await runMaintenanceRecalculation(supabase, {
        vehicleIds: payload.vehicleId ? [clean(payload.vehicleId, 80)] : undefined,
        includeAll: Boolean(payload.includeAll),
        jobName: "admin-maintenance-recalculation",
      });
      return json(200, { result });
    }
    if (payload.action === "run-outreach-intelligence") {
      const result = await runOutreachIntelligence(supabase, {
        vehicleIds: payload.vehicleId ? [clean(payload.vehicleId, 80)] : undefined,
        includeAll: Boolean(payload.includeAll),
        jobName: "admin-outreach-intelligence",
      });
      return json(200, { result });
    }
    return json(400, { error: "Choose a valid Vehicle Intelligence action." });
  } catch (error) {
    console.error("Vehicle Intelligence admin request failed", error);
    return json(error.statusCode || 500, { error: error.message || "Vehicle Intelligence request failed." });
  }
}
