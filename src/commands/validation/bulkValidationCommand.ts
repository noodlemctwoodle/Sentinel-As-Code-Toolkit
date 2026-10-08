//
// src/commands/validation/bulkValidationCommand.ts
//
// Created by Toby G on 08/10/2026.
//

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseCommand } from '../base/baseCommand';
import { SentinelRuleFormatter } from '../../formatting/formatter';
import { RuleTypeDetector, RuleType } from '../../utils/ruleTypeDetector';
import { isDocumentExcludedFromValidation } from '../../utils/validationExclusions';

type BulkAction = 'validate' | 'fix' | 'report';

interface FileResult {
    uri: vscode.Uri;
    errors: vscode.Diagnostic[];
    warnings: vscode.Diagnostic[];
}

/**
 * "Bulk Maintenance & Validation": validates, formats, or reports on every Sentinel
 * analytics rule in a chosen folder. Scaffolding templates and files matched by
 * sentinelAsCode.validation.excludePatterns are skipped.
 */
export class BulkValidationCommand extends BaseCommand {
    public registerCommands(): vscode.Disposable[] {
        return [vscode.commands.registerCommand('sentinelAsCode.validateWorkspace', this.run.bind(this))];
    }

    private async run(uri?: vscode.Uri): Promise<void> {
        try {
            const folder = uri ?? await this.pickFolder();
            if (!folder) {
                return;
            }

            const rules = await this.findRules(folder);
            const folderName = path.basename(folder.fsPath);
            if (rules.length === 0) {
                vscode.window.showInformationMessage(`No Sentinel analytics rules found in "${folderName}".`);
                return;
            }

            const action = await this.pickAction(rules.length);
            if (!action) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `${action === 'fix' ? 'Formatting' : 'Validating'} Sentinel rules in ${folderName}`,
                cancellable: false
            }, async progress => {
                const step = 100 / rules.length;
                const results: FileResult[] = [];
                let formatted = 0;
                for (const document of rules) {
                    progress.report({ increment: step, message: path.basename(document.uri.fsPath) });
                    if (action === 'fix' && await this.formatAndSave(document)) {
                        formatted++;
                    }
                    results.push(this.validate(document));
                }
                await this.report(action, results, folderName, formatted);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Bulk maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async pickFolder(): Promise<vscode.Uri | undefined> {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select a folder of Sentinel rules to validate or format',
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
        });
        return picked?.[0];
    }

    private async findRules(folder: vscode.Uri): Promise<vscode.TextDocument[]> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '**/*.{yaml,yml}'),
            '**/node_modules/**'
        );
        const rules: vscode.TextDocument[] = [];
        for (const file of files.sort((a, b) => a.fsPath.localeCompare(b.fsPath))) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                if (!isDocumentExcludedFromValidation(document) && RuleTypeDetector.detectType(document.getText()) === RuleType.SENTINEL) {
                    rules.push(document);
                }
            } catch {
                // Unreadable files are skipped.
            }
        }
        return rules;
    }

    private async pickAction(count: number): Promise<BulkAction | undefined> {
        const items: Array<vscode.QuickPickItem & { action: BulkAction }> = [
            { action: 'validate', label: '$(search) Validate only', detail: 'Check every rule and list the problems in the Problems panel' },
            { action: 'fix', label: '$(tools) Format and fix field order', detail: 'Format every rule, save it, then validate' },
            { action: 'report', label: '$(report) Validation report', detail: 'Open a Markdown report of every error and warning' }
        ];
        const picked = await vscode.window.showQuickPick(items, {
            title: 'Bulk Maintenance & Validation',
            placeHolder: `Choose what to do with ${count} Sentinel rule${count === 1 ? '' : 's'}`
        });
        return picked?.action;
    }

    private async formatAndSave(document: vscode.TextDocument): Promise<boolean> {
        const edits = SentinelRuleFormatter.formatDocument(document, false);
        if (edits.length === 0 || edits.every(e => e.newText === document.getText(e.range))) {
            return false;
        }
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
        await document.save();
        return true;
    }

    private validate(document: vscode.TextDocument): FileResult {
        this.validator.updateDiagnostics(document);
        const diagnostics = this.validator.validateDocument(document);
        return {
            uri: document.uri,
            errors: diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error),
            warnings: diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
        };
    }

    private async report(action: BulkAction, results: FileResult[], folderName: string, formatted: number): Promise<void> {
        const errors = results.reduce((n, r) => n + r.errors.length, 0);
        const warnings = results.reduce((n, r) => n + r.warnings.length, 0);
        const failing = results.filter(r => r.errors.length + r.warnings.length > 0);

        if (action === 'report') {
            const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: this.buildReport(results, folderName) });
            await vscode.window.showTextDocument(document, { preview: false });
            return;
        }

        const formattedNote = action === 'fix' ? ` Formatted ${formatted} file${formatted === 1 ? '' : 's'}.` : '';
        const summary = `Checked ${results.length} rule${results.length === 1 ? '' : 's'} in "${folderName}".${formattedNote} ${errors} error(s) and ${warnings} warning(s) in ${failing.length} file(s).`;
        if (failing.length === 0) {
            vscode.window.showInformationMessage(summary);
            return;
        }
        const choice = await vscode.window.showWarningMessage(summary, 'Show Problems');
        if (choice === 'Show Problems') {
            await vscode.commands.executeCommand('workbench.actions.view.problems');
        }
    }

    private buildReport(results: FileResult[], folderName: string): string {
        const lines = [`# Sentinel rule validation: ${folderName}`, '', `Rules checked: ${results.length}`, ''];
        for (const result of results) {
            const relative = vscode.workspace.asRelativePath(result.uri);
            const problems = [...result.errors, ...result.warnings];
            if (problems.length === 0) {
                lines.push(`- ${relative}: no errors or warnings`);
                continue;
            }
            lines.push(`- ${relative}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
            for (const d of problems) {
                const level = d.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warning';
                lines.push(`  - ${level}, line ${d.range.start.line + 1}: ${d.message}`);
            }
        }
        return lines.join('\n') + '\n';
    }
}
