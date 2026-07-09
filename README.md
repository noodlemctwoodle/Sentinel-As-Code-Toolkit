# Sentinel as Code Toolkit

![VS Code](https://img.shields.io/badge/VS%20Code-1.125+-0078D4?logo=visualstudiocode&logoColor=white) ![Version](https://img.shields.io/badge/version-26.07--1-blue) ![License](https://img.shields.io/badge/license-Apache%202.0-green)

**The dedicated VS Code authoring toolkit for the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) project.**

A complete detection-as-code authoring environment for Microsoft Sentinel and Microsoft Defender XDR content — everything you need to write, validate, and shape repository-ready files without leaving the editor:

- **Author** Sentinel analytics rules and hunting queries as YAML, with real-time validation, IntelliSense, and starter templates.
- **Validate** against the Sentinel and Defender XDR schemas, plus multi-framework MITRE ATT&CK (Enterprise, Mobile, and ICS; v14 to v16).
- **Format** every Sentinel-as-Code content type into canonical shape — analytics rules, hunting queries, and parsers (YAML), and automation rules, summary rules, watchlists, workbooks, and playbooks (JSON).
- **Scaffold** new hunting queries, parsers, summary rules, and automation rules from their documented schemas.
- **Auto-fill** a rule's `requiredDataConnectors` from the KQL tables in its query, using the bundled Content Hub mapping.
- **Build** deployment-ready watchlists from a CSV or TSV.
- **Decompile** single or bulk `Microsoft.SecurityInsights/alertRules` ARM templates into clean YAML.
- **Convert** Microsoft Defender XDR custom detections between repository YAML and deployable Microsoft Graph `detectionRule` JSON, and format portal exports into repository-ready files.
- **Maintain in bulk** — validate and normalise every rule in the workspace, and regenerate rule IDs.

> Feedback and bug reports are welcome on the [issue tracker](https://github.com/noodlemctwoodle/Sentinel-As-Code/issues).

---

## Overview

Sentinel as Code Toolkit turns VS Code into a detection-as-code authoring environment. It understands the Microsoft Sentinel analytics rule schema and the Defender XDR custom detection schema, giving you real-time validation, IntelliSense, formatting, and templates as you write — so the YAML you produce is ready to commit into a Git-based Sentinel deployment such as the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) pipeline.

The toolkit is focused on authoring and repository hygiene. It does **not** deploy content to a tenant; deployment is the job of your pipeline.

