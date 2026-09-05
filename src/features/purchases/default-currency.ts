import { createClient } from "@/lib/supabase/server";
import { getSettingsMap } from "@/services/settings";
import { getCurrencySettings } from "@/lib/config/currency";

/** Resolved `currency.code` setting (TND when unavailable). */
export async function getDefaultCurrencyCode(
  establishmentId: string
): Promise<string> {
  try {
    const supabase = await createClient();
    const map = await getSettingsMap(supabase, establishmentId);
    return getCurrencySettings(map).code;
  } catch {
    return "TND";
  }
}