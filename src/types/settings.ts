import type { SettingGroup, SettingType } from "@/types/database";

/** Normalized setting value as consumed by the frontend. */
export type TypedSettingValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[];

/** A fully typed setting entry returned by the settings service. */
export interface SettingEntry {
  key: string;
  value: string | null;
  type: SettingType;
  group: SettingGroup;
  description?: string | null;
  isPublic: boolean;
}

/** A parsed (typed) setting value by key. */
export type SettingsMap = Record<string, TypedSettingValue>;

export interface UpsertSettingInput {
  key: string;
  value: string | null;
  type?: SettingType;
  group?: SettingGroup;
  description?: string | null;
  isPublic?: boolean;
}
