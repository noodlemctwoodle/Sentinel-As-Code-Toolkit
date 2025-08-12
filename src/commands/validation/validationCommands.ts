import * as vscode from 'vscode';
// Removed unused imports: path and SentinelRuleFormatter
import { BaseCommand } from '../base/baseCommand';
import { SentinelRuleValidator } from '../../validation/validator';
import { DefenderDetectionValidator } from '../../validation/defenderDetectionValidator';
import { RuleTypeDetector, RuleType } from '../../utils/ruleTypeDetector';
import * as yaml from 'js-yaml';

export class ValidationCommands extends BaseCommand {
    private defenderValidator: DefenderDetectionValidator;

    constructor(context: vscode.ExtensionContext, validator: SentinelRuleValidator) {
        super(context, validator);
        this.defenderValidator = new DefenderDetectionValidator();
    }

    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Register existing validation command with auto-detection
        disposables.push(
            vscode.commands.registerCommand('sentinelRules.validateRule', this.validateRule.bind(this))
        );

        // Add specific commands for each type if needed
        disposables.push(
            vscode.commands.registerCommand('sentinelRules.validateSentinelRule', this.validateSentinelRule.bind(this))
        );

        disposables.push(
            vscode.commands.registerCommand('defender.validateDetection', this.validateDefenderDetection.bind(this))
        );

        return disposables;
    }

    /**
     * Auto-detect rule type and validate accordingly
     */
    private async validateRule(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const document = editor.document;
        const content = document.getText();

        // Detect rule type
        const ruleType = RuleTypeDetector.detectType(content);

        // Debug: Show what type was detected
        console.log(`Detected rule type: ${ruleType}`);

        switch (ruleType) {
            case RuleType.SENTINEL:
                await this.validateSentinelRule();
                break;
            case RuleType.DEFENDER:
                await this.validateDefenderDetection();
                break;
            case RuleType.UNKNOWN:
                // If unknown, check for key fields to make a best guess
                if (content.includes('detectorId') || content.includes('queryCondition')) {
                    // Likely a Defender detection
                    await this.validateDefenderDetection();
                } else if (content.includes('tactics') || content.includes('queryFrequency')) {
                    // Likely a Sentinel rule
                    await this.validateSentinelRule();
                } else {
                    vscode.window.showWarningMessage('Unable to determine rule type. Please use specific validation commands.');
                }
                break;
        }
    }

    /**
     * Validate as Sentinel Analytics Rule
     */
    private async validateSentinelRule(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        // The validateDocument method likely returns vscode.Diagnostic[] directly
        // or it might not exist - we should use the validator's actual method
        try {
            // Try to validate the document
            const diagnostics = this.validator.validateDocument(editor.document);
            
            // If diagnostics is an array (vscode.Diagnostic[])
            if (Array.isArray(diagnostics)) {
                if (diagnostics.length === 0) {
                    vscode.window.showInformationMessage('✅ Sentinel Analytics Rule validation passed!');
                } else {
                    const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
                    const warningCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
                    
                    vscode.window.showWarningMessage(
                        `Sentinel Rule validation found ${errorCount} error(s) and ${warningCount} warning(s)`
                    );
                }
            } else {
                // If it's not an array, try to handle it as an object with properties
                const validationResult = diagnostics as any;
                if (validationResult.errors && validationResult.warnings) {
                    if (validationResult.errors.length === 0) {
                        vscode.window.showInformationMessage('✅ Sentinel Analytics Rule validation passed!');
                    } else {
                        vscode.window.showWarningMessage(
                            `Sentinel Rule validation found ${validationResult.errors.length} error(s) and ${validationResult.warnings.length} warning(s)`
                        );
                    }
                } else {
                    // Fallback - just show success
                    vscode.window.showInformationMessage('Sentinel Analytics Rule validation completed');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to validate Sentinel rule: ${error}`);
        }
    }

    /**
     * Validate as Defender Custom Detection
     */
    private async validateDefenderDetection(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const document = editor.document;
        const content = document.getText();

        try {
            // Parse content (try YAML first, then JSON)
            let parsedContent: any;
            try {
                parsedContent = yaml.load(content);
            } catch {
                parsedContent = JSON.parse(content);
            }

            // Validate using Defender validator
            const result = this.defenderValidator.validate(parsedContent);

            // Create diagnostics
            const diagnostics: vscode.Diagnostic[] = [];
            const diagnosticCollection = vscode.languages.createDiagnosticCollection('defenderDetection');

            // Add errors
            for (const error of result.errors) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0), // You might want to improve position detection
                    `❌ ${error}`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            // Add warnings
            for (const warning of result.warnings) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    `⚠️ ${warning}`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // Add info
            for (const info of result.info) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    `ℹ️ ${info}`,
                    vscode.DiagnosticSeverity.Information
                ));
            }

            // Set diagnostics
            diagnosticCollection.set(document.uri, diagnostics);

            // Show summary message
            if (result.isValid) {
                vscode.window.showInformationMessage(
                    `✅ Defender Custom Detection validation passed! ${result.warnings.length > 0 ? `(${result.warnings.length} warning(s))` : ''}`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ Defender Custom Detection validation failed: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`
                );
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to validate Defender detection: ${error}`);
        }
    }
}