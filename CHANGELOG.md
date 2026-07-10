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

### Fixed

- Technique completion now recognises the `relevantTechniques` and
  `mitreTechniques` fields (previously only `techniques` matched) and no longer
  stops after the first 50 techniques, so all techniques and sub-techniques are
  suggested.
- Analytics-rule validation and hunting-query diagnostics now run on
  `.sentinel.yaml` files (the `sentinel-rule` language), matching the behaviour
  of plain `.yaml` files.

## [26.7.2] - 2026-07-10

### Fixed

- The extension icon no longer appears broken on the Visual Studio Marketplace
  listing (corrected the `repository` URL and used an absolute README image URL).

### Changed

- Releases now publish as stable by default; removed the automatic beta flagging
  from the release workflow.
