//
// src/content/parserFormatter.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

/**
 * Canonical field order for Sentinel-as-Code parsers (saved KQL functions).
 * Source: Content/Parsers example files (there is no separate Parsers doc).
 * A parser is a KQL function published to the workspace and referenced by its
 * functionAlias in other queries.
 */
export const PARSER_ORDER = [
    'id',
    'name',
    'description',
    'category',
    'functionAlias',
    'functionParameters',
    'query',
    'version',
    'tags'
];

export class ParserFormatter {
    private static readonly DUMP_OPTIONS: yaml.DumpOptions = {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false
    };

    /**
     * Reorders parser fields into the canonical order and normalises YAML output.
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
            vscode.window.showErrorMessage(`Failed to format parser: ${error}`);
            return [];
        }
    }

    private static reorderFields(parsed: Record<string, unknown>): Record<string, unknown> {
        const reordered: Record<string, unknown> = {};

        for (const field of PARSER_ORDER) {
            if (field in parsed) {
                reordered[field] = parsed[field];
            }
        }

        for (const [key, value] of Object.entries(parsed)) {
            if (!PARSER_ORDER.includes(key)) {
                reordered[key] = value;
            }
        }

        return reordered;
    }
}
