import { createClient } from "@supabase/supabase-js";
import {
  benefitAllowancesForPlan,
  membershipBenefitPeriod,
  summarizeMembershipBenefits,
} from "../../shared/membershipBenefits.js";

const adminPassword = process.env.ADMIN_PORTAL_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function authorized(event) {
  const headerToken = event.headers["x-admin-token"];
  return adminPassword && headerToken && headerToken === adminPassword;
}

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function benefitPeriodForProfile(profile) {
  return membershipBenefitPeriod(
    profile?.subscription_activated_at || profile?.stripe_subscription_created_at || profile?.created_at,
  );
}

async function updateMembershipBenefit({ action, benefitKey, requestId }) {
  const { data: request, error: requestError } = await supabase
    .from("service_requests")
    .select("id, user_id, service_type")
    .eq("id", requestId)
    .single();

  if (requestError || !request?.user_id) {
    return { statusCode: 404, body: { error: "Could not find the member service request." } };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, plan, subscription_activated_at, stripe_subscription_created_at, created_at")
    .eq("id", request.user_id)
    .single();

  if (profileError || !profile) {
    return { statusCode: 404, body: { error: "Could not find the member profile." } };
  }

  const allowance = benefitAllowancesForPlan(profile.plan).find((item) => item.key === benefitKey);
  if (!allowance) {
    return { statusCode: 400, body: { error: `${profile.plan} does not include that benefit.` } };
  }

  const period = benefitPeriodForProfile(profile);
  const periodStart = dateOnly(period.start);
  const periodEnd = dateOnly(period.end);

  const { data: existing, error: existingError } = await supabase
    .from("membership_benefit_usage")
    .select("*")
    .eq("service_request_id", requestId)
    .eq("benefit_key", benefitKey)
    .maybeSingle();

  if (existingError) {
    return { statusCode: 500, body: { error: "Could not load the benefit ledger. Run the membership benefits migration." } };
  }

  if (action === "restore-benefit") {
    if (!existing) {
      return { statusCode: 404, body: { error: "That request has no matching benefit redemption." } };
    }

    const { data, error } = await supabase
      .from("membership_benefit_usage")
      .update({ status: "reversed", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) return { statusCode: 500, body: { error: "Could not restore the member benefit." } };
    return { statusCode: 200, body: { usage: data } };
  }

  if (existing?.status === "redeemed") {
    return { statusCode: 200, body: { usage: existing } };
  }

  const { count, error: countError } = await supabase
    .from("membership_benefit_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", request.user_id)
    .eq("benefit_key", benefitKey)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("status", "redeemed");

  if (countError) {
    return { statusCode: 500, body: { error: "Could not verify the member's remaining benefits." } };
  }

  if ((count || 0) >= allowance.annualQuantity) {
    return { statusCode: 409, body: { error: `No ${allowance.label.toLowerCase()} benefits remain this membership year.` } };
  }

  const benefitRecord = {
    benefit_key: allowance.key,
    credit_cents: allowance.creditCents,
    description: `${allowance.label} applied to ${request.service_type}`,
    period_end: periodEnd,
    period_start: periodStart,
    service_request_id: requestId,
    status: "redeemed",
    updated_at: new Date().toISOString(),
    used_at: new Date().toISOString(),
    user_id: request.user_id,
  };

  const query = existing
    ? supabase.from("membership_benefit_usage").update(benefitRecord).eq("id", existing.id)
    : supabase.from("membership_benefit_usage").insert(benefitRecord);
  const { data, error } = await query.select("*").single();

  if (error) return { statusCode: 500, body: { error: "Could not record the member benefit." } };
  return { statusCode: 200, body: { usage: data } };
}

export async function handler(event) {
  if (!authorized(event)) {
    return json(401, { error: "Unauthorized" });
  }

  if (!supabase) {
    return json(503, { error: "Admin backend is not configured" });
  }

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("service_requests")
      .select("id, user_id, vehicle_label, service_type, preferred_date, preferred_time, notes, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Could not load service requests", error);
      return json(500, { error: "Could not load service requests" });
    }

    const userIds = [...new Set((data || []).map((request) => request.user_id).filter(Boolean))];
    const profileMap = new Map();

    if (userIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, plan, subscription_activated_at, stripe_subscription_created_at, created_at")
        .in("id", userIds);

      if (profileError) {
        console.warn("Could not attach member profiles to service requests", profileError);
      }

      for (const profile of profiles || []) {
        profileMap.set(profile.id, profile);
      }
    }

    let benefitUsage = [];
    if (userIds.length) {
      const { data: usageRows, error: usageError } = await supabase
        .from("membership_benefit_usage")
        .select("id, user_id, service_request_id, benefit_key, credit_cents, description, period_start, period_end, status, used_at")
        .in("user_id", userIds);

      if (usageError) {
        console.warn("Could not attach membership benefits. Run the membership benefits migration.", usageError);
      } else {
        benefitUsage = usageRows || [];
      }
    }

    return json(200, {
      requests: (data || []).map((request) => {
        const profile = profileMap.get(request.user_id) || null;
        const period = benefitPeriodForProfile(profile);
        const periodStart = dateOnly(period.start);
        const periodEnd = dateOnly(period.end);
        const currentUsage = benefitUsage.filter((usage) => (
          usage.user_id === request.user_id
          && usage.period_start === periodStart
          && usage.period_end === periodEnd
        ));

        return {
          ...request,
          benefit_usage: benefitUsage.filter((usage) => usage.service_request_id === request.id),
          member: profile,
          member_benefits: summarizeMembershipBenefits(profile?.plan, currentUsage),
        };
      }),
    });
  }

  if (event.httpMethod === "PATCH") {
    const payload = JSON.parse(event.body || "{}");
    const { action, benefitKey, id, status, paymentAmount, paymentMode, paymentNote, paymentTitle } = payload;

    if (action === "redeem-benefit" || action === "restore-benefit") {
      if (!id || !benefitKey) return json(400, { error: "Request id and benefit are required." });
      const result = await updateMembershipBenefit({ action, benefitKey, requestId: id });
      return json(result.statusCode, result.body);
    }

    if (!id || (!status && !paymentAmount && !paymentMode && !paymentTitle && !paymentNote)) {
      return json(400, { error: "Request id and update details are required" });
    }

    const update = { updated_at: new Date().toISOString() };

    if (status) {
      update.status = status;
    }

    if (paymentAmount || paymentMode || paymentTitle || paymentNote) {
      const { data: existingRequest, error: loadError } = await supabase
        .from("service_requests")
        .select("notes")
        .eq("id", id)
        .single();

      if (loadError) {
        console.error("Could not load service request before payment update", loadError);
        return json(500, { error: "Could not load service request before updating payment" });
      }

      const paymentBlock = [
        "Admin payment update",
        `Updated: ${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}`,
        paymentTitle && `Payment type: ${paymentTitle}`,
        paymentMode && `Payment mode: ${paymentMode}`,
        paymentAmount && `Amount: ${paymentAmount}`,
        paymentNote && `Note: ${paymentNote}`,
      ].filter(Boolean).join("\n");

      update.notes = [existingRequest?.notes, paymentBlock].filter(Boolean).join("\n\n---\n\n");
    }

    const { data, error } = await supabase
      .from("service_requests")
      .update(update)
      .eq("id", id)
      .select("id, notes, status")
      .single();

    if (error) {
      console.error("Could not update service request", error);
      return json(500, { error: "Could not update service request" });
    }

    return json(200, { request: data });
  }

  return json(405, { error: "Method not allowed" });
}
