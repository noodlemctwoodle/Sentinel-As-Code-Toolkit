//
// src/content/contentTypes.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { RuleTypeDetector, RuleType } from '../utils/ruleTypeDetector';

/**
 * The Sentinel-as-Code content types that the toolkit can format and validate.
 * Each maps to a folder under `Content/` in the Sentinel-as-Code repository.
 */
export enum SentinelContentType {
    AnalyticsRule = 'AnalyticsRule',
    HuntingQuery = 'HuntingQuery',
    AutomationRule = 'AutomationRule',
    SummaryRule = 'SummaryRule',
    Watchlist = 'Watchlist',
    Workbook = 'Workbook',
    Playbook = 'Playbook',
    Parser = 'Parser',
    DefenderDetection = 'DefenderDetection',
    Unknown = 'Unknown'
}

/** The on-disk serialisation format for a content type. */
export type ContentFormat = 'yaml' | 'json' | 'unknown';

export interface ContentTypeInfo {
    type: SentinelContentType;
    format: ContentFormat;
    /** Human-readable label used in messages. */
    label: string;
}

/** Maps repository folder names (lower-cased) to their content type. */
const FOLDER_MAP: Record<string, SentinelContentType> = {
    'analyticalrules': SentinelContentType.AnalyticsRule,
    'analyticsrules': SentinelContentType.AnalyticsRule,
    'huntingqueries': SentinelContentType.HuntingQuery,
    'automationrules': SentinelContentType.AutomationRule,
    'summaryrules': SentinelContentType.SummaryRule,
    'watchlists': SentinelContentType.Watchlist,
    'workbooks': SentinelContentType.Workbook,
    'playbooks': SentinelContentType.Playbook,
    'parsers': SentinelContentType.Parser,
    'defendercustomdetections': SentinelContentType.DefenderDetection
};

const LABELS: Record<SentinelContentType, string> = {
    [SentinelContentType.AnalyticsRule]: 'Analytics Rule',
    [SentinelContentType.HuntingQuery]: 'Hunting Query',
    [SentinelContentType.AutomationRule]: 'Automation Rule',
    [SentinelContentType.SummaryRule]: 'Summary Rule',
    [SentinelContentType.Watchlist]: 'Watchlist',
    [SentinelContentType.Workbook]: 'Workbook',
    [SentinelContentType.Playbook]: 'Playbook',
    [SentinelContentType.Parser]: 'Parser',
    [SentinelContentType.DefenderDetection]: 'Defender Custom Detection',
    [SentinelContentType.Unknown]: 'Unknown'
};

const YAML_TYPES = new Set<SentinelContentType>([
    SentinelContentType.AnalyticsRule,
    SentinelContentType.HuntingQuery,
    SentinelContentType.Parser,
    SentinelContentType.DefenderDetection
]);

const JSON_TYPES = new Set<SentinelContentType>([
    SentinelContentType.AutomationRule,
    SentinelContentType.SummaryRule,
    SentinelContentType.Watchlist,
    SentinelContentType.Workbook,
    SentinelContentType.Playbook
]);

function formatFor(type: SentinelContentType): ContentFormat {
    if (YAML_TYPES.has(type)) {
        return 'yaml';
    }
    if (JSON_TYPES.has(type)) {
        return 'json';
    }
    return 'unknown';
}

function toInfo(type: SentinelContentType): ContentTypeInfo {
    return { type, format: formatFor(type), label: LABELS[type] };
}

/**
 * Detects the Sentinel-as-Code content type for a document, preferring the
 * repository folder name and falling back to inspecting the document content.
 */
export function detectContentType(document: vscode.TextDocument): ContentTypeInfo {
    const fromPath = detectFromPath(document.uri.fsPath);
    if (fromPath !== SentinelContentType.Unknown) {
        return toInfo(fromPath);
    }

    return toInfo(detectFromContent(document));
}

/** Detects a content type from the folder segments of a file path. */
function detectFromPath(fsPath: string): SentinelContentType {
    const segments = fsPath.split(/[\\/]/).map(segment => segment.toLowerCase());
    for (const segment of segments) {
        const match = FOLDER_MAP[segment];
        if (match) {
            return match;
        }
    }
    return SentinelContentType.Unknown;
}

/** Detects a content type by parsing and inspecting the document content. */
function detectFromContent(document: vscode.TextDocument): SentinelContentType {
    const content = document.getText();
    const isJson = document.languageId === 'json' || /\.(json|jsonc)$/i.test(document.uri.fsPath);

    if (isJson) {
        return detectJsonContent(content);
    }

    // Treat everything else as YAML (Analytics Rule, Hunting Query, or Defender detection).
    if (RuleTypeDetector.detectType(content) === RuleType.DEFENDER) {
        return SentinelContentType.DefenderDetection;
    }

    let parsed: any;
    try {
        parsed = yaml.load(content);
    } catch {
        return SentinelContentType.Unknown;
    }

    if (!parsed || typeof parsed !== 'object') {
        return SentinelContentType.Unknown;
    }

    // Parsers are saved KQL functions identified by a functionAlias.
    if ('functionAlias' in parsed && 'query' in parsed) {
        return SentinelContentType.Parser;
    }

    const kind = typeof parsed.kind === 'string' ? parsed.kind.toLowerCase() : undefined;
    if (kind === 'scheduled' || kind === 'nrt') {
        return SentinelContentType.AnalyticsRule;
    }

    const hasSchedulingFields = 'severity' in parsed || 'triggerOperator' in parsed ||
        'triggerThreshold' in parsed || 'queryFrequency' in parsed;
    if (hasSchedulingFields) {
        return SentinelContentType.AnalyticsRule;
    }

    // Hunting queries require id + name + query and have none of the scheduling fields above.
    if ('id' in parsed && 'name' in parsed && 'query' in parsed) {
        return SentinelContentType.HuntingQuery;
    }

    return SentinelContentType.Unknown;
}

/** Best-effort classification of a JSON document into a Sentinel content type. */
function detectJsonContent(content: string): SentinelContentType {
    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch {
        return SentinelContentType.Unknown;
    }

    if (!parsed || typeof parsed !== 'object') {
        return SentinelContentType.Unknown;
    }

    const schema = typeof parsed.$schema === 'string' ? parsed.$schema.toLowerCase() : '';

    // Workbook gallery template: version + items, or a workbook schema reference.
    if (schema.includes('workbook') || ('version' in parsed && 'items' in parsed)) {
        return SentinelContentType.Workbook;
    }

    // ARM deployment templates (Logic App playbooks).
    if (schema.includes('deploymenttemplate') || ('resources' in parsed && 'contentVersion' in parsed)) {
        return SentinelContentType.Playbook;
    }

    const properties = (parsed.properties && typeof parsed.properties === 'object') ? parsed.properties : parsed;

    // Watchlists expose a search key and item source.
    if ('watchlistAlias' in properties || 'itemsSearchKey' in properties || 'numberOfLinesToSkip' in properties) {
        return SentinelContentType.Watchlist;
    }

    // Automation rules carry triggering logic and actions.
    if ('triggeringLogic' in properties || ('actions' in properties && 'triggersOn' in properties)) {
        return SentinelContentType.AutomationRule;
    }

    // Summary rules define a binned aggregation query.
    if ('binSize' in properties || 'binDelay' in properties) {
        return SentinelContentType.SummaryRule;
    }

    return SentinelContentType.Unknown;
}
