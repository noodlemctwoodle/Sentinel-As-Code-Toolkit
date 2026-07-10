# Changelog

All notable changes to the Sentinel as Code Toolkit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases prior to 26.7.2 are listed on the
[GitHub Releases](https://github.com/noodlemctwoodle/Sentinel-As-Code-Toolkit/releases) page.

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
