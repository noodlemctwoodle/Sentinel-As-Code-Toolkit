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
