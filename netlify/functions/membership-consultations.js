import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
const callMethods = new Set(["Google Meet", "FaceTime", "Phone call", "WhatsApp"]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function clean(value, maxLength = 480) {
  return String(value || "").trim().slice(0, maxLength);
}

async function verifySignupMember(payload) {
  const userId = clean(payload.userId);
  const memberEmail = clean(payload.memberEmail).toLowerCase();
  if (!userId || !memberEmail) throw Object.assign(new Error("Create your account before booking a consultation."), { statusCode: 400 });

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw Object.assign(new Error("We could not verify the new member account."), { statusCode: 404 });
  if (String(data.user.email || "").toLowerCase() !== memberEmail) {
    throw Object.assign(new Error("This consultation does not match the new member account."), { statusCode: 403 });
  }
  return data.user;
}

async function verifyMember(event, payload) {
  const authorization = event.headers.authorization || event.headers.Authorization || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    if (payload.signupActivation) return verifySignupMember(payload);
    throw Object.assign(new Error("Sign in before booking your consultation."), { statusCode: 401 });
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw Object.assign(new Error("Your sign-in expired. Sign in again."), { statusCode: 401 });
  if (payload.userId && data.user.id !== payload.userId) {
    throw Object.assign(new Error("This consultation does not match the signed-in member."), { statusCode: 403 });
  }
  return data.user;
}

function validateDateAndTime(date, time, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
    || hour > 23
    || minute > 59
  ) return false;

  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const localNow = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    return `${date}T${time}` > localNow;
  } catch {
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (!supabase) return json(503, { error: "Consultation booking is not configured." });

  if (event.httpMethod === "GET") {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("membership_consultations")
      .select("consultation_date, consultation_time")
      .gte("consultation_date", today)
      .in("status", ["scheduled", "confirmed"]);
    if (error) {
      const message = error.code === "42P01" || error.code === "PGRST205"
        ? "Run the membership consultation SQL migration in Supabase first."
        : "Could not load consultation availability.";
      return json(503, { error: message });
    }
    return json(200, { busySlots: (data || []).map((slot) => `${slot.consultation_date}|${String(slot.consultation_time).slice(0, 5)}`) });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const payload = JSON.parse(event.body || "{}");
    const user = await verifyMember(event, payload);
    const date = clean(payload.date, 10);
    const time = clean(payload.time, 5);
    const timezone = clean(payload.timezone || "America/Toronto", 80);
    const callMethod = clean(payload.callMethod, 40);
    if (!validateDateAndTime(date, time, timezone)) return json(400, { error: "Choose a future consultation date and time." });
    if (!callMethods.has(callMethod)) return json(400, { error: "Choose how you would like us to call you." });

    const { data: occupied, error: availabilityError } = await supabase
      .from("membership_consultations")
      .select("id")
      .eq("consultation_date", date)
      .eq("consultation_time", time)
      .in("status", ["scheduled", "confirmed"])
      .limit(1);

    if (availabilityError) {
      if (availabilityError.code === "42P01" || availabilityError.code === "PGRST205") {
        return json(503, { error: "Run the membership consultation SQL migration in Supabase first." });
      }
      throw availabilityError;
    }
    if (occupied?.length) return json(409, { error: "That time was just reserved. Please choose another time." });

    const { data, error } = await supabase
      .from("membership_consultations")
      .insert({
        user_id: user.id,
        email: clean(user.email || payload.memberEmail, 320),
        full_name: clean(payload.memberName || user.user_metadata?.full_name || user.email, 160),
        phone: clean(payload.memberPhone || user.user_metadata?.phone, 80) || null,
        plan: clean(payload.plan || user.user_metadata?.plan || "Club Drive", 80),
        consultation_date: date,
        consultation_time: time,
        timezone,
        call_method: callMethod,
        call_details: clean(payload.callDetails, 320) || null,
        notes: clean(payload.notes, 1200) || null,
      })
      .select("id, consultation_date, consultation_time, timezone, call_method, status")
      .single();

    if (error?.code === "23505") return json(409, { error: "That time was just reserved. Please choose another time." });
    if (error) throw error;
    return json(201, { consultation: data });
  } catch (error) {
    console.error("Could not book membership consultation", error);
    return json(error.statusCode || 500, { error: error.message || "Could not book the consultation." });
  }
}
