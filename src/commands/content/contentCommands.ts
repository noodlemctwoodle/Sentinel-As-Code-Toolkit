//
// src/commands/content/contentCommands.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { ContentBuilders } from '../../content/contentBuilders';
import { WatchlistBuilder } from '../../content/watchlistBuilder';
import { ConnectorLoader } from '../../validation/connectorLoader';
import { detectContentType, SentinelContentType } from '../../content/contentTypes';
import { EXPECTED_ORDER } from '../../validation/constants';

interface ContentPick extends vscode.QuickPickItem {
    key: string;
}

/**
 * Commands that scaffold new Sentinel-as-Code content and auto-populate
 * requiredDataConnectors by matching the query's tables to connectors.
 */
export class ContentCommands {
    public registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('sentinelAsCode.newContent', () => this.newContent()),
            vscode.commands.registerCommand('sentinelAsCode.createHuntingQuery', () => ContentBuilders.createHuntingQuery()),
            vscode.commands.registerCommand('sentinelAsCode.createParser', () => ContentBuilders.createParser()),
            vscode.commands.registerCommand('sentinelAsCode.createSummaryRule', () => ContentBuilders.createSummaryRule()),
            vscode.commands.registerCommand('sentinelAsCode.createAutomationRule', () => ContentBuilders.createAutomationRule()),
            vscode.commands.registerCommand('sentinelAsCode.createWatchlistFromCsv', () => WatchlistBuilder.createFromActiveCsv()),
            vscode.commands.registerCommand('sentinelAsCode.populateDataConnectors', () => this.populateDataConnectors())
        ];
    }

    private async newContent(): Promise<void> {
        const picks: ContentPick[] = [
            { key: 'standard', label: '$(file-code) Analytics Rule (Standard)', detail: 'Scheduled Sentinel analytics rule' },
            { key: 'nrt', label: '$(clock) Analytics Rule (NRT)', detail: 'Near-real-time Sentinel analytics rule' },
            { key: 'detection', label: '$(shield) Custom Detection', detail: 'Defender XDR custom detection' },
            { key: 'hunting', label: '$(search) Hunting Query', detail: 'Log Analytics saved search' },
            { key: 'parser', label: '$(symbol-function) Parser', detail: 'Saved KQL function' },
            { key: 'summary', label: '$(graph) Summary Rule', detail: 'Log Analytics aggregation into a _CL table' },
            { key: 'automation', label: '$(zap) Automation Rule', detail: 'Incident/alert automation' },
            { key: 'watchlist', label: '$(list-flat) Watchlist from CSV', detail: 'Build a watchlist package from the active CSV/TSV' }
        ];

        const selected = await vscode.window.showQuickPick(picks, {
            title: 'New Sentinel-as-Code content',
            placeHolder: 'Select the content type to scaffold',
            matchOnDetail: true
        });
        if (!selected) {
            return;
        }

        switch (selected.key) {
            case 'standard': await vscode.commands.executeCommand('sentinelAsCode.generateTemplate'); break;
            case 'nrt': await vscode.commands.executeCommand('sentinelAsCode.generateNRTTemplate'); break;
            case 'detection': await vscode.commands.executeCommand('defender.generateDetectionTemplate'); break;
            case 'hunting': await ContentBuilders.createHuntingQuery(); break;
            case 'parser': await ContentBuilders.createParser(); break;
            case 'summary': await ContentBuilders.createSummaryRule(); break;
            case 'automation': await ContentBuilders.createAutomationRule(); break;
            case 'watchlist': await WatchlistBuilder.createFromActiveCsv(); break;
        }
    }

    private async populateDataConnectors(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Open an analytics rule to populate its required data connectors.');
            return;
        }

        if (detectContentType(editor.document).type !== SentinelContentType.AnalyticsRule) {
            vscode.window.showWarningMessage('requiredDataConnectors only applies to Sentinel analytics rules.');
            return;
        }

        const content = editor.document.getText();
        let parsed: any;
        try {
            parsed = yaml.load(content);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not parse the rule: ${error instanceof Error ? error.message : 'invalid YAML'}`);
            return;
        }

        if (!parsed || typeof parsed !== 'object' || typeof parsed.query !== 'string') {
            vscode.window.showErrorMessage('The active analytics rule has no `query` field to analyse.');
            return;
        }

        const connectors = ConnectorLoader.suggestRequiredDataConnectorsForQuery(parsed.query);
        if (connectors.length === 0) {
            vscode.window.showWarningMessage('No known Log Analytics tables were found in the query, so no connectors could be matched.');
            return;
        }

        parsed.requiredDataConnectors = connectors;
        const reordered = this.reorderToCanonical(parsed);
        const newText = yaml.dump(reordered, { indent: 2, lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });

        const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(content.length));
        await editor.edit(editBuilder => editBuilder.replace(fullRange, newText));

        const summary = connectors.map(c => `${c.connectorId} (${c.dataTypes.join(', ')})`).join('; ');
        vscode.window.showInformationMessage(`Populated requiredDataConnectors from the query: ${summary}`);
    }

    private reorderToCanonical(parsed: Record<string, unknown>): Record<string, unknown> {
        const reordered: Record<string, unknown> = {};
        for (const field of EXPECTED_ORDER) {
            if (field in parsed) {
                reordered[field] = parsed[field];
            }
        }
        for (const [key, value] of Object.entries(parsed)) {
            if (!EXPECTED_ORDER.includes(key)) {
                reordered[key] = value;
            }
        }
        return reordered;
    }
}
