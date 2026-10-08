import * as assert from 'assert';
import * as yaml from 'js-yaml';
import { ArmToYamlConverter } from '../../../conversion/armToYamlConverter';

function buildArmTemplate(properties: Record<string, unknown>): string {
    return JSON.stringify({
        $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
        contentVersion: '1.0.0.0',
        resources: [{
            type: 'Microsoft.OperationalInsights/workspaces/providers/alertRules',
            kind: 'Scheduled',
            apiVersion: '2023-02-01-preview',
            name: 'workspace/Microsoft.SecurityInsights/5c7b4a0e-1d2f-4a3b-9c8d-0e1f2a3b4c5d',
            properties: {
                displayName: 'Test Rule',
                description: 'A test rule',
                severity: 'High',
                query: 'SigninLogs | take 1',
                tactics: ['InitialAccess'],
                ...properties
            }
        }]
    });
}

async function convertFirstRule(properties: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = await ArmToYamlConverter.convertArmToYaml(buildArmTemplate(properties));
    assert.strictEqual(result.successfulConversions, 1, result.results[0]?.errors.join('; '));
    return yaml.load(result.results[0].yamlContent as string) as Record<string, unknown>;
}

suite('ARM to YAML Converter Tests', () => {
    test('Should emit relevantTechniques rather than the deprecated techniques alias', async () => {
        const rule = await convertFirstRule({ techniques: ['T1110', 'T1078'] });

        assert.deepStrictEqual(rule.relevantTechniques, ['T1110', 'T1078']);
        assert.strictEqual('techniques' in rule, false, 'Converted YAML must not contain a techniques key');
    });

    test('Should fold ARM subTechniques into relevantTechniques', async () => {
        const rule = await convertFirstRule({
            techniques: ['T1110', 'T1078'],
            subTechniques: ['T1078.004']
        });

        assert.deepStrictEqual(rule.relevantTechniques, ['T1110', 'T1078.004']);
    });

    test('Should emit an empty relevantTechniques list when ARM has no technique data', async () => {
        const rule = await convertFirstRule({});

        assert.deepStrictEqual(rule.relevantTechniques, []);
    });

    test('Should place relevantTechniques directly after tactics', async () => {
        const result = await ArmToYamlConverter.convertArmToYaml(buildArmTemplate({ techniques: ['T1110'] }));
        const keys = Object.keys(yaml.load(result.results[0].yamlContent as string) as object);

        assert.strictEqual(keys[keys.indexOf('tactics') + 1], 'relevantTechniques');
    });
});
