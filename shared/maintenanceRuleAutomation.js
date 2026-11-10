const OFFICIAL_OWNER_PORTALS = Object.freeze({
  acura: "https://owners.acura.com/vehicle-information/manuals",
  audi: "https://ownersmanual.audiusa.com/",
  bmw: "https://www.bmwusa.com/owners-manuals.html",
  buick: "https://experience.gm.com/support/vehicle/manuals-guides",
  cadillac: "https://experience.gm.com/support/vehicle/manuals-guides",
  chevrolet: "https://experience.gm.com/support/vehicle/manuals-guides",
  chrysler: "https://www.mopar.com/en-us/my-vehicle/owners-manual.html",
  dodge: "https://www.mopar.com/en-us/my-vehicle/owners-manual.html",
  fiat: "https://www.mopar.com/en-us/my-vehicle/owners-manual.html",
  ford: "https://www.ford.ca/support/owner-manuals/",
  genesis: "https://owners.genesis.com/us/en/resources/manuals-warranties.html",
  gmc: "https://experience.gm.com/support/vehicle/manuals-guides",
  honda: "https://mygarage.honda.com/s/manuals-search",
  hyundai: "https://owners.hyundaiusa.com/us/en/resources/manuals-warranties.html",
  infiniti: "https://www.infinitiusa.com/owners/ownership/manuals-guides.html",
  jaguar: "https://www.jaguar.com/owners/handbooks-and-guides/index.html",
  jeep: "https://www.mopar.com/en-us/my-vehicle/owners-manual.html",
  kia: "https://owners.kia.com/content/owners/en/manuals.html",
  "land rover": "https://www.landrover.com/ownership/guides-and-manuals/index.html",
  lexus: "https://www.lexus.com/My-Lexus/resources",
  lincoln: "https://www.lincoln.com/support/owner-manuals/",
  mazda: "https://www.mazdausa.com/static/manuals-and-guides",
  "mercedes-benz": "https://www.mercedes-benz.ca/en/owners/service-warranty-manuals",
  mini: "https://www.miniusa.com/owners/tools-support/owner-manuals.html",
  mitsubishi: "https://www.mitsubishicars.com/owners/service/manuals",
  nissan: "https://www.nissanusa.com/owners/ownership/manuals-guides.html",
  porsche: "https://manual.porsche.com/",
  ram: "https://www.mopar.com/en-us/my-vehicle/owners-manual.html",
  subaru: "https://www.subaru.com/owners/vehicle-resources.html",
  tesla: "https://www.tesla.com/ownersmanual",
  toyota: "https://www.toyota.ca/toyota/en/owners/manuals",
  volkswagen: "https://www.vwserviceandparts.com/digital-resources/online-owners-manual/",
  volvo: "https://www.volvocars.com/ca/support/car/",
});

function clean(value, limit = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
}

export function normalizedVehicleMake(value) {
  const make = clean(value).toLowerCase().replace(/[._]/g, " ").replace(/\s+/g, " ");
  const aliases = {
    benz: "mercedes-benz",
    mercedes: "mercedes-benz",
    "mercedes benz": "mercedes-benz",
    vw: "volkswagen",
    "landrover": "land rover",
  };
  return aliases[make] || make;
}

export function officialOwnerPortal(make) {
  return OFFICIAL_OWNER_PORTALS[normalizedVehicleMake(make)] || null;
}

