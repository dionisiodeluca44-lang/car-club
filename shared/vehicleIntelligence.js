const kilometresPerMile = 1.609344;

export function normalizeMileageUnit(value) {
  return String(value || "").toLowerCase() === "mi" ? "mi" : "km";
}
export function normalizeOdometer(value) {
  const normalized = String(value ?? "").replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const odometer = Number.parseInt(normalized, 10);
  return Number.isInteger(odometer) && odometer >= 0 && odometer <= 2000000 ? odometer : null;
}

export function toKilometres(value, unit = "km") {
  const odometer = normalizeOdometer(value);
  if (odometer === null) return null;
  return normalizeMileageUnit(unit) === "mi" ? odometer * kilometresPerMile : odometer;
}

export function mileageCorrectionRequired(latestReading, nextReading) {
  const latest = normalizeOdometer(latestReading);
  const next = normalizeOdometer(nextReading);
  return latest !== null && next !== null && next < latest;
}

export function averageDailyDistance(readings = [], outputUnit = "km") {
  const normalized = readings
    .map((reading) => ({
      valueKm: toKilometres(reading.odometerValue ?? reading.odometer_value, reading.unit),
      recordedAt: new Date(reading.recordedAt || reading.recorded_at).getTime(),
    }))
    .filter((reading) => Number.isFinite(reading.valueKm) && Number.isFinite(reading.recordedAt))
    .sort((left, right) => left.recordedAt - right.recordedAt);

  if (normalized.length < 2) return null;
  const rates = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const days = (current.recordedAt - previous.recordedAt) / 86400000;
    const distance = current.valueKm - previous.valueKm;
    if (days >= 1 && distance >= 0) rates.push(distance / days);
  }
  if (!rates.length) return null;
  rates.sort((left, right) => left - right);
  const middle = Math.floor(rates.length / 2);
  const medianKm = rates.length % 2 ? rates[middle] : (rates[middle - 1] + rates[middle]) / 2;
  return normalizeMileageUnit(outputUnit) === "mi" ? medianKm / kilometresPerMile : medianKm;
}

export function mapAppointmentLifecycleStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["requested", "new"].includes(status)) return "Requested";
  if (["in review", "approved", "pending", "pending confirmation"].includes(status)) return "Pending Confirmation";
  if (["booked", "paid / confirmed", "paid", "confirmed"].includes(status)) return "Confirmed";
  if (["in progress", "started"].includes(status)) return "In Progress";
  if (["completed", "complete"].includes(status)) return "Completed";
  if (["cancelled", "canceled"].includes(status)) return "Cancelled";
  if (["no show", "no-show"].includes(status)) return "No Show";
  return "Requested";
}
