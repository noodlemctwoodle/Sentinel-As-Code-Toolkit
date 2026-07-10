# Sentinel as Code Toolkit

<p align="center">
  <img src="https://raw.githubusercontent.com/noodlemctwoodle/Sentinel-As-Code-Toolkit/main/images/icon.png" alt="Sentinel-As-Code" width="512" />
</p>



![VS Code](https://img.shields.io/badge/VS%20Code-1.125+-0078D4?logo=visualstudiocode&logoColor=white) ![Version](https://img.shields.io/badge/version-26.07--2-blue) ![License](https://img.shields.io/badge/license-Apache%202.0-green)

**The dedicated VS Code authoring toolkit for the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) project.**

A complete detection-as-code authoring environment for Microsoft Sentinel and Microsoft Defender XDR content — everything you need to write, validate, and shape repository-ready files without leaving the editor:

- **Author** Sentinel analytics rules and hunting queries as YAML, with real-time validation, IntelliSense, and starter templates.
- **Validate** against the Sentinel and Defender XDR schemas, plus multi-framework MITRE ATT&CK (Enterprise, Mobile, and ICS; v14 to v16).
- **Format** every Sentinel-as-Code content type into canonical shape — analytics rules, hunting queries, and parsers (YAML), and automation rules, summary rules, watchlists, workbooks, and playbooks (JSON).
- **Scaffold** new content — analytics rules, hunting queries, parsers, summary rules, automation rules, and watchlists — as commented YAML, choosing where each file is saved.
- **Auto-fill** a rule's `requiredDataConnectors` from the KQL tables in its query, using the bundled Content Hub mapping — and register your own custom `_CL` tables in a workspace `.sentinel-connectors.json` when they aren't in the catalogue.
- **Build** watchlists from a CSV or TSV — a `watchlist.yaml` metadata file plus its data file.
- **Decompile** single or bulk `Microsoft.SecurityInsights/alertRules` ARM templates into clean YAML.
- **Convert** an authored content YAML to the JSON the pipeline stores — summary rules, automation rules, and watchlists — with a single command.
- **Convert** Microsoft Defender XDR custom detections between repository YAML and deployable Microsoft Graph `detectionRule` JSON, and format portal exports into repository-ready files.
- **Maintain in bulk** — validate and normalise every rule in the workspace, and regenerate rule IDs.

> Feedback and bug reports are welcome on the [issue tracker](https://github.com/noodlemctwoodle/Sentinel-As-Code/issues).

---

## Overview

Sentinel as Code Toolkit turns VS Code into a detection-as-code authoring environment. It understands the Microsoft Sentinel analytics rule schema and the Defender XDR custom detection schema, giving you real-time validation, IntelliSense, formatting, and templates as you write — so the YAML you produce is ready to commit into a Git-based Sentinel deployment such as the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) pipeline.

The toolkit is focused on authoring and repository hygiene. It **authors and validates content; it does not deploy it**. Deployment to a tenant is the job of your pipeline.

