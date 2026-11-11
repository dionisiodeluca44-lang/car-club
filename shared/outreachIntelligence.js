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
      body: `Bonjour ${firstName(customerName)}, ici White Glove Concierge. Selon les renseignements vérifiés au dossier pour votre ${vehicleLabel}, ${safeReason}${dueText}. Il s’agit d’une recommandation, et non d’un diagnostic. Souhaitez-vous que nous vous aidions à organiser la prochaine étape?${link}`,
    };
  }
  return {
    subject: `Maintenance follow-up — ${vehicleLabel}`,
    body: `Hi ${firstName(customerName)}, it’s White Glove Concierge. Based on the verified information on file for your ${vehicleLabel}, ${safeReason}${dueText}. This is a recommendation, not a diagnosis. Would you like us to help arrange the next step?${link}`,
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
