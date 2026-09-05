// Provision a super_admin account (auth + profile + role + membership).
// Usage: node scripts/create-superadmin.mjs <email> <password>
// Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ESTABLISHMENT = "00000000-0000-0000-0000-000000000001";

function loadEnv() {
  const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
const password = process.argv[3] ?? "";
if (!email || !password) {
  console.error("Usage: node scripts/create-superadmin.mjs <email> <password>");
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Auth user (create or reuse).
let userId = null;
{
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("listUsers:", error.message);
    process.exit(1);
  }
  const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (found) {
    userId = found.id;
    console.log(`User ${email} already exists (${userId}).`);
  }
}
if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Super Admin" },
  });
  if (error) {
    console.error("createUser:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created auth user ${email} (${userId}).`);
}

// 2. Profile (the on_auth_user_created trigger does this too; keep it idempotent).
{
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: "Super Admin", is_active: true });
  if (error) {
    console.error("profiles:", error.message);
    process.exit(1);
  }
}

// 3. Membership + super_admin role on the default establishment.
const { data: estData } = await supabase
  .from("establishments")
  .select("id")
  .eq("id", DEFAULT_ESTABLISHMENT)
  .maybeSingle();
const estId = estData?.id ?? null;
if (!estId) {
  console.error("Default establishment not found; aborting role assignment.");
  process.exit(1);
}
const { data: roleRow } = await supabase
  .from("roles")
  .select("id")
  .eq("code", "super_admin")
  .maybeSingle();
if (!roleRow) {
  console.error("super_admin role not found; aborting role assignment.");
  process.exit(1);
}

{
  const { error } = await supabase
    .from("establishment_members")
    .upsert(
      { user_id: userId, establishment_id: estId, is_active: true },
      { onConflict: "user_id,establishment_id" }
    );
  if (error) {
    console.error("establishment_members:", error.message);
    process.exit(1);
  }
}
{
  const { error } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: userId, role_id: roleRow.id, establishment_id: estId },
      { onConflict: "user_id,role_id,establishment_id" }
    );
  if (error) {
    console.error("user_roles:", error.message);
    process.exit(1);
  }
}

console.log(`Super admin ${email} is ready on establishment ${estId}.`);