//
// src/content/contentBuilders.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interactive scaffolders that create new Sentinel-as-Code content items from the
 * documented repository schemas. Each opens an editable, deployment-shaped draft.
 * (Watchlists are handled by WatchlistBuilder; Workbooks/Playbooks are ARM exports
 * and out of scope.)
 */
export class ContentBuilders {
    private static readonly SUMMARY_BIN_SIZES = ['20', '30', '60', '120', '180', '360', '720', '1440'];

    /** Hunting query (Log Analytics saved search). Schema: Docs/Content/Hunting-Queries.md */
    public static async createHuntingQuery(): Promise<void> {
        const name = await vscode.window.showInputBox({
            title: 'Hunting query name',
            prompt: 'Display name shown in the Sentinel Hunting blade.'
        });
        if (!name) {
            return;
        }
        const description = await vscode.window.showInputBox({
            title: 'Description (optional)',
            prompt: "Begins with 'Identifies' or 'Detects'."
        });
        if (description === undefined) {
            return;
        }

        const draft = {
            id: uuidv4(),
            name: name.trim(),
            description: description.trim() || `Identifies ${name.trim()}.`,
            query: '// Author the hunting query (Log Analytics KQL) here.\nSigninLogs\n| where TimeGenerated > ago(1d)\n| take 100',
            tactics: ['InitialAccess'],
            techniques: ['T1078']
        };
        await this.openYaml(draft);
    }

    /** Parser (saved KQL function). Schema derived from Content/Parsers examples. */
    public static async createParser(): Promise<void> {
        const name = await vscode.window.showInputBox({
            title: 'Parser name',
            prompt: 'Display name of the parser (saved function).'
        });
        if (!name) {
            return;
        }
        const functionAlias = await vscode.window.showInputBox({
            title: 'Function alias',
            prompt: 'KQL function name used to call the parser.',
            value: this.toIdentifier(name)
        });
        if (!functionAlias) {
            return;
        }
        const category = await vscode.window.showInputBox({ title: 'Category (optional)', value: 'Security' });
        if (category === undefined) {
            return;
        }
        const description = await vscode.window.showInputBox({ title: 'Description (optional)' });
        if (description === undefined) {
            return;
        }

        const draft = {
            id: this.toIdentifier(name),
            name: name.trim(),
            description: description.trim() || `Normalises data for ${name.trim()}.`,
            category: category.trim() || 'Security',
            functionAlias: functionAlias.trim(),
            query: '// Author the parser KQL body here.\nunion isfuzzy=true SigninLogs\n| project TimeGenerated'
        };
        await this.openYaml(draft);
    }

    /** Summary rule (Log Analytics). Schema: Docs/Content/Summary-Rules.md */
    public static async createSummaryRule(): Promise<void> {
        const name = await vscode.window.showInputBox({
            title: 'Summary rule name',
            prompt: 'Alphanumeric and hyphens only. Used as the resource name.',
            validateInput: value => /^[A-Za-z0-9-]+$/.test(value.trim()) ? undefined : 'Use alphanumeric characters and hyphens only.'
        });
        if (!name) {
            return;
        }
        const binSize = await vscode.window.showQuickPick(this.SUMMARY_BIN_SIZES, {
            title: 'Bin size (minutes)',
            placeHolder: '60 = hourly (a sensible default for SOC dashboards)'
        });
        if (!binSize) {
            return;
        }
        const destinationTable = await vscode.window.showInputBox({
            title: 'Destination table',
            prompt: 'Custom log table that receives the aggregated results. Must end with _CL.',
            value: `${name.trim().replace(/-/g, '')}_CL`,
            validateInput: value => /_CL$/.test(value.trim()) ? undefined : 'Destination table must end with the _CL suffix.'
        });
        if (!destinationTable) {
            return;
        }
        const description = await vscode.window.showInputBox({ title: 'Description (optional)' });
        if (description === undefined) {
            return;
        }

        const draft = {
            name: name.trim(),
            displayName: name.trim(),
            description: description.trim() || `Aggregation summary for ${name.trim()}.`,
            query: 'SigninLogs\n| summarize SuccessCount = countif(ResultType == 0), FailureCount = countif(ResultType != 0) by Location = tostring(LocationDetails.countryOrRegion), AppDisplayName',
            binSize: Number(binSize),
            destinationTable: destinationTable.trim(),
            binDelay: 10
        };
        await this.openJson(draft);
    }

    /** Automation rule. Schema: Docs/Content/Automation-Rules.md */
    public static async createAutomationRule(): Promise<void> {
        const displayName = await vscode.window.showInputBox({
            title: 'Automation rule name',
            prompt: 'Display name shown in the Sentinel portal.'
        });
        if (!displayName) {
            return;
        }
        const orderInput = await vscode.window.showInputBox({
            title: 'Order (1-1000)',
            prompt: 'Execution priority. Lower numbers run first.',
            value: '100',
            validateInput: value => {
                const order = Number(value);
                return Number.isInteger(order) && order >= 1 && order <= 1000 ? undefined : 'Enter an integer between 1 and 1000.';
            }
        });
        if (!orderInput) {
            return;
        }
        const triggersOn = await vscode.window.showQuickPick(['Incidents', 'Alerts'], { title: 'Triggers on' });
        if (!triggersOn) {
            return;
        }
        const triggersWhen = await vscode.window.showQuickPick(['Created', 'Updated'], { title: 'Triggers when' });
        if (!triggersWhen) {
            return;
        }

        const draft = {
            automationRuleId: uuidv4(),
            displayName: displayName.trim(),
            order: Number(orderInput),
            triggeringLogic: {
                isEnabled: true,
                triggersOn,
                triggersWhen,
                conditions: []
            },
            actions: [
                {
                    actionType: 'ModifyProperties',
                    order: 1,
                    actionConfiguration: {
                        severity: 'Medium'
                    }
                }
            ]
        };
        await this.openJson(draft);
    }

    private static async openYaml(draft: unknown): Promise<void> {
        const content = yaml.dump(draft, { indent: 2, lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });
        const doc = await vscode.workspace.openTextDocument({ content, language: 'yaml' });
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private static async openJson(draft: unknown): Promise<void> {
        const content = JSON.stringify(draft, null, 2) + '\n';
        const doc = await vscode.workspace.openTextDocument({ content, language: 'json' });
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private static toIdentifier(name: string): string {
        const pascal = (name ?? '')
            .replace(/[^A-Za-z0-9]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
        return pascal || 'NewItem';
    }
}
