import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const productionSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://vocal-pie-c034af.netlify.app";

export const isBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isBackendConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

const defaultNotifications = {
  bookingUpdates: true,
  feedActivity: true,
  offers: true,
  serviceReminders: true,
};

function ensureList(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function effectiveMemberPlan(profile, user) {
  if (profile?.collector_access_override) return "Collector";
  return profile?.plan || user?.user_metadata?.plan || "Club Drive";
}

function friendlyAuthError(error, fallback = "Could not complete authentication.") {
  if (!error) return fallback;
  if (error.name === "AuthRetryableFetchError") {
    return "Supabase could not create the account right now. Try a real email address, then check Supabase Auth URL and email settings if it keeps happening.";
  }
  if (typeof error.message === "string" && error.message && error.message !== "{}") return error.message;
  if (typeof error.error_description === "string" && error.error_description) return error.error_description;
  if (typeof error.error === "string" && error.error && error.error !== "{}") return error.error;
  return fallback;
}

function getAuthRedirectUrl() {
  if (typeof window === "undefined") return productionSiteUrl;

  const origin = window.location.origin;
  const isLocalDev = import.meta.env.DEV && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const isNativeAppOrigin = /^(capacitor|ionic):\/\/localhost$/i.test(origin) || /^https?:\/\/localhost(:\d+)?$/i.test(origin);

  if (isLocalDev) return origin;
  if (!origin || origin === "null" || isNativeAppOrigin) return productionSiteUrl;
  return origin;
}

function getPasswordRecoveryRedirectUrl() {
  return `${getAuthRedirectUrl()}/?password=recovery`;
}

export async function getCurrentMember() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  const user = data.session.user;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) throw profileError;

  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email,
    email: user.email,
    plan: effectiveMemberPlan(profile, user),
    collectorAccessOverride: Boolean(profile?.collector_access_override),
    subscriptionStatus: profile?.subscription_status || user.user_metadata?.subscription_status || "pending",
    subscriptionCancelAtPeriodEnd: Boolean(profile?.subscription_cancel_at_period_end),
    subscriptionStatusUpdatedAt: profile?.subscription_status_updated_at || "",
    stripeCustomerId: profile?.stripe_customer_id || "",
    stripeSubscriptionId: profile?.stripe_subscription_id || "",
    username: profile?.username || user.user_metadata?.username || "",
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || "",
    phone: user.user_metadata?.phone || "",
    addresses: user.user_metadata?.addresses || [],
    notifications: profile?.notifications || defaultNotifications,
  };
}

export async function createAccount({ addresses = [], email, name, password, phone, plan, username }) {
  if (!supabase) {
    return { addresses, avatarUrl: "", email, name, phone, plan, subscriptionStatus: "active", username, notifications: defaultNotifications };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: name,
        username,
        phone,
        plan,
        addresses,
      },
    },
  });

  if (error) throw new Error(friendlyAuthError(error, "Account could not be created."));
  if (!data.user) throw new Error("Account could not be created.");

  if (!data.session) {
    return {
      id: data.user.id,
      addresses,
      email,
      name,
      phone,
      plan,
      subscriptionStatus: "pending",
      pendingConfirmation: true,
      username,
    };
  }

  await upsertProfile({
    id: data.user.id,
    email,
    name,
    plan,
    username,
    avatarUrl: "",
    notifications: defaultNotifications,
  });

  return {
    id: data.user.id,
    email,
    name,
    phone,
    plan,
    subscriptionStatus: "pending",
    username,
    avatarUrl: "",
    addresses,
    notifications: defaultNotifications,
  };
}

export async function resendConfirmationEmail(email) {
  if (!supabase) return;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });

  if (error) throw new Error(friendlyAuthError(error, "Could not resend the confirmation email."));
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    throw new Error("Password recovery requires the Supabase backend.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordRecoveryRedirectUrl(),
  });

  if (error) throw new Error(friendlyAuthError(error, "Could not send the password reset email."));
}

