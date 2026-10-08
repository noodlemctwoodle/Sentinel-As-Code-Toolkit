import * as vscode from 'vscode';
import { SentinelRuleValidator } from '../validation/validator';
import { affectsSentinelSettings, shouldValidateOnSave, shouldValidateOnType } from '../utils/validationTriggers';

export class DocumentListenerManager {
    private validator: SentinelRuleValidator;

    constructor(validator: SentinelRuleValidator) {
        this.validator = validator;
    }

    public registerListeners(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Document change listener
        disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (shouldValidateOnType()) {
                    this.validator.updateDiagnostics(event.document);
                }
            })
        );

        // Document save listener  
        disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (shouldValidateOnSave()) {
                    this.validator.updateDiagnostics(document);
                }
            })
        );

        // Document open listener
        disposables.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                this.validator.updateDiagnostics(document);
            })
        );

        // Re-run validation when settings change (validation.enabled, MITRE and
        // connector strictness, field-order hints) so open files reflect them.
        disposables.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (affectsSentinelSettings(event)) {
                    this.validateOpenDocuments();
                }
            })
        );

        return disposables;
    }

    public validateOpenDocuments(): void {
        vscode.workspace.textDocuments.forEach((document: vscode.TextDocument) => {
            this.validator.updateDiagnostics(document);
        });
    }
}