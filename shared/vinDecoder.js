const decodedVehicleFields = [
  "year",
  "make",
  "model",
  "trim",
  "bodyStyle",
  "drivetrain",
  "transmission",
  "fuelType",
  "engine",
  "horsepower",
];

export function normalizeVin(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

export function isValidVin(value) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(value));
}

function useful(value) {
  const text = String(value ?? "").trim();
  if (!text || /^(0|not applicable|n\/a|null)$/i.test(text)) return "";
  return text;
}

function vehicleCase(value) {
  return useful(value).split(/\s+/).map((word) => {
    return word.split("-").map((part) => {
      if (/^[A-Z0-9]{2,3}$/.test(part) || /^\d/.test(part)) return part;
      return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
    }).join("-");
  }).join(" ");
}

function bodyStyle(value) {
  const text = useful(value).toLowerCase();
  if (!text) return "";
  if (text.includes("convertible") || text.includes("cabriolet")) return "Convertible";
  if (text.includes("coupe")) return "Coupe";
  if (text.includes("hatchback")) return "Hatchback";
  if (text.includes("wagon")) return "Wagon";
  if (text.includes("sport utility") || text.includes("multipurpose") || text.includes("multi-purpose") || text.includes("crossover")) return "SUV";
  if (text.includes("pickup")) return "Pickup truck";
  if (text.includes("van")) return "Van";
  if (text.includes("sedan") || text.includes("saloon")) return "Sedan";
  return "Other";
}

function drivetrain(value) {
  const text = useful(value).toLowerCase();
  if (!text) return "";
  if (/all.?wheel|\bawd\b/.test(text)) return "AWD";
  if (/four.?wheel|4x4|\b4wd\b/.test(text)) return "4WD";
  if (/rear.?wheel|\brwd\b/.test(text)) return "RWD";
  if (/front.?wheel|\bfwd\b/.test(text)) return "FWD";
  return "";
}

function transmission(value) {
  const text = useful(value).toLowerCase();
  if (!text) return "";
  if (text.includes("continuously variable") || text.includes("cvt")) return "CVT";
  if (text.includes("single") && text.includes("speed")) return "Single-speed EV";
  if (text.includes("manual") || text.includes("standard")) return "Manual";
  if (text.includes("automatic") || text.includes("auto")) return "Automatic";
  return "Other";
}

function fuelType(value, secondaryValue) {
  const text = `${useful(value)} ${useful(secondaryValue)}`.toLowerCase();
  if (!text.trim()) return "";
  if (/plug.?in|phev/.test(text)) return "Plug-in hybrid";
  if (text.includes("hybrid")) return "Hybrid";
  if (/electric|bev/.test(text)) return "Electric";
  if (text.includes("diesel")) return "Diesel";
  if (/gasoline|petrol/.test(text)) return "Gasoline";
  return "Other";
}

function engineDescription(result) {
  const parts = [];
  const displacement = useful(result.DisplacementL);
  const cylinders = useful(result.EngineCylinders);
  const configuration = useful(result.EngineConfiguration);
  const model = useful(result.EngineModel);
  if (displacement) parts.push(`${Number(displacement).toFixed(Number(displacement) % 1 ? 1 : 0)}L`);
  if (configuration) parts.push(vehicleCase(configuration));
  if (cylinders) parts.push(`${cylinders}-cylinder`);
  if (model && !parts.some((part) => part.toLowerCase() === model.toLowerCase())) parts.push(model);
  return parts.join(" ");
}

export function vehicleDetailsFromVpic(result = {}) {
  const series = useful(result.Trim) || useful(result.Series) || useful(result.Series2);
  return {
    year: useful(result.ModelYear),
    make: vehicleCase(result.Make),
    model: vehicleCase(result.Model),
    trim: vehicleCase(series),
    bodyStyle: bodyStyle(result.BodyClass),
    drivetrain: drivetrain(result.DriveType),
    transmission: transmission(result.TransmissionStyle || result.TransmissionSpeeds),
    fuelType: fuelType(result.FuelTypePrimary, result.FuelTypeSecondary),
    engine: engineDescription(result),
    horsepower: useful(result.EngineHP),
  };
}

export function mergeDecodedVehicleDetails(current = {}, decoded = {}) {
  const merged = { ...current };
  const filled = [];
  for (const field of decodedVehicleFields) {
    if (!String(current[field] ?? "").trim() && String(decoded[field] ?? "").trim()) {
      merged[field] = decoded[field];
      filled.push(field);
    }
  }
  return { vehicle: merged, filled };
}

export { decodedVehicleFields };