export async function signIn({ email, password }) {
  if (!supabase) {
    return { avatarUrl: "", email, name: email.split("@")[0] || "Member", phone: "", plan: "Club Drive", subscriptionStatus: "active", username: "", notifications: defaultNotifications };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error, "Could not sign in."));
  if (!data.user) throw new Error("Could not sign in.");

  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;

  return {
    id: data.user.id,
    name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email,
    email: data.user.email,
    plan: effectiveMemberPlan(profile, data.user),
    collectorAccessOverride: Boolean(profile?.collector_access_override),
    subscriptionStatus: profile?.subscription_status || data.user.user_metadata?.subscription_status || "pending",
    subscriptionCancelAtPeriodEnd: Boolean(profile?.subscription_cancel_at_period_end),
    subscriptionStatusUpdatedAt: profile?.subscription_status_updated_at || "",
    stripeCustomerId: profile?.stripe_customer_id || "",
    stripeSubscriptionId: profile?.stripe_subscription_id || "",
    username: profile?.username || data.user.user_metadata?.username || "",
    avatarUrl: profile?.avatar_url || data.user.user_metadata?.avatar_url || "",
    phone: data.user.user_metadata?.phone || "",
    addresses: data.user.user_metadata?.addresses || [],
    notifications: profile?.notifications || defaultNotifications,
  };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentAccessToken() {
  if (!supabase) return "";

  const { data, error } = await supabase.auth.getSession();
  if (error) return "";
  return data.session?.access_token || "";
}

export async function upsertProfile({ avatarUrl, email, id, name, notifications, plan, username }) {
  if (!supabase || !id) return;

  const payload = {
    full_name: name,
    username: username || null,
    avatar_url: avatarUrl || null,
    notifications: notifications || defaultNotifications,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").update(payload).eq("id", id);

  if (error) throw error;
}

export async function updateMemberProfile({ avatarUrl, email, id, name, notifications, plan, username }) {
  let savedAvatarUrl = avatarUrl || "";

  if (String(savedAvatarUrl).startsWith("data:")) {
    try {
      savedAvatarUrl = await uploadStorageImage("vehicle-photos", `${id}/profile`, savedAvatarUrl);
    } catch (error) {
      throw new Error(`Could not upload profile picture: ${error.message}`);
    }
  }

  await upsertProfile({ avatarUrl: savedAvatarUrl, email, id, name, notifications, plan, username });
  return {
    id,
    avatarUrl: savedAvatarUrl,
    email,
    name,
    notifications: notifications || defaultNotifications,
    plan,
    username: username || "",
  };
}

export async function updateMemberPassword(password) {
  if (!supabase || !password) return;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function loadVehicles(userId) {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(fromVehicleRow);
}

export async function createVehicle(userId, vehicle) {
  if (!supabase || !userId) return vehicle;

  const imageUrls = await safeUploadVehicleImages(userId, vehicle.images?.length ? vehicle.images : [vehicle.image]);
  const fallbackImages = ensureImageList(vehicle.images?.length ? vehicle.images : [vehicle.image]).map(reusableImageUrl).filter(Boolean);
  const images = imageUrls.length ? imageUrls : fallbackImages;
  const payload = toVehicleRow(userId, { ...vehicle, image: images[0] || reusableImageUrl(vehicle.image), images });

  const { data, error } = await supabase.from("vehicles").insert(payload).select("*").single();
  if (error) throw new Error(`Could not save vehicle: ${error.message}`);
  return fromVehicleRow(data);
}

export async function updateVehicleRecord(vehicleId, updates) {
  if (!supabase || !vehicleId) return updates;

  const updateImages = updates.images?.length ? updates.images : updates.image ? [updates.image] : [];
  const imageUrls = await safeUploadVehicleImages("vehicle-updates", updateImages);
  const fallbackImages = ensureImageList(updateImages).map(reusableImageUrl).filter(Boolean);
  const images = imageUrls.length ? imageUrls : fallbackImages;
  const payload = toVehicleUpdateRow({
    ...updates,
    image: images[0] || reusableImageUrl(updates.image),
    images: images.length ? images : updates.images,
  });

  const { data, error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId).select("*").single();
  if (error) throw new Error(`Could not update vehicle: ${error.message}`);
  return fromVehicleRow(data);
}

export async function deleteVehicleRecord(vehicleId) {
  if (!supabase || !vehicleId) return;

  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw new Error(`Could not delete vehicle: ${error.message}`);
}

export async function loadServiceRequests(userId) {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(fromRequestRow);
}

export async function createServiceRequest(userId, request) {
  if (!supabase || !userId) return request;

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      user_id: userId,
      vehicle_label: request.vehicle,
      service_type: request.service,
      preferred_date: request.date || null,
      preferred_time: request.time || null,
      notes: request.notes || "",
      status: "Requested",
    })
    .select("*")
    .single();

  if (error) throw error;
  return fromRequestRow(data);
}

