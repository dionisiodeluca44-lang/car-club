import {
  buildEstimatedMaintenanceDraft,
  buildOutreachDraft,
  communicationEligibility,
  estimatedMaintenancePlan,
  hasMatchingActiveAppointment,
  normalizeOutreachChannel,
  normalizePreferredLanguage,
  opportunityPriority,
  outreachFrequencyAllowed,
  outreachTypeForForecast,
  resolveServicePrice,
  vehiclePlanningGaps,
} from "../../shared/outreachIntelligence.js";

function weekBucket(value = new Date()) {
  const date = new Date(value);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - first) / 86400000) + first.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function resultData(query, fallback = []) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? fallback;
}

export async function getOutreachIntelligence(supabase) {
  const [settings, preferences, opportunities, messages, events, jobs] = await Promise.all([
    resultData(supabase.from("outreach_settings").select("*").eq("setting_key", "default").eq("active", true).maybeSingle(), null),
    resultData(supabase.from("communication_preferences").select("*").order("updated_at", { ascending: false })),
    resultData(supabase.from("service_opportunities").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500)),
    resultData(supabase.from("outreach_messages").select("*").order("created_at", { ascending: false }).limit(500)),
    resultData(supabase.from("outreach_events").select("*").order("created_at", { ascending: false }).limit(1000)),
    resultData(supabase.from("outreach_job_runs").select("*").order("started_at", { ascending: false }).limit(20)),
  ]);
  return { available: true, settings, preferences, opportunities, messages, events, jobRuns: jobs };
}

async function providerDraft(input, fallback) {
  const endpoint = process.env.OUTREACH_DRAFT_PROVIDER_URL;
  if (!endpoint) return { ...fallback, generatedByAi: false, draftMethod: "verified_template", provider: null };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OUTREACH_DRAFT_PROVIDER_SECRET ? { Authorization: `Bearer ${process.env.OUTREACH_DRAFT_PROVIDER_SECRET}` } : {}),
    },
    body: JSON.stringify({
      customerFirstName: String(input.customerName || "").trim().split(/\s+/)[0],
      vehicle: [input.vehicle?.year, input.vehicle?.make, input.vehicle?.model].filter(Boolean).join(" "),
      serviceName: input.serviceName,
      forecastStatus: input.forecast?.status,
      verifiedReason: input.forecast?.reason?.summary || "",
      dueDate: input.forecast?.next_due_date || null,
      language: normalizePreferredLanguage(input.language),
      bookingUrl: input.bookingUrl || "",
      rules: [
        "Short, friendly, and professional.",
        "Do not exaggerate urgency or make a diagnosis.",
        "Do not promise a price.",
        "Use only the supplied facts.",
      ],
    }),
  });
  if (!response.ok) throw new Error(`Outreach draft provider returned ${response.status}.`);
  const data = await response.json();
  const subject = String(data.subject || "").trim().slice(0, 240);
  const body = String(data.body || data.message || "").trim().slice(0, 4000);
  if (!body) throw new Error("Outreach draft provider returned an empty message.");
  return { subject: subject || fallback.subject, body, generatedByAi: true, draftMethod: "ai_provider", provider: data.provider || "configured_provider" };
}

async function startJob(supabase, jobName, idempotencyKey) {
  const { data: existing, error: loadError } = await supabase.from("outreach_job_runs").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (loadError) throw loadError;
  if (existing?.status === "completed") return { skipped: true, run: existing };
  if (existing) {
    const { data, error } = await supabase.from("outreach_job_runs").update({
      status: "running",
      attempt_count: Number(existing.attempt_count || 1) + 1,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
    }).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return { skipped: false, run: data };
  }
  const { data, error } = await supabase.from("outreach_job_runs").insert({ job_name: jobName, idempotency_key: idempotencyKey }).select("*").single();
  if (error) throw error;
  return { skipped: false, run: data };
}

async function audit(supabase, action, entityType, entityId, nextValue, previousValue = null) {
  const { error } = await supabase.from("crm_audit_logs").insert({
    actor_type: "system",
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_value: previousValue,
    new_value: nextValue,
  });
  if (error) console.error("Could not write Phase 3 audit log", error);
}

