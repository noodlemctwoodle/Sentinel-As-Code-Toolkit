# Changelog

All notable changes to the Sentinel as Code Toolkit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases prior to 26.7.2 are listed on the
[GitHub Releases](https://github.com/noodlemctwoodle/Sentinel-As-Code-Toolkit/releases) page.

## [Unreleased]

### Changed

- `validation.onType` now defaults to on, matching how validation already behaved.

### Fixed

- Connector problems are reported again. Unknown connectors in strict or workspace
  mode, deprecated connectors, and tables a connector does not provide were never
  shown, because the validator could not find the line of a list item. Each
  unavailable table is now reported once, as a warning on its own line, and only for
  connectors whose tables are known.
- Unknown tactics and techniques now show the information message that
  `mitre.allowUnknownTactics` and `mitre.allowUnknownTechniques` describe.
  Information-level diagnostics, including field-order hints, were previously
  discarded. `fieldOrdering.showOrderHints` now hides the field-order hints.
- Field-order hints only consider top-level keys, so nested keys such as
  `incidentConfiguration.groupingConfiguration.enabled` no longer produce false hints.
- Turning off `validation.enabled` now stops analytics rule validation, not just
  hunting query validation.
- `validation.onType` and `validation.onSave` now control when validation runs, and
  changing any Sentinel-as-Code setting revalidates open files.
- **Validate Rule** reports a pass when a rule has no errors or warnings, instead of a
  warning reading "found 0 error(s) and 0 warning(s)".
- Only a file's own name decides whether it is treated as a Sentinel rule by name, so
  a folder with "sentinel" in its path no longer pulls in unrelated YAML files.
- **Format Content** no longer fails on summary rules, automation rules, and
  watchlists authored in YAML. It explains that the YAML is not reformatted and points
  to **Convert Content YAML to JSON**.
- **Format Content** no longer reformats unrelated JSON files and reports
  "Formatted Unknown".
- `formatting.enabled` now turns off Format Document for Sentinel content, and
  `fieldOrdering.enforceOrder` set to off keeps the existing field order when
  formatting rules.

## [26.10.1] - 2026-10-08

### Fixed

- Locally packaged builds no longer include leftover files from earlier
  builds. The webpack output folder is now emptied before each build, so a
  stale, unused `dist/401.extension.js` chunk and an outdated
  `extension.js.LICENSE.txt` no longer end up in the VSIX. Builds from CI
  were not affected because they start from a clean checkout.

### Security

- Data connector hover text is no longer rendered as trusted markdown.
  Connector details can come from a `.sentinel-connectors.json` file in the
  workspace, so that text is now treated as untrusted content.
- Removed the separate weekly connector refresh workflow, which pushed
  regenerated data straight to the default branch. Connector data is still
  refreshed weekly by the data job in `build.yaml`, which opens a pull
  request for review.
- The release workflow now passes inputs and job outputs to its shell
  scripts through environment variables instead of inlining them.
- Removed `tmp`, an unused runtime dependency.

## [26.10.0] - 2026-10-08

### Changed

- The minimum supported VS Code version is now 1.134 (`engines.vscode`
  raised from `^1.125.0`), so the extension API typings can track current
  VS Code releases.
- Development toolchain updates: `@vscode/vsce` 4.x (requires Node.js 22 or
  later), `@vscode/test-electron` 3.1, ESLint 10.11, Mocha 11.8, webpack
  5.111, webpack-cli 7.2.3, typescript-eslint 8.71, and `@types/node` 26.6.
- CI now validates on Node.js 22 and 24. Node.js 20 was dropped from the
  matrix because it reached end of life and the packaging tool no longer
  supports it. `actions/setup-node` moved to v7 and
  `softprops/action-gh-release` to v3.0.2.

### Fixed

- **Convert ARM to YAML** now writes MITRE technique IDs under the canonical
  `relevantTechniques` key instead of the deprecated `techniques` alias,
  matching the Sentinel-As-Code documentation, the Azure-Sentinel query style
  guide, and every analytics rule in the Sentinel-As-Code content library.
  Sub-technique IDs from the ARM `subTechniques` property are now folded into
  the same list (for example `T1078.004` rather than a bare `T1078`), so
  they are no longer dropped on conversion.
  (noodlemctwoodle/Sentinel-As-Code#51)

### Security

- Resolved all open Dependabot alerts. Runtime: `js-yaml` 4.3.2 (two high
  severity advisories). Development only: `undici` 7.30, `fast-uri` 3.1.8,
  `browserslist` 4.29, `baseline-browser-mapping` 2.11, and the `braces`
  advisory reachable through `@vscode/vsce` 3.x. `npm audit` reports no
  remaining vulnerabilities.
- Reviewed the codebase with Mythos 5.1 code scanning, covering
  dependencies, YAML and JSON parsing, file writes, regular expressions,
  committed secrets, and the GitHub Actions workflows. No dependency
  vulnerabilities or committed secrets were found. A small number of
  hardening items were identified and will be addressed in a follow-up
  release.

## [26.7.3] - 2026-07-10

### Added

- MITRE ATT&CK IntelliSense and hover now work across every content type that
  carries MITRE metadata: analytics rules and NRT rules (`relevantTechniques`),
  hunting queries (`techniques`), and Defender custom detections
  (`mitreTechniques`), plus files opened under the custom `sentinel-rule`
  language (`.sentinel.yaml` / `.sentinel.yml`).
- New **Convert Content JSON to YAML** command
  (`sentinelAsCode.convertContentToYaml`) — the inverse of **Convert Content
  YAML to JSON**. Converts a summary rule, automation rule, or watchlist
  authored in JSON to readable YAML next to the source file. Available from the
  command palette and the editor/explorer right-click menus on `.json` files.
- Value IntelliSense now covers `severity` and the ISO 8601 duration fields
  `queryFrequency`, `queryPeriod`, and `suppressionDuration`. Severity is
  content-type aware (capitalised `High`/`Medium`/`Low`/`Informational` for
  Sentinel rules, lowercase for Defender custom detections), and the duration
  fields suggest common values with human-readable labels (for example `PT5H`
  shown as 5 hours); `suppressionDuration` is capped at 24 hours.

### Changed

- Streamlined the command palette to a single **New Sentinel-as-Code
  Content...** entry for scaffolding. The overlapping **Generate Rule Template**
  picker and the individual **New Hunting Query**, **New Parser**, **New Summary
  Rule**, **New Automation Rule**, and **Generate Custom Detection Template**
  entries are now hidden from the palette; the commands remain registered so
  **New Sentinel-as-Code Content...**, context menus, and keybindings keep
  working.

### Fixed

- Technique completion now recognises the `relevantTechniques` and
  `mitreTechniques` fields (previously only `techniques` matched) and no longer
  stops after the first 50 techniques, so all techniques and sub-techniques are
  suggested.
- Analytics-rule validation and hunting-query diagnostics now run on
  `.sentinel.yaml` files (the `sentinel-rule` language), matching the behaviour
  of plain `.yaml` files.
- The scaffolded default `severity` is now `Medium` (was incorrectly `Low` due
  to an off-by-one index into `VALID_SEVERITIES`), matching the documented
  intent and the ARM-to-YAML converter's fallback.

## [26.7.2] - 2026-07-10

### Fixed

- The extension icon no longer appears broken on the Visual Studio Marketplace
  listing (corrected the `repository` URL and used an absolute README image URL).

### Changed

- Releases now publish as stable by default; removed the automatic beta flagging
  from the release workflow.
