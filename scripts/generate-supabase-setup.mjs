import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../", import.meta.url);
const migrationsDirectory = new URL("supabase/migrations/", projectRoot);
const filenames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

if (!filenames.length) throw new Error("No database migrations found.");

const migrations = await Promise.all(
  filenames.map(async (name) => {
    const sql = await readFile(new URL(name, migrationsDirectory), "utf8");
    return `-- Migration: ${name}\n${sql.trim()}\n`;
  }),
);

const output = new URL("supabase/setup.sql", projectRoot);
await writeFile(
  output,
  `-- GENERATED: run npm run db:bundle to rebuild from supabase/migrations.\n` +
    `-- Fresh Supabase project setup using the dashboard SQL Editor.\n` +
    `-- Run the ENTIRE file once, as the project's database administrator.\n` +
    `-- This installs the full schema; it does not create an Auth user or password.\n` +
    `-- Use either this setup file OR CLI db push for initial provisioning.\n` +
    `-- If this file is used, see docs/DEPLOYMENT.md before future CLI migrations.\n\n` +
    `begin;\n\n` +
    `do $$\nbegin\n` +
    `  if to_regclass('public.profiles') is not null or to_regclass('public.workspaces') is not null then\n` +
    `    raise exception 'Application tables already exist. Do not rerun fresh setup; inspect migration history instead.';\n` +
    `  end if;\nend $$;\n\n` +
    migrations.join("\n") +
    `\ncommit;\n\n` +
    `-- After this succeeds, create your Auth user and provision its profiles row\n` +
    `-- using the administrator instructions in docs/DEPLOYMENT.md.\n`,
);
console.log(`Bundled ${filenames.length} migrations into ${fileURLToPath(output)}.`);
