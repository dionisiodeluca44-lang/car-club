const supportedChannels = new Set(["email", "sms"]);

export function normalizeOutreachChannel(value) {
  const channel = String(value || "email").trim().toLowerCase();
  return supportedChannels.has(channel) ? channel : "email";
}

export function normalizePreferredLanguage(value) {
  const language = String(value || "en").trim().toLowerCase();
  return language.startsWith("fr") ? "fr-CA" : "en-CA";
}

export function normalizedServiceKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function communicationEligibility(preferences, { channel = "email", purpose = "transactional" } = {}) {
  const normalizedChannel = normalizeOutreachChannel(channel);
  if (!preferences) return { eligible: false, reason: "Communication preferences have not been recorded." };
  if (preferences.suppressed_at || preferences.unsubscribe_timestamp) {
    return { eligible: false, reason: "Customer is on the suppression list." };
  }
  const consentField = purpose === "promotional" ? "promotional_consent" : "transactional_consent";
  if (!preferences[consentField]) {
    return { eligible: false, reason: `${purpose === "promotional" ? "Promotional" : "Transactional"} consent is not recorded.` };
  }
  const channelField = normalizedChannel === "sms" ? "sms_enabled" : "email_enabled";
  if (!preferences[channelField]) {
    return { eligible: false, reason: `${normalizedChannel.toUpperCase()} contact is disabled.` };
  }
  return { eligible: true, reason: "Recorded consent permits this message." };
}

export function resolveServicePrice(serviceName, aliases = [], pricingRows = []) {
  const candidates = new Set([serviceName, ...aliases].map(normalizedServiceKey).filter(Boolean));
  const row = pricingRows.find((item) => candidates.has(normalizedServiceKey(item.service_label)));
  if (!row) return { estimatedRevenueCents: null, quoteRequired: true, pricingSource: null };
  if (row.payment_mode !== "full") {
    return {
      estimatedRevenueCents: row.payment_mode === "free" ? 0 : null,
      quoteRequired: row.payment_mode !== "free",
      pricingSource: row.service_label,
    };
  }
  return {
    estimatedRevenueCents: Math.max(0, Number(row.amount_cents) || 0),
    quoteRequired: false,
    pricingSource: row.service_label,
  };
}

export function hasMatchingActiveAppointment(serviceName, aliases = [], appointments = []) {
  const candidates = new Set([serviceName, ...aliases].map(normalizedServiceKey).filter(Boolean));
  return appointments.some((appointment) => {
    if (["cancelled", "completed", "no show"].includes(String(appointment.status || "").toLowerCase())) return false;
    return candidates.has(normalizedServiceKey(appointment.service_type));
  });
}

export function opportunityPriority(forecast) {
  if (forecast?.status === "Overdue") return "urgent";
  if (forecast?.status === "Due") return "high";
  if (["Inspection Required", "Awaiting Mileage"].includes(forecast?.status)) return "normal";
  return "low";
}

export function outreachTypeForForecast(forecast) {
  if (forecast?.status === "Overdue") return "overdue_maintenance_follow_up";
  if (["Due", "Approaching"].includes(forecast?.status)) return "upcoming_maintenance_reminder";
  if (forecast?.status === "Inspection Required") return "preventative_inspection_recommendation";
  return "mileage_update_request";
}

function firstName(value) {
  return String(value || "there").trim().split(/\s+/)[0] || "there";
}

