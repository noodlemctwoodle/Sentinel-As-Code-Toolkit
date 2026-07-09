import * as vscode from 'vscode';
import * as path from 'path';
import { BaseCommand } from '../base/baseCommand';
import { ArmToYamlConverter, ConversionOptions } from '../../conversion/armToYamlConverter';

export class ConversionCommands extends BaseCommand {
    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.convertArmToYaml', this.convertArmToYaml.bind(this))
        );

        return disposables;
    }

    private async convertArmToYaml(uri?: vscode.Uri): Promise<void> {
        try {
            let sourceFile: vscode.Uri;

            // Determine source file
            if (uri && uri.fsPath.endsWith('.json')) {
                sourceFile = uri;
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.fileName.endsWith('.json')) {
                    sourceFile = activeEditor.document.uri;
                } else {
                    // Show file picker
                    const selectedFiles = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'JSON files': ['json']
                        },
                        title: 'Select ARM Template to Convert'
                    });

                    if (!selectedFiles || selectedFiles.length === 0) {
                        return;
                    }
                    sourceFile = selectedFiles[0];
                }
            }

            // Read and validate the ARM template
            const armContent = await vscode.workspace.fs.readFile(sourceFile);
            const armString = Buffer.from(armContent).toString('utf8');

            if (!ArmToYamlConverter.isValidArmTemplate(armString)) {
                vscode.window.showErrorMessage('Selected file does not contain a valid ARM template with Sentinel Analytics Rules.');
                return;
            }

            // Get conversion options from configuration
            const config = vscode.workspace.getConfiguration('sentinelAsCode.conversion');
            const options: Partial<ConversionOptions> = {
                namingStrategy: config.get('defaultNamingStrategy', 'displayName'),
                validateMitre: config.get('validateMitreOnConversion', true),
                autoFormat: config.get('autoFormatAfterConversion', true),
                includeOptionalFields: config.get('includeOptionalFields', true),
                preserveQueryFormatting: config.get('preserveQueryFormatting', true),
                defaultVersion: config.get('defaultVersion', '1.0.0')
            };

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Converting ARM Template to YAML',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Parsing ARM template...' });

                // Perform conversion
                const result = await ArmToYamlConverter.convertArmToYaml(armString, options);

                progress.report({ increment: 50, message: 'Generating YAML files...' });

                if (!result.overallSuccess) {
                    const errors = result.results.flatMap(r => r.errors).join('\n');
                    vscode.window.showErrorMessage(`Conversion failed: ${errors}`);
                    return;
                }

                // Determine output directory
                const outputDir = config.get('outputDirectory', '') || path.dirname(sourceFile.fsPath);
                
                // Create YAML files
                let openedFiles = 0;
                for (const conversionResult of result.results) {
                    if (conversionResult.success && conversionResult.yamlContent && conversionResult.fileName) {
                        const yamlPath = path.join(outputDir, conversionResult.fileName);
                        const yamlUri = vscode.Uri.file(yamlPath);
                        
                        await vscode.workspace.fs.writeFile(yamlUri, Buffer.from(conversionResult.yamlContent, 'utf8'));
                        
                        // Open the first file automatically
                        if (openedFiles === 0) {
                            const document = await vscode.workspace.openTextDocument(yamlUri);
                            await vscode.window.showTextDocument(document);
                            openedFiles++;
                        }
                    }
                }

                progress.report({ increment: 100, message: 'Conversion complete!' });

                // Show summary
                const warnings = result.results.flatMap(r => r.warnings);
                let summaryMessage = `Successfully converted ${result.successfulConversions} of ${result.totalRules} rules.`;
                
                if (warnings.length > 0) {
                    summaryMessage += `\n\nWarnings:\n${warnings.join('\n')}`;
                    if (config.get('showConversionSummary', true)) {
                        vscode.window.showWarningMessage(summaryMessage, 'OK');
                    }
                } else {
                    vscode.window.showInformationMessage(summaryMessage);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to convert ARM template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}