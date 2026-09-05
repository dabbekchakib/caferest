// Loads .env.local, validates the migration-related keys, and runs the
// Supabase CLI with those variables set. Usage:
//   node scripts/supabase-cli.mjs <cmd...>          e.g. node scripts/supabase-cli.mjs db push
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(root, ".env.local");
const cliVersion = "latest";

const vars = { ...process.env };

if (existsSync(envFile)) {
  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^SUPABASE_/.test(key)) vars[key] = value;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/supabase-cli.mjs <supabase args...>");
  process.exit(1);
}

const needsProjectRef =
  args.includes("link") ||
  args.includes("push") ||
  args.includes("reset") ||
  args.includes("status") ||
  args.includes("pull");
const needsToken =
  args.includes("link") ||
  args.includes("push") ||
  args.includes("reset") ||
  args.includes("pull");
const needsDbPassword = args.includes("push") || args.includes("reset");

if (needsToken && !vars.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "✖ SUPABASE_ACCESS_TOKEN is missing. Create one in Supabase Dashboard → Account → Access Tokens and add it to .env.local"
  );
  process.exit(1);
}
if (needsProjectRef && !vars.SUPABASE_PROJECT_REF) {
  console.error(
    "✖ SUPABASE_PROJECT_REF is missing. Set it in .env.local (the subdomain of your project URL)."
  );
  process.exit(1);
}
if (needsDbPassword && !vars.SUPABASE_DATABASE_PASSWORD) {
  console.error(
    "✖ SUPABASE_DATABASE_PASSWORD is missing. Set the PostgreSQL 'postgres' role password in .env.local."
  );
  process.exit(1);
}

// Non-interactive: pass --password when available so we don't depend on a TTY prompt.
if (
  args[0] === "link" &&
  !args.includes("--password") &&
  !args.some((a) => a === "-p") &&
  vars.SUPABASE_DATABASE_PASSWORD
) {
  args.push("--password", vars.SUPABASE_DATABASE_PASSWORD);
}

// link requires the project ref as a flag/arg; inject it from the env.
if (
  args[0] === "link" &&
  vars.SUPABASE_PROJECT_REF &&
  !args.includes("--project-ref")
) {
  args.push("--project-ref", vars.SUPABASE_PROJECT_REF);
}

const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
const r = spawnSync(cmd, ["--yes", `supabase@${cliVersion}`, ...args], {
  cwd: root,
  stdio: "inherit",
  env: vars,
  shell: true,
});

process.exit(r.status ?? 1);
