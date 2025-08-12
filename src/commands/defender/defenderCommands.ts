import * as vscode from 'vscode';
import * as path from 'path';
import { DefenderAuthProvider } from '../../defender/auth/defenderAuthProvider';
import { DefenderXdrService } from '../../defender/services/defenderXdrService';

export class DefenderCommands {
    private auth: DefenderAuthProvider;
    private service: DefenderXdrService;

    constructor(private context: vscode.ExtensionContext) {
        this.auth = new DefenderAuthProvider(context);
        this.service = new DefenderXdrService(this.auth);
        this.init();
    }

    private async init() {
        await this.auth.load();
    }

    public registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('defender.configureAuth', async () => {
                await this.auth.configure();
            }),
            vscode.commands.registerCommand('defender.clearAuth', async () => {
                await this.auth.clear();
            }),
            vscode.commands.registerCommand('defender.listCustomDetections', async () => {
                await this.ensureAuth();
                const includeDisabled = await this.pickIncludeDisabled();
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Listing custom detections' }, async () => {
                    await this.service.listRules({ includeDisabled });
                });
            }),
            vscode.commands.registerCommand('defender.exportCustomDetections', async () => {
                await this.ensureAuth();
                const includeDisabled = await this.pickIncludeDisabled();
                
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Exporting custom detections' }, async () => {
                    await this.service.exportRules({
                        includeDisabled,
                        separateFiles: true  // Always true now since we only export as separate files
                    });
                });
            }),
            vscode.commands.registerCommand('defender.importCustomDetections', async () => {
                await this.ensureAuth();
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Importing custom detections' }, async () => {
                    await this.service.importRules({});
                });
            }),
            vscode.commands.registerCommand('defender.showAuthStatus', async () => {
                await this.ensureAuth();
                vscode.window.showInformationMessage(this.auth.getAuthSummaryDetailed());
            })
        ];
    }

    private async ensureAuth() {
        if (!this.auth.getAuthSummary() || this.auth.getAuthSummary() === 'Not configured') {
            const proceed = await vscode.window.showWarningMessage('Defender XDR auth not configured. Configure now?', 'Yes', 'No');
            if (proceed === 'Yes') {
                await this.auth.configure();
            } else {
                throw new Error('Authentication required.');
            }
        }
    }

    private async pickIncludeDisabled(): Promise<boolean> {
        const choice = await vscode.window.showQuickPick(
            [
                { label: 'Enabled rules only', value: 'no' },
                { label: 'Include disabled rules', value: 'yes' }
            ],
            { title: 'Include disabled rules?' }
        );
        return choice?.value === 'yes';
    }

    private async exportCustomDetections() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }

            const document = editor.document;
            let jsonContent: any;
            
            try {
                jsonContent = JSON.parse(document.getText());
            } catch (_error) {  // Changed 'error' to '_error' to match the lint rule
                vscode.window.showErrorMessage('Invalid JSON in active document');
                return;
            }

            // Extract displayName and format it for filename
            const displayName = jsonContent.displayName || jsonContent.properties?.displayName;
            let filename: string;
            
            if (displayName) {
                // Convert displayName to lowercase with underscores
                filename = displayName
                    .toLowerCase()
                    .replace(/[\s-]+/g, '_')  // Replace spaces and hyphens with underscores
                    .replace(/[^a-z0-9_]/g, '_')  // Replace any non-alphanumeric characters (except underscores) with underscores
                    .replace(/_+/g, '_')  // Replace multiple underscores with single underscore
                    .replace(/^_|_$/g, '');  // Remove leading/trailing underscores
                
                filename = `${filename}.json`;
            } else {
                // Fallback to timestamp-based name if no displayName found
                filename = `DefenderCustomDetections_${Date.now()}.json`;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, filename)),
                filters: {
                    'JSON files': ['json']
                }
            });

            if (saveUri) {
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(JSON.stringify(jsonContent, null, 2)));
                vscode.window.showInformationMessage(`Custom detection exported to ${saveUri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export custom detection: ${error}`);
        }
    }
}