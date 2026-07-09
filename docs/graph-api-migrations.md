# Microsoft Graph API changes affecting Defender custom detections

This file records upcoming Microsoft Graph `security` API changes that affect how this
toolkit models Microsoft Defender XDR custom detections, so the schema, templates, and
converters can be migrated ahead of the removal dates.

> Source: Microsoft Graph beta reference (`microsoft.graph.security`), verified 2026-07-09.

## Deprecations — all scheduled for removal on 2026-10-01

| Current shape (used by this toolkit) | Replacement | Notes |
|---|---|---|
| `detectionAction.responseActions` and all 17 `responseAction` derived types | `detectionAction.automatedActions` (grouped via `automatedActionSet`) | The custom-detection template catalogues every current `responseAction`. Migration = re-map each to an `automatedAction`. |
| `detectionRule.isEnabled` (boolean) | `detectionRule.status` (`detectionRuleStatus` enum) | Boolean flag becomes an enum. |
| `alertTemplate.impactedAssets` and the `impacted*Asset` derived types | `alertTemplate.entityMappings` and the `entityMapping` derived types | Entity-mapping shape changes. |

## Where this repo depends on the current shape

- `schemas/defender-custom-detection-schema.json` — models `isEnabled`, `queryCondition`, `schedule`, `detectionAction.alertTemplate` (with `impactedAssets`) and `detectionAction.responseActions`.
- `templates/custom-detection.template.yaml` — uses `isEnabled`, `impactedAssets`, and the full `responseActions` catalogue.
- `src/defender/services/defenderXdrService.ts` — `formatRuleForRepo` and the convert methods pass `responseActions` and `impactedAssets` through unchanged.
- `src/validation/defenderDetectionValidator.ts` — requires `isEnabled`; treats `responseActions` / `impactedAssets` as arrays.

## Migration plan (before 2026-10-01)

1. Extend the schema and validator to accept `automatedActions`, `status`, and `entityMappings` alongside the current fields (dual-read during the transition).
2. Update `defenderXdrService` conversion to emit the new shape.
3. Switch `templates/custom-detection.template.yaml` to `automatedActions` / `status` / `entityMappings`.
4. Remove the deprecated fields once tenants no longer accept the old shape.
