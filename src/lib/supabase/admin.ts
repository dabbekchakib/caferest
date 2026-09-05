import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-only admin client authenticated with the service-role key.
 *
 * It bypasses RLS, so it MUST NEVER be imported from a client component and
 * every caller has to enforce permissions explicitly before using it (the
 * authorization service does this via `requirePermission` on the user's own
 * server client). Secrets stay server-side; nothing `NEXT_PUBLIC_*` is used.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Configure it in the server environment."
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}