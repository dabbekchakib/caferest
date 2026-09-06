import type { Metadata } from "next";
import path from "node:path";
import fs from "node:fs";
import { requirePagePermission, requireAnyPermission } from "@/services/authorization";
import { SystemTestView } from "@/features/system-test/system-test-view";
import { navSections } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Test système",
};

interface KnownModule {
  route: string;
  module: string;
}

const KNOWN_MODULES: KnownModule[] = [
  { route: "/dashboard", module: "Dashboard" },
  { route: "/pos", module: "POS" },
  { route: "/orders", module: "Commandes" },
  { route: "/products", module: "Produits" },
  { route: "/categories", module: "Catégories" },
  { route: "/ingredients", module: "Ingrédients" },
  { route: "/recipes", module: "Recettes" },
  { route: "/units", module: "Unités" },
  { route: "/unit-conversions", module: "Conversions" },
  { route: "/suppliers", module: "Fournisseurs" },
  { route: "/purchase-orders", module: "Bons de commande" },
  { route: "/receipts", module: "Réceptions" },
  { route: "/stocktakes", module: "Inventaire" },
  { route: "/stock-adjustments", module: "Pertes & ajustements" },
  { route: "/tables", module: "Tables" },
  { route: "/floor-plan", module: "Floor Plan" },
  { route: "/dining-areas", module: "Espaces" },
  { route: "/users", module: "Utilisateurs" },
  { route: "/roles", module: "Rôles" },
  { route: "/settings", module: "Configuration" },
  { route: "/style-guide", module: "Style Guide" },
  { route: "/ui-test", module: "UI Test" },
  { route: "/system-test", module: "Test système" },
];

/**
 * Collects the real routes of the (dashboard) route-group from the filesystem.
 * Dynamic segments ([id]) are normalised to ':id' so both static and dynamic
 * pages can be matched against the known modules.
 */
function collectRoutes(rootDir: string): string[] {
  const routes: string[] = [];
  const dir = path.join(rootDir, "src", "app", "(dashboard)");
  function walk(dirName: string, segments: string[]) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirName, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "page.tsx") {
        routes.push("/" + (segments.length ? segments.join("/") : ""));
      } else if (entry.isDirectory()) {
        const seg = entry.name.startsWith("[")
          ? `:${entry.name.slice(1, -1)}`
          : entry.name;
        walk(path.join(dirName, entry.name), [...segments, seg]);
      }
    }
  }
  walk(dir, []);
  return routes;
}

/** True when `route` matches an existing route, including dynamic segments. */
function matches(existing: string[], route: string): boolean {
  const normalize = (r: string) =>
    r.replace(/:[^/]+/g, "[x]");
  const want = normalize(route);
  return existing.some((r) => normalize(r) === want);
}

export default async function SystemTestPage() {
  await requirePagePermission("settings.view");
  await requireAnyPermission(["roles.view", "users.view", "settings.view"]);

  const existing = collectRoutes(process.cwd());
  const rows = KNOWN_MODULES.map(({ route, module }) => ({
    route,
    module,
    ok: matches(existing, route),
  }));

  const registered = new Set(
    navSections.map((s) => s.items).flat().map((i) => i.href)
  );

  return <SystemTestView rows={rows} registered={registered} />;
}
