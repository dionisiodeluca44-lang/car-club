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
const activeMembershipStatuses = new Set(["active", "trialing"]);

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
    profile?.stripe_subscription_created_at || profile?.subscription_activated_at || profile?.created_at,
  );
}

function effectiveProfilePlan(profile) {
  return profile?.collector_access_override ? "Collector" : profile?.plan;
}

function currencyCents(value) {
  const match = String(value || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Math.round(Number(match[1]) * 100) : 0;
}

function legacyPaymentDetails(request) {
  const notes = String(request?.notes || "");
  const paymentLine = notes.match(/^Payment:\s*(.+)$/im)?.[1] || "";
  const paidCents = currencyCents(paymentLine || notes.match(/^Amount:\s*(.+)$/im)?.[1]);
  const paymentMode = /deposit/i.test(paymentLine) ? "deposit" : /full/i.test(paymentLine) ? "full" : "custom";
  return { paidCents, paymentMode };
}

function paymentSummary(request, payments = []) {
  const legacy = legacyPaymentDetails(request);
  const ledgerPaidCents = payments.reduce((total, payment) => {
    const amount = Math.max(0, Number(payment.amount_cents) || 0);
    return total + (payment.payment_type === "refund" ? -amount : amount);
  }, 0);
  const paidCents = Math.max(0, ledgerPaidCents || legacy.paidCents);
  const quotedTotalCents = Math.max(0, Number(request.quoted_total_cents) || 0);
  const totalKnown = quotedTotalCents > 0;
  const dueCents = totalKnown ? Math.max(quotedTotalCents - paidCents, 0) : null;
  let status = String(request.payment_status || "").toLowerCase();

  if (!status || status === "unpaid") {
    if (totalKnown && paidCents >= quotedTotalCents) status = "paid";
    else if (paidCents > 0 && (request.payment_mode === "deposit" || legacy.paymentMode === "deposit")) status = "deposit_paid";
    else if (paidCents > 0) status = "partially_paid";
    else status = "unpaid";
  }

  return {
    due_cents: dueCents,
    mode: request.payment_mode || legacy.paymentMode,
    paid_cents: paidCents,
    status,
    total_cents: quotedTotalCents,
    total_known: totalKnown,
  };
}

function serviceDocumentExtension(fileName, fileType) {
  const supplied = String(fileName || "").split(".").pop()?.toLowerCase();
  if (/^[a-z0-9]{1,8}$/.test(supplied || "")) return supplied;
  const commonTypes = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "text/csv": "csv",
    "text/plain": "txt",
  };
  return commonTypes[fileType] || "bin";
}

