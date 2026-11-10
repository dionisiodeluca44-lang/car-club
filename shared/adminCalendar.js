function text(value) {
  return String(value || "").trim();
}

function dateInTimeZone(value, timeZone = "America/Toronto") {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function vehicleLabel(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "Vehicle";
}

function customerLabel(vehicle = {}) {
  return vehicle.customer?.full_name || vehicle.customer?.email || "Member";
}

function activeStatus(value) {
  return !["archived", "cancelled", "canceled", "completed", "dismissed"].includes(text(value).toLowerCase());
}

export function buildAdminCalendarEvents({ vehicles = [], rules = [], forecasts = [], tasks = [] } = {}) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const events = [];

  for (const vehicle of vehicles) {
    for (const appointment of vehicle.appointments || []) {
      if (!appointment.preferred_date || !activeStatus(appointment.status)) continue;
      events.push({
        id: `appointment:${appointment.id}`,
        type: "appointment",
        date: String(appointment.preferred_date).slice(0, 10),
        time: text(appointment.preferred_time).slice(0, 5),
        title: text(appointment.service_type) || "Service appointment",
        detail: text(appointment.notes),
        status: text(appointment.status) || "Requested",
        priority: "normal",
        vehicleId: vehicle.id,
        vehicle: vehicleLabel(vehicle),
        customer: customerLabel(vehicle),
      });
    }
  }

  const activeForecastTasks = new Set();
  for (const task of tasks) {
    if (!activeStatus(task.status)) continue;
    if (task.related_forecast_id) activeForecastTasks.add(task.related_forecast_id);
    const dueValue = task.status === "snoozed" && task.snoozed_until ? task.snoozed_until : task.due_at;
    const date = dateInTimeZone(dueValue);
    if (!date) continue;
    const vehicle = vehicleById.get(task.vehicle_id) || {};
    const isMileage = task.task_type === "mileage_update";
    events.push({
      id: `task:${task.id}`,
      type: isMileage ? "mileage" : "maintenance",
      date,
      time: "",
      title: isMileage ? "Mileage check-in" : text(task.title) || "Vehicle follow-up",
      detail: text(task.detail),
      status: text(task.status).replaceAll("_", " ") || "Open",
      priority: text(task.priority) || "normal",
      vehicleId: vehicle.id || task.vehicle_id || "",
      vehicle: vehicleLabel(vehicle),
      customer: customerLabel(vehicle),
    });
  }

  const excludedForecastStatuses = new Set(["Scheduled", "Completed", "Dismissed", "Not Applicable"]);
  for (const forecast of forecasts) {
    if (!forecast.next_due_date || activeForecastTasks.has(forecast.id) || excludedForecastStatuses.has(forecast.status)) continue;
    const vehicle = vehicleById.get(forecast.vehicle_id) || {};
    const rule = ruleById.get(forecast.rule_id);
    events.push({
      id: `forecast:${forecast.id}`,
      type: "maintenance",
      date: String(forecast.next_due_date).slice(0, 10),
      time: "",
      title: text(rule?.rule_name) || "Maintenance due",
      detail: text(forecast.reason?.summary),
      status: text(forecast.status) || "Upcoming",
      priority: ["Overdue", "Due"].includes(forecast.status) ? "high" : "normal",
      vehicleId: vehicle.id || forecast.vehicle_id || "",
      vehicle: vehicleLabel(vehicle),
      customer: customerLabel(vehicle),
    });
  }

  return events.sort((left, right) => (
    left.date.localeCompare(right.date)
    || left.time.localeCompare(right.time)
    || left.title.localeCompare(right.title)
  ));
}

