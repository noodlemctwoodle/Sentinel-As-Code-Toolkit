import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BaseCommand } from '../base/baseCommand';
import { TemplateTypeOption } from './templateTypes';
import { SentinelRuleFormatter } from '../../formatting/formatter';

export class TemplateCommands extends BaseCommand {
    public registerCommands(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // Enhanced template creation command (for context menus)
        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.createSentinelRule', this.createSentinelRuleWorkflow.bind(this))
        );

        // Unified template command for command palette
        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.generateRuleTemplate', this.createSentinelRuleWorkflow.bind(this))
        );

        // Legacy template commands for backward compatibility
        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.generateTemplate', (uri?: vscode.Uri) => 
                this.generateTemplate('standard-rule', 'standard_sentinel_rule.yaml', uri))
        );

        disposables.push(
            vscode.commands.registerCommand('sentinelAsCode.generateNRTTemplate', (uri?: vscode.Uri) => 
                this.generateTemplate('nrt-rule', 'nrt_sentinel_rule.yaml', uri))
        );

        disposables.push(
            vscode.commands.registerCommand('defender.generateDetectionTemplate', (uri?: vscode.Uri) => 
                this.generateTemplate('custom-detection', 'custom_detection.yaml', uri))
        );

        return disposables;
    }

    private async generateTemplate(templateName: string, defaultFilename: string, uri?: vscode.Uri): Promise<void> {
        const template = await SentinelRuleFormatter.loadTemplate(templateName);
        await this.createTemplateFile(template, defaultFilename, uri);
    }

    /**
     * NEW: Enhanced workflow for creating Sentinel rule templates
     */
    private async createSentinelRuleWorkflow(uri?: vscode.Uri): Promise<void> {
        try {
            // Step 1: Prompt for template type
            const templateType = await this.promptForTemplateType();
            if (!templateType) {
                return; // User cancelled
            }

            // Step 2: Determine initial save location
            const defaultLocation = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            
            // Step 3: Prompt for save location
            const saveLocation = await this.promptForSaveLocation(defaultLocation, templateType.defaultFilename);
            if (!saveLocation) {
                return; // User cancelled
            }

            // Step 4: Generate template
            await this.generateTemplateAtLocation(templateType.templateKey, saveLocation);

            // Step 5: Open the created file
            const document = await vscode.workspace.openTextDocument(saveLocation);
            await vscode.languages.setTextDocumentLanguage(document, 'yaml');
            await vscode.window.showTextDocument(document);

            vscode.window.showInformationMessage(`${templateType.displayName} template created successfully!`);

        } catch (error) {
            console.error('Error creating Sentinel rule template:', error);
            vscode.window.showErrorMessage(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Prompt user to select template type
     */
    private async promptForTemplateType(): Promise<TemplateTypeOption | undefined> {
        const templateOptions: TemplateTypeOption[] = [
            {
                label: "$(file-code) Standard Rule",
                description: "General-purpose scheduled Sentinel analytics rule",
                detail: "Recommended for most detection scenarios",
                templateKey: "standard-rule",
                defaultFilename: "standard_sentinel_rule.yaml",
                displayName: "Standard Rule"
            },
            {
                label: "$(clock) Near Real-Time (NRT) Rule",
                description: "Low-latency Sentinel alerting for immediate threats",
                detail: "For time-sensitive detections (no scheduling fields)",
                templateKey: "nrt-rule",
                defaultFilename: "nrt_sentinel_rule.yaml",
                displayName: "NRT Rule"
            },
            {
                label: "$(shield) Custom Detection",
                description: "Defender XDR custom detection (Advanced Hunting KQL)",
                detail: "Graph detectionRule schema for Content/DefenderCustomDetections",
                templateKey: "custom-detection",
                defaultFilename: "custom_detection.yaml",
                displayName: "Custom Detection"
            }
        ];

        const selected = await vscode.window.showQuickPick(templateOptions, {
            placeHolder: "Select a Sentinel-as-Code template",
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: false
        });

        return selected;
    }

    /**
     * Prompt user for save location
     */
    private async promptForSaveLocation(defaultPath?: string, defaultFilename?: string): Promise<string | undefined> {
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: defaultPath ? vscode.Uri.file(path.join(defaultPath, defaultFilename || 'sentinel_rule.yaml')) : undefined,
            filters: {
                'YAML Files': ['yaml', 'yml'],
                'All Files': ['*']
            },
            title: "Save Sentinel Rule Template"
        });

        return saveUri?.fsPath;
    }

    /**
     * Generate template at specific location with GUID replacement
     */
    private async generateTemplateAtLocation(templateKey: string, filePath: string): Promise<void> {
        try {
            const template = await SentinelRuleFormatter.loadTemplate(templateKey);
            
            // Replace {{GUID}} placeholder with actual GUID
            const processedTemplate = template.replace(/\{\{GUID\}\}/g, uuidv4());
            
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(processedTemplate, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to load or create template: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
        }
    }

    private async createTemplateFile(template: string, defaultFilename: string, uri?: vscode.Uri): Promise<void> {
        let targetUri: vscode.Uri;
        if (uri && uri.fsPath) {
            targetUri = vscode.Uri.file(path.join(uri.fsPath, defaultFilename));
        } else {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }
            targetUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, defaultFilename));
        }

        try {
            // Replace {{GUID}} placeholder with actual GUID
            const processedTemplate = template.replace(/\{\{GUID\}\}/g, uuidv4());
            
            await vscode.workspace.fs.writeFile(targetUri, Buffer.from(processedTemplate, 'utf8'));
            const document = await vscode.workspace.openTextDocument(targetUri);
            
            // Explicitly set language to YAML to prevent auto-detection of custom language
            await vscode.languages.setTextDocumentLanguage(document, 'yaml');
            
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(`New ${defaultFilename} template created with unique GUID!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create template: ${error}`);
        }
    }
}