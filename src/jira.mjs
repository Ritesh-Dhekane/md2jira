import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { epicDescription, ticketDescription } from "./adf.mjs";

export function createClient({ site, email, token }) {
  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  return async function jira(path, init = {}) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(`https://${site}/rest/api/3${path}`, {
        ...init,
        headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body.errors ?? body.errorMessages ?? body)}`);
      return body;
    }
    throw new Error(`Jira kept failing on ${path}`);
  };
}

/**
 * Creates the epics and their tickets. Anything already in the state file is skipped,
 * so a re-run (or a run after `--max`) never creates duplicates.
 */
export async function importPlan({ jira, epics, project, epicType, ticketType, statePath, max = Infinity, log = console.log }) {
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

  const { issueTypes } = await jira(`/project/${project}`);
  const names = issueTypes.map((t) => t.name);
  const epicName = names.find((n) => n.toLowerCase() === epicType.toLowerCase());
  const ticketName = names.find((n) => n.toLowerCase() === ticketType.toLowerCase());
  if (!epicName || !ticketName) throw new Error(`Issue types "${epicType}" and "${ticketType}" needed; space has: ${names.join(", ")}`);

  const fields = await jira("/field");
  const pointsField = fields.find((f) => /^story point/i.test(f.name));
  let usePoints = Boolean(pointsField);
  log(`Types: ${epicName} / ${ticketName}. Points field: ${pointsField ? `${pointsField.name} (${pointsField.id})` : "not found, points skipped"}`);

  async function create(extra, points) {
    const fieldsBody = { project: { key: project }, ...extra };
    if (points != null && usePoints) fieldsBody[pointsField.id] = points;
    try {
      return await jira("/issue", { method: "POST", body: JSON.stringify({ fields: fieldsBody }) });
    } catch (err) {
      if (points != null && usePoints && String(err.message).includes(pointsField.id)) {
        log(`! "${pointsField.name}" is not on the create screen: creating without points. Add it to the screen and set points later.`);
        usePoints = false;
        return create(extra, null);
      }
      throw err;
    }
  }

  let made = 0;
  for (const epic of epics) {
    let epicKey = state[epic.title];
    if (!epicKey) {
      if (made >= max) break;
      const r = await create({ issuetype: { name: epicName }, summary: epic.title, description: epicDescription(epic) });
      epicKey = state[epic.title] = r.key;
      save();
      made++;
      log(`${r.key} ${epic.title}`);
    }
    for (const t of epic.tickets) {
      const id = `${epic.title}/${t.title}`;
      if (state[id]) continue;
      if (made >= max) return made;
      const r = await create(
        { issuetype: { name: ticketName }, summary: t.title, parent: { key: epicKey }, description: ticketDescription(t) },
        t.points,
      );
      state[id] = r.key;
      save();
      made++;
      log(`  ${r.key} ${t.title}${t.points != null ? ` [${t.points} pt]` : ""}`);
    }
  }
  return made;
}