export function buildOutreachDraft({ customerName, vehicle, serviceName, forecast, language = "en-CA", bookingUrl = "" }) {
  const preferredLanguage = normalizePreferredLanguage(language);
  const vehicleLabel = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "your vehicle";
  const reason = String(forecast?.reason?.summary || "").trim();
  const dueText = forecast?.next_due_date ? ` (${forecast.next_due_date})` : "";
  const safeReason = reason || (preferredLanguage === "fr-CA"
    ? `nos dossiers indiquent que ${serviceName} pourrait bientôt être à prévoir`
    : `our records indicate that ${serviceName} may be approaching`);
  const link = bookingUrl ? ` ${bookingUrl}` : "";
  if (preferredLanguage === "fr-CA") {
    return {
      subject: `Suivi d’entretien — ${vehicleLabel}`,
      body: `Bonjour ${firstName(customerName)},\n\nNous communiquons avec vous au sujet de votre ${vehicleLabel}. Selon les renseignements vérifiés au dossier, ${safeReason}${dueText}.\n\nIl s’agit d’une recommandation d’entretien, et non d’un diagnostic. Si vous le souhaitez, notre équipe peut confirmer les détails et coordonner la prochaine étape.${link}\n\nWhite Glove Concierge`,
    };
  }
  return {
    subject: `Maintenance follow-up — ${vehicleLabel}`,
    body: `Hi ${firstName(customerName)},\n\nWe’re reaching out regarding your ${vehicleLabel}. Based on the verified information on file, ${safeReason}${dueText}.\n\nThis is a maintenance recommendation, not a diagnosis. If you’d like, our team can confirm the details and coordinate the next step.${link}\n\nWhite Glove Concierge`,
  };
}

export function vehiclePlanningGaps(vehicle = {}) {
  const fields = [
    ["year", "model year"],
    ["make", "make"],
    ["model", "model"],
    ["vin", "VIN"],
    ["mileage", "current mileage"],
  ];
  return fields.filter(([key]) => vehicle[key] == null || String(vehicle[key]).trim() === "").map(([, label]) => label);
}

export function buildBestEffortReviewDraft({ customerName, vehicle, language = "en-CA", bookingUrl = "" }) {
  const preferredLanguage = normalizePreferredLanguage(language);
  const vehicleLabel = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "your vehicle";
  const gaps = vehiclePlanningGaps(vehicle);
  const missingEnglish = gaps.length ? ` We still need to confirm: ${gaps.join(", ")}.` : " We would like to confirm its current maintenance needs and recent service history.";
  const missingFrench = gaps.length ? ` Il nous reste à confirmer : ${gaps.join(", ")}.` : " Nous aimerions confirmer ses besoins d’entretien actuels et son historique de service récent.";
  const link = bookingUrl ? ` ${bookingUrl}` : "";
  if (preferredLanguage === "fr-CA") {
    return {
      subject: `Vérification du dossier d’entretien — ${vehicleLabel}`,
      body: `Bonjour ${firstName(customerName)}, ici White Glove Concierge. Nous préparons la planification d’entretien de votre ${vehicleLabel} avec les renseignements actuellement au dossier.${missingFrench} Cette vérification sert à compléter le dossier; ce n’est ni un diagnostic ni un calendrier d’entretien du fabricant vérifié. Souhaitez-vous que nous fassions cette mise à jour avec vous?${link}`,
    };
  }
  return {
    subject: `Maintenance information review — ${vehicleLabel}`,
    body: `Hi ${firstName(customerName)}, it’s White Glove Concierge. We’re preparing the maintenance plan for your ${vehicleLabel} using the information currently on file.${missingEnglish} This is an information-gathering review, not a diagnosis or a verified manufacturer maintenance schedule. Would you like us to complete this update with you?${link}`,
  };
}

function dateOnlyAfter(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthsSince(value, asOf) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (new Date(asOf).getTime() - date.getTime()) / (30.4375 * 86400000));
}

function matchingService(history, pattern) {
  return history
    .filter((item) => pattern.test(`${item.service_type || ""} ${item.service_description || ""}`))
    .sort((left, right) => String(right.service_date || "").localeCompare(String(left.service_date || "")))[0] || null;
}

/**
 * Produces cautious planning windows when no exact approved manufacturer rule is
 * available. These are CRM review prompts, not claims that maintenance is due.
 */
