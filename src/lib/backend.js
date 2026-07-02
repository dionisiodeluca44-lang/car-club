import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isBackendConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function getCurrentMember() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  const user = data.session.user;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email,
    email: user.email,
    plan: profile?.plan || user.user_metadata?.plan || "Club Drive",
  };
}

export async function createAccount({ email, name, password, plan }) {
  if (!supabase) {
    return { email, name, plan };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        plan,
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error("Account could not be created.");

  if (!data.session) {
    throw new Error("Account created. Check your email to confirm your account, then sign in.");
  }

  await upsertProfile({
    id: data.user.id,
    email,
    name,
    plan,
  });

  return {
    id: data.user.id,
    email,
    name,
    plan,
  };
}

export async function signIn({ email, password }) {
  if (!supabase) {
    return { email, name: email.split("@")[0] || "Member", plan: "Club Drive" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Could not sign in.");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();

  return {
    id: data.user.id,
    name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email,
    email: data.user.email,
    plan: profile?.plan || data.user.user_metadata?.plan || "Club Drive",
  };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function upsertProfile({ email, id, name, plan }) {
  if (!supabase || !id) return;

  const { error } = await supabase.from("profiles").upsert({
    id,
    email,
    full_name: name,
    plan,
  });

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

  const imageUrl = await uploadVehicleImage(userId, vehicle.image);
  const payload = toVehicleRow(userId, { ...vehicle, image: imageUrl || vehicle.image });

  const { data, error } = await supabase.from("vehicles").insert(payload).select("*").single();
  if (error) throw error;
  return fromVehicleRow(data);
}

export async function updateVehicleRecord(vehicleId, updates) {
  if (!supabase || !vehicleId) return updates;

  const imageUrl = await uploadVehicleImage(null, updates.image);
  const payload = toVehicleUpdateRow({ ...updates, image: imageUrl || updates.image });

  const { data, error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId).select("*").single();
  if (error) throw error;
  return fromVehicleRow(data);
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

function fromVehicleRow(row) {
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
    notes: row.notes || "",
    image: row.image_url || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=85",
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
    notes: vehicle.notes || "",
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
  if (updates.notes !== undefined) row.notes = updates.notes;
  return row;
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
