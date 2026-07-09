import * as vscode from 'vscode';
import { BaseCommand } from '../base/baseCommand';
import { SentinelRuleFormatter } from '../../formatting/formatter';
import { SentinelContentFormatter } from '../../content/contentFormatter';
import { RuleTypeDetector } from '../../utils/ruleTypeDetector';

export class FormatCommands extends BaseCommand {
    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.fixFieldOrder', this.fixFieldOrder.bind(this))
        );

        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.formatRule', this.formatRule.bind(this))
        );

        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.formatContent', this.formatContent.bind(this))
        );

        return disposables;
    }

    private async formatContent(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const result = SentinelContentFormatter.format(editor.document);

        if (!result.supported) {
            vscode.window.showWarningMessage(result.message ?? 'This content type is not supported for formatting.');
            return;
        }

        if (result.edits.length === 0) {
            vscode.window.showInformationMessage(`${result.info.label} is already formatted.`);
            return;
        }

        await editor.edit(editBuilder => {
            for (const edit of result.edits) {
                editBuilder.replace(edit.range, edit.newText);
            }
        });

        vscode.window.showInformationMessage(`Formatted ${result.info.label}.`);
    }

    private async fixFieldOrder(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const edits = SentinelRuleFormatter.reorderFieldsOnly(editor.document);
        if (edits.length > 0) {
            await editor.edit(editBuilder => {
                for (const edit of edits) {
                    editBuilder.replace(edit.range, edit.newText);
                }
            });
        }
    }

    private formatRule(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const isYamlFile = /\.(ya?ml)$/i.test(document.fileName);
        if (!isYamlFile || !RuleTypeDetector.isSentinelRule(document.getText())) {
            vscode.window.showErrorMessage('This command only works on Sentinel YAML files');
            return;
        }

        // Use the same formatter as the document formatting provider
        const edits = SentinelRuleFormatter.formatDocument(document);
        if (edits.length > 0) {
            editor.edit(editBuilder => {
                for (const edit of edits) {
                    editBuilder.replace(edit.range, edit.newText);
                }
            });
        }
    }
}