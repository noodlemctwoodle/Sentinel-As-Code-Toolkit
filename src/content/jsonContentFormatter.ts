//
// src/content/jsonContentFormatter.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';

/**
 * Formats JSON-based Sentinel-as-Code content (Automation Rules, Summary Rules,
 * Watchlists, Workbooks, Playbooks) by pretty-printing with a consistent
 * two-space indent. Key order is preserved to avoid changing ARM/gallery
 * semantics; only whitespace and indentation are normalised.
 */
export class JsonContentFormatter {
    public static formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
        const content = document.getText();

        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            vscode.window.showErrorMessage(`Cannot format: document is not valid JSON (${error})`);
            return [];
        }

        const normalised = JSON.stringify(parsed, null, 2) + '\n';
        if (normalised === content) {
            return [];
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(content.length)
        );

        return [new vscode.TextEdit(fullRange, normalised)];
    }
}
