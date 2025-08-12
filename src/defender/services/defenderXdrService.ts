import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { DefenderAuthProvider } from '../auth/defenderAuthProvider';
import { DetectionRule } from '../types/defenderTypes'; // Removed unused import: ExportPerRuleFile

const GRAPH_BASE = 'https://graph.microsoft.com/beta';
const RULES_ENDPOINT = `${GRAPH_BASE}/security/rules/detectionRules`;

interface ListOptions {
    includeDisabled: boolean;
}

interface ExportOptions extends ListOptions {
    separateFiles: boolean;
    outputUri?: vscode.Uri;
    format?: 'json' | 'yaml';  // Add format option
}

interface ImportOptions {
    fileUri?: vscode.Uri;
}

export class DefenderXdrService {
    constructor(private auth: DefenderAuthProvider) {}

    private async api<T = any>(method: string, url: string, token: string, body?: any): Promise<T> {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        const resp = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        } as RequestInit);

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`${method} ${url} failed (${resp.status}): ${text}`);
        }
        if (resp.status === 204) return {} as T;
        return await resp.json() as T;
    }

    private async getAllDetectionRules(includeDisabled: boolean): Promise<DetectionRule[]> {
        const token = await this.auth.acquireToken();
        const rules: DetectionRule[] = [];
        let url = RULES_ENDPOINT;
        while (url) {
            const page = await this.api<{ value: DetectionRule[]; '@odata.nextLink'?: string }>('GET', url, token);
            for (const rule of page.value) {
                if (rule.isSystemRule) continue;
                if (!includeDisabled && rule.isEnabled === false) continue;
                // Fetch full detail
                const full = await this.api<DetectionRule>('GET', `${RULES_ENDPOINT}/${rule.id}`, token);
                rules.push(full);
            }
            url = (page as any)['@odata.nextLink'] || '';
        }
        return rules;
    }

    public async listRules(options: ListOptions): Promise<void> {
        const rules = await this.getAllDetectionRules(options.includeDisabled);
        if (rules.length === 0) {
            vscode.window.showInformationMessage('No custom detection rules found.');
            return;
        }
        const lines = rules.map(r => `${r.displayName} | Enabled=${r.isEnabled} | Period=${r.schedule?.period} | Id=${r.id}`);
        const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'plaintext' });
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    public async exportRules(options: ExportOptions): Promise<void> {
        const rules = await this.getAllDetectionRules(options.includeDisabled);
        if (rules.length === 0) {
            vscode.window.showWarningMessage('No rules to export.');
            return;
        }

        // Always export as separate files
        let folderUri = options.outputUri;
        if (!folderUri) {
            const picked = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select export folder'
            });
            if (!picked || picked.length === 0) return;
            folderUri = picked[0];
        }
        
        // Always export as YAML
        const extension = 'yaml';
        
        // Export directly to the selected folder, no timestamp subfolder
        for (const rule of rules) {
            // Format filename: lowercase, replace spaces and special chars with underscores
            const formattedName = rule.displayName
                .toLowerCase()
                .replace(/[\s-]+/g, '_')  // Replace spaces and hyphens with underscores
                .replace(/[^a-z0-9_]/g, '_')  // Replace any non-alphanumeric characters (except underscores) with underscores
                .replace(/_+/g, '_')  // Replace multiple underscores with single underscore
                .replace(/^_|_$/g, '');  // Remove leading/trailing underscores
            
            // Clean up the rule object by removing OData metadata
            const cleanRule = this.cleanRuleForExport(rule);
            
            // Export as YAML
            const content = yaml.dump(cleanRule, { 
                lineWidth: -1,  // Don't wrap lines
                noRefs: true,   // No anchors/aliases
                quotingType: '"', // Use double quotes
                forceQuotes: false // Only quote when necessary
            });
            
            const fileUri = vscode.Uri.joinPath(folderUri, `${formattedName}.${extension}`);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
        }
        vscode.window.showInformationMessage(`Exported ${rules.length} rule${rules.length === 1 ? '' : 's'} as YAML to selected folder.`);
    }

    public async importRules(options: ImportOptions): Promise<void> {
        let fileUri = options.fileUri;
        if (!fileUri) {
            const pick = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: { JSON: ['json'] },
                openLabel: 'Select import file'
            });
            if (!pick || pick.length === 0) return;
            fileUri = pick[0];
        }
        const rawBytes = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(rawBytes).toString('utf8');

        let json: any;
        try {
            json = JSON.parse(text);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to parse JSON: ${e.message}`);
            return;
        }

        let rules: DetectionRule[] = [];
        if (Array.isArray(json.rules)) rules = json.rules;
        else if (json.rule) rules = [json.rule];
        else {
            vscode.window.showErrorMessage('No rules found in file (expected "rules" or "rule" property).');
            return;
        }

        const token = await this.auth.acquireToken();
        const existing = await this.getAllDetectionRules(true);
        const existingNames = new Set(existing.map(r => r.displayName));

        let imported = 0;
        for (const rule of rules) {
            let targetName = rule.displayName;
            if (existingNames.has(targetName)) {
                const choice = await vscode.window.showQuickPick(
                    [
                        { label: 'Skip', value: 'skip' },
                        { label: 'Duplicate (append timestamp)', value: 'dup' },
                        { label: 'Cancel Import', value: 'cancel' }
                    ],
                    { title: `Rule "${targetName}" already exists` }
                );
                if (!choice || choice.value === 'cancel') {
                    vscode.window.showInformationMessage('Import cancelled.');
                    return;
                }
                if (choice.value === 'skip') continue;
                if (choice.value === 'dup') {
                    targetName = `${targetName}_${new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15)}`;
                }
            }

            const body: DetectionRule = {
                displayName: targetName,
                isEnabled: rule.isEnabled,
                queryCondition: { queryText: rule.queryCondition?.queryText || '' },
                schedule: { period: rule.schedule?.period || '1H' }
            };

            if (rule.detectionAction && rule.detectionAction.alertTemplate) {
                body.detectionAction = { alertTemplate: { ...rule.detectionAction.alertTemplate } };
            }

            try {
                await this.api('POST', RULES_ENDPOINT, token, body);
                imported++;
            } catch (e: any) {
                vscode.window.showWarningMessage(`Failed to import "${targetName}": ${e.message}`);
            }
        }

        vscode.window.showInformationMessage(`Imported ${imported} of ${rules.length} rule(s).`);
    }

    // New method to convert YAML to JSON
    public async convertYamlToJson(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const yamlContent = document.getText();
        
        try {
            const jsonObject = yaml.load(yamlContent);
            const jsonContent = JSON.stringify(jsonObject, null, 2);
            
            // Create new document with JSON content
            const doc = await vscode.workspace.openTextDocument({
                content: jsonContent,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
            
            vscode.window.showInformationMessage('YAML converted to JSON successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to convert YAML to JSON: ${error.message}`);
        }
    }

    // New method to convert JSON to YAML
    public async convertJsonToYaml(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const jsonContent = document.getText();
        
        try {
            const jsonObject = JSON.parse(jsonContent);
            const yamlContent = yaml.dump(jsonObject, {
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: false
            });
            
            // Create new document with YAML content
            const doc = await vscode.workspace.openTextDocument({
                content: yamlContent,
                language: 'yaml'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
            
            vscode.window.showInformationMessage('JSON converted to YAML successfully');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to convert JSON to YAML: ${error.message}`);
        }
    }

    // New method to clean up rule for export
    private cleanRuleForExport(rule: any): any {
        // Create a deep copy to avoid modifying the original
        const cleanRule = JSON.parse(JSON.stringify(rule));
        
        // Remove OData metadata fields only
        delete cleanRule['@odata.context'];
        delete cleanRule['@odata.etag'];
        delete cleanRule['@odata.type'];
        
        // Clean up nested OData references in impactedAssets
        if (cleanRule.detectionAction?.alertTemplate?.impactedAssets) {
            cleanRule.detectionAction.alertTemplate.impactedAssets = 
                cleanRule.detectionAction.alertTemplate.impactedAssets.map((asset: any) => {
                    const cleanAsset = { ...asset };
                    delete cleanAsset['@odata.type'];
                    return cleanAsset;
                });
        }
        
        // Remove null values that aren't meaningful
        if (cleanRule.lastRunDetails?.failureReason === null) {
            delete cleanRule.lastRunDetails.failureReason;
        }
        if (cleanRule.lastRunDetails?.errorCode === null) {
            delete cleanRule.lastRunDetails.errorCode;
        }
        if (cleanRule.detectionAction?.organizationalScope === null) {
            delete cleanRule.detectionAction.organizationalScope;
        }
        
        // Remove empty responseActions array if present
        if (cleanRule.detectionAction?.responseActions && 
            Array.isArray(cleanRule.detectionAction.responseActions) && 
            cleanRule.detectionAction.responseActions.length === 0) {
            delete cleanRule.detectionAction.responseActions;
        }
        
        return cleanRule;
    }
}