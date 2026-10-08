//
// src/content/contentFormatter.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import { detectContentType, SentinelContentType, ContentTypeInfo } from './contentTypes';
import { SentinelRuleFormatter } from '../formatting/formatter';
import { HuntingQueryFormatter } from './huntingQueryFormatter';
import { ParserFormatter } from './parserFormatter';
import { JsonContentFormatter } from './jsonContentFormatter';

export interface ContentFormatResult {
    info: ContentTypeInfo;
    edits: vscode.TextEdit[];
    supported: boolean;
    message?: string;
}

/**
 * Routes a document to the correct formatter based on its detected
 * Sentinel-as-Code content type.
 */
export class SentinelContentFormatter {
    public static format(document: vscode.TextDocument): ContentFormatResult {
        const info = detectContentType(document);

        switch (info.type) {
            case SentinelContentType.AnalyticsRule:
                return { info, supported: true, edits: SentinelRuleFormatter.formatDocument(document) };

            case SentinelContentType.HuntingQuery:
                return { info, supported: true, edits: HuntingQueryFormatter.formatDocument(document) };

            case SentinelContentType.Parser:
                return { info, supported: true, edits: ParserFormatter.formatDocument(document) };

            case SentinelContentType.AutomationRule:
            case SentinelContentType.SummaryRule:
            case SentinelContentType.Watchlist:
            case SentinelContentType.Workbook:
            case SentinelContentType.Playbook:
                // These types deploy as JSON but are often authored in YAML (New
                // Content scaffolds them that way). Only the JSON form is formatted;
                // re-dumping YAML would strip the template's comments.
                if (!this.isJsonDocument(document)) {
                    return {
                        info,
                        supported: false,
                        edits: [],
                        message: `${info.label} YAML is not reformatted. Use 'Convert Content YAML to JSON' to produce the formatted JSON for deployment.`
                    };
                }
                return { info, supported: true, edits: JsonContentFormatter.formatDocument(document) };

            case SentinelContentType.DefenderDetection:
                return {
                    info,
                    supported: false,
                    edits: [],
                    message: "Detected a Defender Custom Detection. Use 'Defender: Format Custom Detection for Repo' instead."
                };

            default:
                return this.formatUnknown(document, info);
        }
    }

    private static isJsonDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'json' || /\.(json|jsonc)$/i.test(document.uri.fsPath);
    }

    private static formatUnknown(_document: vscode.TextDocument, info: ContentTypeInfo): ContentFormatResult {
        // Unclassified documents (including arbitrary JSON such as package.json) are
        // left alone rather than being reformatted as "Unknown" content.
        return {
            info,
            supported: false,
            edits: [],
            message: 'Could not detect a Sentinel-as-Code content type for this document.'
        };
    }
}
