import {
  calculateMaintenanceForecast,
  estimateDrivingRate,
  mileageReminderIntervalDays,
  ruleAppliesToVehicle,
  taskForForecast,
} from "../../shared/maintenanceIntelligence.js";
import { mapAppointmentLifecycleStatus } from "../../shared/vehicleIntelligence.js";

function isoDate(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function taskBucket(status, asOf, settings) {
  if (["Inspection Required", "Awaiting Mileage"].includes(status)) {
    const interval = Number(settings?.insufficient_data_reminder_days || 60);
    const bucket = Math.floor(new Date(asOf).getTime() / (interval * 86400000));
    return String(bucket);
  }
  if (status === "Overdue") {
    return String(Math.floor(new Date(asOf).getTime() / (30 * 86400000)));
  }
  return isoDate(asOf).slice(0, 7);
}

async function loadVehicleRows(supabase, table, vehicleIds) {
  const { data, error } = await supabase.from(table).select("*").in("vehicle_id", vehicleIds);
  if (error) throw error;
  return data || [];
}

export async function getMaintenanceIntelligence(supabase) {
  const [settingsResult, rulesResult, forecastsResult, tasksResult, jobsResult] = await Promise.all([
    supabase.from("maintenance_settings").select("*").eq("setting_key", "default").eq("active", true).maybeSingle(),
    supabase.from("vehicle_maintenance_rules").select("*").order("stable_key").order("version", { ascending: false }),
    supabase.from("vehicle_maintenance_forecasts").select("*").is("archived_at", null).order("updated_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("maintenance_job_runs").select("*").order("started_at", { ascending: false }).limit(20),
  ]);
  const error = [settingsResult, rulesResult, forecastsResult, tasksResult, jobsResult].find((result) => result.error)?.error;
  if (error) throw error;
  return {
    available: true,
    settings: settingsResult.data || null,
    rules: rulesResult.data || [],
    forecasts: forecastsResult.data || [],
    tasks: tasksResult.data || [],
    jobRuns: jobsResult.data || [],
  };
}

async function persistForecast(supabase, { vehicle, rule, calculation, asOf }) {
  const { data: existing, error: existingError } = await supabase
    .from("vehicle_maintenance_forecasts")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .eq("rule_id", rule.id)
    .is("archived_at", null)
    .maybeSingle();
  if (existingError) throw existingError;
  const record = {
    vehicle_id: vehicle.id,
    rule_id: rule.id,
    rule_version: rule.version,
    last_service_history_id: calculation.lastServiceHistoryId,
    current_mileage_snapshot_km: calculation.currentMileageKm,
    estimated_daily_km: calculation.estimatedDailyKm,
    next_due_mileage_km: calculation.nextDueMileageKm,
    mileage_due_date: calculation.mileageDueDate,
    calendar_due_date: calculation.calendarDueDate,
    next_due_date: calculation.nextDueDate,
    confidence: calculation.confidence,
    reason: calculation.reason,
    status: calculation.status,
    needs_manual_review: calculation.needsManualReview,
    calculated_at: new Date(asOf).toISOString(),
    updated_at: new Date().toISOString(),
    idempotency_key: `${vehicle.id}:${rule.stable_key}:v${rule.version}`,
  };
  if (existing) {
    const { data, error } = await supabase
      .from("vehicle_maintenance_forecasts")
      .update(record)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("vehicle_maintenance_forecasts").insert(record).select("*").single();
  if (error) throw error;
  return data;
}

async function syncForecastTask(supabase, { forecast, rule, vehicle, settings, asOf }) {
  const task = taskForForecast(forecast);
  const { data: activeTasks, error: taskLoadError } = await supabase
    .from("crm_tasks")
    .select("id, idempotency_key, status")
    .eq("related_forecast_id", forecast.id)
    .in("status", ["open", "in_progress", "snoozed"]);
  if (taskLoadError) throw taskLoadError;
  if (!task) {
    if (activeTasks?.length) {
      const { error } = await supabase
        .from("crm_tasks")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .in("id", activeTasks.map((item) => item.id));
      if (error) throw error;
    }
    return { created: false, dismissed: activeTasks?.length || 0 };
  }

  const idempotencyKey = `${forecast.id}:${forecast.status}:${taskBucket(forecast.status, asOf, settings)}`;
  const obsoleteTasks = (activeTasks || []).filter((item) => item.idempotency_key !== idempotencyKey);
  if (obsoleteTasks.length) {
    const { error } = await supabase
      .from("crm_tasks")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .in("id", obsoleteTasks.map((item) => item.id));
    if (error) throw error;
  }
  const detail = forecast.reason?.summary || `Review ${rule.rule_name} for this vehicle.`;
  const { error } = await supabase.from("crm_tasks").upsert({
    customer_id: vehicle.user_id,
    vehicle_id: vehicle.id,
    related_forecast_id: forecast.id,
    task_type: task.taskType,
    title: `${forecast.status}: ${rule.rule_name}`,
    detail,
    priority: task.priority,
    due_at: forecast.next_due_date ? `${forecast.next_due_date}T12:00:00Z` : new Date(asOf).toISOString(),
    status: "open",
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
  return { created: true, dismissed: obsoleteTasks.length };
}

async function syncMileageUpdateTask(supabase, { vehicle, readings, history, forecastStatuses, settings, asOf }) {
  const rate = estimateDrivingRate(readings);
  const intervalDays = mileageReminderIntervalDays({ annualKm: rate.annualKm, forecastStatuses, settings });
  const reliableReadingDates = readings
    .filter((item) => !["estimated", "rejected"].includes(String(item.verification_status || "").toLowerCase()))
    .map((item) => new Date(item.recorded_at).getTime())
    .filter(Number.isFinite);
  const serviceMileageDates = history
    .filter((item) => item.service_mileage != null && ["verified", "corrected"].includes(String(item.verification_status || "").toLowerCase()))
    .map((item) => new Date(`${item.service_date}T12:00:00Z`).getTime())
    .filter(Number.isFinite);
  const lastEvidenceAt = Math.max(0, ...reliableReadingDates, ...serviceMileageDates);
  const elapsedDays = lastEvidenceAt ? (new Date(asOf).getTime() - lastEvidenceAt) / 86400000 : Infinity;
  if (elapsedDays < intervalDays) {
    const { error } = await supabase
      .from("crm_tasks")
      .update({
        status: "completed",
        completed_at: new Date(asOf).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("vehicle_id", vehicle.id)
      .eq("task_type", "mileage_update")
      .in("status", ["open", "in_progress", "snoozed"]);
    if (error) throw error;
    return false;
  }

  const bucket = Math.floor(new Date(asOf).getTime() / (intervalDays * 86400000));
  const idempotencyKey = `${vehicle.id}:mileage-update:${bucket}`;
  const { error } = await supabase.from("crm_tasks").upsert({
    customer_id: vehicle.user_id,
    vehicle_id: vehicle.id,
    related_forecast_id: null,
    task_type: "mileage_update",
    title: "Mileage update required",
    detail: "Request a current odometer reading. Any mileage estimate remains directional and must not be stored as verified mileage.",
    priority: forecastStatuses.some((status) => ["Due", "Overdue"].includes(status)) ? "high" : "normal",
    due_at: new Date(asOf).toISOString(),
    status: "open",
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
  return true;
}

async function startJob(supabase, { jobName, idempotencyKey }) {
  const { data: existing, error: loadError } = await supabase
    .from("maintenance_job_runs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (loadError) throw loadError;
  if (existing?.status === "completed") return { existing, skipped: true };
  if (existing) {
    const { data, error } = await supabase.from("maintenance_job_runs").update({
      status: "running",
      attempt_count: Number(existing.attempt_count || 1) + 1,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
    }).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return { run: data, skipped: false };
  }
  const { data, error } = await supabase.from("maintenance_job_runs").insert({
    job_name: jobName,
    idempotency_key: idempotencyKey,
  }).select("*").single();
  if (error) throw error;
  return { run: data, skipped: false };
}

export async function runMaintenanceRecalculation(supabase, options = {}) {
  const asOf = options.asOf || new Date();
  const jobName = options.jobName || "manual-maintenance-recalculation";
  const idempotencyKey = options.idempotencyKey || `${jobName}:${new Date().toISOString()}`;
  const started = await startJob(supabase, { jobName, idempotencyKey });
  if (started.skipped) return { ...started.existing.stats, skipped: true };
  const job = started.run;
  const stats = { vehicles: 0, forecasts: 0, tasks: 0, archivedForecasts: 0, errors: 0 };
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("maintenance_settings")
      .select("*")
      .eq("setting_key", "default")
      .eq("active", true)
      .single();
    if (settingsError) throw settingsError;
    const { data: rules, error: rulesError } = await supabase
      .from("vehicle_maintenance_rules")
      .select("*")
      .eq("approval_status", "approved")
      .eq("active", true)
      .is("archived_at", null);
    if (rulesError) throw rulesError;

    let vehicleQuery = supabase.from("vehicles").select("*").is("archived_at", null);
    if (options.vehicleIds?.length) vehicleQuery = vehicleQuery.in("id", options.vehicleIds);
    else if (!options.includeAll) vehicleQuery = vehicleQuery.eq("maintenance_recalculation_required", true);
    const { data: vehicles, error: vehicleError } = await vehicleQuery;
    if (vehicleError) throw vehicleError;
    const vehicleIds = (vehicles || []).map((vehicle) => vehicle.id);
    if (!vehicleIds.length) {
      await supabase.from("maintenance_job_runs").update({ status: "completed", completed_at: new Date().toISOString(), stats }).eq("id", job.id);
      return stats;
    }
    const [readings, history, appointments] = await Promise.all([
      loadVehicleRows(supabase, "vehicle_mileage_readings", vehicleIds),
      loadVehicleRows(supabase, "vehicle_service_history", vehicleIds),
      loadVehicleRows(supabase, "service_requests", vehicleIds),
    ]);
    const activeRuleIds = new Set((rules || []).map((rule) => rule.id));

    for (const vehicle of vehicles || []) {
      stats.vehicles += 1;
      try {
        const vehicleReadings = readings.filter((item) => item.vehicle_id === vehicle.id);
        const vehicleHistory = history.filter((item) => item.vehicle_id === vehicle.id);
        const vehicleAppointments = appointments
          .filter((item) => item.vehicle_id === vehicle.id && item.status !== "Archived")
          .map((item) => ({ ...item, lifecycle_status: mapAppointmentLifecycleStatus(item.status) }));
        const { data: existingForecasts, error: existingError } = await supabase
          .from("vehicle_maintenance_forecasts")
          .select("id, rule_id")
          .eq("vehicle_id", vehicle.id)
          .is("archived_at", null);
        if (existingError) throw existingError;
        const obsoleteIds = (existingForecasts || []).filter((item) => !activeRuleIds.has(item.rule_id)).map((item) => item.id);
        if (obsoleteIds.length) {
          const { error } = await supabase.from("vehicle_maintenance_forecasts").update({ archived_at: new Date().toISOString() }).in("id", obsoleteIds);
          if (error) throw error;
          const { error: taskError } = await supabase.from("crm_tasks").update({
            status: "dismissed",
            updated_at: new Date().toISOString(),
          }).in("related_forecast_id", obsoleteIds).in("status", ["open", "in_progress", "snoozed"]);
          if (taskError) throw taskError;
          stats.archivedForecasts += obsoleteIds.length;
        }

        const vehicleForecastStatuses = [];
        for (const rule of rules || []) {
          if (!ruleAppliesToVehicle(rule, vehicle)) continue;
          const calculation = calculateMaintenanceForecast({
            vehicle,
            rule,
            mileageReadings: vehicleReadings,
            serviceHistory: vehicleHistory,
            appointments: vehicleAppointments,
            settings,
            asOf,
          });
          const forecast = await persistForecast(supabase, { vehicle, rule, calculation, asOf });
          vehicleForecastStatuses.push(forecast.status);
          stats.forecasts += 1;
          const taskResult = await syncForecastTask(supabase, { forecast, rule, vehicle, settings, asOf });
          if (taskResult.created) stats.tasks += 1;
        }
        if (await syncMileageUpdateTask(supabase, {
          vehicle,
          readings: vehicleReadings,
          history: vehicleHistory,
          forecastStatuses: vehicleForecastStatuses,
          settings,
          asOf,
        })) stats.tasks += 1;
        const { error: clearError } = await supabase.from("vehicles").update({
          maintenance_recalculation_required: false,
        }).eq("id", vehicle.id);
        if (clearError) throw clearError;
      } catch (error) {
        stats.errors += 1;
        console.error("Vehicle maintenance recalculation failed", vehicle.id, error);
      }
    }
    await supabase.from("maintenance_job_runs").update({
      status: stats.errors ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      stats,
      error_message: stats.errors ? `${stats.errors} vehicle recalculation(s) failed.` : null,
    }).eq("id", job.id);
    return stats;
  } catch (error) {
    await supabase.from("maintenance_job_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      stats,
      error_message: String(error.message || error).slice(0, 2000),
    }).eq("id", job.id);
    throw error;
  }
}
