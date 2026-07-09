import * as assert from 'assert';
import * as yaml from 'js-yaml';
import { DefenderDetectionValidator } from '../../../validation/defenderDetectionValidator';
import { readRepoFile } from './test-utils';

function validDetection(): any {
    return {
        displayName: 'Test Detection',
        isEnabled: true,
        queryCondition: { queryText: 'DeviceProcessEvents | take 1' },
        schedule: { period: '1H' },
        detectionAction: {
            alertTemplate: {
                title: 'Test Detection',
                description: 'A test detection.',
                severity: 'medium',
                category: 'Execution',
                mitreTechniques: ['T1059']
            }
        }
    };
}

// Every concrete responseAction @odata.type the authoring template is expected to catalogue.
const EXPECTED_RESPONSE_ACTIONS = [
    'isolateDeviceResponseAction',
    'restrictAppExecutionResponseAction',
    'runAntivirusScanResponseAction',
    'collectInvestigationPackageResponseAction',
    'initiateInvestigationResponseAction',
    'stopAndQuarantineFileResponseAction',
    'blockFileResponseAction',
    'allowFileResponseAction',
    'disableUserResponseAction',
    'forceUserPasswordResetResponseAction',
    'markUserAsCompromisedResponseAction',
    'softDeleteResponseAction',
    'hardDeleteResponseAction',
    'moveToInboxResponseAction',
    'moveToJunkResponseAction',
    'moveToDeletedItemsResponseAction'
].map(name => `#microsoft.graph.security.${name}`);

suite('DefenderDetectionValidator Tests', () => {
    const validator = new DefenderDetectionValidator();

    test('accepts a well-formed detection', () => {
        const result = validator.validate(validDetection());
        assert.strictEqual(result.isValid, true, `Unexpected errors: ${result.errors.join('; ')}`);
        assert.strictEqual(result.errors.length, 0);
    });

    test('reports every missing required field', () => {
        const result = validator.validate({});
        assert.strictEqual(result.isValid, false);
        for (const field of ['displayName', 'isEnabled', 'queryCondition', 'schedule', 'detectionAction']) {
            assert.ok(result.errors.some(e => e.includes(field)), `Expected an error for missing ${field}`);
        }
    });

    test('rejects an invalid severity', () => {
        const data = validDetection();
        data.detectionAction.alertTemplate.severity = 'critical';
        const result = validator.validate(data);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some(e => e.toLowerCase().includes('severity')));
    });

    test('rejects an invalid schedule period', () => {
        const data = validDetection();
        data.schedule.period = '2H';
        const result = validator.validate(data);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some(e => e.includes('period')));
    });

    test('warns about runtime/read-only fields that must not be committed', () => {
        const data = validDetection();
        data.id = '4096';
        data['@odata.type'] = '#microsoft.graph.security.detectionRule';
        const result = validator.validate(data);
        assert.ok(result.warnings.some(w => w.includes('id')));
        assert.ok(result.warnings.some(w => w.includes('@odata.type')));
    });

    suite('shipped custom-detection template', () => {
        const template: any = yaml.load(readRepoFile('templates/custom-detection.template.yaml'));

        test('validates cleanly against the authoring schema', () => {
            const result = validator.validate(template);
            assert.strictEqual(result.isValid, true, `Unexpected errors: ${result.errors.join('; ')}`);
        });

        test('catalogues every supported response action type', () => {
            const actions: string[] = (template.detectionAction.responseActions ?? []).map((a: any) => a['@odata.type']);
            for (const type of EXPECTED_RESPONSE_ACTIONS) {
                assert.ok(actions.includes(type), `Template is missing response action: ${type}`);
            }
            assert.strictEqual(
                actions.length,
                EXPECTED_RESPONSE_ACTIONS.length,
                'Template response action count does not match the expected set'
            );
        });
    });
});
