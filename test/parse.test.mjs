import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../src/parse.mjs";
import { ticketDescription } from "../src/adf.mjs";

const plan = readFileSync(new URL("../examples/plan.md", import.meta.url), "utf8");

test("parses epics, drops day counts and sections without tickets", () => {
  const epics = parse(plan);
  assert.deepEqual(epics.map((e) => e.title), ["Storefront", "Orders"]);
  assert.equal(epics[0].goal, "visitors can see the menu and find the stand.");
  assert.equal(epics[0].tickets.length, 2);
});

test("maps sizes to story points and keeps acceptance criteria", () => {
  const [menu, map] = parse(plan)[0].tickets;
  assert.deepEqual([menu.title, menu.size, menu.points], ["Menu page", "M", 2]);
  assert.equal(map.points, 1);
  assert.equal(menu.ac.length, 2);
  assert.equal(parse(plan)[1].tickets[0].points, 3);
});

test("a bracket that is not a known size stays in the title", () => {
  const [epic] = parse("## E\n- **Fix login (urgent).** text\n- **Other (XL).** text");
  assert.equal(epic.tickets[0].title, "Fix login (urgent)");
  assert.equal(epic.tickets[0].points, null);
  assert.equal(epic.tickets[1].title, "Other (XL)");
});

test("custom size map is honoured", () => {
  const [epic] = parse("## E\n- **Big thing (XL).** text", { XL: 8 });
  assert.equal(epic.tickets[0].points, 8);
});

test("ticket without description or criteria still gets a description", () => {
  const [epic] = parse("## E\n- **Bare ticket (S).**");
  const d = ticketDescription(epic.tickets[0]);
  assert.equal(d.content[0].content[0].text, "Bare ticket");
});
