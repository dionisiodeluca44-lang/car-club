import { isValidVin, normalizeVin, vehicleDetailsFromVpic } from "../../shared/vinDecoder.js";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "private, max-age=86400",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Enter a valid VIN." });
  }
  const vin = normalizeVin(payload.vin);
  if (!isValidVin(vin)) return json(400, { error: "Enter a valid 17-character VIN." });

  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`);
    if (!response.ok) throw new Error(`Vehicle decoder returned ${response.status}.`);
    const data = await response.json();
    const result = data?.Results?.[0] || null;
    if (!result) return json(404, { error: "No vehicle information was found for that VIN." });
    const vehicle = vehicleDetailsFromVpic(result);
    const decodedCount = Object.values(vehicle).filter(Boolean).length;
    if (!decodedCount) return json(404, { error: "That VIN was valid, but no vehicle details were available." });
    return json(200, {
      vehicle,
      source: "NHTSA vPIC",
      warning: String(result.ErrorText || "").trim(),
    });
  } catch (error) {
    console.error("VIN decoding failed", error);
    return json(502, { error: "Vehicle details could not be loaded right now. You can still enter them manually." });
  }
}
