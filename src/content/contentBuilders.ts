//
// src/content/contentBuilders.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { SentinelRuleFormatter } from '../formatting/formatter';
import { promptSaveAndOpen } from './contentFiles';

/**
 * Scaffolders for new Sentinel-as-Code content. Each asks where to save, writes the
 * commented YAML template (with a fresh GUID) to that location, and opens it so every
 * field is filled in the file rather than through Command Palette prompts.
 * (Watchlists are handled by WatchlistBuilder; Workbooks/Playbooks are ARM exports
 * and out of scope.)
 */
export class ContentBuilders {
    /** Hunting query (Log Analytics saved search). Schema: Docs/Content/Hunting-Queries.md */
    public static async createHuntingQuery(): Promise<void> {
        await this.createFromTemplate('hunting-query.template.yaml', 'hunting_query.yaml');
    }

    /** Parser (saved KQL function). Schema derived from Content/Parsers examples. */
    public static async createParser(): Promise<void> {
        await this.createFromTemplate('parser.template.yaml', 'parser.yaml');
    }

    /** Summary rule (Log Analytics). Schema: Docs/Content/Summary-Rules.md */
    public static async createSummaryRule(): Promise<void> {
        await this.createFromTemplate('summary-rule.template.yaml', 'summary_rule.yaml');
    }

    /** Automation rule. Schema: Docs/Content/Automation-Rules.md */
    public static async createAutomationRule(): Promise<void> {
        await this.createFromTemplate('automation-rule.template.yaml', 'automation_rule.yaml');
    }

    /**
     * Loads a commented YAML content template, replaces the {{GUID}} placeholder with a
     * fresh id, asks where to save it, and opens it for editing.
     */
    private static async createFromTemplate(templateFile: string, defaultFilename: string): Promise<void> {
        let content: string;
        try {
            content = (await SentinelRuleFormatter.loadContentTemplate(templateFile)).replace(/\{\{GUID\}\}/g, uuidv4());
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load ${templateFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }
        await promptSaveAndOpen(defaultFilename, content, 'yaml');
    }
}
