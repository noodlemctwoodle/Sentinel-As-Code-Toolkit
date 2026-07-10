<!--
Thanks for contributing to the Sentinel as Code Toolkit. Fill in the
sections below. Empty sections and unchecked boxes are fine - replace the
placeholder text with your own, and remove sections that do not apply.

Conventions:
  - en-GB spelling (analyse, behaviour, customise, normalise, prioritise)
  - No em-dashes in new prose; use hyphens or parenthetical phrasing
  - No emoji in PR titles, descriptions, or commit messages
  - No AI / LLM references and no Co-Authored-By trailers in commits or PRs
-->

## Summary

<!--
One or two paragraphs: what does this PR do, and why?

If it adds or changes a command, provider, validator, formatter, schema,
or bundled data (connectors / MITRE), name the authoring scenario it
serves.
-->

## Type of change

<!-- Check all that apply -->

- [ ] feat - new capability
- [ ] fix - bug fix
- [ ] refactor - restructure without behavioural change
- [ ] perf - measurable performance improvement
- [ ] docs - documentation only
- [ ] test - test additions or changes
- [ ] chore - dependency bump, version pin, file rename
- [ ] ci - workflow / pipeline change
- [ ] build - bundling / packaging change

## Files changed (high level)

<!--
Bullet list of the meaningful changes, grouped logically. Describe intent
rather than pasting a `git diff --stat`.

Example:
- src/commands/content/contentCommands.ts - add inline custom _CL registration
- schemas/sentinel-analytics-rule-schema.json - allow a new optional field
- README.md - document the new command
-->

## Pre-merge checklist

<!--
The PR Validation Gate runs these automatically; tick them when you have
confirmed locally so reviewers know what was run.
-->

- [ ] **Compiles** cleanly (`npm run compile`)
- [ ] **Lint** passes (`npm run lint:check`)
- [ ] **Tests** pass (`npm test` - headless VS Code integration tests)
- [ ] **Packages** cleanly (`npm run package`)
- [ ] **Schemas / templates** updated if a content type changed
- [ ] **Bundled data** regenerated if the connector source changed (`node scripts/extract-connectors.mjs`)
- [ ] **No secrets** in committed files (tokens, connection strings, workspace IDs)
- [ ] **Commit messages** follow conventional-commit format (`type(scope): subject` plus a detailed body)
- [ ] **Documentation** (README) updated if user-visible behaviour changed

## Testing

<!--
How did you confirm the change works? Which commands did you exercise in
the Extension Development Host, and against what sample content?
-->

## Required status check

<!--
Main branch protection requires the PR Validation Gate to pass. It runs
automatically when you open the PR and should not be skipped without
explicit reviewer agreement.
-->

- `pr-validation` - aggregation gate over `validate` (compile, webpack, lint, VS Code tests, and package across the Node 20.x / 22.x matrix)

## Related

<!--
Issues this PR closes (Fixes #N), companion PRs, or supporting docs.
-->

---

<!--
Reminder: on squash-and-merge, GitHub uses the PR title as the squashed
commit message, so make the title follow conventional-commit format too:

  feat(connectors): register custom _CL tables from a query

  fix(validation): skip scaffolding templates in the live validator

  ci(pr-validation): add the PR Validation Gate
-->
