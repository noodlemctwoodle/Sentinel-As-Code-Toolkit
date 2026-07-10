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
            { key: 'analytics', label: '$(file-code) Analytics Rule', detail: 'Blank Standard/NRT template, or decompile from ARM' },
            { key: 'detection', label: '$(shield) Custom Detection', detail: 'Defender XDR custom detection' },
            { key: 'hunting', label: '$(search) Hunting Query', detail: 'Log Analytics saved search' },
            { key: 'parser', label: '$(symbol-function) Parser', detail: 'Saved KQL function' },
            { key: 'summary', label: '$(graph) Summary Rule', detail: 'Log Analytics aggregation into a _CL table' },
            { key: 'automation', label: '$(zap) Automation Rule', detail: 'Incident/alert automation' },
            { key: 'watchlist', label: '$(list-flat) Watchlist', detail: 'Blank template, or build from the active CSV/TSV' }
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
            case 'analytics': await this.newAnalyticsRule(); break;
            case 'detection': await vscode.commands.executeCommand('defender.generateDetectionTemplate'); break;
            case 'hunting': await ContentBuilders.createHuntingQuery(); break;
            case 'parser': await ContentBuilders.createParser(); break;
            case 'summary': await ContentBuilders.createSummaryRule(); break;
            case 'automation': await ContentBuilders.createAutomationRule(); break;
            case 'watchlist': await this.newWatchlist(); break;
        }
    }

    /**
     * Second-level picker for analytics rules: blank Standard/NRT templates, or the
     * existing ARM decompiler. The decompiler is reached via its command so the
     * right-click "Decompile ARM to YAML" menu entry keeps working unchanged.
     */
    private async newAnalyticsRule(): Promise<void> {
        const picks: ContentPick[] = [
            { key: 'standard', label: '$(file-code) Standard rule (blank template)', detail: 'Scheduled analytics rule' },
            { key: 'nrt', label: '$(clock) NRT rule (blank template)', detail: 'Near-real-time analytics rule (no scheduling fields)' },
            { key: 'arm', label: '$(file-symlink-file) Decompile from ARM template', detail: 'Convert an exported ARM template to rule YAML' }
        ];
        const selected = await vscode.window.showQuickPick(picks, {
            title: 'New analytics rule',
            placeHolder: 'Choose how to create the analytics rule',
            matchOnDetail: true
        });
        if (!selected) {
            return;
        }
        switch (selected.key) {
            case 'standard': await vscode.commands.executeCommand('sentinelAsCode.generateTemplate'); break;
            case 'nrt': await vscode.commands.executeCommand('sentinelAsCode.generateNRTTemplate'); break;
            case 'arm': await vscode.commands.executeCommand('sentinelAsCode.convertArmToYaml'); break;
        }
    }

    /**
     * Second-level picker for watchlists: scaffold a blank metadata template, or build
     * a full package from the active CSV/TSV.
     */
    private async newWatchlist(): Promise<void> {
        const picks: ContentPick[] = [
            { key: 'template', label: '$(list-flat) Blank template', detail: 'Scaffold a watchlist.json to fill in by hand' },
            { key: 'csv', label: '$(table) From active CSV/TSV', detail: 'Build watchlist.json + data.csv from the active file' }
        ];
        const selected = await vscode.window.showQuickPick(picks, {
            title: 'New watchlist',
            placeHolder: 'Choose how to create the watchlist',
            matchOnDetail: true
        });
        if (!selected) {
            return;
        }
        switch (selected.key) {
            case 'template': await WatchlistBuilder.createTemplate(); break;
            case 'csv': await WatchlistBuilder.createFromActiveCsv(); break;
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

        const choices = ConnectorLoader.getQueryTableConnectorChoices(parsed.query);
        const unmatchedCustomTables = ConnectorLoader.getUnmatchedCustomTablesForQuery(parsed.query);
        if (choices.length === 0 && unmatchedCustomTables.length === 0) {
            vscode.window.showWarningMessage('No known Log Analytics tables were found in the query, so no connectors could be matched.');
            return;
        }

        // Resolve each table to a connector, prompting when a table is provided by more than one.
        const byConnector = new Map<string, string[]>();
        for (const choice of choices) {
            let connectorId = choice.connectors[0].id;
            if (choice.connectors.length > 1) {
                const items: Array<vscode.QuickPickItem & { connectorId: string }> = choice.connectors.map((c, i) => ({
                    connectorId: c.id,
                    label: c.id,
                    description: c.deprecated ? `${c.displayName} — deprecated` : c.displayName,
                    detail: i === 0 ? 'Suggested best match' : undefined
                }));
                const picked = await vscode.window.showQuickPick(items, {
                    title: `Data connector for "${choice.table}"`,
                    placeHolder: `"${choice.table}" is provided by ${choice.connectors.length} connectors — choose which one to require`,
                    matchOnDescription: true
                });
                if (!picked) {
                    vscode.window.showInformationMessage('Populate required data connectors was cancelled.');
                    return;
                }
                connectorId = picked.connectorId;
            }
            const tables = byConnector.get(connectorId) ?? [];
            tables.push(choice.table);
            byConnector.set(connectorId, tables);
        }

        // For unknown custom (_CL) tables, offer to register them in .sentinel-connectors.json
        // inline — the same command-palette style prompt used for multi-connector matches.
        let registeredCount = 0;
        for (const table of unmatchedCustomTables) {
            const defaultId = table.replace(/_CL$/, '');
            const items: Array<vscode.QuickPickItem & { action: 'add' | 'edit' | 'skip' }> = [
                { action: 'add', label: `$(add) Add as "${defaultId}"`, detail: `Register a custom connector in .sentinel-connectors.json so "${table}" is required` },
                { action: 'edit', label: '$(edit) Add with a different connector id…', detail: 'Choose the connectorId to register' },
                { action: 'skip', label: '$(circle-slash) Skip', detail: 'Leave this table out of requiredDataConnectors' }
            ];
            const picked = await vscode.window.showQuickPick(items, {
                title: `Unknown custom table "${table}"`,
                placeHolder: `"${table}" isn't provided by any known connector`
            });
            if (!picked) {
                vscode.window.showInformationMessage('Populate required data connectors was cancelled.');
                return;
            }
            if (picked.action === 'skip') {
                continue;
            }
            let connectorId = defaultId;
            if (picked.action === 'edit') {
                const input = await vscode.window.showInputBox({
                    title: `Connector id for "${table}"`,
                    prompt: 'Written to requiredDataConnectors and .sentinel-connectors.json',
                    value: defaultId,
                    validateInput: v => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v.trim()) ? undefined : 'Use letters, numbers, . _ - starting with a letter or number'
                });
                if (input === undefined) {
                    vscode.window.showInformationMessage('Populate required data connectors was cancelled.');
                    return;
                }
                connectorId = input.trim();
            }
            const wrote = await this.registerCustomTable(editor.document.uri, connectorId, table);
            if (wrote) {
                registeredCount++;
            } else {
                vscode.window.showWarningMessage(`Open a workspace folder to save .sentinel-connectors.json; "${table}" was still added to this rule.`);
            }
            const customTables = byConnector.get(connectorId) ?? [];
            if (!customTables.includes(table)) {
                customTables.push(table);
            }
            byConnector.set(connectorId, customTables);
        }

        if (byConnector.size === 0) {
            vscode.window.showWarningMessage('No connectors were selected, so requiredDataConnectors was left unchanged.');
            return;
        }

        if (registeredCount > 0) {
            // Refresh so the newly-registered custom tables are recognised for the rest of the session.
            await ConnectorLoader.loadConnectorData();
        }

        const connectors = [...byConnector.entries()].map(([connectorId, dataTypes]) => ({ connectorId, dataTypes }));
        parsed.requiredDataConnectors = connectors;
        const reordered = this.reorderToCanonical(parsed);
        const newText = yaml.dump(reordered, { indent: 2, lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });

        const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(content.length));
        await editor.edit(editBuilder => editBuilder.replace(fullRange, newText));

        const summary = connectors.map(c => `${c.connectorId} (${c.dataTypes.join(', ')})`).join('; ');
        const registeredNote = registeredCount > 0 ? ` (registered ${registeredCount} custom table${registeredCount === 1 ? '' : 's'} in .sentinel-connectors.json)` : '';
        vscode.window.showInformationMessage(`Populated requiredDataConnectors from the query: ${summary}${registeredNote}`);
    }

    /**
     * Registers a custom (_CL) table under a connector in the workspace
     * .sentinel-connectors.json (creating or merging the file), so future matching and
     * validation recognise it. Returns the file URI, or undefined when there is no
     * workspace folder to write to.
     */
    private async registerCustomTable(ruleUri: vscode.Uri, connectorId: string, table: string): Promise<vscode.Uri | undefined> {
        const folder = vscode.workspace.getWorkspaceFolder(ruleUri) ?? vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return undefined;
        }
        const fileUri = vscode.Uri.joinPath(folder.uri, '.sentinel-connectors.json');

        let doc: any = { connectors: [] };
        try {
            const existing = await vscode.workspace.fs.readFile(fileUri);
            const parsedFile = JSON.parse(Buffer.from(existing).toString('utf8'));
            if (parsedFile && typeof parsedFile === 'object') {
                doc = parsedFile;
            }
        } catch {
            // No existing file (or unreadable) — start a fresh one.
        }

        const listKey = Array.isArray(doc.tablesByConnector) ? 'tablesByConnector' : 'connectors';
        if (!Array.isArray(doc[listKey])) {
            doc[listKey] = [];
        }
        const list: any[] = doc[listKey];

        let entry = list.find(c => (c.connectorId ?? c.id) === connectorId);
        if (!entry) {
            // Create a full template so every connector field is present and editable.
            entry = {
                connectorId,
                connectorTitle: connectorId,
                descriptionMarkdown: '',
                publisher: 'Custom',
                source: '',
                tables: []
            };
            list.push(entry);
        }

        let tables: string[];
        if (typeof entry.tables === 'string') {
            tables = entry.tables ? [entry.tables] : [];
        } else if (Array.isArray(entry.tables)) {
            tables = entry.tables;
        } else if (Array.isArray(entry.dataTypes)) {
            tables = entry.dataTypes;
        } else {
            tables = [];
        }
        if (!tables.includes(table)) {
            tables.push(table);
            tables.sort((a, b) => a.localeCompare(b));
        }
        entry.tables = tables;

        // Backfill any missing canonical fields so all options are visible for editing.
        if (entry.connectorTitle === undefined) {
            entry.connectorTitle = connectorId;
        }
        if (entry.descriptionMarkdown === undefined) {
            entry.descriptionMarkdown = '';
        }
        if (entry.publisher === undefined) {
            entry.publisher = 'Custom';
        }
        if (entry.source === undefined) {
            entry.source = '';
        }

        const content = JSON.stringify(doc, null, 2) + '\n';
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
        return fileUri;
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
