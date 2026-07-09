import * as vscode from 'vscode';
import { SentinelRuleFormatter } from '../formatting/formatter';
import { SentinelContentFormatter } from '../content/contentFormatter';

export class SentinelDocumentFormatProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return SentinelRuleFormatter.formatDocument(document);
    }
}

/**
 * Formats any supported Sentinel-as-Code content type by auto-detecting it and
 * delegating to the appropriate formatter.
 */
export class SentinelContentFormatProvider implements vscode.DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        return SentinelContentFormatter.format(document).edits;
    }
}

const CONTENT_SELECTOR: vscode.DocumentSelector = [
    { scheme: 'file', pattern: '**/*.sentinel.{yaml,yml}' },
    { scheme: 'file', pattern: '**/AnalyticalRules/**/*.{yaml,yml}' },
    { scheme: 'file', pattern: '**/AnalyticsRules/**/*.{yaml,yml}' },
    { scheme: 'file', pattern: '**/HuntingQueries/**/*.{yaml,yml}' },
    { scheme: 'file', pattern: '**/Parsers/**/*.{yaml,yml}' },
    { scheme: 'file', pattern: '**/AutomationRules/**/*.json' },
    { scheme: 'file', pattern: '**/SummaryRules/**/*.json' },
    { scheme: 'file', pattern: '**/Watchlists/**/*.json' },
    { scheme: 'file', pattern: '**/Workbooks/**/*.json' },
    { scheme: 'file', pattern: '**/Playbooks/**/*.json' }
];

export function createFormattingProvider(): vscode.Disposable {
    return vscode.languages.registerDocumentFormattingEditProvider(
        CONTENT_SELECTOR,
        new SentinelContentFormatProvider()
    );
}