function validServiceDocument(file) {
  const extension = serviceDocumentExtension(file?.name, file?.type);
  const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"]);
  const size = Number(file?.size) || 0;
  return file?.name && allowedExtensions.has(extension) && size > 0 && size <= 25 * 1024 * 1024;
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
    .select("id, plan, collector_access_override, subscription_status, subscription_activated_at, stripe_subscription_created_at, created_at")
    .eq("id", request.user_id)
    .single();

  if (profileError || !profile) {
    return { statusCode: 404, body: { error: "Could not find the member profile." } };
  }

  const effectivePlan = effectiveProfilePlan(profile);
  if (action !== "restore-benefit" && !activeMembershipStatuses.has(String(profile.subscription_status || "").toLowerCase())) {
    return { statusCode: 409, body: { error: "Benefits can only be applied while the membership is active." } };
  }
  const allowance = benefitAllowancesForPlan(effectivePlan).find((item) => item.key === benefitKey);
  if (!allowance) {
    return { statusCode: 400, body: { error: `${effectivePlan} does not include that benefit.` } };
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

  const { data: periodUsage, error: usageError } = await supabase
    .from("membership_benefit_usage")
    .select("id, benefit_key, status, period_start, period_end")
    .eq("user_id", request.user_id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (usageError) {
    return { statusCode: 500, body: { error: "Could not verify the member's remaining benefits." } };
  }

  const { data: revenueEvents, error: revenueError } = await supabase
    .from("membership_revenue_events")
    .select("amount_paid_cents, amount_refunded_cents, paid_at")
    .eq("user_id", request.user_id)
    .gte("paid_at", period.start.toISOString())
    .lt("paid_at", period.end.toISOString());

  if (revenueError) {
    return { statusCode: 500, body: { error: "Could not verify paid membership revenue. Run the membership benefit unlock migration." } };
  }

  const balances = summarizeMembershipBenefits(effectivePlan, periodUsage || [], {
    activationDate: profile.stripe_subscription_created_at || profile.subscription_activated_at || profile.created_at,
    revenueEvents: revenueEvents || [],
  });
  const balance = balances.find((item) => item.key === benefitKey);

  if (!balance || balance.remaining <= 0) {
    const nextDate = balance?.nextUnlockAt && new Date(balance.nextUnlockAt) > new Date()
      ? new Date(balance.nextUnlockAt).toLocaleDateString("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" })
      : "after additional successful membership payments";
    return {
      statusCode: 409,
      body: { error: `No earned ${allowance.label.toLowerCase()} credit is available yet. Its earliest unlock is ${nextDate}; the paid-revenue reserve must also be able to cover it.` },
    };
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
    let { data, error } = await supabase
      .from("service_requests")
      .select("id, user_id, vehicle_label, service_type, preferred_date, preferred_time, transport_date, transport_time, cancelled_at, cancellation_reason, payment_link_url, payment_link_amount_cents, payment_link_label, payment_link_created_at, notes, status, quoted_total_cents, payment_mode, payment_status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error?.code === "42703") {
      const legacyResult = await supabase
        .from("service_requests")
        .select("id, user_id, vehicle_label, service_type, preferred_date, preferred_time, notes, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      console.error("Could not load service requests", error);
      return json(500, { error: "Could not load service requests" });
    }

    const userIds = [...new Set((data || []).map((request) => request.user_id).filter(Boolean))];
    const profileMap = new Map();

    if (userIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, plan, collector_access_override, subscription_status, subscription_activated_at, stripe_subscription_created_at, created_at")
        .in("id", userIds);

      if (profileError) {
        console.warn("Could not attach member profiles to service requests", profileError);
      }

      for (const profile of profiles || []) {
        profileMap.set(profile.id, { ...profile, plan: effectiveProfilePlan(profile) });
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

    let membershipRevenueEvents = [];
    if (userIds.length) {
      const { data: revenueRows, error: revenueError } = await supabase
        .from("membership_revenue_events")
        .select("user_id, amount_paid_cents, amount_refunded_cents, paid_at")
        .in("user_id", userIds);

      if (revenueError) {
        console.warn("Could not attach paid membership revenue. Run the membership benefit unlock migration.", revenueError);
      } else {
        membershipRevenueEvents = revenueRows || [];
      }
    }

    let serviceDocuments = [];
    let servicePayments = [];
    const requestIds = (data || []).map((request) => request.id).filter(Boolean);
    if (requestIds.length) {
      const { data: documentRows, error: documentError } = await supabase
        .from("service_documents")
        .select("id, service_request_id, user_id, file_name, file_type, file_size, storage_path, created_at")
        .in("service_request_id", requestIds)
        .order("created_at", { ascending: false });

      if (documentError) {
        console.warn("Could not attach service documents. Run the service documents migration.", documentError);
      } else {
        serviceDocuments = documentRows || [];
      }

      const { data: paymentRows, error: paymentError } = await supabase
        .from("service_request_payments")
        .select("id, service_request_id, user_id, amount_cents, payment_type, payment_method, stripe_checkout_session_id, note, paid_at, created_at")
        .in("service_request_id", requestIds)
        .order("paid_at", { ascending: false });

      if (paymentError) {
        console.warn("Could not attach service payment records. Run the service payment migration.", paymentError);
      } else {
        servicePayments = paymentRows || [];
      }
    }

    let feedEvents = [];
    const { data: feedRows, error: feedError } = await supabase
      .from("feed_posts")
      .select("id, user_id, author_name, vehicle_label, caption, image_url, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (feedError) {
      console.warn("Could not load the admin event archive", feedError);
    } else {
      feedEvents = (feedRows || [])
        .filter((post) => String(post.caption || "").startsWith("[WG_EVENT]"))
        .map((post) => ({
          id: post.id,
          userId: post.user_id,
          author: post.author_name || "Member",
          caption: post.caption || "",
          image: post.image_url || "",
          vehicle: post.vehicle_label || "",
          createdAt: post.created_at,
          updatedAt: post.updated_at,
        }));
    }

    return json(200, {
      events: feedEvents,
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

        const payments = servicePayments.filter((payment) => payment.service_request_id === request.id);
        return {
          ...request,
          benefit_usage: benefitUsage.filter((usage) => usage.service_request_id === request.id),
          documents: serviceDocuments.filter((document) => document.service_request_id === request.id),
          payment_summary: paymentSummary(request, payments),
          payments,
          member: profile,
          member_benefits: summarizeMembershipBenefits(profile?.plan, currentUsage, {
            activationDate: profile?.stripe_subscription_created_at || profile?.subscription_activated_at || profile?.created_at,
            revenueEvents: membershipRevenueEvents.filter((entry) => entry.user_id === request.user_id),
          }),
        };
      }),
    });
  }

  if (event.httpMethod === "POST") {
    const payload = JSON.parse(event.body || "{}");
    const { action, files, requestId, uploads } = payload;

    if (!requestId || !["prepare-service-documents", "finalize-service-documents"].includes(action)) {
      return json(400, { error: "A service request and document action are required." });
    }

    const { data: request, error: requestError } = await supabase
      .from("service_requests")
      .select("id, user_id")
      .eq("id", requestId)
      .single();

    if (requestError || !request?.user_id) {
      return json(404, { error: "Could not find that member service request." });
    }

    if (action === "prepare-service-documents") {
      const requestedFiles = Array.isArray(files) ? files.slice(0, 10) : [];
      if (!requestedFiles.length || requestedFiles.some((file) => !validServiceDocument(file))) {
        return json(400, { error: "Choose up to 10 PDF, image, Word, Excel, CSV, or text files. Each file must be under 25 MB." });
      }

      const preparedUploads = [];
      for (const file of requestedFiles) {
        const extension = serviceDocumentExtension(file.name, file.type);
        const path = `${request.user_id}/service-records/${request.id}/${crypto.randomUUID()}.${extension}`;
        const { data: signedUpload, error: uploadError } = await supabase.storage
          .from("vehicle-documents")
          .createSignedUploadUrl(path);

        if (uploadError || !signedUpload?.token) {
          console.error("Could not prepare service document upload", uploadError);
          return json(500, { error: "Could not prepare the secure upload. Run the service documents SQL migration first." });
        }

        preparedUploads.push({
          fileName: file.name,
          fileSize: Number(file.size) || 0,
          fileType: file.type || "application/octet-stream",
          path,
          token: signedUpload.token,
        });
      }

      return json(200, { uploads: preparedUploads });
    }

    const completedUploads = Array.isArray(uploads) ? uploads.slice(0, 10) : [];
    const expectedPrefix = `${request.user_id}/service-records/${request.id}/`;
    if (!completedUploads.length || completedUploads.some((upload) => !upload?.path?.startsWith(expectedPrefix))) {
      return json(400, { error: "The completed upload details are invalid." });
    }

    const documentRows = completedUploads.map((upload) => ({
      service_request_id: request.id,
      user_id: request.user_id,
      file_name: String(upload.fileName || "Service document").slice(0, 240),
      file_type: String(upload.fileType || "application/octet-stream").slice(0, 160),
      file_size: Math.max(0, Number(upload.fileSize) || 0),
      storage_path: upload.path,
    }));
    const { data: savedDocuments, error: saveError } = await supabase
      .from("service_documents")
      .insert(documentRows)
      .select("id, service_request_id, user_id, file_name, file_type, file_size, storage_path, created_at");

    if (saveError) {
      console.error("Could not save service document records", saveError);
      return json(500, { error: "Files uploaded, but the document records could not be saved. Run the service documents SQL migration." });
    }

    return json(200, { documents: savedDocuments || [] });
  }

  if (event.httpMethod === "DELETE") {
    const payload = JSON.parse(event.body || "{}");
    if (!payload.documentId) return json(400, { error: "A document is required." });

    const { data: document, error: documentError } = await supabase
      .from("service_documents")
      .select("id, storage_path")
      .eq("id", payload.documentId)
      .single();

    if (documentError || !document) return json(404, { error: "Could not find that service document." });

    const { error: storageError } = await supabase.storage.from("vehicle-documents").remove([document.storage_path]);
    if (storageError) return json(500, { error: "Could not remove the stored document." });

    const { error: deleteError } = await supabase.from("service_documents").delete().eq("id", document.id);
    if (deleteError) return json(500, { error: "Could not remove the document record." });
    return json(200, { deletedId: document.id });
  }

  if (event.httpMethod === "PATCH") {
    const payload = JSON.parse(event.body || "{}");
    const {
      action,
      amountCents,
      benefitKey,
      id,
      note,
      paymentMethod,
      paymentMode,
      paymentType,
      preferredDate,
      preferredTime,
      quotedTotalCents,
      status,
      transportDate,
      transportTime,
      cancellationReason,
    } = payload;

    if (action === "redeem-benefit" || action === "restore-benefit") {
      if (!id || !benefitKey) return json(400, { error: "Request id and benefit are required." });
      const result = await updateMembershipBenefit({ action, benefitKey, requestId: id });
      return json(result.statusCode, result.body);
    }

    if (!id || (!status && !["set-payment-total", "record-payment", "schedule", "cancel-request"].includes(action))) {
      return json(400, { error: "Request id and update details are required" });
    }

    if (action === "schedule") {
      if (!preferredDate) return json(400, { error: "Choose an appointment date." });
      const scheduleUpdate = {
        preferred_date: preferredDate,
        preferred_time: preferredTime || null,
        transport_date: transportDate || null,
        transport_time: transportTime || null,
        updated_at: new Date().toISOString(),
      };
      const { data: currentRequest } = await supabase.from("service_requests").select("status").eq("id", id).maybeSingle();
      if (!["Completed", "Paid / Confirmed", "Cancelled"].includes(currentRequest?.status)) scheduleUpdate.status = "Booked";
      const { data, error } = await supabase
        .from("service_requests")
        .update(scheduleUpdate)
        .eq("id", id)
        .select("id, preferred_date, preferred_time, transport_date, transport_time, status")
        .single();
      if (error) return json(500, { error: "Could not update the appointment. Run the latest service payment SQL migration first." });
      return json(200, { request: data });
    }

    if (action === "cancel-request") {
      const { data, error } = await supabase
        .from("service_requests")
        .update({
          cancellation_reason: String(cancellationReason || "Cancelled by the concierge team").slice(0, 500),
          cancelled_at: new Date().toISOString(),
          status: "Cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, cancelled_at, cancellation_reason, status")
        .single();
      if (error) return json(500, { error: "Could not cancel this request. Run the latest service payment SQL migration first." });
      return json(200, { request: data });
    }

    if (action === "set-payment-total") {
      const total = Number(quotedTotalCents);
      if (!Number.isInteger(total) || total < 0) return json(400, { error: "Enter a valid total service price." });

      const { data: payments, error: paymentsError } = await supabase
        .from("service_request_payments")
        .select("amount_cents, payment_type")
        .eq("service_request_id", id);
      if (paymentsError) return json(500, { error: "Run the service payment SQL migration before saving payment totals." });

      const paid = (payments || []).reduce((sum, payment) => sum + (payment.payment_type === "refund" ? -1 : 1) * Number(payment.amount_cents || 0), 0);
      const nextPaymentStatus = paymentMode === "free" || (total > 0 && paid >= total) ? "paid" : paid > 0 ? (paymentMode === "deposit" ? "deposit_paid" : "partially_paid") : "unpaid";
      const bookingUpdate = {
        payment_mode: paymentMode || "custom",
        payment_status: nextPaymentStatus,
        quoted_total_cents: total,
        updated_at: new Date().toISOString(),
      };
      if (nextPaymentStatus === "paid" && paymentMode === "free") bookingUpdate.status = "Paid / Confirmed";
      const { data, error } = await supabase
        .from("service_requests")
        .update(bookingUpdate)
        .eq("id", id)
        .select("id, payment_mode, payment_status, quoted_total_cents, status")
        .single();
      if (error) return json(500, { error: "Could not save the service total. Run the service payment SQL migration first." });
      return json(200, { request: data });
    }

    if (action === "record-payment") {
      const amount = Number(amountCents);
      if (!Number.isInteger(amount) || amount <= 0) return json(400, { error: "Enter a payment amount greater than zero." });
      const allowedTypes = new Set(["deposit", "balance", "full", "manual"]);
      if (!allowedTypes.has(paymentType)) return json(400, { error: "Choose a valid payment type." });

      const { data: request, error: requestError } = await supabase
        .from("service_requests")
        .select("id, user_id, quoted_total_cents, payment_mode")
        .eq("id", id)
        .single();
      if (requestError || !request) return json(404, { error: "Could not find that service request." });

      const { error: insertError } = await supabase.from("service_request_payments").insert({
        amount_cents: amount,
        note: String(note || "").slice(0, 500) || null,
        paid_at: new Date().toISOString(),
        payment_method: String(paymentMethod || "Admin recorded").slice(0, 120),
        payment_type: paymentType,
        service_request_id: id,
        user_id: request.user_id,
      });
      if (insertError) return json(500, { error: "Could not record the payment. Run the service payment SQL migration first." });

      const { data: payments } = await supabase
        .from("service_request_payments")
        .select("amount_cents, payment_type")
        .eq("service_request_id", id);
      const paid = (payments || []).reduce((sum, payment) => sum + (payment.payment_type === "refund" ? -1 : 1) * Number(payment.amount_cents || 0), 0);
      const total = Number(request.quoted_total_cents) || 0;
      const nextPaymentStatus = total > 0 && paid >= total ? "paid" : paymentType === "deposit" ? "deposit_paid" : "partially_paid";
      const requestUpdate = { payment_status: nextPaymentStatus, updated_at: new Date().toISOString() };
      if (nextPaymentStatus === "paid") requestUpdate.status = "Paid / Confirmed";
      const { data, error } = await supabase
        .from("service_requests")
        .update(requestUpdate)
        .eq("id", id)
        .select("id, payment_mode, payment_status, quoted_total_cents, status")
        .single();
      if (error) return json(500, { error: "Payment saved, but the booking balance could not be refreshed." });
      return json(200, { request: data });
    }

    const update = { updated_at: new Date().toISOString() };

    if (status) {
      update.status = status;
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
