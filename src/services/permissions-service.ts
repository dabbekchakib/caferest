import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "@/lib/authorization/errors";
import { requireAnyPermission } from "./authorization";

export interface PermissionInfo {
  id: string;
  slug: string;
}

/** Full permission catalog: id (DB PK) + slug (stable key). */
export async function listAllPermissions(): Promise<PermissionInfo[]> {
  await requireAnyPermission(["roles.view", "roles.update", "users.view"]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, slug")
    .order("slug");

  if (error) throw new AuthorizationError("GENERIC", error.message);
  return (data ?? []).map((p) => ({ id: p.id, slug: p.slug }));
}