// Stock-adjustment approval gates. The RPCs receive the gates as parameters
// (never hardcoded in SQL); the "requires approval" preview is front-end only.
// Settings are read from the establishment settings with safe defaults.
import type { SettingsMap } from "@/types/settings";
import { settingValue } from "@/lib/config/settings";
import type { StockAdjustmentThresholds } from "./types";

export const ADJUSTMENT_THRESHOLD_KEYS = {
  requireApproval: "require_adjustment_approval",
  approvalThresholdValue: "approval_threshold_value",
  /// Reserved for the future recipe-consumption phase (not enforced yet).
  approvalThresholdPercentage: "approval_threshold_percentage",
  requireSeparation: "require_adjustment_approval_separation",
} as const;

/** Defaults when the setting is absent (spec: no mandatory approval, 1000 TND). */
export const ADJUSTMENT_THRESHOLD_DEFAULTS: StockAdjustmentThresholds = {
  requireApproval: false,
  approvalThresholdValue: 1000,
  approvalThresholdPercentage: 0,
  requireSeparation: false,
};

/** Read the server-side keys into a typed thresholds object. */
export function adjustmentThresholdsFromSettings(
  settings: SettingsMap
): StockAdjustmentThresholds {
  const raw = {
    requireApproval: Boolean(
      settingValue(
        settings,
        ADJUSTMENT_THRESHOLD_KEYS.requireApproval,
        ADJUSTMENT_THRESHOLD_DEFAULTS.requireApproval
      )
    ),
    approvalThresholdValue: Number(
      settingValue(
        settings,
        ADJUSTMENT_THRESHOLD_KEYS.approvalThresholdValue,
        ADJUSTMENT_THRESHOLD_DEFAULTS.approvalThresholdValue
      )
    ),
    approvalThresholdPercentage: Number(
      settingValue(
        settings,
        ADJUSTMENT_THRESHOLD_KEYS.approvalThresholdPercentage,
        ADJUSTMENT_THRESHOLD_DEFAULTS.approvalThresholdPercentage
      )
    ),
    requireSeparation: Boolean(
      settingValue(
        settings,
        ADJUSTMENT_THRESHOLD_KEYS.requireSeparation,
        ADJUSTMENT_THRESHOLD_DEFAULTS.requireSeparation
      )
    ),
  };
  return {
    requireApproval: raw.requireApproval,
    approvalThresholdValue: Number.isFinite(raw.approvalThresholdValue)
      ? Math.max(0, raw.approvalThresholdValue)
      : ADJUSTMENT_THRESHOLD_DEFAULTS.approvalThresholdValue,
    approvalThresholdPercentage: Number.isFinite(
      raw.approvalThresholdPercentage
    )
      ? Math.max(0, raw.approvalThresholdPercentage)
      : ADJUSTMENT_THRESHOLD_DEFAULTS.approvalThresholdPercentage,
    requireSeparation: raw.requireSeparation,
  };
}