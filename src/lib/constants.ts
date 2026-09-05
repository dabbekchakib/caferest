export const APP_NAME = "CafeRest";
export const APP_VERSION = "0.1.0";
export const APP_DESCRIPTION = "POS/ERP application for cafes and restaurants";

export const ENVIRONMENT = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
} as const;

export const DEFAULT_LOCALE = "fr" as const;
export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
