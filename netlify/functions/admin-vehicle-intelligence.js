import { createClient } from "@supabase/supabase-js";
import { mileageCorrectionRequired, normalizeMileageUnit, normalizeOdometer } from "../../shared/vehicleIntelligence.js";

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

  const vehicles = (vehiclesResult.data || []).map((vehicle) => ({
    ...vehicle,
    customer: profiles.get(vehicle.user_id) || null,
    mileage_readings: readingsByVehicle.get(vehicle.id) || [],
    service_history: historyByVehicle.get(vehicle.id) || [],
    appointments: requestsByVehicle.get(vehicle.id) || [],
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

  return {
    overview: {
      totalVehicles: activeVehicles.length,
      archivedVehicles: vehicles.length - activeVehicles.length,
      activeCustomers: activeCustomerIds.size,
      vehiclesRequiringAttention: activeVehicles.filter((vehicle) => !(readingsByVehicle.get(vehicle.id) || []).length).length,
      maintenanceDue7Days: 0,
      maintenanceDue30Days: 0,
      overdueMaintenance: 0,
      customersNeedingMileage: customersNeedingMileage.size,
      upcomingAppointments: activeAppointments.length,
      pendingOutreachApprovals: 0,
      unansweredFollowUps: 0,
      estimatedPotentialRevenueCents,
      completedMaintenanceAppointments: (requestsResult.data || []).filter((request) => request.status === "Completed").length,
      forecastingAvailable: false,
    },
    vehicles,
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
  const record = {
    vehicle_id: vehicle.id,
    user_id: vehicle.user_id,
    service_type: serviceType,
    appointment_id: payload.appointmentId || null,
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

export async function handler(event) {
  if (!authorized(event)) return json(401, { error: "Unauthorized" });
  if (!supabase) return json(503, { error: "Admin backend is not configured" });

  try {
    if (event.httpMethod === "GET") return json(200, await getVehicleIntelligence());
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const payload = JSON.parse(event.body || "{}");
    if (payload.action === "record-mileage") return json(200, { reading: await recordMileage(payload) });
    if (payload.action === "record-service") return json(200, { service: await recordService(payload) });
    return json(400, { error: "Choose a valid Vehicle Intelligence action." });
  } catch (error) {
    console.error("Vehicle Intelligence admin request failed", error);
    return json(error.statusCode || 500, { error: error.message || "Vehicle Intelligence request failed." });
  }
}
