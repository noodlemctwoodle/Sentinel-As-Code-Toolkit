import * as vscode from 'vscode';
import { DefenderAuthProvider } from '../auth/defenderAuthProvider';
import { DetectionRule, ExportPerRuleFile } from '../types/defenderTypes';

const GRAPH_BASE = 'https://graph.microsoft.com/beta';
const RULES_ENDPOINT = `${GRAPH_BASE}/security/rules/detectionRules`;

interface ListOptions {
    includeDisabled: boolean;
}

interface ExportOptions extends ListOptions {
    separateFiles: boolean;
    outputUri?: vscode.Uri;
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
        
        // Export directly to the selected folder, no timestamp subfolder
        for (const rule of rules) {
            // Format filename: lowercase, replace spaces and special chars with underscores
            const formattedName = rule.displayName
                .toLowerCase()
                .replace(/[\s-]+/g, '_')  // Replace spaces and hyphens with underscores
                .replace(/[^a-z0-9_]/g, '_')  // Replace any non-alphanumeric characters (except underscores) with underscores
                .replace(/_+/g, '_')  // Replace multiple underscores with single underscore
                .replace(/^_|_$/g, '');  // Remove leading/trailing underscores
            
            // Export just the rule without metadata wrapper, directly to selected folder
            const fileUri = vscode.Uri.joinPath(folderUri, `${formattedName}.json`);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(rule, null, 2), 'utf8'));
        }
        vscode.window.showInformationMessage(`Exported ${rules.length} rule${rules.length === 1 ? '' : 's'} to selected folder.`);
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
}