//
// src/content/contentFiles.ts
//
// Created by Toby G on 10/07/2026.
//

import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Prompts for a save location (defaulting to the first workspace folder and the
 * supplied filename), writes the content there, opens it in the chosen language,
 * and returns the saved URI. Returns undefined when the user cancels the dialog.
 *
 * Centralising this keeps every "New Sentinel-as-Code Content..." path consistent:
 * the author is always asked where to create the file rather than it being dropped
 * in the workspace root or left as an untitled buffer.
 */
export async function promptSaveAndOpen(
    defaultFilename: string,
    content: string,
    languageId: 'yaml' | 'json'
): Promise<vscode.Uri | undefined> {
    const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const filters: Record<string, string[]> = languageId === 'json'
        ? { 'JSON Files': ['json'], 'All Files': ['*'] }
        : { 'YAML Files': ['yaml', 'yml'], 'All Files': ['*'] };

    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: defaultFolder ? vscode.Uri.file(path.join(defaultFolder, defaultFilename)) : undefined,
        filters,
        title: `Save ${defaultFilename}`
    });
    if (!saveUri) {
        return undefined;
    }

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf8'));
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.languages.setTextDocumentLanguage(doc, languageId);
    await vscode.window.showTextDocument(doc, { preview: false });
    return saveUri;
}
