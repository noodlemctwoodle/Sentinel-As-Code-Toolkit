//
// src/content/huntingQueryFormatter.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

/**
 * Canonical field order for Sentinel-as-Code hunting queries.
 * Source: Docs/Content/Hunting-Queries.md (Log Analytics Saved Searches schema).
 * Required: id, name, query. Optional: description, tactics, techniques, tags.
 * Note: hunting queries use `techniques` (not `relevantTechniques`) and `tags`
 * is an array of { name, value } objects rather than plain strings.
 */
export const HUNTING_QUERY_ORDER = [
    'id',
    'name',
    'description',
    'query',
    'tactics',
    'techniques',
    'tags'
];

export class HuntingQueryFormatter {
    private static readonly DUMP_OPTIONS: yaml.DumpOptions = {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    };

    /**
     * Reorders hunting query fields into the canonical order and normalises YAML output.
     */
    public static formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
        const content = document.getText();

        try {
            const parsed = yaml.load(content);
            if (!parsed || typeof parsed !== 'object') {
                return [];
            }

            const reordered = this.reorderFields(parsed as Record<string, unknown>);
            const newContent = yaml.dump(reordered, this.DUMP_OPTIONS);

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            return [new vscode.TextEdit(fullRange, newContent)];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to format hunting query: ${error}`);
            return [];
        }
    }

    private static reorderFields(parsed: Record<string, unknown>): Record<string, unknown> {
        const reordered: Record<string, unknown> = {};

        for (const field of HUNTING_QUERY_ORDER) {
            if (field in parsed) {
                reordered[field] = parsed[field];
            }
        }

        for (const [key, value] of Object.entries(parsed)) {
            if (!HUNTING_QUERY_ORDER.includes(key)) {
                reordered[key] = value;
            }
        }

        return reordered;
    }
}