> ### Supporting this project
>
> Sentinel as Code Toolkit and the wider [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) project are built and maintained on my own time. If the toolkit saves your team engineering effort — or your organisation relies on it in production — please consider supporting the work. Contributions fund new features, test infrastructure, and keeping the schemas current with Microsoft's release cadence.
>
> Recurring **Organisation** tiers (£125 / £250 / £500 per month), one-off tips at any amount, and annual sponsorships by invoice are all live on [sentinel.blog/support](https://sentinel.blog/support/). All channels are Stripe-backed, all blog content stays free for everyone, and contributions do not create a support contract — see the support page for the full disclaimer.
>
> [![Support sentinel.blog](https://img.shields.io/badge/💛%20Support%20—%20sentinel.blog%2Fsupport-orange?style=for-the-badge&logo=heart&logoColor=white)](https://sentinel.blog/support/)

---

## Documentation

The full technical reference lives in the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) repository, under [`Docs/Toolkit/`](https://github.com/noodlemctwoodle/Sentinel-As-Code/tree/main/Docs/Toolkit). That folder is the single source of truth for the toolkit:

- [Commands](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Commands.md): every Command Palette and context-menu command.
- [Configuration](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Configuration.md): all `sentinelAsCode.*` settings and the `.sentinel-connectors.json` custom-connector file.
- [Templates](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Templates.md): the content templates, how each is authored as YAML, and which deploy as JSON.
- [Schemas and Validation](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Schemas-and-Validation.md): schema bindings, validation behaviour, and MITRE ATT&CK.
- [ARM to YAML Conversion](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/ARM-to-YAML-Conversion.md): decompiling alert-rule ARM templates.
- [Defender Workflows](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Defender-Workflows.md): formatting, validating, and converting Defender XDR custom detections.
- [Graph API Migrations](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Toolkit/Graph-API-Migrations.md): Microsoft Graph deprecations that affect Defender detections.

---

## Requirements

- Visual Studio Code 1.125 or later.
- Familiarity with the Microsoft Sentinel analytics rule schema (KQL, MITRE ATT&CK).

---

## Installation

- **Marketplace** — search for **Sentinel as Code Toolkit** in the Extensions view, or install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=noodlemctwoodle.sentinelcodeguard).
- **From VSIX** — obtain the `.vsix`, then run **Extensions: Install from VSIX...** from the Command Palette.

---

## Getting started

Everything is authored as commented YAML. In short:

1. Run **New Sentinel-as-Code Content...** from the Command Palette, or right-click a folder in the Explorer, and pick a content type. Analytics Rule offers Standard, NRT, or Decompile from an ARM template; Watchlist offers a blank template or one built from the active CSV/TSV. The toolkit writes the commented YAML and asks where to save it.
2. Fill in the values in the YAML, guided by the inline comments. Validation and IntelliSense guide you as you type, and you can format with `Shift+Alt+F`.
3. For the three content types the pipeline stores as JSON (summary rules, automation rules, and watchlists), run **Convert Content YAML to JSON** to produce the `.json` you commit. Analytics rules, hunting queries, parsers, and Defender detections deploy as YAML and need no conversion.

For the full command reference, per-workflow walkthroughs, and configuration, see the [Documentation](#documentation) above.

---

## The Sentinel-as-Code project

This extension is the authoring companion to [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code), an end-to-end CI/CD solution for deploying Microsoft Sentinel and Defender XDR content from a single Git repository. Author and validate content here; let the pipeline deploy it.

- Toolkit documentation: [Docs/Toolkit](https://github.com/noodlemctwoodle/Sentinel-As-Code/tree/main/Docs/Toolkit)
- Defender custom-detection schema and conventions: [Docs/Content/Defender-Custom-Detections.md](https://github.com/noodlemctwoodle/Sentinel-As-Code/blob/main/Docs/Content/Defender-Custom-Detections.md)
- Repository documentation index: [Docs](https://github.com/noodlemctwoodle/Sentinel-As-Code/tree/main/Docs)

---

## Support the project

If you find Sentinel as Code Toolkit useful, subscribe to [sentinel.blog](https://sentinel.blog) for more Microsoft Sentinel and security content.

[![Subscribe to Sentinel Blog](https://img.shields.io/badge/Subscribe-sentinel.blog-blue?style=for-the-badge&logo=ghost&logoColor=white)](https://sentinel.blog/#/portal/signup)

The best way to support this work is by subscribing to the blog, reporting issues, and suggesting improvements. If you are using the toolkit in an organisation, see the [donation callout under Overview](#overview).

Issues and feature requests: [GitHub](https://github.com/noodlemctwoodle/Sentinel-As-Code/issues).

---

## License

The extension is released under the [Apache License 2.0](LICENSE.txt), matching the [Sentinel-as-Code](https://github.com/noodlemctwoodle/Sentinel-As-Code) repository it targets. See [NOTICE](NOTICE) for copyright and third-party attribution. Releases up to and including `26.7.1` were published under the MIT License and remain available under those terms; Apache-2.0 applies from the next release onward.

---

Created by TobyG. Visit [sentinel.blog](https://sentinel.blog) for Microsoft Sentinel resources, tutorials, and insights.
