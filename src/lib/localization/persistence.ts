import { getDirection, type Direction, type Locale } from "@/i18n/routing";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Number of days the locale cookie should live. */
const DAYS = 365;

export function readLocaleCookie(): Locale | undefined {
  const value = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return value ? (value as Locale) : undefined;
}

export function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${DAYS * 24 * 60 * 60}; samesite=lax`;
}

export function clearLocaleCookie(): void {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Apply the writing direction and language to the <html> element. */
export function applyHtmlDirection(locale: Locale): void {
  const dir: Direction = getDirection(locale);
  const html = document.documentElement;
  html.lang = locale;
  html.dir = dir;
  html.dataset.direction = dir;
}
