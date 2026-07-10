//
// src/content/watchlistBuilder.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SentinelRuleFormatter } from '../formatting/formatter';

/**
 * Converts a raw CSV/TSV into a deployment-ready Sentinel-as-Code watchlist:
 * a `watchlist.json` metadata file plus the data file, in a folder named after
 * the alias (Content/Watchlists/<alias>/). Schema per Docs/Content/Watchlists.md.
 */
export class WatchlistBuilder {
    public static async createFromActiveCsv(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Open a CSV/TSV file to convert into a watchlist.');
            return;
        }

        // Only convert genuine CSV/TSV data. Without this guard the command writes
        // the active editor's contents verbatim into data.csv, so running it while a
        // rule or JSON tab is focused produced a watchlist whose data file held an
        // analytics rule instead of tabular rows.
        const fsPath = editor.document.uri.fsPath;
        const languageId = editor.document.languageId;
        const isTsv = /\.tsv$/i.test(fsPath) || languageId === 'tsv';
        const isCsvOrTsv = isTsv || /\.csv$/i.test(fsPath) || languageId === 'csv';
        if (!isCsvOrTsv) {
            vscode.window.showErrorMessage(
                'The active editor is not a CSV or TSV file. Open the CSV/TSV data file you want to convert into a watchlist, then run this command again.'
            );
            return;
        }

        const dataText = editor.document.getText();
        const headers = this.parseHeaders(dataText, isTsv);
        if (headers.length === 0) {
            vscode.window.showErrorMessage('Could not read a header row. The first line must contain the column names.');
            return;
        }

        const baseName = path.basename(editor.document.uri.fsPath).replace(/\.(csv|tsv)$/i, '');
        const defaultAlias = this.toPascalCase(baseName);

        const alias = await vscode.window.showInputBox({
            title: 'Watchlist alias',
            prompt: 'Unique alias used in KQL via _GetWatchlist(...). The watchlist folder is named after this.',
            value: defaultAlias,
            validateInput: value => /^[A-Za-z0-9_]+$/.test(value.trim()) ? undefined : 'Use letters, numbers, and underscores only.'
        });
        if (!alias) {
            return;
        }

        const displayName = await vscode.window.showInputBox({
            title: 'Watchlist display name',
            prompt: 'Human-readable name shown in the Sentinel UI.',
            value: alias.trim()
        });
        if (displayName === undefined) {
            return;
        }

        const description = await vscode.window.showInputBox({
            title: 'Watchlist description',
            prompt: "Describe the watchlist's purpose."
        });
        if (description === undefined) {
            return;
        }

        const itemsSearchKey = await vscode.window.showQuickPick(headers, {
            title: 'Primary key column (itemsSearchKey)',
            placeHolder: 'Select the CSV column that uniquely identifies each row'
        });
        if (!itemsSearchKey) {
            return;
        }

        const targetFolder = await this.resolveTargetFolder(alias.trim());
        if (!targetFolder) {
            return;
        }

        const metadata = yaml.load(await SentinelRuleFormatter.loadContentTemplate('watchlist.template.yaml')) as Record<string, any>;
        metadata.watchlistAlias = alias.trim();
        metadata.displayName = (displayName || alias).trim();
        metadata.description = (description || '').trim();
        metadata.provider = 'Custom';
        metadata.itemsSearchKey = itemsSearchKey;
        const dataFileName = isTsv ? 'data.tsv' : 'data.csv';

        try {
            await vscode.workspace.fs.createDirectory(targetFolder);
            await vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(targetFolder, 'watchlist.json'),
                Buffer.from(JSON.stringify(metadata, null, 2) + '\n', 'utf8')
            );
            await vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(targetFolder, dataFileName),
                Buffer.from(dataText, 'utf8')
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write watchlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        const metaDoc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(targetFolder, 'watchlist.json'));
        await vscode.window.showTextDocument(metaDoc, { preview: false });
        vscode.window.showInformationMessage(`Watchlist "${alias.trim()}" is deployment-ready (watchlist.json + ${dataFileName}).`);
    }

    private static parseHeaders(text: string, isTsv: boolean): string[] {
        const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0);
        if (!firstLine) {
            return [];
        }
        const delimiter = isTsv ? '\t' : ',';
        return firstLine
            .split(delimiter)
            .map(header => header.trim().replace(/^"(.*)"$/, '$1').trim())
            .filter(header => header.length > 0);
    }

    private static async resolveTargetFolder(alias: string): Promise<vscode.Uri | undefined> {
        // Prefer an existing Content/Watchlists folder in the workspace.
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const candidate = vscode.Uri.joinPath(folder.uri, 'Content', 'Watchlists');
            try {
                const stat = await vscode.workspace.fs.stat(candidate);
                if ((stat.type & vscode.FileType.Directory) !== 0) {
                    return vscode.Uri.joinPath(candidate, alias);
                }
            } catch {
                // Content/Watchlists not present in this workspace root; keep looking.
            }
        }

        // Otherwise let the user pick a parent folder for the watchlist.
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select the Watchlists parent folder'
        });
        return picked?.[0] ? vscode.Uri.joinPath(picked[0], alias) : undefined;
    }

    private static toPascalCase(name: string): string {
        const pascal = (name ?? '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
        return pascal || 'Watchlist';
    }
}