export function estimatedMaintenancePlan(vehicle = {}, serviceHistory = [], asOf = new Date()) {
  const year = Number.parseInt(vehicle.year, 10);
  const modelAge = Number.isInteger(year) ? Math.max(0, new Date(asOf).getUTCFullYear() - year) : null;
  const recordedMileage = Number(vehicle.mileage);
  const hasMileage = Number.isFinite(recordedMileage) && recordedMileage >= 0;
  const mileageUnit = String(vehicle.mileage_unit || "km").toLowerCase() === "mi" ? "mi" : "km";
  const mileageKm = hasMileage ? recordedMileage * (mileageUnit === "mi" ? 1.609344 : 1) : null;
  const usableHistory = serviceHistory.filter((item) => item.verification_status !== "rejected");
  const context = [
    modelAge == null ? "vehicle age not recorded" : `${modelAge}-year vehicle age`,
    hasMileage ? `${Math.round(recordedMileage).toLocaleString("en-CA")} ${mileageUnit} recorded` : "current mileage not recorded",
    usableHistory.length ? `${usableHistory.length} service record${usableHistory.length === 1 ? "" : "s"} reviewed` : "no service history on file",
  ].join(", ");
  const estimatedReason = (detail) => `Estimated planning window based on ${context}. ${detail} Confirm the vehicle's condition, recent records, and manufacturer schedule before booking.`;
  const oilRecord = matchingService(usableHistory, /\b(oil|lubrication|engine service|filter)\b/i);
  const tireBrakeRecord = matchingService(usableHistory, /\b(tire|tyre|brake|rotor|pad)\b/i);
  const batteryFluidRecord = matchingService(usableHistory, /\b(battery|coolant|fluid|antifreeze)\b/i);
  const oilRecent = oilRecord && monthsSince(oilRecord.service_date, asOf) <= 10;
  const tireBrakeRecent = tireBrakeRecord && monthsSince(tireBrakeRecord.service_date, asOf) <= 6;
  const batteryFluidRecent = batteryFluidRecord && monthsSince(batteryFluidRecord.service_date, asOf) <= 9;
  const olderOrDriven = (modelAge ?? 4) >= 4 || (hasMileage && mileageKm >= 20000);
  const assumptions = { modelAge, recordedMileage: hasMileage ? recordedMileage : null, mileageUnit, mileageKm, serviceHistoryCount: usableHistory.length, verifiedSchedule: false };
  const items = [];

  if (!hasMileage) {
    items.push({
      key: "odometer-check-in",
      title: "Odometer and maintenance-record check-in",
      titleFr: "Mise à jour de l’odomètre et du dossier d’entretien",
      category: "planning",
      dueDate: dateOnlyAfter(asOf, 7),
      reason: estimatedReason("An updated odometer reading is needed to improve mileage-based estimates."),
      assumptions,
    });
  }

  items.push({
    key: "oil-filter-review",
    title: "Oil and filter service review",
    titleFr: "Vérification de l’huile et du filtre",
    category: "mechanical",
    dueDate: dateOnlyAfter(asOf, oilRecent ? 120 : 30),
    reason: estimatedReason(oilRecent
      ? `An oil-related service was recorded on ${oilRecord.service_date}; confirm the applicable next interval.`
      : "No recent oil-and-filter service is recorded, so this should be reviewed first."),
    assumptions,
  });
  items.push({
    key: "tires-brakes-review",
    title: "Tire and brake condition review",
    titleFr: "Vérification de l’état des pneus et des freins",
    category: "safety",
    dueDate: dateOnlyAfter(asOf, tireBrakeRecent ? 120 : olderOrDriven ? 45 : 90),
    reason: estimatedReason(tireBrakeRecent
      ? `Tire or brake work was recorded on ${tireBrakeRecord.service_date}; confirm condition at the next appropriate inspection.`
      : "No recent tire or brake inspection is recorded; condition and remaining life should be checked."),
    assumptions,
  });
  items.push({
    key: "battery-fluids-review",
    title: "Battery and fluid condition review",
    titleFr: "Vérification de la batterie et des liquides",
    category: "preventative",
    dueDate: dateOnlyAfter(asOf, batteryFluidRecent ? 150 : olderOrDriven ? 60 : 120),
    reason: estimatedReason(batteryFluidRecent
      ? `Battery or fluid service was recorded on ${batteryFluidRecord.service_date}; verify the next appropriate check.`
      : "No recent battery or fluid-condition record is available; a preventative review is advisable."),
    assumptions,
  });
  return items;
}

