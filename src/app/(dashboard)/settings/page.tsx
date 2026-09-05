import { SettingsPage } from "@/features/settings/settings-page";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function SettingsRoute() {
  const connected = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <SettingsPage
        connected={connected}
        establishmentName={config.name}
        initial={{ defaultLocale: DEFAULT_LOCALE }}
      />
    </div>
  );
}