> ### Supporting this project
>
> Sentinel as Code Toolkit and the wider [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) project are built and maintained on my own time. If the toolkit saves your team engineering effort — or your organisation relies on it in production — please consider supporting the work. Contributions fund new features, test infrastructure, and keeping the schemas current with Microsoft's release cadence.
>
> Recurring **Organisation** tiers (£125 / £250 / £500 per month), one-off tips at any amount, and annual sponsorships by invoice are all live on [sentinel.blog/support](https://sentinel.blog/support/). All channels are Stripe-backed, all blog content stays free for everyone, and contributions do not create a support contract — see the support page for the full disclaimer.
>
> [![Support sentinel.blog](https://img.shields.io/badge/💛%20Support%20—%20sentinel.blog%2Fsupport-orange?style=for-the-badge&logo=heart&logoColor=white)](https://sentinel.blog/support/)

---

## Requirements

- Visual Studio Code 1.125 or later.
- Familiarity with the Microsoft Sentinel analytics rule schema (KQL, MITRE ATT&CK).

---

## Installation

- **Marketplace** — search for **Sentinel as Code Toolkit** in the Extensions view, or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=noodlemctwoodle.sentinelcodeguard).
- **From VSIX** — obtain the `.vsix`, then run **Extensions: Install from VSIX...** from the Command Palette.

---

## Features

### Sentinel analytics rules

- **Content-based detection** — any `.yaml`/`.yml` file whose contents resemble a Sentinel analytics rule is recognised automatically; no special filename required.
- **Real-time validation** — rule-type-aware checks surface in the Problems panel, on save or as you type.
- **IntelliSense** — completions for Sentinel fields, tactics, techniques, connectors, and enumerations.
- **Formatting** — canonical field ordering, ISO 8601 duration correction, and structure tidy-up (`Shift+Alt+F`).
- **Templates** — Standard and Near-Real-Time (NRT) analytics-rule starting points, plus hunting query, parser, summary rule, automation rule, watchlist, and Defender detection templates. See [Templates](#templates).
- **Multi-framework MITRE ATT&CK** — validate tactics and techniques against the Enterprise, Mobile, and ICS matrices (v14 to v16 selectable).
- **Required-connector auto-fill** — read the KQL tables in a rule's `query` and populate `requiredDataConnectors` from the bundled Content Hub table-to-connector mapping, in canonical order.
- **Bulk maintenance** — validate and normalise every rule in the workspace, and regenerate rule IDs in bulk.

### Hunting queries

- **Folder- and content-aware detection** — files under `Content/HuntingQueries/`, or any `.yaml` shaped like a hunting query, are recognised automatically.
- **Real-time validation** — required-field checks (`id`, `name`, `query`), stable-GUID and MITRE technique validation, and `tags` structure checks surface in the Problems panel.
- **Formatting** — canonical field ordering (`id`, `name`, `description`, `query`, `tactics`, `techniques`, `tags`) matching the documented Log Analytics saved-search schema.

### Other Sentinel-as-Code content

- **Format any repository content** — one command detects the content type from its folder and shape, then applies the correct formatter: analytics rules, hunting queries, and parsers (YAML canonical ordering), and automation rules, summary rules, watchlists, workbooks, and playbooks (JSON pretty-printing with stable key order).
- **Schema-backed validation** — bundled JSON schemas for analytics rules, hunting queries, parsers, summary rules, automation rules, watchlists, and Defender custom detections drive validation and IntelliSense in the matching repository folders.

### Content scaffolding

- **New content scaffolders** — generate starter files for hunting queries, parsers, summary rules, and automation rules from their documented schemas, or pick a type from a single **New Sentinel-as-Code Content...** command.
- **Watchlist from CSV** — turn a CSV/TSV into a deployment-ready `watchlist.json` and data file under `Content/Watchlists/<alias>/`, prompting for the alias, display name, and primary-key column.

### ARM to YAML conversion

- Decompile single or bulk `Microsoft.SecurityInsights/alertRules` ARM templates into clean analytics-rule YAML.
- Configurable file-naming strategies (original filename, display name, or rule ID).
- MITRE correction, entity-mapping validation, and optional auto-formatting during conversion.

### Defender XDR custom detections (repository formatting)

The toolkit **formats and validates** Defender XDR custom detections for a Sentinel-as-Code repository — it does **not** authenticate to a tenant or deploy them. All detections flow through the Sentinel-as-Code CI/CD pipeline.

- **Format an existing export** — turn a portal JSON export (or a Graph response) in the active editor into a repository-ready YAML file using the clean authoring schema, with a suggested PascalCase filename for `Content/DefenderCustomDetections/`.
- **Validate** a detection against the repository authoring schema, flagging runtime/read-only fields that should not be committed.
- **Convert** a detection between repo YAML and the deployable Microsoft Graph `detectionRule` JSON — round-trips cleanly, dropping runtime/read-only fields.

---

## Getting started

### Create and format a rule

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **Sentinel-As-Code: Generate Standard Rule Template** (or pick another template).
3. Edit the rule — validation and IntelliSense guide you as you type.
4. Format with `Shift+Alt+F`, or run **Sentinel-As-Code: Fix Field Order** (`Ctrl+Shift+F` / `Cmd+Shift+F`).

### Decompile an ARM template

1. Right-click a `.json` ARM template, or open it and use the Command Palette.
2. Run **Sentinel-As-Code: Decompile ARM to YAML**.
3. Choose a naming strategy and output location, then review the conversion summary.

### Format a Defender detection for the repo

1. Open a Defender XDR custom detection export (portal JSON, or YAML) in the editor.
2. Run **Defender-As-Code: Format Custom Detection for Repo**.
3. Save the generated YAML under `Content/DefenderCustomDetections/` using the suggested PascalCase filename.

### Format any Sentinel-as-Code content

1. Open a hunting query, parser, automation rule, summary rule, watchlist, workbook, or playbook.
2. Run **Sentinel-As-Code: Format Sentinel Content (Auto-detect)**, or press `Shift+Alt+F`.
3. The toolkit detects the content type and normalises it to the documented schema.

### Build a watchlist from a CSV

1. Open a CSV/TSV of watchlist data (first row = column headers).
2. Run **Sentinel-As-Code: Create Watchlist from CSV** (or right-click the file).
3. Provide the alias, display name, and primary-key column; the toolkit writes a deployment-ready `watchlist.json` + data file under `Content/Watchlists/<alias>/`.

### Auto-fill required data connectors

1. Open an analytics rule that has a `query`.
2. Run **Sentinel-As-Code: Populate Required Data Connectors from Query** (or right-click the file).
3. The toolkit reads the KQL tables, matches them to connectors using the bundled Content Hub table mapping, and writes `requiredDataConnectors` in canonical order — no manual lookup needed.

---

## File conventions

Rules are plain YAML, and the toolkit auto-detects Sentinel rules by content, so any `.yaml`/`.yml` file works. The dedicated `.sentinel.yaml` / `.sentinel.yml` extensions additionally enable the bundled language mode (syntax highlighting, snippets, and schema validation).

```text
detection-rules/
  login-anomalies.yaml            # auto-detected
  data-exfiltration.yml           # auto-detected
  rules/
    privilege-escalation.yaml     # auto-detected
    malware-detection.yaml        # auto-detected
```

---

## Templates

Every template is authored as **commented YAML** so each option is documented inline. When you scaffold one — via **New Sentinel-as-Code Content...**, a per-type command, or **Create Watchlist from CSV** — the toolkit writes it in the format the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) pipeline expects: YAML content is written as-is, and the JSON content types are **converted from YAML to JSON automatically** on generation.

| Template | Content type — repository folder | On-disk format | Pipeline conversion |
|----------|----------------------------------|----------------|---------------------|
| Standard Rule | Analytics rule — `Content/AnalyticalRules/` | YAML | Not required |
| NRT Rule | Analytics rule — `Content/AnalyticalRules/` | YAML | Not required |
| Custom Detection | Defender XDR detection — `Content/DefenderCustomDetections/` | YAML | Not required |
| Hunting Query | Hunting query — `Content/HuntingQueries/` | YAML | Not required |
| Parser | KQL parser/function — `Content/Parsers/` | YAML | Not required |
| Summary Rule | Summary rule — `Content/SummaryRules/` | **JSON** | **Converted to JSON** |
| Automation Rule | Automation rule — `Content/AutomationRules/` | **JSON** | **Converted to JSON** |
| Watchlist | Watchlist metadata — `Content/Watchlists/<alias>/watchlist.json` | **JSON** | **Converted to JSON** |

### Templates converted to JSON for the pipeline

The Sentinel-as-Code pipeline stores analytics rules, hunting queries, parsers, and Defender detections as YAML, but **three** content types must be **JSON** on disk. The toolkit authors these as commented YAML for readability and converts them to JSON automatically when you scaffold them — you commit the generated JSON to the repo. **Exactly these three need converting:**

- **Summary Rule** → `Content/SummaryRules/<name>.json`
- **Automation Rule** → `Content/AutomationRules/<name>.json`
- **Watchlist** → `Content/Watchlists/<alias>/watchlist.json` (plus its `data.csv` / `data.tsv`)

Every other template — Standard Rule, NRT Rule, Custom Detection, Hunting Query, and Parser — is written as YAML and needs no conversion.

---

## Commands

### Sentinel rule commands

| Command | Description |
|---------|-------------|
| Sentinel-As-Code: Generate Rule Template | Interactive picker: Standard, NRT, or Custom Detection |
| Sentinel-As-Code: Generate Standard Rule Template / Generate NRT Rule Template | Create a specific Sentinel rule template |
| Defender-As-Code: Generate Custom Detection Template | Create a Defender custom detection YAML from the template |
| Sentinel-As-Code: Create Sentinel Rule Template... | Create a rule in a chosen folder (Explorer context menu) |
| Sentinel-As-Code: Create Watchlist from CSV | Convert the active CSV/TSV into a deployment-ready watchlist (watchlist.json + data file) |
| Sentinel-As-Code: New Sentinel-as-Code Content... | Pick and scaffold any content type (analytics rule, hunting query, parser, summary rule, automation rule, watchlist) |
| Sentinel-As-Code: New Hunting Query / New Parser / New Summary Rule / New Automation Rule | Scaffold a specific content type from its documented schema |
| Sentinel-As-Code: Populate Required Data Connectors from Query | Match the rule's KQL tables to connectors and fill `requiredDataConnectors` automatically |
| Sentinel-As-Code: Fix Field Order | Reorder fields to the canonical schema order (`Ctrl/Cmd+Shift+F`) |
| Sentinel-As-Code: Format Sentinel Rule | Format and tidy the rule structure |
| Sentinel-As-Code: Format Sentinel Content (Auto-detect) | Detect the content type and format it (analytics rules, hunting queries, and JSON content) |
| Sentinel-As-Code: Generate New Rule ID | Generate a fresh GUID for the current rule |
| Sentinel-As-Code: Generate New IDs for All Rules | Bulk-regenerate rule IDs across the workspace |
| Sentinel-As-Code: Bulk Maintenance & Validation | Validate and normalise every rule in the workspace |
| Sentinel-As-Code: Decompile ARM to YAML | Convert ARM alert-rule templates to YAML |
| Sentinel-As-Code: Validate as Sentinel Analytics Rule | Force Sentinel-rule validation of the active file |
| Sentinel-As-Code: Validate Rule (Auto-detect Type) | Validate the active file, auto-detecting Sentinel vs Defender |

### Defender commands

| Command | Description |
|---------|-------------|
| Defender-As-Code: Format Custom Detection for Repo | Convert the active portal JSON/YAML detection into repo-ready YAML |
| Defender-As-Code: Validate as Custom Detection | Validate the active file against the repository authoring schema |
| Defender-As-Code: Convert Custom Detection YAML to JSON | Reshape repo YAML into deployable Graph detectionRule JSON |
| Defender-As-Code: Convert Custom Detection JSON to YAML | Reshape a Graph detectionRule JSON export into clean repo YAML |

---

## Configuration

All settings live under the `sentinelAsCode.*` namespace (Settings UI section: **Sentinel as Code Toolkit**).

### Validation and editing

| Setting | Default | Description |
|---------|---------|-------------|
| `sentinelAsCode.validation.enabled` | `true` | Enable rule validation |
| `sentinelAsCode.validation.onSave` | `true` | Validate on save |
| `sentinelAsCode.validation.onType` | `false` | Validate while typing |
| `sentinelAsCode.validation.excludePatterns` | `[]` | Glob patterns for files to skip during validation |
| `sentinelAsCode.formatting.enabled` | `true` | Enable formatting |
| `sentinelAsCode.fieldOrdering.enforceOrder` | `true` | Enforce canonical field order |
| `sentinelAsCode.fieldOrdering.showOrderHints` | `true` | Show field-order hints in diagnostics |
| `sentinelAsCode.intellisense.enabled` | `true` | Enable IntelliSense |

### Excluding files from validation

Add glob patterns to `sentinelAsCode.validation.excludePatterns` to skip validation for files such as drafts, test fixtures, templates, or archived rules. Matching files produce no diagnostics and stay out of the Problems panel. Patterns are matched against each file's workspace-relative and absolute path (and its filename), support `*`, `**`, `?`, and `{a,b}` alternation, and are case-insensitive on Windows.

```json
{
  "sentinelAsCode.validation.excludePatterns": [
    "**/test/**",
    "**/tests/**",
    "**/*.draft.yaml",
    "**/*.template.yaml",
    "**/backup/**",
    "**/.archive/**"
  ]
}
```

Exclusions are additive: with no patterns configured (the default), every candidate file is validated as before.

### MITRE ATT&CK

| Setting | Default | Description |
|---------|---------|-------------|
| `sentinelAsCode.mitre.version` | `"v16"` | ATT&CK version (`v16`, `v15`, `v14`) |
| `sentinelAsCode.mitre.frameworks` | `["enterprise","mobile","ics"]` | Frameworks to load and validate against |
| `sentinelAsCode.mitre.allowUnknownTactics` | `true` | Allow tactics not in the loaded data (info only) |
| `sentinelAsCode.mitre.allowUnknownTechniques` | `true` | Allow techniques not in the loaded data (info only) |
| `sentinelAsCode.mitre.strictValidation` | `false` | Treat unknown tactics/techniques as errors |

### Connectors

| Setting | Default | Description |
|---------|---------|-------------|
| `sentinelAsCode.connectors.validationMode` | `"permissive"` | `strict`, `workspace`, or `permissive` |
| `sentinelAsCode.connectors.customConnectors` | `[]` | Additional connector IDs to recognise |

### Conversion settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sentinelAsCode.conversion.enabled` | `true` | Enable ARM-to-YAML conversion |
| `sentinelAsCode.conversion.defaultNamingStrategy` | `"displayName"` | `original`, `displayName`, or `ruleId` |
| `sentinelAsCode.conversion.validateMitreOnConversion` | `true` | Validate and correct MITRE data during conversion |
| `sentinelAsCode.conversion.autoFormatAfterConversion` | `true` | Format converted files automatically |
| `sentinelAsCode.conversion.showConversionSummary` | `true` | Show a summary dialog after conversion |
| `sentinelAsCode.conversion.outputDirectory` | `""` | Output folder (empty = alongside the source) |
| `sentinelAsCode.conversion.preserveQueryFormatting` | `true` | Preserve original KQL formatting |
| `sentinelAsCode.conversion.includeOptionalFields` | `true` | Include optional fields with default values |
| `sentinelAsCode.conversion.validateEntityMappings` | `true` | Validate entity types and identifiers |
| `sentinelAsCode.conversion.defaultVersion` | `"1.0.0"` | Version for rules missing `templateVersion` |

Example `settings.json`:

```json
{
  "sentinelAsCode.validation.onType": true,
  "sentinelAsCode.mitre.frameworks": ["enterprise", "mobile"],
  "sentinelAsCode.conversion.defaultNamingStrategy": "displayName"
}
```

---

## The Sentinel-as-Code project

This extension is the authoring companion to [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code), an end-to-end CI/CD solution for deploying Microsoft Sentinel and Defender XDR content from a single Git repository. Author and validate content here; let the pipeline deploy it.

- Defender custom-detection schema and conventions: [Docs/Content/Defender-Custom-Detections.md](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Content/Defender-Custom-Detections.md)
- Repository documentation index: [Docs](https://github.com/noodlemctwoodle/Sentinel-As-Code/tree/main/Docs)

---

## Resources

- [Microsoft Sentinel documentation](https://learn.microsoft.com/azure/sentinel/)
- [MITRE ATT&CK](https://attack.mitre.org/)
- [Kusto Query Language reference](https://learn.microsoft.com/kusto/query/)
- Issues and feature requests: [GitHub](https://github.com/noodlemctwoodle/Sentinel-As-Code/issues)

---

## Support the project

If you find Sentinel as Code Toolkit useful, subscribe to [sentinel.blog](https://sentinel.blog) for more Microsoft Sentinel and security content.

[![Subscribe to Sentinel Blog](https://img.shields.io/badge/Subscribe-sentinel.blog-blue?style=for-the-badge&logo=ghost&logoColor=white)](https://sentinel.blog/#/portal/signup)

The best way to support this work is by subscribing to the blog, reporting issues, and suggesting improvements. If you are using the toolkit in an organisation, see the [donation callout under Overview](#overview).

---

## License

The extension is released under the [Apache License 2.0](LICENSE.txt), matching the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) repository it targets. See [NOTICE](NOTICE) for copyright and third-party attribution. Releases up to and including `26.7.1` were published under the MIT License and remain available under those terms; Apache-2.0 applies from the next release onward.

---

Created by TobyG. Visit [sentinel.blog](https://sentinel.blog) for Microsoft Sentinel resources, tutorials, and insights.
