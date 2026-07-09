import * as assert from 'assert';
import { RuleTypeDetector, RuleType } from '../../../utils/ruleTypeDetector';
import { readRepoFile } from './test-utils';

suite('RuleTypeDetector Tests', () => {
    test('detects a Sentinel scheduled rule from tactics and scheduling fields', () => {
        const rule = [
            'id: 11111111-1111-1111-1111-111111111111',
            'name: Example Sentinel Rule',
            'severity: Medium',
            'queryFrequency: PT1H',
            'queryPeriod: PT1H',
            'triggerOperator: gt',
            'triggerThreshold: 0',
            'tactics:',
            '  - Execution',
            'query: |',
            '  SigninLogs | take 1'
        ].join('\n');
        assert.strictEqual(RuleTypeDetector.detectType(rule), RuleType.SENTINEL);
    });

    test('detects a Defender custom detection from queryCondition and detectionAction', () => {
        const rule = [
            'displayName: Example Detection',
            'isEnabled: true',
            'queryCondition:',
            '  queryText: DeviceProcessEvents | take 1',
            'schedule:',
            '  period: "1H"',
            'detectionAction:',
            '  alertTemplate:',
            '    title: Example',
            '    severity: medium'
        ].join('\n');
        assert.strictEqual(RuleTypeDetector.detectType(rule), RuleType.DEFENDER);
    });

    test('classifies the shipped Defender custom-detection template as Defender', () => {
        const template = readRepoFile('templates/custom-detection.template.yaml');
        assert.strictEqual(RuleTypeDetector.detectType(template), RuleType.DEFENDER);
    });

    test('treats a numeric id as a Defender indicator', () => {
        const rule = JSON.stringify({ id: '4096', displayName: 'Numeric id rule' });
        assert.strictEqual(RuleTypeDetector.detectType(rule), RuleType.DEFENDER);
    });

    test('treats responseActions as a Defender indicator', () => {
        const rule = 'responseActions:\n  - "@odata.type": "#microsoft.graph.security.isolateDeviceResponseAction"';
        assert.strictEqual(RuleTypeDetector.detectType(rule), RuleType.DEFENDER);
    });

    test('returns UNKNOWN for non-object or unparseable content', () => {
        assert.strictEqual(RuleTypeDetector.detectType('just a plain string'), RuleType.UNKNOWN);
        assert.strictEqual(RuleTypeDetector.detectType(''), RuleType.UNKNOWN);
    });
});
