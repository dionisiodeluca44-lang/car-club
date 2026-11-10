import { handler as adminVehicleIntelligenceHandler } from "./admin-vehicle-intelligence.js";

export async function handler() {
  if (!process.env.ADMIN_PORTAL_PASSWORD) {
    return { statusCode: 503, body: JSON.stringify({ error: "Admin automation is not configured." }) };
  }
  return adminVehicleIntelligenceHandler({
    httpMethod: "POST",
    headers: { "x-admin-token": process.env.ADMIN_PORTAL_PASSWORD },
    body: JSON.stringify({ action: "auto-draft-maintenance-rules" }),
  });
}
