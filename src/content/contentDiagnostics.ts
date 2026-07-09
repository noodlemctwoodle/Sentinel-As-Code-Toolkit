//
// src/content/contentDiagnostics.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import { detectContentType, SentinelContentType } from './contentTypes';
import { HuntingQueryValidator } from './huntingQueryValidator';

/**
 * Provides live diagnostics for Sentinel-as-Code content types that are not
 * covered by the analytics-rule validator (currently hunting queries).
 * Owns its own diagnostic collection and document listeners.
 */
export class ContentDiagnosticsManager {
    private readonly collection: vscode.DiagnosticCollection;
    private readonly huntingValidator = new HuntingQueryValidator();

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('sentinel-content');
    }

    public registerListeners(): vscode.Disposable[] {
        return [
            this.collection,
            vscode.workspace.onDidChangeTextDocument(event => this.update(event.document)),
            vscode.workspace.onDidSaveTextDocument(document => this.update(document)),
            vscode.workspace.onDidOpenTextDocument(document => this.update(document))
        ];
    }

    public updateOpenDocuments(): void {
        vscode.workspace.textDocuments.forEach(document => this.update(document));
    }

    private update(document: vscode.TextDocument): void {
        if (document.languageId !== 'yaml') {
            this.collection.delete(document.uri);
            return;
        }

        const validationEnabled = vscode.workspace
            .getConfiguration('sentinelAsCode')
            .get<boolean>('validation.enabled', true);
        if (!validationEnabled) {
            this.collection.delete(document.uri);
            return;
        }

        const info = detectContentType(document);
        if (info.type === SentinelContentType.HuntingQuery) {
            this.collection.set(document.uri, this.huntingValidator.validateDocument(document));
        } else {
            this.collection.delete(document.uri);
        }
    }

    public dispose(): void {
        this.collection.dispose();
    }
}
