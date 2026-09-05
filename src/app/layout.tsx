import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import {
  getDirection,
  isLocale,
  defaultLocale,
  type Locale,
  type Direction,
} from "@/i18n/routing";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { getClientMessages } from "@/i18n/client-messages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function resolveInitialLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const cookie = store.get("NEXT_LOCALE")?.value;
    return isLocale(cookie) ? cookie : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveInitialLocale();
  const messages = getClientMessages(locale);
  const meta = (messages as { common?: { app?: { description?: string } } })
    .common?.app;
  return {
    title: {
      default: APP_NAME,
      template: `%s — ${APP_NAME}`,
    },
    description: meta?.description ?? "CafeRest POS/ERP",
    manifest: "/manifest.json",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await resolveInitialLocale();
  const direction: Direction = getDirection(initialLocale);

  return (
    <html
      lang={initialLocale}
      dir={direction}
      data-direction={direction}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider />
        <LocaleProvider initialLocale={initialLocale}>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
