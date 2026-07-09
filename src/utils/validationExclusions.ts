//
// src/utils/validationExclusions.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import { matchesAnyGlob } from './globMatcher';

/**
 * True when the document path matches any glob in the
 * sentinelAsCode.validation.excludePatterns setting. Patterns are tested against
 * the workspace-relative path and the absolute path, case-insensitively on Windows.
 */
export function isDocumentExcludedFromValidation(document: vscode.TextDocument): boolean {
    const patterns = vscode.workspace
        .getConfiguration('sentinelAsCode')
        .get<string[]>('validation.excludePatterns', []);
    if (!patterns || patterns.length === 0) {
        return false;
    }
    const caseSensitive = process.platform !== 'win32';
    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    return matchesAnyGlob(relativePath, patterns, caseSensitive)
        || matchesAnyGlob(document.uri.fsPath, patterns, caseSensitive);
}
