import { getClientMessages, type MessagesBundle } from "./client-messages";
import type { Locale } from "./routing";

interface MessageRecord {
  [key: string]: unknown;
}

export type { MessageRecord };

/**
 * Load and merge all namespaces for a single locale.
 *
 * Uses the same statically-imported locale bundles as the client provider so
 * that SSR and CSR always see identical messages. Runtime dynamic imports are
 * avoided: Turbopack otherwise resolves them as empty modules in server
 * builds, producing `MISSING_MESSAGE` error logs and fallback key paths.
 */
export function importMessages(locale: Locale): MessagesBundle {
  return getClientMessages(locale);
}
