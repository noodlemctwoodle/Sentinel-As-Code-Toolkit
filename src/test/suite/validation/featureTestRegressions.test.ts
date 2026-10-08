//
// src/test/suite/validation/featureTestRegressions.test.ts
//
// Created by Toby G on 08/10/2026.
//

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { ArmToYamlConverter } from '../../../conversion/armToYamlConverter';
import { SentinelContentFormatter } from '../../../content/contentFormatter';
import { findIndexedFieldLine, parseIndexedPath } from '../../../utils/yamlLineLocator';
import { ConnectorLoader } from '../../../validation/connectorLoader';
import { MitreLoader } from '../../../validation/mitreLoader';
import { SentinelRuleValidator } from '../../../validation/validator';

const RULE_LINES = [
    'id: 3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
    'requiredDataConnectors:',
    '  - connectorId: AzureActiveDirectory',
    '    dataTypes:',
    '      - SigninLogs',
    '  - connectorId: SecurityEvents',
    '    dataTypes:',
    '      - SecurityEvent',
    '      - "NotARealTable"',
    'tactics:',
    '  - InitialAccess'
];

function armTemplate(kind: string, properties: Record<string, unknown> = {}): string {
    return JSON.stringify({
        $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
        contentVersion: '1.0.0.0',
        resources: [{
            type: 'Microsoft.OperationalInsights/workspaces/providers/alertRules',
            kind,
            name: 'workspace/Microsoft.SecurityInsights/6d8c5b1f-2e3a-4b4c-8d9e-1f2a3b4c5d6e',
            properties: { displayName: 'Rule', description: 'd', severity: 'Medium', query: 'AuditLogs | take 1', tactics: ['Persistence'], ...properties }
        }]
    });
}