export async function updateServiceRequestRecord(requestId, updates) {
  if (!supabase || !requestId) return { id: requestId, ...updates };

  const payload = {};
  if (updates.date !== undefined) payload.preferred_date = updates.date || null;
  if (updates.time !== undefined) payload.preferred_time = updates.time || null;
  if (updates.notes !== undefined) payload.notes = updates.notes || "";
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("service_requests")
    .update(payload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) throw new Error(`Could not update service request: ${error.message}`);
  return fromRequestRow(data);
}

export async function loadFeedPosts() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("feed_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("Could not load member feed posts.", error);
    return [];
  }

  return data.map(fromFeedPostRow);
}

export async function loadServicePricing() {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("service_pricing")
    .select("service_label, payment_mode, amount_cents, note, updated_at");

  if (error) {
    console.warn("Could not load service pricing.", error);
    return {};
  }

  return (data || []).reduce((pricing, row) => {
    pricing[row.service_label] = {
      amountCents: row.amount_cents,
      note: row.note || "",
      paymentMode: row.payment_mode,
      serviceLabel: row.service_label,
      updatedAt: row.updated_at,
    };
    return pricing;
  }, {});
}

export async function loadMembershipPricing() {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("membership_pricing")
    .select("plan_name, amount_cents, cadence, note, updated_at");

  if (error) {
    console.warn("Could not load membership pricing.", error);
    return {};
  }

  return (data || []).reduce((pricing, row) => {
    pricing[row.plan_name] = {
      amountCents: row.amount_cents,
      cadence: row.cadence || "/month",
      note: row.note || "",
      planName: row.plan_name,
      updatedAt: row.updated_at,
    };
    return pricing;
  }, {});
}

export async function loadMembershipBenefitUsage(userId) {
  if (!supabase || !userId) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("membership_benefit_usage")
    .select("id, service_request_id, benefit_key, credit_cents, description, period_start, period_end, status, used_at")
    .eq("user_id", userId)
    .lte("period_start", today)
    .gt("period_end", today)
    .order("used_at", { ascending: false });

  if (error) {
    console.warn("Could not load membership benefit usage. Run the membership benefits migration.", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    serviceRequestId: row.service_request_id || "",
    benefitKey: row.benefit_key,
    creditCents: Number(row.credit_cents || 0),
    description: row.description || "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status || "redeemed",
    usedAt: row.used_at,
  }));
}

