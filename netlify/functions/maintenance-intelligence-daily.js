import { createClient } from "@supabase/supabase-js";
import { runMaintenanceRecalculation } from "../lib/maintenanceIntelligence.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const config = { schedule: "@daily" };

export async function handler() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Daily maintenance intelligence job is not configured.");
    return { statusCode: 503 };
  }
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stats = await runMaintenanceRecalculation(supabase, {
      includeAll: true,
      jobName: "daily-maintenance-recalculation",
      idempotencyKey: `daily-maintenance-recalculation:${today}`,
    });
    console.log("Daily maintenance intelligence job completed", stats);
    return { statusCode: 200 };
  } catch (error) {
    console.error("Daily maintenance intelligence job failed", error);
    return { statusCode: 500 };
  }
}
