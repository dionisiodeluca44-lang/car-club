import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function isMissingStripeResource(error) {
  return error?.code === "resource_missing" || error?.statusCode === 404;
}

async function cancelBilling(profile) {
  if (!stripe || (!profile?.stripe_customer_id && !profile?.stripe_subscription_id)) return;

  try {
    if (profile.stripe_customer_id) {
      await stripe.customers.del(profile.stripe_customer_id);
      return;
    }

    await stripe.subscriptions.cancel(profile.stripe_subscription_id);
  } catch (error) {
    if (!isMissingStripeResource(error)) throw error;
  }
}

async function listStorageFiles(bucket, prefix) {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    const entries = data || [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id || entry.metadata) {
        files.push(path);
      } else {
        files.push(...await listStorageFiles(bucket, path));
      }
    }

    if (entries.length < 100) break;
    offset += entries.length;
  }

  return files;
}

async function removeMemberStorage(bucket, userId) {
  const files = await listStorageFiles(bucket, userId);
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await supabase.storage.from(bucket).remove(files.slice(index, index + 100));
    if (error) throw error;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!supabase) return json(500, { error: "Account deletion is not configured." });

  try {
    const payload = JSON.parse(event.body || "{}");
    if (payload.confirmation !== "DELETE") {
      return json(400, { error: "Type DELETE to confirm permanent account deletion." });
    }

    const authorization = event.headers.authorization || event.headers.Authorization || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return json(401, { error: "Sign in before deleting your account." });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData?.user;
    if (authError || !user) return json(401, { error: "Your sign-in expired. Sign in again before deleting your account." });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    // Billing is stopped before personal data is removed so a failed deletion
    // can never leave an inaccessible subscription charging the member.
    await cancelBilling(profile);
    await removeMemberStorage("vehicle-photos", user.id);
    await removeMemberStorage("vehicle-documents", user.id);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json(200, { deleted: true });
  } catch (error) {
    console.error("Could not delete member account", error);
    return json(500, { error: "We could not finish deleting the account. Please try again or contact White Glove support." });
  }
}
