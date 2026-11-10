function normalizedDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function torontoDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function canArchivePastBooking(request = {}, today = torontoDate()) {
  const status = String(request.status || "").trim().toLowerCase();
  if (["completed", "cancelled", "canceled"].includes(status)) return true;
  const appointmentDate = normalizedDate(request.preferred_date || request.preferredDate);
  return Boolean(appointmentDate && appointmentDate < normalizedDate(today));
}

