import { toKilometres } from "./vehicleIntelligence.js";

const DAY_MS = 86400000;
const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "requested",
  "pending confirmation",
  "confirmed",
  "in progress",
  "booked",
  "paid / confirmed",
]);

export const MAINTENANCE_STATUSES = Object.freeze([
  "Not Yet Due",
  "Approaching",
  "Due",
  "Overdue",
  "Inspection Required",
  "Awaiting Mileage",
  "Scheduled",
  "Completed",
  "Dismissed",
  "Not Applicable",
]);

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateOnly(value) {
  const date = validDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function addMonths(value, months) {
  const date = validDate(value);
  if (!date || !Number.isInteger(Number(months)) || Number(months) <= 0) return null;
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months), 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function estimateDrivingRate(readings = []) {
  const normalized = readings
    .filter((reading) => !["estimated", "rejected"].includes(String(reading.verification_status || "").toLowerCase()))
    .map((reading) => ({
      valueKm: toKilometres(reading.odometer_value ?? reading.odometerValue, reading.unit),
      recordedAt: validDate(reading.recorded_at || reading.recordedAt),
      verificationStatus: String(reading.verification_status || "self_reported").toLowerCase(),
    }))
    .filter((reading) => Number.isFinite(reading.valueKm) && reading.recordedAt)
    .sort((left, right) => left.recordedAt - right.recordedAt);

  const segments = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const days = (current.recordedAt - previous.recordedAt) / DAY_MS;
    const distanceKm = current.valueKm - previous.valueKm;
    if (days >= 1 && distanceKm >= 0) segments.push({ dailyKm: distanceKm / days, days, distanceKm });
  }
  if (!segments.length) {
    return { dailyKm: null, annualKm: null, sampleCount: normalized.length, segmentCount: 0, outlierCount: 0, spanDays: 0 };
  }

  const initialMedian = median(segments.map((segment) => segment.dailyKm));
  const absoluteDeviations = segments.map((segment) => Math.abs(segment.dailyKm - initialMedian));
  const medianDeviation = median(absoluteDeviations) || 0;
  const upperBound = Math.max(initialMedian * 4, initialMedian + (6 * medianDeviation), 250);
  const reliableSegments = segments.filter((segment) => segment.dailyKm <= upperBound);
  const dailyKm = median(reliableSegments.map((segment) => segment.dailyKm));
  const spanDays = normalized.length > 1
    ? Math.max(0, (normalized.at(-1).recordedAt - normalized[0].recordedAt) / DAY_MS)
    : 0;
  return {
    dailyKm,
    annualKm: Number.isFinite(dailyKm) ? dailyKm * 365.25 : null,
    sampleCount: normalized.length,
    verifiedCount: normalized.filter((reading) => ["verified", "corrected"].includes(reading.verificationStatus)).length,
    segmentCount: reliableSegments.length,
    outlierCount: segments.length - reliableSegments.length,
    spanDays,
  };
}