export function subscribeToFeedPosts(onPostCreated) {
  if (!supabase || typeof onPostCreated !== "function") return () => {};

  const channel = supabase
    .channel("member-feed-posts")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "feed_posts",
      },
      (payload) => {
        if (payload.new) {
          onPostCreated(fromFeedPostRow(payload.new));
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function createFeedPost(userId, post, authorName = "Member") {
  if (!supabase || !userId) return post;

  const imageUrl = await safeUploadFeedImage(userId, post.image);
  if (!imageUrl && !reusableImageUrl(post.image)) {
    throw new Error("Could not upload the photo. Please try again before posting to the feed.");
  }

  const { data, error } = await supabase
    .from("feed_posts")
    .insert({
      user_id: userId,
      author_name: authorName || "Member",
      vehicle_label: post.vehicle || "",
      caption: post.caption || "",
      image_url: imageUrl || reusableImageUrl(post.image),
    })
    .select("*")
    .single();

  if (error) throw new Error(`Could not post to feed: ${error.message}`);
  return fromFeedPostRow(data);
}

async function uploadVehicleImage(userId, image) {
  if (!supabase || !image || !String(image).startsWith("data:")) return "";

  const response = await fetch(image);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  const folder = userId || "vehicle-updates";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("vehicle-photos").upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function safeUploadVehicleImage(userId, image) {
  try {
    return await uploadVehicleImage(userId, image);
  } catch (error) {
    console.warn("Vehicle photo upload failed. Saving vehicle without the uploaded photo.", error);
    return "";
  }
}

function ensureImageList(images) {
  return ensureList(images).filter(Boolean).slice(0, 10);
}

async function safeUploadVehicleImages(userId, images) {
  const uploadedImages = [];

  for (const image of ensureImageList(images)) {
    if (String(image).startsWith("data:")) {
      try {
        const imageUrl = await uploadStorageImage("vehicle-photos", userId || "vehicle-updates", image);
        if (imageUrl) uploadedImages.push(imageUrl);
      } catch (error) {
        console.warn("Vehicle photo upload failed.", error);
      }
    } else {
      const reusableUrl = reusableImageUrl(image);
      if (reusableUrl) uploadedImages.push(reusableUrl);
    }
  }

  return uploadedImages;
}

async function safeUploadFeedImage(userId, image) {
  try {
    return await uploadStorageImage("vehicle-photos", `${userId}/feed`, image);
  } catch (error) {
    console.warn("Feed photo upload failed.", error);
    return "";
  }
}

async function uploadStorageImage(bucket, folder, image) {
  if (!supabase || !image || !String(image).startsWith("data:")) return "";

  const response = await fetch(image);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function reusableImageUrl(image) {
  if (!image || String(image).startsWith("data:")) return "";
  return image;
}

function fromVehicleRow(row) {
  const galleryImages = parseVehicleGallery(row.notes);
  const images = ensureImageList([row.image_url, ...galleryImages]);

  return {
    id: row.id,
    year: row.year || "",
    make: row.make || "",
    model: row.model || "",
    mileage: row.mileage || "",
    use: row.usage || "Collection",
    status: row.status || "Active",
    marketValue: row.market_value || "Value pending",
    horsepower: row.horsepower || "HP pending",
    workDone: row.work_done || [],
    notes: stripVehicleGallery(row.notes),
    image: images[0] || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85",
    images,
  };
}

function toVehicleRow(userId, vehicle) {
  return {
    user_id: userId,
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    mileage: vehicle.mileage || "",
    usage: vehicle.use || "Collection",
    status: vehicle.status || "Active",
    market_value: vehicle.marketValue || "Value pending",
    horsepower: vehicle.horsepower || "HP pending",
    work_done: vehicle.workDone || [],
    notes: serializeVehicleNotes(vehicle.notes, vehicle.images?.length ? vehicle.images : [vehicle.image]),
    image_url: vehicle.image || "",
  };
}

function toVehicleUpdateRow(updates) {
  const row = {};
  if (updates.mileage !== undefined) row.mileage = updates.mileage;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.marketValue !== undefined) row.market_value = updates.marketValue;
  if (updates.horsepower !== undefined) row.horsepower = updates.horsepower;
  if (updates.workDone !== undefined) row.work_done = updates.workDone;
  if (updates.image !== undefined) row.image_url = updates.image;
  if (updates.notes !== undefined || updates.images !== undefined) row.notes = serializeVehicleNotes(updates.notes, updates.images);
  return row;
}

const vehicleGalleryPrefix = "Photo gallery:";

function parseVehicleGallery(notes) {
  const galleryLine = String(notes || "")
    .split("\n")
    .find((line) => line.trim().startsWith(vehicleGalleryPrefix));

  if (!galleryLine) return [];

  try {
    const parsed = JSON.parse(galleryLine.slice(vehicleGalleryPrefix.length).trim());
    return ensureImageList(parsed);
  } catch {
    return [];
  }
}

function stripVehicleGallery(notes) {
  return String(notes || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith(vehicleGalleryPrefix))
    .join("\n")
    .trim();
}

function serializeVehicleNotes(notes, images) {
  const cleanNotes = stripVehicleGallery(notes);
  const galleryImages = ensureImageList(images);
  if (!galleryImages.length) return cleanNotes;
  return [cleanNotes, `${vehicleGalleryPrefix} ${JSON.stringify(galleryImages)}`].filter(Boolean).join("\n");
}

function fromRequestRow(row) {
  return {
    id: row.id,
    vehicle: row.vehicle_label,
    service: row.service_type,
    date: row.preferred_date || "",
    time: row.preferred_time || "",
    notes: row.notes || "",
    status: row.status || "Requested",
  };
}

function fromFeedPostRow(row) {
  return {
    id: row.id,
    author: row.author_name || "Member",
    caption: row.caption || "",
    createdAt: row.created_at,
    image: row.image_url || "",
    vehicle: row.vehicle_label || "",
  };
}
