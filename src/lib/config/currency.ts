import type { SettingsMap } from "@/types/settings";
import { settingValue } from "./settings";

export interface ResolvedCurrency {
  code: string;
  symbol: string;
  position: "before" | "after";
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

/** Resolve currency settings from the consolidated settings map. */
export function getCurrencySettings(map: SettingsMap): ResolvedCurrency {
  return {
    code: settingValue<string>(map, "currency.code", "TND"),
    symbol: settingValue<string>(map, "currency.symbol", "TND"),
    position: settingValue<"before" | "after">(
      map,
      "currency.position",
      "after"
    ),
    decimalPlaces: settingValue<number>(map, "currency.decimal_places", 3),
    thousandSeparator: settingValue<string>(
      map,
      "currency.thousand_separator",
      ","
    ),
    decimalSeparator: settingValue<string>(
      map,
      "currency.decimal_separator",
      "."
    ),
  };
}