function readablePlanningDate(value, language) {
  return new Intl.DateTimeFormat(language === "fr-CA" ? "fr-CA" : "en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function buildEstimatedMaintenanceDraft({ customerName, vehicle, items = [], gaps = [], language = "en-CA", bookingUrl = "" }) {
  const preferredLanguage = normalizePreferredLanguage(language);
  const vehicleLabel = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || (preferredLanguage === "fr-CA" ? "votre véhicule" : "your vehicle");
  const link = bookingUrl ? `\n\n${bookingUrl}` : "";
  if (preferredLanguage === "fr-CA") {
    const list = items.map((item) => `• ${item.titleFr || item.title} — fenêtre de vérification estimée : ${readablePlanningDate(item.dueDate, preferredLanguage)}`).join("\n");
    const missing = gaps.length ? `\n\nPour finaliser le plan, il faudra également confirmer : ${gaps.join(", ")}.` : "";
    return {
      subject: `Planification d’entretien pour votre ${vehicleLabel}`,
      body: `Bonjour ${firstName(customerName)},\n\nNous avons examiné les renseignements actuellement au dossier pour votre ${vehicleLabel}. Selon l’âge du véhicule, le kilométrage enregistré et l’historique de service disponible, voici les prochains éléments à vérifier :\n\n${list}\n\nCes échéances sont des estimations de planification jusqu’à ce que nous confirmions l’historique récent et le calendrier du fabricant.${missing}\n\nSi vous le souhaitez, notre équipe peut valider les dossiers et coordonner les services qui sont réellement requis.${link}\n\nWhite Glove Concierge`,
    };
  }
  const list = items.map((item) => `• ${item.title} — estimated review window: ${readablePlanningDate(item.dueDate, preferredLanguage)}`).join("\n");
  const missing = gaps.length ? `\n\nTo finalize the plan, we also need to confirm: ${gaps.join(", ")}.` : "";
  return {
    subject: `Maintenance planning for your ${vehicleLabel}`,
    body: `Hi ${firstName(customerName)},\n\nWe’ve reviewed the information currently on file for your ${vehicleLabel}. Based on the vehicle’s age, recorded mileage, and available service history, the next items worth reviewing are:\n\n${list}\n\nThese are planning estimates until we confirm the recent service records and applicable manufacturer schedule.${missing}\n\nIf you’d like, our team can verify the records and coordinate anything that is actually due.${link}\n\nWhite Glove Concierge`,
  };
}

export function isMaterialMessageChange(message, nextSubject, nextBody) {
  return String(message?.subject || "").trim() !== String(nextSubject || "").trim()
    || String(message?.message_body || "").trim() !== String(nextBody || "").trim();
}

export function outreachFrequencyAllowed(messages, settings, asOf = new Date()) {
  const limit = Math.max(1, Number(settings?.max_customer_contacts_per_30_days) || 4);
  const minimumDays = Math.max(1, Number(settings?.minimum_days_between_contacts) || 7);
  const asOfTime = new Date(asOf).getTime();
  const cutoff = new Date(asOf).getTime() - (30 * 86400000);
  const recentSentTimes = messages.map((message) => {
    const sentAt = new Date(message.sent_at || 0).getTime();
    return Number.isFinite(sentAt) && ["sent", "delivered"].includes(message.delivery_status) ? sentAt : null;
  }).filter(Boolean);
  const recent = recentSentTimes.filter((sentAt) => sentAt >= cutoff);
  const mostRecent = recentSentTimes.length ? Math.max(...recentSentTimes) : 0;
  const gapAllowed = !mostRecent || asOfTime - mostRecent >= minimumDays * 86400000;
  return { allowed: recent.length < limit && gapAllowed, count: recent.length, limit };
}
