#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse, DEFAULT_POINTS } from "../src/parse.mjs";
import { createClient, importPlan } from "../src/jira.mjs";

const USAGE = `Usage: md2jira <plan.md> [--apply] [--only "<epic title text>"] [--max N] [--config file] [--state file]
Dry run unless --apply. Credentials: JIRA_EMAIL and JIRA_TOKEN (environment or .env).`;

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const file = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
if (!file || args.includes("--help")) {
  console.log(USAGE);
  process.exit(file ? 0 : 1);
}

// .env in the current folder; never overrides variables already set.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file: use the real environment */
}

const configPath = resolve(flag("--config") ?? "md2jira.config.json");
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const settings = {
  site: process.env.JIRA_SITE ?? config.site,
  project: process.env.JIRA_PROJECT ?? config.project,
  epicType: config.epicType ?? "Epic",
  ticketType: config.ticketType ?? "Story",
  points: config.points ?? DEFAULT_POINTS,
};

const only = flag("--only")?.toLowerCase();
const epics = parse(readFileSync(resolve(file), "utf8"), settings.points).filter(
  (e) => !only || e.title.toLowerCase().includes(only),
);
const ticketCount = epics.reduce((n, e) => n + e.tickets.length, 0);
console.log(`Parsed ${epics.length} epics, ${ticketCount} tickets.`);
for (const e of epics) console.log(`  ${e.title}: ${e.tickets.length}`);

if (!args.includes("--apply")) {
  console.log("Dry run only. Add --apply to create them in Jira.");
  process.exit(0);
}

const { JIRA_EMAIL, JIRA_TOKEN } = process.env;
if (!JIRA_EMAIL || !JIRA_TOKEN || !settings.site || !settings.project) {
  console.error("Need JIRA_EMAIL, JIRA_TOKEN, and a site and project (md2jira.config.json or JIRA_SITE / JIRA_PROJECT).");
  process.exit(1);
}

const max = flag("--max") ? Number(flag("--max")) : Infinity;
const made = await importPlan({
  jira: createClient({ site: settings.site, email: JIRA_EMAIL, token: JIRA_TOKEN }),
  epics,
  project: settings.project,
  epicType: settings.epicType,
  ticketType: settings.ticketType,
  statePath: resolve(flag("--state") ?? ".md2jira-state.json"),
  max,
});
console.log(`Created ${made} issues.`);
