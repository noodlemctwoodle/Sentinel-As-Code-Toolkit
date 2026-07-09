import * as assert from 'assert';
import * as yaml from 'js-yaml';
import { readRepoFile } from './test-utils';

function loadTemplate(fileName: string): any {
    const raw = readRepoFile(`templates/${fileName}`).replace('{{GUID}}', '11111111-1111-1111-1111-111111111111');
    return yaml.load(raw);
}

const SCHEDULED_ONLY = ['queryFrequency', 'queryPeriod', 'triggerOperator', 'triggerThreshold'];

// Every top-level analytics-rule option a complete Scheduled template should expose.
const SCHEDULED_FIELDS = [
    'id', 'name', 'description', 'severity', 'requiredDataConnectors',
    'queryFrequency', 'queryPeriod', 'triggerOperator', 'triggerThreshold',
    'enabled', 'tactics', 'relevantTechniques', 'query', 'entityMappings',
    'alertDetailsOverride', 'customDetails', 'eventGroupingSettings',
    'incidentConfiguration', 'suppressionDuration', 'suppressionEnabled',
    'version', 'kind', 'tags'
];

suite('Analytics Template Completeness Tests', () => {
    test('standard-rule template exposes every Scheduled option', () => {
        const tpl = loadTemplate('standard-rule.template.yaml');
        for (const field of SCHEDULED_FIELDS) {
            assert.ok(field in tpl, `standard-rule template is missing "${field}"`);
        }
        assert.strictEqual(tpl.kind, 'Scheduled');
    });

    test('nrt-rule template exposes every NRT option and omits Scheduled-only fields', () => {
        const tpl = loadTemplate('nrt-rule.template.yaml');
        const nrtFields = SCHEDULED_FIELDS.filter(f => !SCHEDULED_ONLY.includes(f));
        for (const field of nrtFields) {
            assert.ok(field in tpl, `nrt-rule template is missing "${field}"`);
        }
        assert.strictEqual(tpl.kind, 'NRT');
        for (const field of SCHEDULED_ONLY) {
            assert.ok(!(field in tpl), `nrt-rule template should not contain Scheduled-only field "${field}"`);
        }
    });

    test('both templates demonstrate MITRE sub-technique support', () => {
        for (const file of ['standard-rule.template.yaml', 'nrt-rule.template.yaml']) {
            const tpl = loadTemplate(file);
            const techniques: string[] = tpl.relevantTechniques ?? [];
            assert.ok(
                techniques.some((t: string) => /^T\d{4}\.\d{3}$/.test(t)),
                `${file} should include at least one sub-technique (T####.###)`
            );
        }
    });
});

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function assertRequired(tpl: any, fields: string[], label: string): void {
    for (const field of fields) {
        assert.ok(field in tpl, `${label} template is missing required field "${field}"`);
    }
}

function assertNoExtraKeys(tpl: any, allowed: string[], label: string): void {
    for (const key of Object.keys(tpl)) {
        assert.ok(allowed.includes(key), `${label} template has unexpected top-level key "${key}"`);
    }
}

