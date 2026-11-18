# md2jira

Create Jira Cloud epics and tickets from a Markdown plan. No dependencies, Node 22 or newer.

Write your plan once as Markdown, check it with a dry run, then create every epic and ticket in one go,
with acceptance criteria in the description and sizes turned into story points.

## Plan format

See [examples/plan.md](examples/plan.md).

```md
## Storefront (3 days)
Goal: visitors can see the menu.

- **Menu page (M).** Show each drink with a price.
  - AC: every drink has a price.
```

- `## Title` is an epic. A trailing `(N days)` is dropped.
- The first plain line under it is the epic description (`Goal:` is stripped).
- `- **Title (M).** text` is a ticket under that epic. `M` becomes story points when it is a key of `points`.
- `  - AC: …` lines become the "Acceptance criteria" list.
- Sections with no tickets are ignored, and `---` ends the current epic.

## Setup

1. Clone this repo. There is nothing to install.
2. Create an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>
   (**Create API token**, not the scoped variant). Choose a short expiry.
3. In the folder you run it from, create `.env` (it is git-ignored):

   ```
   JIRA_EMAIL=the-email-you-log-into-atlassian-with
   JIRA_TOKEN=the-token
   ```

4. Create `md2jira.config.json` (see [md2jira.config.example.json](md2jira.config.example.json)):
   your site (`your-team.atlassian.net`), the space key, the issue types and the size-to-points map.

## Use

```sh
node bin/md2jira.mjs plan.md                            # dry run: prints what it would create
node bin/md2jira.mjs plan.md --apply --only "Storefront" --max 2   # real test: a couple of issues
node bin/md2jira.mjs plan.md --apply                    # everything
```

| Option | Meaning |
|---|---|
| `--apply` | Actually create the issues. Without it nothing is written. |
| `--only "text"` | Only the epic whose title is, or starts with, the text as whole words (`E1` does not match `E10`). |
| `--fix-points` | Also set story points on tickets created by an earlier run. |
| `--max N` | Stop after creating N issues. |
| `--config file` | Config path (default `md2jira.config.json` in the current folder). |
| `--state file` | Where created keys are remembered (default `.md2jira-state.json`). |

Re-running skips anything already in the state file, so it never creates duplicates. Edits to a ticket that
was already created are not pushed to Jira.

## Notes

- Works with team-managed and company-managed Jira Cloud spaces. Tickets are linked to their epic with the
  `parent` field.
- If the story-points field is not on the space's create screen, points are set right after each ticket is
  created. If Jira refuses that too, tickets are created without points; add the field to the issue layout and
  run again with `--fix-points`.
- The token is only ever read from the environment or `.env`. Keep `.env` out of version control.

## Development

```sh
npm test
```

Work on a `feat/…` branch, open a PR into `dev`, then release with a PR from `dev` into `prod`.

## License

[MIT](LICENSE)
