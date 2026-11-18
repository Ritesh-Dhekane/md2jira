// Jira Cloud's REST API v3 takes rich text as Atlassian Document Format (ADF), not Markdown.
const paragraph = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content) => ({ type: "doc", version: 1, content });
const bullets = (items) => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [paragraph(i)] })),
});

export const epicDescription = (epic) => doc(paragraph(epic.goal || epic.title));

export function ticketDescription(ticket) {
  const parts = [];
  if (ticket.text) parts.push(paragraph(ticket.text));
  if (ticket.ac.length) parts.push(paragraph("Acceptance criteria"), bullets(ticket.ac));
  return doc(...(parts.length ? parts : [paragraph(ticket.title)]));
}
