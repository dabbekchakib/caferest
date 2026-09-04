import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SettingGroup, SettingType } from "@/types/database";
import type { SettingsMap, UpsertSettingInput } from "@/types/settings";
import {
  parseSettingValue,
  serializeSettingValue,
  toSettingEntry,
  toSettingsMap,
} from "@/lib/config/settings";

type Client = SupabaseClient<Database>;

/**
 * Resolve the user's active establishment from their memberships.
 * Falls back to the first membership when none is explicitly active.
 */
export async function getActiveEstablishmentId(
  client: Client,
  userId: string
): Promise<string | null> {
  const { data: members, error } = await client
    .from("establishment_members")
    .select("establishment_id, is_active")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .limit(1);

  if (error) return null;
  return (members?.[0]?.establishment_id as string | undefined) ?? null;
}

/** Build a consolidated key -> typed value settings map for an establishment. */
export async function getSettingsMap(
  client: Client,
  establishmentId: string
): Promise<SettingsMap> {
  const { data, error } = await client
    .from("settings")
    .select("key, value, type, group_name, description, is_public")
    .eq("establishment_id", establishmentId);

  if (error || !data) return {};
  return toSettingsMap(data.map((row) => toSettingEntry(row)));
}

/** Fetch and map an entire establishment (public fields). */
export async function getEstablishment(
  client: Client,
  establishmentId: string
) {
  const { data, error } = await client
    .from("establishments")
    .select("*")
    .eq("id", establishmentId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Upsert a single setting. Null value deletes it (means "unset").
 * Uses the establishment-scoped unique (establishment_id, key).
 */
export async function upsertSetting(
  client: Client,
  establishmentId: string,
  input: UpsertSettingInput
) {
  if (input.value === null || input.value === undefined) {
    return client
      .from("settings")
      .delete()
      .eq("establishment_id", establishmentId)
      .eq("key", input.key);
  }

  return client
    .from("settings")
    .upsert(
      {
        establishment_id: establishmentId,
        key: input.key,
        value: input.value,
        type: input.type ?? "string",
        group_name: input.group ?? "general",
        description: input.description ?? null,
        is_public: input.isPublic ?? false,
      },
      { onConflict: "establishment_id,key" }
    );
}

/** Upsert many settings in a single transaction-aware batch. */
export async function upsertSettings(
  client: Client,
  establishmentId: string,
  entries: UpsertSettingInput[]
) {
  const rows = entries
    .filter((e) => e.value !== null && e.value !== undefined)
    .map((e) => ({
      establishment_id: establishmentId,
      key: e.key,
      value: e.value as string,
      type: (e.type ?? "string") as SettingType,
      group_name: (e.group ?? "general") as SettingGroup,
      description: e.description ?? null,
      is_public: e.isPublic ?? false,
    }));

  return client
    .from("settings")
    .upsert(rows, { onConflict: "establishment_id,key" });
}

/** Update establishment scalar fields (name, address, ids, receipt, etc.). */
export async function updateEstablishment(
  client: Client,
  establishmentId: string,
  patch: Partial<Database["public"]["Tables"]["establishments"]["Update"]>
) {
  return client
    .from("establishments")
    .update(patch)
    .eq("id", establishmentId);
}

export { parseSettingValue, serializeSettingValue };
