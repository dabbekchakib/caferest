// Stocktake variance thresholds. The DB RPCs receive the APPROVAL gates as
// parameters (never hardcoded in SQL); the warning gates are presentation only.
// All four keys are read from the establishment settings, with safe defaults.
import type { SettingsMap } from "@/types/settings";
import { settingValue } from "@/lib/config/settings";
import type { StocktakeThresholds } from "./types";

export const STOCKTAKE_THRESHOLD_KEYS = {
  warningPercentage: "stocktake_variance_warning_percentage",
  approvalPercentage: "stocktake_variance_approval_percentage",
  approvalValue: "stocktake_variance_approval_value",
  warningValue: "stocktake_variance_warning_value",
} as const;

/** Defaults when the setting is absent (spec: warning 2 %, approval 5 %). */
export const STOCKTAKE_THRESHOLD_DEFAULTS: StocktakeThresholds = {
  warningPercentage: 2,
  approvalPercentage: 5,
  approvalValue: 0,
  warningValue: 0,
};

/** Read the four server-side keys into a typed thresholds object. */
export function stocktakeThresholdsFromSettings(
  settings: SettingsMap
): StocktakeThresholds {
  const raw = {
    warningPercentage: Number(
      settingValue(
        settings,
        STOCKTAKE_THRESHOLD_KEYS.warningPercentage,
        STOCKTAKE_THRESHOLD_DEFAULTS.warningPercentage
      )
    ),
    approvalPercentage: Number(
      settingValue(
        settings,
        STOCKTAKE_THRESHOLD_KEYS.approvalPercentage,
        STOCKTAKE_THRESHOLD_DEFAULTS.approvalPercentage
      )
    ),
    approvalValue: Number(
      settingValue(
        settings,
        STOCKTAKE_THRESHOLD_KEYS.approvalValue,
        STOCKTAKE_THRESHOLD_DEFAULTS.approvalValue
      )
    ),
    warningValue: Number(
      settingValue(
        settings,
        STOCKTAKE_THRESHOLD_KEYS.warningValue,
        STOCKTAKE_THRESHOLD_DEFAULTS.warningValue
      )
    ),
  };
  // clamp: percentages must stay positive, values non-negative
  return {
    warningPercentage: Number.isFinite(raw.warningPercentage)
      ? Math.max(0, raw.warningPercentage)
      : STOCKTAKE_THRESHOLD_DEFAULTS.warningPercentage,
    approvalPercentage: Number.isFinite(raw.approvalPercentage)
      ? Math.max(0, raw.approvalPercentage)
      : STOCKTAKE_THRESHOLD_DEFAULTS.approvalPercentage,
    approvalValue: Number.isFinite(raw.approvalValue)
      ? Math.max(0, raw.approvalValue)
      : 0,
    warningValue: Number.isFinite(raw.warningValue)
      ? Math.max(0, raw.warningValue)
      : 0,
  };
}

/**
 * Optional "freeze" of a stocktake location during a count: when enabled, the
 * count page surfaces a persistent banner warning that stock-receipt writes on
 * the location may be restricted until the stocktake is validated/cancelled.
 * The setting is advisory (UI) — the RPCs never hard-code a freeze.
 */
export const STOCKTAKE_FREEZE_LOCATION_KEY = "freeze_stocktake_location";

export function isStocktakeLocationFrozen(settings: SettingsMap): boolean {
  return Boolean(
    settingValue(settings, STOCKTAKE_FREEZE_LOCATION_KEY, false)
  );
}