export function vehicleRuleSignature(vehicle = {}) {
  return [vehicle.year, normalizedVehicleMake(vehicle.make), vehicle.model, vehicle.trim, vehicle.engine]
    .map((value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-");
}

export function exactVehicleApplicability(vehicle = {}) {
  const year = Number.parseInt(vehicle.year, 10);
  return {
    makes: clean(vehicle.make) ? [clean(vehicle.make)] : [],
    models: clean(vehicle.model) ? [clean(vehicle.model)] : [],
    trims: clean(vehicle.trim) ? [clean(vehicle.trim)] : [],
    engines: clean(vehicle.engine) ? [clean(vehicle.engine)] : [],
    fuelTypes: clean(vehicle.fuel_type || vehicle.fuelType) ? [clean(vehicle.fuel_type || vehicle.fuelType)] : [],
    drivetrains: clean(vehicle.drivetrain) ? [clean(vehicle.drivetrain)] : [],
    yearFrom: Number.isInteger(year) ? year : undefined,
    yearTo: Number.isInteger(year) ? year : undefined,
  };
}

export function safeInspectionDraft(vehicle = {}) {
  const signature = vehicleRuleSignature(vehicle) || "unknown-vehicle";
  const name = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].map(clean).filter(Boolean).join(" ") || "Vehicle";
  const portal = officialOwnerPortal(vehicle.make);
  return {
    stableKey: `auto-${signature}-schedule-verification`,
    ruleName: `${name} maintenance schedule verification`,
    serviceType: "Manufacturer maintenance schedule review",
    serviceAliases: ["Maintenance inspection", "Scheduled maintenance review"],
    serviceCategory: "preventative",
    recommendationType: "inspection",
    mileageIntervalKm: null,
    timeIntervalMonths: null,
    sourceType: "internal_inspection",
    sourceReference: portal
      ? `Official ${clean(vehicle.make)} owner resources: ${portal}. No exact interval was automatically confirmed; retain the vehicle-specific booklet before approval.`
      : `No supported official owner-resource portal was found automatically for ${name}. Obtain and retain the vehicle-specific maintenance booklet before approval.`,
    sourceVersion: null,
    confidenceLevel: "Low",
    customerExplanation: "The exact manufacturer schedule still needs to be verified for this vehicle. No service interval has been assumed.",
    severeServiceConditions: {},
    requiresInspection: true,
    safetyRelated: false,
    vehicleApplicability: exactVehicleApplicability(vehicle),
    automationStatus: "no_reliable_source",
  };
}

function positiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeDiscoveredRule(rule, vehicle) {
  const serviceType = clean(rule?.serviceType);
  const sourceUrl = httpsUrl(rule?.sourceUrl);
  const sourceTitle = clean(rule?.sourceTitle, 300);
  const sourceVersion = clean(rule?.sourceVersion, 200);
  const mileageIntervalKm = positiveInteger(rule?.mileageIntervalKm);
  const timeIntervalMonths = positiveInteger(rule?.timeIntervalMonths);
  if (!serviceType || !sourceUrl || !sourceTitle || !sourceVersion || (!mileageIntervalKm && !timeIntervalMonths)) return null;
  const signature = vehicleRuleSignature(vehicle) || "unknown-vehicle";
  const serviceKey = serviceType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const category = ["mechanical", "tires", "preventative"].includes(rule.serviceCategory) ? rule.serviceCategory : "preventative";
  const confidence = ["High", "Medium", "Low"].includes(rule.confidenceLevel) ? rule.confidenceLevel : "Medium";
  return {
    stableKey: `auto-${signature}-${serviceKey}`,
    ruleName: clean(rule.ruleName) || `${serviceType} schedule`,
    serviceType,
    serviceAliases: Array.isArray(rule.serviceAliases) ? rule.serviceAliases.map((item) => clean(item)).filter(Boolean).slice(0, 10) : [],
    serviceCategory: category,
    recommendationType: "scheduled_maintenance",
    mileageIntervalKm,
    timeIntervalMonths,
    sourceType: "manufacturer",
    sourceReference: `${sourceTitle} — ${sourceUrl}${clean(rule.sourceCitation, 600) ? ` — ${clean(rule.sourceCitation, 600)}` : ""}`,
    sourceVersion,
    confidenceLevel: confidence,
    customerExplanation: clean(rule.customerExplanation, 1200) || `This draft follows the retained ${sourceTitle} schedule for the specified vehicle configuration.`,
    severeServiceConditions: {},
    requiresInspection: false,
    safetyRelated: Boolean(rule.safetyRelated),
    vehicleApplicability: exactVehicleApplicability(vehicle),
    automationStatus: confidence === "High" ? "ready_to_approve" : "needs_review",
  };
}

export function automationStatusForRule(rule = {}) {
  if (rule.approval_status === "approved") return "Approved";
  if (rule.source_type === "manufacturer" && rule.confidence_level === "High") return "Ready to approve";
  if (rule.source_type === "manufacturer") return "Needs review";
  if (rule.requires_inspection && /No supported official|No exact interval/i.test(rule.source_reference || "")) return "No reliable source found";
  return "Needs review";
}

export function unresolvedAutomaticRule(rule = {}) {
  const generated = String(rule.stable_key || "").startsWith("auto-");
  const missingInterval = !Number(rule.mileage_interval_km) && !Number(rule.time_interval_months);
  const unresolvedSource = /No exact interval|No supported official|needs to be verified/i.test(rule.source_reference || "");
  return generated && Boolean(rule.requires_inspection) && (missingInterval || unresolvedSource);
}

export function verifiedRuleCanAutoActivate(rule = {}) {
  const applicability = rule.vehicle_applicability || {};
  const hasExactVehicle = Array.isArray(applicability.makes)
    && applicability.makes.length > 0
    && Array.isArray(applicability.models)
    && applicability.models.length > 0
    && Number.isInteger(Number(applicability.yearFrom))
    && Number(applicability.yearFrom) >= 1886
    && Number.isInteger(Number(applicability.yearTo))
    && Number(applicability.yearTo) >= Number(applicability.yearFrom);
  const hasInterval = Number(rule.mileage_interval_km) > 0 || Number(rule.time_interval_months) > 0;
  const hasRetainedHttpsSource = /https:\/\//i.test(String(rule.source_reference || ""));
  return rule.approval_status === "draft"
    && rule.source_type === "manufacturer"
    && rule.confidence_level === "High"
    && Boolean(String(rule.source_version || "").trim())
    && hasExactVehicle
    && hasInterval
    && hasRetainedHttpsSource
    && !rule.requires_inspection
    && !unresolvedAutomaticRule(rule);
}

