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

        return {
          ...request,
          benefit_usage: benefitUsage.filter((usage) => usage.service_request_id === request.id),
          documents: serviceDocuments.filter((document) => document.service_request_id === request.id),
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
