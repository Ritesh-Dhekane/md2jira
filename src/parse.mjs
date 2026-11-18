export const DEFAULT_POINTS = { S: 1, M: 2, L: 3 };

/**
 * Turns a Markdown plan into epics and tickets.
 *
 *   ## Epic title (3 days)          -> epic ("(N days)" is dropped)
 *   Goal: one line                  -> epic description
 *   - **Ticket title (M).** text    -> ticket; "(M)" is a size if it is a key of `points`
 *     - AC: a criterion             -> bullet under "Acceptance criteria"
 *
 * Sections without tickets (summaries, risks) are ignored. `---` ends the current epic.
 */
export function parse(md, points = DEFAULT_POINTS) {
  const epics = [];
  let epic = null;
  let ticket = null;

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();

    const heading = line.match(/^## (.+)$/);
    if (heading) {
      epic = { title: heading[1].replace(/\s*\(\d+ days?\)$/, "").trim(), goal: "", tickets: [] };
      epics.push(epic);
      ticket = null;
      continue;
    }
    if (!epic) continue;
    if (line === "---") {
      epic = null;
      ticket = null;
      continue;
    }

    const bullet = line.match(/^- \*\*(.+?)\.\*\* ?(.*)$/);
    if (bullet) {
      const sized = bullet[1].match(/^(.*\S) \(([^)]+)\)$/);
      const hasSize = sized && Object.hasOwn(points, sized[2]);
      ticket = {
        title: hasSize ? sized[1] : bullet[1],
        size: hasSize ? sized[2] : null,
        points: hasSize ? points[sized[2]] : null,
        text: bullet[2],
        ac: [],
      };
      epic.tickets.push(ticket);
      continue;
    }

    const criterion = line.match(/^\s+- AC: (.+)/);
    if (criterion && ticket) {
      ticket.ac.push(criterion[1]);
    } else if (line && !ticket && !epic.goal && !line.startsWith("-")) {
      epic.goal = line.replace(/^Goal: /, "");
    }
  }

  return epics.filter((e) => e.tickets.length > 0);
}