// Validates the content-type templates (hunting query, parser, summary rule,
// automation rule, watchlist) against their bundled schema constraints. These
// templates are the single source of truth for the interactive scaffolders and
// the content-type picker, so they must stay schema-valid.
suite('Content Template Completeness Tests', () => {
    test('hunting-query template satisfies the hunting query schema', () => {
        const tpl = loadTemplate('hunting-query.template.yaml');
        assertRequired(tpl, ['id', 'name', 'query'], 'hunting-query');
        assertNoExtraKeys(tpl, ['id', 'name', 'description', 'query', 'tactics', 'techniques', 'tags'], 'hunting-query');
        assert.ok(GUID.test(tpl.id), 'hunting-query id must be a GUID');
        for (const tactic of tpl.tactics ?? []) {
            assert.ok(/^[A-Z][a-zA-Z]{2,30}$/.test(tactic), `hunting-query tactic "${tactic}" must be camelCase`);
        }
        const techniques: string[] = tpl.techniques ?? [];
        for (const technique of techniques) {
            assert.ok(/^T[0-9]{4}(\.[0-9]{3})?$/.test(technique), `hunting-query technique "${technique}" is malformed`);
        }
        assert.ok(techniques.some(t => /^T\d{4}\.\d{3}$/.test(t)), 'hunting-query should demonstrate a sub-technique');
        for (const tag of tpl.tags ?? []) {
            assert.ok('name' in tag && 'value' in tag, 'hunting-query tags need name and value');
        }
    });

    test('parser template satisfies the parser schema', () => {
        const tpl = loadTemplate('parser.template.yaml');
        assertRequired(tpl, ['id', 'name', 'functionAlias', 'query'], 'parser');
        assert.ok(typeof tpl.functionAlias === 'string' && tpl.functionAlias.length > 0, 'parser functionAlias must be non-empty');
        // Template must demonstrate every documented optional field.
        for (const field of ['description', 'category', 'functionParameters', 'version', 'tags']) {
            assert.ok(field in tpl, `parser template should demonstrate the optional "${field}" field`);
        }
    });

    test('summary-rule template satisfies the summary rule schema', () => {
        const tpl = loadTemplate('summary-rule.template.yaml');
        assertRequired(tpl, ['name', 'query', 'binSize', 'destinationTable'], 'summary-rule');
        assertNoExtraKeys(tpl, ['name', 'displayName', 'description', 'query', 'binSize', 'destinationTable', 'binDelay', 'binStartTime'], 'summary-rule');
        assert.ok(/^[A-Za-z0-9-]+$/.test(tpl.name), 'summary-rule name must be alphanumeric and hyphens only');
        assert.ok([20, 30, 60, 120, 180, 360, 720, 1440].includes(tpl.binSize), 'summary-rule binSize must be an allowed value');
        assert.ok(/_CL$/.test(tpl.destinationTable), 'summary-rule destinationTable must end with _CL');
        assert.ok(!/ago\(|TimeGenerated\s*[<>]/.test(tpl.query), 'summary-rule query must not include explicit time filters');
        // Template must demonstrate every optional field.
        assert.ok('binDelay' in tpl && tpl.binDelay >= 0 && tpl.binDelay <= 1440, 'summary-rule should show binDelay (0-1440)');
        assert.ok('binStartTime' in tpl && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(tpl.binStartTime), 'summary-rule should show a valid binStartTime');
    });

    test('automation-rule template satisfies the automation rule schema', () => {
        const tpl = loadTemplate('automation-rule.template.yaml');
        assertRequired(tpl, ['automationRuleId', 'displayName', 'order', 'triggeringLogic', 'actions'], 'automation-rule');
        assertNoExtraKeys(tpl, ['automationRuleId', 'displayName', 'order', 'triggeringLogic', 'actions'], 'automation-rule');
        assert.ok(GUID.test(tpl.automationRuleId), 'automation-rule automationRuleId must be a GUID');
        assert.ok(tpl.order >= 1 && tpl.order <= 1000, 'automation-rule order must be 1-1000');
        const trigger = tpl.triggeringLogic;
        assert.strictEqual(typeof trigger.isEnabled, 'boolean', 'triggeringLogic.isEnabled must be boolean');
        assert.ok(['Incidents', 'Alerts'].includes(trigger.triggersOn), 'triggersOn must be Incidents or Alerts');
        assert.ok(['Created', 'Updated'].includes(trigger.triggersWhen), 'triggersWhen must be Created or Updated');
        // Template must demonstrate every optional triggeringLogic field.
        assert.ok('expirationTimeUtc' in trigger, 'triggeringLogic should show expirationTimeUtc');
        assert.ok(Array.isArray(trigger.conditions) && trigger.conditions.length >= 1, 'triggeringLogic should show at least one example condition');
        assert.ok(Array.isArray(tpl.actions) && tpl.actions.length >= 1, 'automation-rule needs at least one action');
        for (const action of tpl.actions) {
            assert.ok(['ModifyProperties', 'RunPlaybook', 'AddIncidentTask'].includes(action.actionType), `unexpected actionType "${action.actionType}"`);
            assert.ok(action.order >= 1, 'action order must be >= 1');
        }
        // Template must cover all three action types as a reference.
        const actionTypes = new Set(tpl.actions.map((a: any) => a.actionType));
        for (const actionType of ['ModifyProperties', 'RunPlaybook', 'AddIncidentTask']) {
            assert.ok(actionTypes.has(actionType), `automation-rule template should demonstrate the "${actionType}" action`);
        }
    });

    test('watchlist template satisfies the watchlist schema', () => {
        const tpl = loadTemplate('watchlist.template.yaml');
        assertRequired(tpl, ['watchlistAlias', 'displayName', 'description', 'provider', 'itemsSearchKey'], 'watchlist');
        assertNoExtraKeys(tpl, ['watchlistAlias', 'displayName', 'description', 'provider', 'itemsSearchKey'], 'watchlist');
        assert.strictEqual(tpl.provider, 'Custom', 'watchlist provider must be Custom');
    });
});
