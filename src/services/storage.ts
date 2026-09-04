import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const BUCKET = "branding";

export type BrandingAsset = "logo" | "favicon";

/**
 * Upload a branding asset (logo/favicon) to Supabase Storage and return its
 * public URL. Stores only the path/URL in the DB — never the base64 blob.
 */
export async function uploadBrandingAsset(
  client: Client,
  asset: BrandingAsset,
  file: File | Blob,
  fileName: string
): Promise<{ url: string | null; error: string | null }> {
  const ext = fileName.split(".").pop() ?? "png";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${asset}/${Date.now()}_${safeName}`;

  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  });

  if (error) return { url: null, error: error.message };

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
