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
export async function importPlan({ jira, epics, project, epicType, ticketType, statePath, max = Infinity, fixPoints = false, log = console.log }) {
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

  const { issueTypes } = await jira(`/project/${project}`);
  const names = issueTypes.map((t) => t.name);
  const epicName = names.find((n) => n.toLowerCase() === epicType.toLowerCase());
  const ticketName = names.find((n) => n.toLowerCase() === ticketType.toLowerCase());
  if (!epicName || !ticketName) throw new Error(`Issue types "${epicType}" and "${ticketType}" needed; space has: ${names.join(", ")}`);

  const fields = await jira("/field");
  const pointsField = fields.find((f) => /^story point/i.test(f.name));
  // "create": send points with the new issue. "edit": the create screen lacks the field, so set it
  // right after creating. "none": the field cannot be set at all.
  let mode = pointsField ? "create" : "none";
  log(`Types: ${epicName} / ${ticketName}. Points field: ${pointsField ? `${pointsField.name} (${pointsField.id})` : "not found, points skipped"}`);

  const isFieldError = (err) => pointsField && String(err.message).includes(pointsField.id);

  async function setPoints(key, points) {
    if (points == null || mode === "none") return;
    try {
      await jira(`/issue/${key}`, { method: "PUT", body: JSON.stringify({ fields: { [pointsField.id]: points } }) });
      if (mode === "create") mode = "edit";
    } catch (err) {
      if (!isFieldError(err)) throw err;
      mode = "none";
      log(`! "${pointsField.name}" can be set neither on create nor on edit: add it to the issue layout, then run again with --fix-points.`);
    }
  }

  async function create(extra, points) {
    const fieldsBody = { project: { key: project }, ...extra };
    const inline = points != null && mode === "create";
    if (inline) fieldsBody[pointsField.id] = points;
    let issue;
    try {
      issue = await jira("/issue", { method: "POST", body: JSON.stringify({ fields: fieldsBody }) });
    } catch (err) {
      if (!inline || !isFieldError(err)) throw err;
      log(`  (create screen lacks "${pointsField.name}": setting points after creating)`);
      mode = "edit";
      return create(extra, points);
    }
    if (points != null && !inline) await setPoints(issue.key, points);
    return issue;
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
      if (state[id]) {
        if (fixPoints) await setPoints(state[id], t.points);
        continue;
      }
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