suite('Feature test regressions', () => {
    suiteSetup(async () => {
        const context = { extensionPath: process.cwd() } as vscode.ExtensionContext;
        ConnectorLoader.setExtensionContext(context);
        MitreLoader.setExtensionContext(context);
        await ConnectorLoader.loadConnectorData();
        await MitreLoader.loadMitreData();
    });

    test('Indexed field paths resolve to the right list item', () => {
        assert.deepStrictEqual(parseIndexedPath('requiredDataConnectors[1].dataTypes'), { listKey: 'requiredDataConnectors', index: 1, field: 'dataTypes' });
        assert.strictEqual(parseIndexedPath('tactics'), undefined);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 0, 'connectorId', 'AzureActiveDirectory'), 2);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 1, 'connectorId'), 5);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 1, 'dataTypes'), 6);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 1, 'dataTypes', 'NotARealTable'), 8);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 0, 'dataTypes', 'SecurityEvent'), -1);
        assert.strictEqual(findIndexedFieldLine(RULE_LINES, 'requiredDataConnectors', 2, 'connectorId'), -1);
    });

    test('Connector data-type problems are reported on the right line', async () => {
        const document = await vscode.workspace.openTextDocument({ language: 'yaml', content: RULE_LINES.join('\n') + '\n' });
        const validator = new SentinelRuleValidator();
        try {
            const diagnostics = validator.validateDocument(document).filter(d => /NotARealTable/.test(d.message));
            assert.ok(diagnostics.length > 0, 'no diagnostic for an unknown data type');
            assert.ok(diagnostics.every(d => d.range.start.line >= 5), 'diagnostic attached to the wrong connector');
        } finally {
            validator.dispose();
        }
    });

    test('Field-order hints only consider top-level keys', async () => {
        const content = 'id: 3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b\nname: n\nincidentConfiguration:\n  groupingConfiguration:\n    enabled: false\nenabled: true\n';
        const document = await vscode.workspace.openTextDocument({ language: 'yaml', content });
        const validator = new SentinelRuleValidator();
        try {
            const hints = validator.validateDocument(document).filter(d => d.code === 'field-order');
            assert.ok(hints.every(d => d.range.start.line !== 4), 'nested enabled key produced a field-order hint');
        } finally {
            validator.dispose();
        }
    });

    test('ARM NRT rules decompile as NRT without scheduling fields', async () => {
        const result = await ArmToYamlConverter.convertArmToYaml(armTemplate('NRT', { queryFrequency: 'PT5M', triggerOperator: 'GreaterThan' }));
        const rule = yaml.load(result.results[0].yamlContent as string) as Record<string, unknown>;
        assert.strictEqual(rule.kind, 'NRT');
        for (const field of ['queryFrequency', 'queryPeriod', 'triggerOperator', 'triggerThreshold']) {
            assert.ok(!(field in rule), `NRT rule should not have ${field}`);
        }
    });

    test('ARM Scheduled rules keep their scheduling fields', async () => {
        const result = await ArmToYamlConverter.convertArmToYaml(armTemplate('Scheduled', { queryFrequency: 'PT1H', queryPeriod: 'PT1H', triggerOperator: 'GreaterThan', triggerThreshold: 3 }));
        const rule = yaml.load(result.results[0].yamlContent as string) as Record<string, unknown>;
        assert.strictEqual(rule.kind, 'Scheduled');
        assert.strictEqual(rule.triggerOperator, 'gt');
        assert.strictEqual(rule.triggerThreshold, 3);
    });

    test('Entity mapping validation can be switched off', async () => {
        const bad = { entityMappings: [{ entityType: 'Spaceship', fieldMappings: [{ identifier: 'FullName' }] }] };
        const on = await ArmToYamlConverter.convertArmToYaml(armTemplate('Scheduled', bad));
        const off = await ArmToYamlConverter.convertArmToYaml(armTemplate('Scheduled', bad), { validateEntityMappings: false });
        assert.ok(on.results[0].warnings.some(w => /Spaceship/.test(w)), on.results[0].warnings.join('; '));
        assert.ok(on.results[0].warnings.some(w => /columnName/.test(w)));
        assert.ok(!off.results[0].warnings.some(w => /Spaceship|columnName/.test(w)));
    });

    test('Format Content leaves YAML summary rules and unknown JSON alone', async () => {
        const summary = await vscode.workspace.openTextDocument({ language: 'yaml', content: 'name: Example\nquery: |\n  SigninLogs | summarize count()\nbinSize: 60\ndestinationTable: Example_CL\n' });
        const summaryResult = SentinelContentFormatter.format(summary);
        assert.strictEqual(summaryResult.supported, false, summaryResult.info.label);
        assert.deepStrictEqual(summaryResult.edits, []);

        const plain = await vscode.workspace.openTextDocument({ language: 'json', content: '{"hello":   "world"}' });
        const plainResult = SentinelContentFormatter.format(plain);
        assert.strictEqual(plainResult.supported, false);
        assert.deepStrictEqual(plainResult.edits, []);
    });

    test('Populate ranks the native connector first for core tables', () => {
        const query = 'SecurityEvent | join (SigninLogs) on Account | union OfficeActivity, Syslog';
        const best = Object.fromEntries(ConnectorLoader.getQueryTableConnectorChoices(query).map(c => [c.table, c.connectors[0].id]));
        assert.strictEqual(best.SecurityEvent, 'SecurityEvents');
        assert.strictEqual(best.SigninLogs, 'AzureActiveDirectory');
        assert.strictEqual(best.OfficeActivity, 'Office365');
        assert.strictEqual(best.Syslog, 'Syslog');
    });

    test('Every contributed command is registered', async () => {
        const extension = vscode.extensions.getExtension('noodlemctwoodle.sentinelcodeguard');
        assert.ok(extension, 'extension not found');
        await extension.activate();
        const registered = new Set(await vscode.commands.getCommands(true));
        const missing = (extension.packageJSON.contributes.commands as Array<{ command: string }>)
            .map(c => c.command)
            .filter(c => !registered.has(c));
        assert.deepStrictEqual(missing, []);
    });
});