async function createApprovalTask(supabase, message, opportunity) {
  const idempotencyKey = `outreach-approval:${message.id}:r${message.revision}`;
  const { data, error } = await supabase.from("crm_tasks").upsert({
    customer_id: message.customer_id,
    vehicle_id: message.vehicle_id,
    related_forecast_id: message.forecast_id,
    task_type: "outreach_approval",
    title: `Review ${String(message.outreach_type).replaceAll("_", " ")} draft`,
    detail: `Review consent, verified facts, and wording before approving this ${message.channel} message.`,
    priority: opportunity.priority,
    due_at: new Date().toISOString(),
    status: "open",
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw error;
  if (data) {
    const { error: linkError } = await supabase.from("outreach_messages").update({ task_id: data.id }).eq("id", message.id);
    if (linkError) throw linkError;
  }
}

export async function runOutreachIntelligence(supabase, options = {}) {
  const asOf = options.asOf || new Date();
  const jobName = options.jobName || "manual-outreach-intelligence";
  const idempotencyKey = options.idempotencyKey || `${jobName}:${new Date(asOf).toISOString()}`;
  const started = await startJob(supabase, jobName, idempotencyKey);
  if (started.skipped) return { ...started.run.stats, skipped: true };
  const stats = { vehicles: 0, opportunities: 0, drafts: 0, bestEffortOpportunities: 0, bestEffortDrafts: 0, suppressed: 0, appointmentsExcluded: 0, errors: 0 };
  try {
    const settings = await resultData(supabase.from("outreach_settings").select("*").eq("setting_key", "default").eq("active", true).single(), null);
    let vehicleQuery = supabase.from("vehicles").select("*").is("archived_at", null);
    if (options.vehicleIds?.length) vehicleQuery = vehicleQuery.in("id", options.vehicleIds);
    else if (!options.includeAll) vehicleQuery = vehicleQuery.eq("outreach_recalculation_required", true);
    const vehicles = await resultData(vehicleQuery);
    const vehicleIds = vehicles.map((item) => item.id);
    const customerIds = [...new Set(vehicles.map((item) => item.user_id))];
    if (!vehicleIds.length) {
      await supabase.from("outreach_job_runs").update({ status: "completed", completed_at: new Date().toISOString(), stats }).eq("id", started.run.id);
      return stats;
    }
    const [profiles, forecasts, rules, appointments, pricing, preferences, messages, serviceHistory] = await Promise.all([
      resultData(supabase.from("profiles").select("id, full_name, email, phone").in("id", customerIds)),
      resultData(supabase.from("vehicle_maintenance_forecasts").select("*").in("vehicle_id", vehicleIds).is("archived_at", null)),
      resultData(supabase.from("vehicle_maintenance_rules").select("*").eq("approval_status", "approved").eq("active", true).is("archived_at", null)),
      resultData(supabase.from("service_requests").select("*").in("vehicle_id", vehicleIds).neq("status", "Archived")),
      resultData(supabase.from("service_pricing").select("service_label, payment_mode, amount_cents")),
      resultData(supabase.from("communication_preferences").select("*").in("customer_id", customerIds)),
      resultData(supabase.from("outreach_messages").select("*").in("customer_id", customerIds)),
      resultData(supabase.from("vehicle_service_history").select("*").in("vehicle_id", vehicleIds).order("service_date", { ascending: false })),
    ]);
    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const ruleById = new Map(rules.map((item) => [item.id, item]));
    const preferenceByCustomer = new Map(preferences.map((item) => [item.customer_id, item]));
    const actionable = new Set(["Approaching", "Due", "Overdue", "Inspection Required"]);
    const confidenceRank = { Low: 1, Medium: 2, High: 3 };
    const minimumConfidence = confidenceRank[settings.opportunity_min_confidence] || 2;

    for (const vehicle of vehicles) {
      stats.vehicles += 1;
      try {
        const vehicleAppointments = appointments.filter((item) => item.vehicle_id === vehicle.id);
        const vehicleForecasts = forecasts.filter((item) => item.vehicle_id === vehicle.id);
        let vehicleHasActionableForecast = false;
        for (const forecast of vehicleForecasts) {
          const rule = ruleById.get(forecast.rule_id);
          if (!rule || rule.safety_related || !actionable.has(forecast.status) || (confidenceRank[forecast.confidence] || 1) < minimumConfidence) continue;
          vehicleHasActionableForecast = true;
          if (hasMatchingActiveAppointment(rule.service_type, rule.service_aliases, vehicleAppointments)) {
            stats.appointmentsExcluded += 1;
            await supabase.from("service_opportunities").update({ status: "won", booking_status: "booked", updated_at: new Date().toISOString() }).eq("forecast_id", forecast.id).in("status", ["open", "qualified", "contacted"]);
            continue;
          }
          const price = resolveServicePrice(rule.service_type, rule.service_aliases, pricing);
          const opportunityKey = `forecast-opportunity:${forecast.id}:v${forecast.rule_version}`;
          const opportunityRecord = {
            customer_id: vehicle.user_id,
            vehicle_id: vehicle.id,
            forecast_id: forecast.id,
            service_type: rule.service_type,
            service_category: rule.service_category,
            reason: forecast.reason?.summary || rule.customer_explanation,
            evidence_source: { ruleId: rule.id, ruleVersion: rule.version, sourceType: rule.source_type, sourceReference: rule.source_reference },
            priority: opportunityPriority(forecast),
            estimated_due_date: forecast.next_due_date,
            estimated_revenue_cents: price.estimatedRevenueCents,
            quote_required: price.quoteRequired,
            pricing_source: price.pricingSource,
            confidence: forecast.confidence,
            idempotency_key: opportunityKey,
            updated_at: new Date().toISOString(),
          };
          const { data: opportunity, error: opportunityError } = await supabase.from("service_opportunities").upsert(opportunityRecord, { onConflict: "idempotency_key" }).select("*").single();
          if (opportunityError) throw opportunityError;
          stats.opportunities += 1;
          if (!settings.draft_generation_enabled) continue;
          const preferencesForCustomer = preferenceByCustomer.get(vehicle.user_id);
          const channel = normalizeOutreachChannel(settings.default_channel);
          const eligibility = communicationEligibility(preferencesForCustomer, { channel, purpose: "transactional" });
          const customerMessages = messages.filter((item) => item.customer_id === vehicle.user_id);
          const frequency = outreachFrequencyAllowed(customerMessages, settings, asOf);
          if (!eligibility.eligible || !frequency.allowed) {
            stats.suppressed += 1;
            await supabase.from("service_opportunities").update({ contact_status: "suppressed" }).eq("id", opportunity.id);
            continue;
          }
          const draftKey = `outreach:${forecast.id}:${channel}:${weekBucket(asOf)}`;
          const { data: existingDraft, error: draftLoadError } = await supabase.from("outreach_messages").select("id").eq("idempotency_key", draftKey).maybeSingle();
          if (draftLoadError) throw draftLoadError;
          if (existingDraft) continue;
          const profile = profileById.get(vehicle.user_id) || {};
          const draftInput = {
            customerName: profile.full_name,
            vehicle,
            serviceName: rule.service_type,
            forecast,
            language: preferencesForCustomer.preferred_language,
            bookingUrl: settings.booking_url,
          };
          const fallback = buildOutreachDraft(draftInput);
          let draft;
          try {
            draft = await providerDraft(draftInput, fallback);
          } catch (error) {
            console.error("Configured outreach draft provider failed; using verified template", error);
            draft = { ...fallback, generatedByAi: false, draftMethod: "verified_template", provider: null };
          }
          const { data: message, error: messageError } = await supabase.from("outreach_messages").insert({
            customer_id: vehicle.user_id,
            vehicle_id: vehicle.id,
            opportunity_id: opportunity.id,
            forecast_id: forecast.id,
            outreach_type: outreachTypeForForecast(forecast),
            purpose: "transactional",
            channel,
            language: preferencesForCustomer.preferred_language,
            trigger_reason: opportunity.reason,
            subject: draft.subject,
            message_body: draft.body,
            generated_by_ai: draft.generatedByAi,
            draft_method: draft.draftMethod,
            generation_metadata: { provider: draft.provider, verifiedSource: opportunity.evidence_source, consentReason: eligibility.reason },
            approval_status: "pending_approval",
            idempotency_key: draftKey,
          }).select("*").single();
          if (messageError) throw messageError;
          await createApprovalTask(supabase, message, opportunity);
          await supabase.from("service_opportunities").update({ contact_status: "drafted" }).eq("id", opportunity.id);
          await supabase.from("outreach_events").insert({ outreach_message_id: message.id, actor_type: "system", event_type: "draft_created", detail: { method: draft.draftMethod } });
          await audit(supabase, "create_outreach_draft", "outreach_message", message.id, { approvalStatus: "pending_approval", method: draft.draftMethod });
          stats.drafts += 1;
        }
        if (vehicleHasActionableForecast) {
          await supabase.from("service_opportunities")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("idempotency_key", `best-effort-review:${vehicle.id}:v1`)
            .in("status", ["open", "qualified", "contacted"]);
          await supabase.from("service_opportunities")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .like("idempotency_key", `estimated-maintenance:${vehicle.id}:%`)
            .in("status", ["open", "qualified", "contacted"]);
        } else {
          const profile = profileById.get(vehicle.user_id) || {};
          const gaps = vehiclePlanningGaps(vehicle);
          const estimates = estimatedMaintenancePlan(vehicle, serviceHistory.filter((item) => item.vehicle_id === vehicle.id), asOf);
          const estimateOpportunities = [];
          await supabase.from("service_opportunities")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("idempotency_key", `best-effort-review:${vehicle.id}:v1`)
            .in("status", ["open", "qualified", "contacted"]);
          for (const estimate of estimates) {
            const opportunityKey = `estimated-maintenance:${vehicle.id}:${estimate.key}:v1`;
            const opportunityRecord = {
              customer_id: vehicle.user_id,
              vehicle_id: vehicle.id,
              forecast_id: null,
              service_type: estimate.title,
              service_category: estimate.category,
              reason: estimate.reason,
              evidence_source: {
                sourceType: "estimated_maintenance_plan",
                estimatedPlan: true,
                verifiedSchedule: false,
                method: "vehicle_age_mileage_and_available_history",
                assumptions: estimate.assumptions,
                missingInformation: gaps,
              },
              priority: estimate.key === "odometer-check-in" ? "high" : "normal",
              estimated_due_date: estimate.dueDate,
              estimated_revenue_cents: null,
              quote_required: true,
              pricing_source: null,
              confidence: "Low",
              idempotency_key: opportunityKey,
              updated_at: new Date().toISOString(),
            };
            let { data: opportunity, error: opportunityError } = await supabase.from("service_opportunities").upsert(opportunityRecord, { onConflict: "idempotency_key" }).select("*").single();
            if (opportunityError) throw opportunityError;
            if (opportunity.status === "expired") {
              const { data: reopened, error: reopenError } = await supabase.from("service_opportunities").update({ status: "open", contact_status: "not_contacted", updated_at: new Date().toISOString() }).eq("id", opportunity.id).select("*").single();
              if (reopenError) throw reopenError;
              opportunity = reopened;
            }
            estimateOpportunities.push(opportunity);
            stats.opportunities += 1;
            stats.bestEffortOpportunities += 1;
          }

          if (settings.draft_generation_enabled && estimateOpportunities.length) {
            const preferencesForCustomer = preferenceByCustomer.get(vehicle.user_id);
            const channel = normalizeOutreachChannel(settings.default_channel);
            const eligibility = communicationEligibility(preferencesForCustomer, { channel, purpose: "transactional" });
            const customerMessages = messages.filter((item) => item.customer_id === vehicle.user_id);
            const frequency = outreachFrequencyAllowed(customerMessages, settings, asOf);
            const sendable = eligibility.eligible && frequency.allowed;
            const draftKey = `estimated-maintenance-outreach:${vehicle.id}:${channel}:${weekBucket(asOf)}`;
            const { data: existingDraft, error: draftLoadError } = await supabase.from("outreach_messages").select("*").eq("idempotency_key", draftKey).maybeSingle();
            if (draftLoadError) throw draftLoadError;
            if (existingDraft) {
              if (sendable && ["draft", "rejected"].includes(existingDraft.approval_status)) {
                const { data: refreshedDraft, error: refreshError } = await supabase.from("outreach_messages").update({
                  approval_status: "pending_approval",
                  rejected_reason: null,
                  updated_at: new Date().toISOString(),
                }).eq("id", existingDraft.id).select("*").single();
                if (refreshError) throw refreshError;
                await createApprovalTask(supabase, refreshedDraft, estimateOpportunities[0]);
              }
              await supabase.from("service_opportunities").update({ contact_status: sendable ? "drafted" : "suppressed", updated_at: new Date().toISOString() }).in("id", estimateOpportunities.map((item) => item.id));
              if (!sendable) stats.suppressed += 1;
            } else {
              const draft = buildEstimatedMaintenanceDraft({
                customerName: profile.full_name,
                vehicle,
                items: estimates,
                gaps,
                language: preferencesForCustomer?.preferred_language,
                bookingUrl: settings.booking_url,
              });
              const { data: message, error: messageError } = await supabase.from("outreach_messages").insert({
                customer_id: vehicle.user_id,
                vehicle_id: vehicle.id,
                opportunity_id: estimateOpportunities[0].id,
                forecast_id: null,
                outreach_type: "estimated_maintenance_plan_review",
                purpose: "transactional",
                channel,
                language: normalizePreferredLanguage(preferencesForCustomer?.preferred_language),
                trigger_reason: `Estimated maintenance review for ${estimates.map((item) => item.title).join(", ")}.`,
                subject: draft.subject,
                message_body: draft.body,
                generated_by_ai: false,
                draft_method: "verified_template",
                generation_metadata: { bestEffort: true, estimatedPlan: true, verifiedSchedule: false, estimatedItems: estimates.map((item) => ({ key: item.key, title: item.title, dueDate: item.dueDate })), missingInformation: gaps, consentReason: eligibility.reason, sendable },
                approval_status: sendable ? "pending_approval" : "draft",
                idempotency_key: draftKey,
              }).select("*").single();
              if (messageError) throw messageError;
              if (sendable) await createApprovalTask(supabase, message, estimateOpportunities[0]);
              else stats.suppressed += 1;
              await supabase.from("service_opportunities").update({ contact_status: sendable ? "drafted" : "suppressed", updated_at: new Date().toISOString() }).in("id", estimateOpportunities.map((item) => item.id));
              await supabase.from("outreach_events").insert({ outreach_message_id: message.id, actor_type: "system", event_type: "estimated_maintenance_draft_created", detail: { estimatedItems: estimates.map((item) => item.key), missingInformation: gaps, sendable } });
              await audit(supabase, "create_estimated_maintenance_draft", "outreach_message", message.id, { approvalStatus: message.approval_status, estimatedItems: estimates.map((item) => item.key), missingInformation: gaps, sendable });
              stats.drafts += 1;
              stats.bestEffortDrafts += 1;
            }
          }
        }
        await supabase.from("vehicles").update({ outreach_recalculation_required: false }).eq("id", vehicle.id);
      } catch (error) {
        stats.errors += 1;
        console.error("Vehicle outreach intelligence failed", vehicle.id, error);
      }
    }
    await supabase.from("outreach_job_runs").update({
      status: stats.errors ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      stats,
      error_message: stats.errors ? `${stats.errors} vehicle outreach calculation(s) failed.` : null,
    }).eq("id", started.run.id);
    return stats;
  } catch (error) {
    await supabase.from("outreach_job_runs").update({ status: "failed", completed_at: new Date().toISOString(), stats, error_message: String(error.message || error).slice(0, 2000) }).eq("id", started.run.id);
    throw error;
  }
}
