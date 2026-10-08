//
// src/test/suite/validation/hoverProvider.test.ts
//
// Created by Toby G on 08/10/2026.
//

import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConnectorLoader } from '../../../validation/connectorLoader';
import { SentinelRuleHoverProvider } from '../../../providers/hoverProvider';

suite('Hover Provider Tests', () => {
    suiteSetup(async () => {
        ConnectorLoader.setExtensionContext({ extensionPath: process.cwd() } as vscode.ExtensionContext);
        await ConnectorLoader.loadConnectorData();
    });

    // Connector hover text can come from a workspace .sentinel-connectors.json, so it
    // must never be rendered as trusted markdown (which would enable command: links).
    test('Connector hover markdown is not trusted', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'yaml',
            content: 'requiredDataConnectors:\n  - connectorId: Darktrace\n'
        });
        const position = new vscode.Position(1, document.lineAt(1).text.indexOf('Darktrace') + 2);

        const hover = await new SentinelRuleHoverProvider().provideHover(
            document,
            position,
            new vscode.CancellationTokenSource().token
        );

        assert.ok(hover, 'Expected a hover for a known connector ID');
        const markdown = hover.contents[0] as vscode.MarkdownString;
        assert.ok(markdown.value.length > 0, 'Hover should contain connector details');
        assert.ok(!markdown.isTrusted, 'Connector hover must not be trusted markdown');
        assert.ok(!markdown.supportHtml, 'Connector hover must not render raw HTML');
    });
});
