import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BaseCommand } from '../base/baseCommand';
import { RuleTypeDetector, RuleType } from '../../utils/ruleTypeDetector';  // Fixed path

export class GuidCommands extends BaseCommand {
    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Individual GUID regeneration
        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.regenerateGuid', this.regenerateGuid.bind(this))
        );

        // Bulk GUID regeneration
        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.regenerateAllGuids', this.regenerateAllGuids.bind(this))
        );

        return disposables;
    }

    /**
     * FIXED: Regenerate GUID in the current Sentinel rule (works from both editor and explorer context)
     */
    private async regenerateGuid(uri?: vscode.Uri): Promise<void> {
        try {
            let targetFile: vscode.Uri;
            let document: vscode.TextDocument;

            if (uri) {
                targetFile = uri;
                if (!targetFile.fsPath.match(/\.(yaml|yml)$/)) {
                    vscode.window.showErrorMessage('This command only works on YAML files');
                    return;
                }
                document = await vscode.workspace.openTextDocument(targetFile);
            } else {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor found');
                    return;
                }
                document = editor.document;
                targetFile = document.uri;
                if (!document.fileName.match(/\.(yaml|yml)$/)) {
                    vscode.window.showErrorMessage('This command only works on YAML files');
                    return;
                }
            }

            const text = document.getText();
            
            // Detect rule type
            const ruleType = RuleTypeDetector.detectType(text);
            
            const guidRegex = /^(\s*)id:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\{\{GUID\}\})/im;
            const numericIdRegex = /^(\s*)id:\s*["']?(\d+)["']?/im;
            const detectorIdRegex = /^(\s*)detectorId:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/im;
            
            let newText = text;
            const fieldsUpdated = [];

            if (ruleType === RuleType.DEFENDER) {
                // For Defender detections, only regenerate detectorId (not the numeric id)
                const detectorIdMatch = text.match(detectorIdRegex);
                if (detectorIdMatch) {
                    const indentation = detectorIdMatch[1];
                    const newDetectorId = uuidv4();
                    newText = newText.replace(detectorIdRegex, `${indentation}detectorId: ${newDetectorId}`);
                    fieldsUpdated.push('detectorId');
                }
                
                // Don't regenerate numeric IDs for Defender detections
                const numericIdMatch = text.match(numericIdRegex);
                if (numericIdMatch && fieldsUpdated.length === 0) {
                    vscode.window.showInformationMessage('Defender Custom Detection numeric IDs are managed by Microsoft Graph API and should not be regenerated');
                    return;
                }
            } else {
                // For Sentinel rules, regenerate the GUID id
                const idMatch = text.match(guidRegex);
                if (idMatch) {
                    const indentation = idMatch[1];
                    const newGuid = uuidv4();
                    newText = newText.replace(guidRegex, `${indentation}id: ${newGuid}`);
                    fieldsUpdated.push('id');
                } else {
                    // No existing GUID found, ask user if they want to add one
                    const addGuid = await vscode.window.showWarningMessage(
                        'No GUID found in this file. Would you like to add an ID field at the top?',
                        'Yes', 'No'
                    );
                    if (addGuid === 'Yes') {
                        await this.addGuidToFileUri(targetFile);
                    }
                    return;
                }
            }

            if (fieldsUpdated.length > 0) {
                // Show confirmation dialog
                const action = await vscode.window.showWarningMessage(
                    `Generate new ${fieldsUpdated.join(' and ')} for "${path.basename(targetFile.fsPath)}"?`,
                    { modal: true },
                    'Generate New ID', 'Cancel'
                );

                if (action === 'Generate New ID') {
                    await vscode.workspace.fs.writeFile(targetFile, Buffer.from(newText, 'utf8'));
                    vscode.window.showInformationMessage(`Successfully regenerated ${fieldsUpdated.join(' and ')}`);
                }
            }
        } catch (error) {
            console.error('Error regenerating GUID:', error);
            vscode.window.showErrorMessage(`Failed to regenerate GUID: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * NEW: Bulk regenerate GUIDs in all Sentinel YAML files within a specific folder
     */
    private async regenerateAllGuids(uri?: vscode.Uri): Promise<void> {
        try {
            // Determine target folder
            let targetFolder: vscode.Uri;
            
            if (uri && uri.fsPath) {
                // Called from right-click on folder (though this shouldn't happen now)
                targetFolder = uri;
            } else {
                // Called from Command Palette - let user choose folder
                const folderOptions = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    title: 'Select folder to regenerate GUIDs in',
                    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
                });

                if (!folderOptions || folderOptions.length === 0) {
                    return; // User cancelled
                }
                targetFolder = folderOptions[0];
            }

            // FIXED: Search for ALL YAML files in the SPECIFIC folder only (not workspace-wide)
            const allYamlFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(targetFolder, '**/*.{yaml,yml}'),
                '**/node_modules/**'
            );

            // Filter for files that contain Sentinel rule content or have sentinel in filename
            const sentinelFiles: vscode.Uri[] = [];
            
            for (const file of allYamlFiles) {
                // Check if filename contains 'sentinel'
                if (file.fsPath.toLowerCase().includes('sentinel')) {
                    sentinelFiles.push(file);
                    continue;
                }
                
                // Check file content for Sentinel rule indicators
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    
                    // Look for common Sentinel rule fields
                    const sentinelIndicators = [
                        /^\s*tactics\s*:/m,
                        /^\s*techniques\s*:/m,
                        /^\s*queryFrequency\s*:/m,
                        /^\s*triggerOperator\s*:/m,
                        /^\s*requiredDataConnectors\s*:/m
                    ];
                    
                    const hasSentinelFields = sentinelIndicators.some(regex => regex.test(text));
                    if (hasSentinelFields) {
                        sentinelFiles.push(file);
                    }
                } catch (error) {
                    // Skip files that can't be read
                    console.log(`Skipping file ${file.fsPath}: ${error}`);
                }
            }

            if (sentinelFiles.length === 0) {
                vscode.window.showInformationMessage(
                    `No Sentinel rule files found in the folder:\n${path.basename(targetFolder.fsPath)}\n\nLooking for YAML files with Sentinel rule fields (tactics, techniques, queryFrequency, etc.) or files with "sentinel" in the filename.`
                );
                return;
            }

            // FIXED: Check which files actually have GUIDs before showing confirmation
            const filesWithGuids: vscode.Uri[] = [];
            for (const file of sentinelFiles) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = Buffer.from(content).toString('utf8');
                    const guidRegex = /^(\s*)id:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\{\{GUID\}\})/im;
                    
                    if (guidRegex.test(text)) {
                        filesWithGuids.push(file);
                    }
                } catch (error) {
                    console.log(`Error checking GUID in ${file.fsPath}: ${error}`);
                }
            }

            if (filesWithGuids.length === 0) {
                vscode.window.showInformationMessage(
                    `Found ${sentinelFiles.length} Sentinel rule file${sentinelFiles.length === 1 ? '' : 's'} in the folder, but none contain GUIDs to regenerate.`
                );
                return;
            }

            // Show confirmation dialog with accurate counts
            const folderName = path.basename(targetFolder.fsPath);
            const action = await vscode.window.showWarningMessage(
                `Generate new Rule IDs for ${filesWithGuids.length} file${filesWithGuids.length === 1 ? '' : 's'} in folder "${folderName}"?\n\nFiles with IDs: ${filesWithGuids.length}\nTotal Sentinel files: ${sentinelFiles.length}\n\nThis will replace all existing Rule IDs with new ones.`,
                { modal: true },
                'Generate New IDs', 'Cancel'
            );

            if (action !== 'Generate New IDs') {
                return;
            }

            // Process ONLY files with GUIDs
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generating new Rule IDs in ${folderName}`,
                cancellable: false
            }, async (progress) => {
                let processedFiles = 0;
                let updatedFiles = 0;
                const errors: string[] = [];

                for (const file of filesWithGuids) {
                    try {
                        progress.report({
                            increment: (processedFiles / filesWithGuids.length) * 100,
                            message: `Processing ${path.basename(file.fsPath)}...`
                        });

                        const result = await this.regenerateGuidInFile(file);
                        if (result.updated) {
                            updatedFiles++;
                        }
                        if (result.error) {
                            errors.push(`${path.basename(file.fsPath)}: ${result.error}`);
                        }

                        processedFiles++;
                    } catch (error) {
                        errors.push(`${path.basename(file.fsPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        processedFiles++;
                    }
                }

                progress.report({ increment: 100, message: 'Complete!' });

                // Show summary
                let message = `Processed ${processedFiles} files in "${folderName}". Generated new Rule IDs in ${updatedFiles} files.`;
                
                if (errors.length > 0) {
                    message += `\n\nErrors encountered:\n${errors.join('\n')}`;
                    vscode.window.showWarningMessage(message, 'OK');
                } else {
                    vscode.window.showInformationMessage(message);
                }
            });

        } catch (error) {
            console.error('Error in bulk GUID regeneration:', error);
            vscode.window.showErrorMessage(`Failed to regenerate GUIDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * FIXED: Add GUID field to file using URI (for explorer context)
     */
    private async addGuidToFileUri(fileUri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            const newGuid = uuidv4();
            
            // Insert at the beginning of the file
            const newText = `id: ${newGuid}\n${text}`;
            
            // Write the updated content directly to file
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(newText, 'utf8'));
            
            vscode.window.showInformationMessage(`Rule ID added successfully!\nFile: ${path.basename(fileUri.fsPath)}\nNew ID: ${newGuid}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add GUID: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Helper: Regenerate GUID in a specific file
     */
    private async regenerateGuidInFile(fileUri: vscode.Uri): Promise<{ updated: boolean; error?: string }> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            
            const guidRegex = /^(\s*)id:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\{\{GUID\}\})/im;
            const match = text.match(guidRegex);

            if (!match) {
                return { updated: false, error: 'No GUID found' };
            }

            const indentation = match[1];
            const newGuid = uuidv4();
            const newText = text.replace(guidRegex, `${indentation}id: ${newGuid}`);
            
            // Write the updated content
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(newText, 'utf8'));
            
            return { updated: true };

        } catch (error) {
            return { updated: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}