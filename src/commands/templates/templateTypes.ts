import * as vscode from 'vscode';

export interface TemplateTypeOption extends vscode.QuickPickItem {
    templateKey: string;
    defaultFilename: string;
    displayName: string;
    /**
     * Full template filename including extension (e.g. 'parser.template.yaml').
     * All content templates are authored in YAML; when `language` is 'json' the
     * generator converts the parsed YAML to JSON on export. Falls back to
     * `${templateKey}.template.yaml` when omitted.
     */
    templateFile?: string;
    /** Editor language for the generated document. Defaults to 'yaml'. */
    language?: 'yaml' | 'json';
}