function comparable(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesList(actual, expected) {
  if (!Array.isArray(expected) || !expected.length) return true;
  return expected.map(comparable).includes(comparable(actual));
}

export function ruleAppliesToVehicle(rule, vehicle) {
  const applicability = rule?.vehicle_applicability || rule?.vehicleApplicability || {};
  if (!applicability || typeof applicability !== "object") return false;
  if (!matchesList(vehicle?.make, applicability.makes)) return false;
  if (!matchesList(vehicle?.model, applicability.models)) return false;
  if (!matchesList(vehicle?.trim, applicability.trims)) return false;
  if (!matchesList(vehicle?.engine, applicability.engines)) return false;
  if (!matchesList(vehicle?.fuel_type || vehicle?.fuelType, applicability.fuelTypes)) return false;
  if (!matchesList(vehicle?.drivetrain, applicability.drivetrains)) return false;
  const year = Number(vehicle?.year);
  if (Number.isFinite(Number(applicability.yearFrom)) && year < Number(applicability.yearFrom)) return false;
  if (Number.isFinite(Number(applicability.yearTo)) && year > Number(applicability.yearTo)) return false;
  return true;
}

function normalizedServiceName(value) {
  return comparable(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function matchingServiceHistory(history, rule) {
  const aliases = [rule.service_type, rule.rule_name, ...(rule.service_aliases || [])]
    .map(normalizedServiceName)
    .filter(Boolean);
  return history
    .filter((service) => ["verified", "corrected"].includes(comparable(service.verification_status)))
    .filter((service) => aliases.includes(normalizedServiceName(service.service_type)))
    .sort((left, right) => String(right.service_date || "").localeCompare(String(left.service_date || "")))[0] || null;
}

function hasScheduledAppointment(appointments, rule) {
  const ruleNames = [rule.service_type, rule.rule_name, ...(rule.service_aliases || [])]
    .map(normalizedServiceName)
    .filter(Boolean);
  return appointments.some((appointment) => (
    ACTIVE_APPOINTMENT_STATUSES.has(comparable(appointment.lifecycle_status || appointment.status))
    && ruleNames.includes(normalizedServiceName(appointment.service_type))
  ));
}

function confidenceFor({ asOf, exactApplicability, lastService, latestReading, rate, settings }) {
  const readingAgeDays = latestReading?.recordedAt
    ? ((validDate(asOf) || new Date()).getTime() - latestReading.recordedAt.getTime()) / DAY_MS
    : Infinity;
  const hasRecentVerifiedMileage = latestReading
    && ["verified", "corrected"].includes(latestReading.verificationStatus)
    && readingAgeDays <= Number(settings.recentVerifiedMileageDays ?? 120);
  if (
    exactApplicability
    && lastService
    && hasRecentVerifiedMileage
    && rate.verifiedCount >= Number(settings.highConfidenceMinVerifiedReadings ?? 3)
    && rate.spanDays >= Number(settings.highConfidenceMinSpanDays ?? 60)
  ) return "High";
  if (
    exactApplicability
    && (lastService || hasRecentVerifiedMileage)
    && rate.sampleCount >= Number(settings.mediumConfidenceMinReadings ?? 2)
  ) return "Medium";
  return "Low";
}

function statusFor({ currentMileageKm, nextDueMileageKm, nextDueDate, rule, scheduled, settings, hasMileage }) {
  if (scheduled) return "Scheduled";
  if (rule.requires_inspection) return "Inspection Required";
  if (!hasMileage && Number(rule.mileage_interval_km) > 0) return "Awaiting Mileage";
  const today = validDate(settings.asOf) || new Date();
  const daysRemaining = nextDueDate ? (nextDueDate - today) / DAY_MS : Infinity;
  const kmRemaining = Number.isFinite(nextDueMileageKm) && Number.isFinite(currentMileageKm)
    ? nextDueMileageKm - currentMileageKm
    : Infinity;
  if (daysRemaining < 0 || kmRemaining < 0) return "Overdue";
  if (daysRemaining <= settings.dueDays || kmRemaining <= settings.dueKm) return "Due";
  if (daysRemaining <= settings.approachingDays || kmRemaining <= settings.approachingKm) return "Approaching";
  return "Not Yet Due";
}

export function calculateMaintenanceForecast({
  vehicle,
  rule,
  mileageReadings = [],
  serviceHistory = [],
  appointments = [],
  settings = {},
  asOf = new Date(),
}) {
  const effectiveSettings = {
    asOf,
    approachingDays: Number(settings.approaching_days ?? settings.approachingDays ?? 30),
    dueDays: Number(settings.due_days ?? settings.dueDays ?? 7),
    approachingKm: Number(settings.approaching_km ?? settings.approachingKm ?? 1500),
    dueKm: Number(settings.due_km ?? settings.dueKm ?? 500),
    highConfidenceMinVerifiedReadings: Number(settings.high_confidence_min_verified_readings ?? settings.highConfidenceMinVerifiedReadings ?? 3),
    highConfidenceMinSpanDays: Number(settings.high_confidence_min_span_days ?? settings.highConfidenceMinSpanDays ?? 60),
    recentVerifiedMileageDays: Number(settings.recent_verified_mileage_days ?? settings.recentVerifiedMileageDays ?? 120),
    mediumConfidenceMinReadings: Number(settings.medium_confidence_min_readings ?? settings.mediumConfidenceMinReadings ?? 2),
  };
  if (!ruleAppliesToVehicle(rule, vehicle)) {
    return { status: "Not Applicable", confidence: "High", reason: { summary: "This approved rule does not apply to this vehicle." } };
  }

  const reliableReadings = mileageReadings
    .filter((reading) => !["estimated", "rejected"].includes(comparable(reading.verification_status)))
    .map((reading) => ({
      raw: reading,
      valueKm: toKilometres(reading.odometer_value ?? reading.odometerValue, reading.unit),
      recordedAt: validDate(reading.recorded_at || reading.recordedAt),
      verificationStatus: comparable(reading.verification_status || "self_reported"),
    }))
    .filter((reading) => Number.isFinite(reading.valueKm) && reading.recordedAt)
    .sort((left, right) => right.recordedAt - left.recordedAt);
  const latestReading = reliableReadings[0] || null;
  const currentMileageKm = latestReading?.valueKm ?? null;
  const rate = estimateDrivingRate(mileageReadings);
  const lastService = matchingServiceHistory(serviceHistory, rule);
  const lastServiceMileageKm = lastService?.service_mileage == null
    ? null
    : toKilometres(lastService.service_mileage, lastService.mileage_unit);
  const severeConditions = rule.severe_service_conditions && typeof rule.severe_service_conditions === "object"
    ? rule.severe_service_conditions
    : {};
  const severeServiceApplied = vehicle?.service_preferences?.severeService === true
    && (Number(severeConditions.mileageIntervalKm) > 0 || Number(severeConditions.timeIntervalMonths) > 0);
  const mileageIntervalKm = severeServiceApplied && Number(severeConditions.mileageIntervalKm) > 0
    ? Number(severeConditions.mileageIntervalKm)
    : Number(rule.mileage_interval_km) > 0 ? Number(rule.mileage_interval_km) : null;
  const timeIntervalMonths = severeServiceApplied && Number(severeConditions.timeIntervalMonths) > 0
    ? Number(severeConditions.timeIntervalMonths)
    : Number(rule.time_interval_months) > 0 ? Number(rule.time_interval_months) : null;
  const nextDueMileageKm = mileageIntervalKm && Number.isFinite(lastServiceMileageKm)
    ? lastServiceMileageKm + mileageIntervalKm
    : null;
  const calendarDueDate = timeIntervalMonths && lastService?.service_date
    ? addMonths(lastService.service_date, timeIntervalMonths)
    : null;
  const remainingKm = Number.isFinite(nextDueMileageKm) && Number.isFinite(currentMileageKm)
    ? nextDueMileageKm - currentMileageKm
    : null;
  const mileageDueDate = Number.isFinite(remainingKm) && Number.isFinite(rate.dailyKm) && rate.dailyKm > 0
    ? new Date((validDate(asOf) || new Date()).getTime() + (Math.max(0, remainingKm) / rate.dailyKm * DAY_MS))
    : null;
  const dueCandidates = [calendarDueDate, mileageDueDate].filter(Boolean).sort((left, right) => left - right);
  const nextDueDate = dueCandidates[0] || null;
  const applicability = rule.vehicle_applicability || {};
  const exactApplicability = Boolean(
    (Array.isArray(applicability.makes) && applicability.makes.length)
    || (Array.isArray(applicability.models) && applicability.models.length)
    || Number.isFinite(Number(applicability.yearFrom))
    || Number.isFinite(Number(applicability.yearTo))
  );
  const scheduled = hasScheduledAppointment(appointments, rule);
  let status = statusFor({
    currentMileageKm,
    nextDueMileageKm,
    nextDueDate,
    rule,
    scheduled,
    settings: effectiveSettings,
    hasMileage: Boolean(latestReading),
  });
  const missingBaseline = Boolean(!lastService && (mileageIntervalKm || timeIntervalMonths));
  if (missingBaseline && !scheduled) status = latestReading ? "Inspection Required" : "Awaiting Mileage";
  const confidence = missingBaseline
    ? "Low"
    : confidenceFor({ asOf, exactApplicability, lastService, latestReading, rate, settings: effectiveSettings });
  const sourceName = String(rule.source_reference || "Approved maintenance source");
  const explanation = missingBaseline
    ? `Manual review is required because no verified ${rule.service_type || rule.rule_name} history is available.`
    : `Based on ${sourceName}, the verified service baseline, and the latest reliable mileage.`;

  return {
    status,
    confidence,
    lastServiceHistoryId: lastService?.id || null,
    currentMileageKm: Number.isFinite(currentMileageKm) ? Math.round(currentMileageKm) : null,
    estimatedDailyKm: Number.isFinite(rate.dailyKm) ? Number(rate.dailyKm.toFixed(2)) : null,
    nextDueMileageKm: Number.isFinite(nextDueMileageKm) ? Math.round(nextDueMileageKm) : null,
    mileageDueDate: dateOnly(mileageDueDate),
    calendarDueDate: dateOnly(calendarDueDate),
    nextDueDate: dateOnly(nextDueDate),
    needsManualReview: missingBaseline || confidence === "Low",
    reason: {
      summary: explanation,
      sourceReference: sourceName,
      sourceVersion: rule.source_version || null,
      mileageIntervalKm,
      timeIntervalMonths,
      usedVerifiedService: Boolean(lastService),
      usedEstimatedMileageRate: Number.isFinite(rate.dailyKm),
      drivingRateSampleCount: rate.sampleCount,
      ignoredOutlierSegments: rate.outlierCount,
      severeServiceApplied,
      severeServiceCondition: severeServiceApplied ? severeConditions.condition || "Documented severe-service schedule" : null,
      warning: "Estimated mileage is directional and is never treated as a verified odometer reading.",
    },
  };
}

export function taskForForecast(forecast) {
  const taskByStatus = {
    "Approaching": { taskType: "maintenance_follow_up", priority: "normal" },
    "Due": { taskType: "maintenance_follow_up", priority: "high" },
    "Overdue": { taskType: "maintenance_follow_up", priority: "urgent" },
    "Inspection Required": { taskType: "manual_review", priority: "high" },
    "Awaiting Mileage": { taskType: "mileage_update", priority: "normal" },
  };
  return taskByStatus[forecast?.status] || null;
}

export function mileageReminderIntervalDays({ annualKm, forecastStatuses = [], settings = {} }) {
  let interval = Number(settings.insufficient_data_reminder_days ?? settings.insufficientDataReminderDays ?? 60);
  if (Number.isFinite(annualKm)) {
    const highUsageKm = Number(settings.high_usage_annual_km ?? settings.highUsageAnnualKm ?? 20000);
    const lowUsageKm = Number(settings.low_usage_annual_km ?? settings.lowUsageAnnualKm ?? 8000);
    if (annualKm >= highUsageKm) interval = Number(settings.high_usage_reminder_days ?? settings.highUsageReminderDays ?? 30);
    else if (annualKm <= lowUsageKm) interval = Number(settings.low_usage_reminder_days ?? settings.lowUsageReminderDays ?? 90);
    else interval = Number(settings.average_usage_reminder_days ?? settings.averageUsageReminderDays ?? 60);
  }
  if (forecastStatuses.some((status) => ["Approaching", "Due", "Overdue"].includes(status))) {
    interval = Math.min(interval, 14);
  }
  return Math.max(7, Math.round(interval));
}

export function completedAppointmentServiceRecords(appointment, performedServices = []) {
  if (comparable(appointment?.status) !== "completed") return [];
  return performedServices
    .filter((service) => service?.confirmed === true)
    .map((service) => ({ serviceType: String(service.serviceType || "").trim(), performed: true }))
    .filter((service) => service.serviceType);
}
