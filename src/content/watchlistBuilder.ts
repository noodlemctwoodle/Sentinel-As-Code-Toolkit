//
// src/content/watchlistBuilder.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import { SentinelRuleFormatter } from '../formatting/formatter';
import { promptSaveAndOpen } from './contentFiles';

/**
 * Creates Sentinel-as-Code watchlists as YAML: a blank metadata template, or a
 * scaffold seeded with the active CSV/TSV as the data file alongside it. The author
 * fills in watchlistAlias and itemsSearchKey in the YAML, then converts to JSON to
 * deploy. Schema per Docs/Content/Watchlists.md.
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

        let template: string;
        try {
            template = await SentinelRuleFormatter.loadContentTemplate('watchlist.template.yaml');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load watchlist template: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        // Ask where to save the metadata; the data file is written alongside it. The
        // author sets watchlistAlias and itemsSearchKey (matching a data column) in the YAML.
        const savedUri = await promptSaveAndOpen('watchlist.yaml', template, 'yaml');
        if (!savedUri) {
            return;
        }

        const dataFileName = isTsv ? 'data.tsv' : 'data.csv';
        try {
            await vscode.workspace.fs.writeFile(
                vscode.Uri.joinPath(savedUri, '..', dataFileName),
                Buffer.from(dataText, 'utf8')
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write ${dataFileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        vscode.window.showInformationMessage(`Watchlist scaffold created with ${dataFileName}. Set watchlistAlias and itemsSearchKey in the YAML, then convert to JSON when ready to deploy.`);
    }

    /**
     * Scaffolds a blank watchlist metadata file (YAML) from the bundled template for
     * hand-editing. The author pairs it with a data.csv/data.tsv in the same folder,
     * then converts to JSON with "Convert Content YAML to JSON" before deploying.
     */
    public static async createTemplate(): Promise<void> {
        let content: string;
        try {
            content = await SentinelRuleFormatter.loadContentTemplate('watchlist.template.yaml');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load watchlist template: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        const saved = await promptSaveAndOpen('watchlist.yaml', content, 'yaml');
        if (saved) {
            vscode.window.showInformationMessage('Watchlist template created. Add a data.csv/data.tsv alongside it, set watchlistAlias and itemsSearchKey, then convert to JSON when ready to deploy.');
        }
    }
}
