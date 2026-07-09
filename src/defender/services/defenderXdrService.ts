import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export class DefenderXdrService {
    public async formatActiveDocumentForRepo(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Open a Defender detection (JSON or YAML) to format for the repo.');
            return;
        }

        const text = editor.document.getText();
        let parsed: any;
        try {
            const looksLikeJson = editor.document.languageId === 'json'
                || text.trimStart().startsWith('{')
                || text.trimStart().startsWith('[');
            parsed = looksLikeJson ? JSON.parse(text) : yaml.load(text);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not parse the active document: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        const rule = this.extractRule(parsed);

        if (!rule || !rule.displayName) {
            vscode.window.showErrorMessage('No detection rule found (expected an object with a displayName).');
            return;
        }

        const content = this.dumpRepoYaml(this.formatRuleForRepo(rule));
        const doc = await vscode.workspace.openTextDocument({ content, language: 'yaml' });
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showInformationMessage(`Formatted "${rule.displayName}" for the repo. Save as ${this.toPascalCase(rule.displayName)}.yaml under Content/DefenderCustomDetections/.`);
    }

    // Convert repo YAML into a deployable Microsoft Graph detectionRule JSON body.
    // Detection rules are reshaped to the clean Graph schema (runtime fields dropped);
    // any other YAML is converted verbatim.
    public async convertYamlToJson(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        try {
            const parsed = yaml.load(editor.document.getText());
            const rule = this.extractRule(parsed);
            const output = (rule && rule.displayName) ? this.formatRuleForRepo(rule) : parsed;
            const jsonContent = JSON.stringify(output, null, 2);

            const doc = await vscode.workspace.openTextDocument({ content: jsonContent, language: 'json' });
            await vscode.window.showTextDocument(doc, { preview: false });

            const message = (rule && rule.displayName)
                ? 'Converted to Graph detectionRule JSON (ready for the Custom Detections API).'
                : 'YAML converted to JSON.';
            vscode.window.showInformationMessage(message);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to convert YAML to JSON: ${error.message}`);
        }
    }

    // Convert a Graph detectionRule JSON export into clean repo YAML.
    // Detection rules are reshaped to the documented authoring schema (runtime
    // fields dropped); any other JSON is converted verbatim.
    public async convertJsonToYaml(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        try {
            const parsed = JSON.parse(editor.document.getText());
            const rule = this.extractRule(parsed);
            const output = (rule && rule.displayName) ? this.formatRuleForRepo(rule) : parsed;
            const yamlContent = this.dumpRepoYaml(output);

            const doc = await vscode.workspace.openTextDocument({ content: yamlContent, language: 'yaml' });
            await vscode.window.showTextDocument(doc, { preview: false });

            const message = (rule && rule.displayName)
                ? 'Converted to repo YAML (clean authoring schema).'
                : 'JSON converted to YAML.';
            vscode.window.showInformationMessage(message);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to convert JSON to YAML: ${error.message}`);
        }
    }

    // Accepts a bare rule, a { rule } wrapper, a { rules: [...] } file, or a Graph
    // { value: [...] } response, and returns the single detection rule object.
    private extractRule(parsed: any): any {
        return parsed?.rule
            ?? (Array.isArray(parsed?.rules) ? parsed.rules[0] : undefined)
            ?? (Array.isArray(parsed?.value) ? parsed.value[0] : undefined)
            ?? parsed;
    }

    // Reshape a Graph detectionRule into the Sentinel-As-Code repo authoring schema.
    // Keeps only the documented authoring fields, in canonical order, and drops all
    // runtime/read-only fields (id, createdBy, lastRunDetails, @odata.* metadata, etc.).
    private formatRuleForRepo(rule: any): Record<string, unknown> {
        const at = rule?.detectionAction?.alertTemplate ?? {};
        const alertTemplate: Record<string, unknown> = {};
        if (at.title !== undefined && at.title !== null) alertTemplate.title = at.title;
        if (at.description !== undefined && at.description !== null) alertTemplate.description = at.description;
        if (at.severity !== undefined && at.severity !== null) alertTemplate.severity = String(at.severity).toLowerCase();
        if (at.category !== undefined && at.category !== null) alertTemplate.category = at.category;
        if (Array.isArray(at.mitreTechniques) && at.mitreTechniques.length > 0) alertTemplate.mitreTechniques = at.mitreTechniques;
        if (at.recommendedActions !== undefined && at.recommendedActions !== null) alertTemplate.recommendedActions = at.recommendedActions;
        if (Array.isArray(at.impactedAssets) && at.impactedAssets.length > 0) alertTemplate.impactedAssets = at.impactedAssets;

        const detectionAction: Record<string, unknown> = { alertTemplate };
        const responseActions = rule?.detectionAction?.responseActions;
        if (Array.isArray(responseActions) && responseActions.length > 0) {
            detectionAction.responseActions = responseActions;
        }

        return {
            displayName: rule?.displayName,
            isEnabled: rule?.isEnabled !== false,
            queryCondition: { queryText: rule?.queryCondition?.queryText ?? '' },
            schedule: { period: rule?.schedule?.period ?? '1H' },
            detectionAction
        };
    }

    private dumpRepoYaml(obj: unknown): string {
        return yaml.dump(obj, {
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false
        });
    }

    // Convert a display name into a PascalCase filename stem (repo convention).
    private toPascalCase(name: string): string {
        const pascal = (name ?? '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
        return pascal || 'Detection';
    }
}