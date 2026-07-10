//
// src/content/contentBuilders.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { SentinelRuleFormatter } from '../formatting/formatter';
import { promptSaveAndOpen } from './contentFiles';

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

        const draft = await this.loadTemplateObject('hunting-query.template.yaml');
        draft.id = uuidv4();
        draft.name = name.trim();
        draft.description = description.trim() || `Identifies ${name.trim()}.`;
        await this.saveDraft(draft, 'hunting_query.yaml');
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

        const draft = await this.loadTemplateObject('parser.template.yaml');
        draft.id = this.toIdentifier(name);
        draft.name = name.trim();
        draft.description = description.trim() || `Normalises data for ${name.trim()}.`;
        draft.category = category.trim() || 'Security';
        draft.functionAlias = functionAlias.trim();
        await this.saveDraft(draft, 'parser.yaml');
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

        const draft = await this.loadTemplateObject('summary-rule.template.yaml');
        draft.name = name.trim();
        draft.displayName = name.trim();
        draft.description = description.trim() || `Aggregation summary for ${name.trim()}.`;
        draft.binSize = Number(binSize);
        draft.destinationTable = destinationTable.trim();
        await this.saveDraft(draft, 'summary_rule.yaml');
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

        const draft = await this.loadTemplateObject('automation-rule.template.yaml');
        draft.automationRuleId = uuidv4();
        draft.displayName = displayName.trim();
        draft.order = Number(orderInput);
        const triggeringLogic = draft.triggeringLogic as Record<string, unknown>;
        triggeringLogic.triggersOn = triggersOn;
        triggeringLogic.triggersWhen = triggersWhen;
        await this.saveDraft(draft, 'automation_rule.yaml');
    }

    /**
     * Loads a YAML content template and parses it into an editable draft object.
     * The {{GUID}} placeholder is replaced with a fresh id before parsing (since
     * "{{...}}" is not a legal YAML plain scalar); callers may override the id.
     */
    private static async loadTemplateObject(fileName: string): Promise<Record<string, any>> {
        const raw = (await SentinelRuleFormatter.loadContentTemplate(fileName)).replace(/\{\{GUID\}\}/g, uuidv4());
        return (yaml.load(raw) ?? {}) as Record<string, any>;
    }

    /**
     * Serialises the draft as YAML and asks where to save it. Every content type is
     * authored as YAML; convert to JSON with "Convert Content YAML to JSON" when the
     * repo requires JSON (summary rules, automation rules, watchlists).
     */
    private static async saveDraft(draft: unknown, defaultFilename: string): Promise<void> {
        const content = yaml.dump(draft, { indent: 2, lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false });
        await promptSaveAndOpen(defaultFilename, content, 'yaml');
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
