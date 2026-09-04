export const config = {
  name: "CafeRest",
  version: "0.1.0",
  description: "POS/ERP application for cafes and restaurants",
  url: "https://caferest.app",
  environment: process.env.NODE_ENV ?? "development",
  defaultLocale: "fr" as const,
} as const;
