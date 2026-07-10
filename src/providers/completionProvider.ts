import * as vscode from 'vscode';
import { ConnectorLoader } from '../validation/connectorLoader';
import { MitreLoader, MITRE_TACTIC_FIELDS, MITRE_TECHNIQUE_FIELDS } from '../validation/mitreLoader';
import { RuleTypeDetector, RuleType } from '../utils/ruleTypeDetector';
import { VALID_SEVERITIES } from '../validation/constants';

// Export the interfaces so they can be used by the completion provider
export interface MitreTactic {
    id: string;
    name: string;
    description: string;
}

export interface MitreTechnique {
    id: string;
    name: string;
    tactics: string[];
    description?: string;
    parent?: string;
}

export class SentinelCompletionProvider implements vscode.CompletionItemProvider {
    
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

        // Identifiers here never contain a hyphen, so keep the leading YAML list
        // dash ("- ") out of the replacement range.
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_.]+/);

        // requiredDataConnectors -> connectorId: <value>
        if (this.isConnectorIdContext(document, position)) {
            return this.getConnectorCompletions(wordRange);
        }

        // requiredDataConnectors -> dataTypes: [ - <value> ], scoped to the entry's connectorId
        const dataTypesContext = this.getDataTypesContext(document, position);
        if (dataTypesContext) {
            return this.getDataTypeCompletions(dataTypesContext.connectorId, wordRange);
        }

        if (this.isTacticsContext(document, position)) {
            return this.getTacticsCompletions();
        }

        if (this.isTechniquesContext(document, position)) {
            return this.getTechniquesCompletions();
        }

        if (this.isSeverityContext(document, position)) {
            return this.getSeverityCompletions(document, wordRange);
        }

        const durationField = this.getDurationField(document, position);
        if (durationField) {
            return this.getDurationCompletions(durationField, wordRange);
        }

        return [];
    }

    private isConnectorIdContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const line = document.lineAt(position.line).text;
        const match = /^\s*(?:-\s*)?connectorId:\s*/.exec(line);
        if (!match) {
            return false;
        }
        // Only when the cursor sits in the value position (at or after "connectorId: ").
        return position.character >= match[0].length;
    }

    private getDataTypesContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): { connectorId?: string } | undefined {
        const line = document.lineAt(position.line).text;

        // The cursor must sit inside a block sequence value: either on a
        // "- <item>" line, or on a blank / partially-typed line where the user
        // is about to add one (so Ctrl+Space on a fresh list line still works).
        const dashMatch = /^(\s*)-\s*/.exec(line);
        const beforeCursor = line.slice(0, position.character);
        const isBlankOrPartial = /^\s*[A-Za-z0-9_.]*$/.test(beforeCursor);
        if (!dashMatch && !isBlankOrPartial) {
            return undefined;
        }
        const itemIndent = dashMatch ? dashMatch[1].length : /^\s*/.exec(line)![0].length;

        // Walk upward to the governing mapping key. Skip blank lines, sibling
        // sequence items, and anything nested deeper than this item. The first
        // shallower-or-equal bare "key:" line we reach governs the list, which is
        // tolerant of both indented and compact YAML sequence styles.
        for (let i = position.line - 1; i >= 0 && i >= position.line - 60; i--) {
            const above = document.lineAt(i).text;
            if (above.trim() === '') {
                continue;
            }
            const indent = /^\s*/.exec(above)![0].length;
            if (indent > itemIndent) {
                continue; // nested content belonging to a sibling item
            }
            if (/^\s*-/.test(above)) {
                continue; // a sibling sequence item
            }
            const keyMatch = /^\s*([A-Za-z0-9_]+):\s*$/.exec(above);
            if (keyMatch && keyMatch[1] === 'dataTypes') {
                return { connectorId: this.findEnclosingConnectorId(document, i) };
            }
            // Any other key (bare or with an inline value) governs this scope.
            return undefined;
        }
        return undefined;
    }

    private findEnclosingConnectorId(document: vscode.TextDocument, fromLine: number): string | undefined {
        for (let i = fromLine; i >= 0 && i >= fromLine - 60; i--) {
            const line = document.lineAt(i).text;
            const match = /^\s*(?:-\s*)?connectorId:\s*(.+?)\s*$/.exec(line);
            if (match) {
                return match[1].replace(/^['"]|['"]$/g, '').trim();
            }
            if (/^\s*requiredDataConnectors:/.test(line)) {
                break;
            }
        }
        return undefined;
    }
    
    private isTacticsContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        return this.isInMitreSection(document, position, MITRE_TACTIC_FIELDS);
    }
    
    private isTechniquesContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        return this.isInMitreSection(document, position, MITRE_TECHNIQUE_FIELDS);
    }
    
    // Determines whether the cursor sits inside a MITRE list governed by one of
    // the given field keys. Matching is anchored to the YAML key (start-of-key,
    // case-sensitive) so `relevantTechniques` and `techniques` are told apart and
    // the word never matches inside a description or comment.
    private isInMitreSection(document: vscode.TextDocument, position: vscode.Position, keys: string[]): boolean {
        const line = document.lineAt(position.line).text;

        // On the field's own key line (e.g. "tactics:" or "relevantTechniques:"),
        // including when the cursor sits in the inline value position.
        const keyOnLine = /^\s*([A-Za-z0-9_]+):/.exec(line);
        if (keyOnLine && keys.includes(keyOnLine[1])) {
            return true;
        }

        // On a block-sequence item ("- value") or a blank/partial line where the
        // user is about to add one: walk up to the governing mapping key.
        const beforeCursor = line.slice(0, position.character);
        const onListItem = /^\s*-\s*/.test(line);
        const onBlankOrPartial = /^\s*[A-Za-z0-9_.]*$/.test(beforeCursor);
        if (!onListItem && !onBlankOrPartial) {
            return false;
        }

        for (let i = position.line - 1; i >= 0 && i >= position.line - 20; i--) {
            const above = document.lineAt(i).text;
            if (above.trim() === '') {
                continue;
            }
            const keyMatch = /^(\s*)([A-Za-z0-9_]+):/.exec(above);
            if (keyMatch) {
                if (keys.includes(keyMatch[2])) {
                    return true;
                }
                // A top-level key that isn't ours ends this block.
                if (keyMatch[1].length === 0) {
                    return false;
                }
            }
        }
        return false;
    }
    
    private getConnectorCompletions(range?: vscode.Range): vscode.CompletionItem[] {
        return ConnectorLoader.getAllConnectors().map(connector => {
            const item = new vscode.CompletionItem(connector.id, vscode.CompletionItemKind.Value);
            item.detail = connector.deprecated ? `${connector.name} (deprecated)` : connector.name;

            const tables = connector.dataTypes.length > 0
                ? connector.dataTypes.map(dt => `- ${dt}`).join('\n')
                : '_No tables recorded_';
            item.documentation = new vscode.MarkdownString(
                `**${connector.name}**\n\n${connector.description}\n\n**Tables**\n\n${tables}`
            );

            item.insertText = connector.id;
            if (range) {
                item.range = range;
            }
            const microsoftRank = connector.category === 'microsoft' ? '0' : '1';
            item.sortText = `${connector.deprecated ? '1' : '0'}_${microsoftRank}_${connector.id}`;
            item.filterText = `${connector.id} ${connector.name}`;
            return item;
        });
    }

    private getDataTypeCompletions(connectorId?: string, range?: vscode.Range): vscode.CompletionItem[] {
        let tables: string[] = [];
        let scoped = false;

        if (connectorId) {
            const info = ConnectorLoader.getConnectorInfo(connectorId);
            if (info && info.dataTypes.length > 0) {
                tables = info.dataTypes;
                scoped = true;
            }
        }
        if (!scoped) {
            tables = ConnectorLoader.getAllDataTypes();
        }

        const unique = Array.from(new Set(tables)).sort((a, b) => a.localeCompare(b));
        return unique.map(table => {
            const item = new vscode.CompletionItem(table, vscode.CompletionItemKind.Value);
            item.detail = scoped ? `Table provided by ${connectorId}` : 'Log Analytics table';
            item.insertText = table;
            if (range) {
                item.range = range;
            }
            item.sortText = `${scoped ? '0' : '1'}_${table}`;
            return item;
        });
    }
    
    private getTacticsCompletions(): vscode.CompletionItem[] {
        console.log('🎯 Getting tactics completions...');
        
        try {
            // Try the new method first
            const tacticsData = (MitreLoader as any).getAllTactics?.();
            if (tacticsData && Array.isArray(tacticsData)) {
                console.log(`Found ${tacticsData.length} tactics with details`);
                return tacticsData.map((tactic: MitreTactic) => {
                    const item = new vscode.CompletionItem(tactic.name, vscode.CompletionItemKind.EnumMember);
                    item.detail = `MITRE ATT&CK Tactic${tactic.id ? ` (${tactic.id})` : ''}`;
                    item.documentation = new vscode.MarkdownString(
                        `**${tactic.name}**${tactic.id ? ` (${tactic.id})` : ''}\n\n${tactic.description}`
                    );
                    item.insertText = tactic.name;
                    item.sortText = `tactic_${tactic.name}`;
                    item.filterText = `${tactic.name} ${tactic.description}`;
                    return item;
                });
            }
        } catch (error) {
            console.warn('Failed to get detailed tactics, falling back to simple list:', error);
        }
        
        // Fallback to the existing method
        const tactics = MitreLoader.getValidTactics();
        console.log(`Found ${tactics.length} tactics (simple list)`);
        
        return tactics.map((tactic: string) => {
            const item = new vscode.CompletionItem(tactic, vscode.CompletionItemKind.EnumMember);
            item.detail = `MITRE ATT&CK Tactic`;
            item.insertText = tactic;
            item.sortText = `tactic_${tactic}`;
            return item;
        });
    }
    
    private getTechniquesCompletions(): vscode.CompletionItem[] {
        console.log('🔧 Getting techniques completions...');
        
        try {
            // Try the new method first
            const techniquesData = (MitreLoader as any).getAllTechniques?.();
            if (techniquesData && Array.isArray(techniquesData)) {
                console.log(`Found ${techniquesData.length} techniques with details`);
                return techniquesData.map((technique: MitreTechnique) => {
                    const item = new vscode.CompletionItem(technique.id, vscode.CompletionItemKind.EnumMember);
                    item.detail = `${technique.name} (${technique.tactics.join(', ')})`;
                    
                    const documentation = new vscode.MarkdownString();
                    documentation.appendMarkdown(`**${technique.name}** (${technique.id})\n\n`);
                    if (technique.description) {
                        documentation.appendMarkdown(`${technique.description}\n\n`);
                    }
                    documentation.appendMarkdown(`**Tactics:** ${technique.tactics.join(', ')}`);
                    if (technique.parent) {
                        documentation.appendMarkdown(`\n\n**Parent Technique:** ${technique.parent}`);
                    }
                    
                    item.documentation = documentation;
                    item.insertText = technique.id;
                    item.sortText = `technique_${technique.id}`;
                    item.filterText = `${technique.id} ${technique.name} ${technique.tactics.join(' ')}`;
                    
                    return item;
                });
            }
        } catch (error) {
            console.warn('Failed to get detailed techniques, falling back to simple list:', error);
        }
        
        // Fallback to common techniques
        const commonTechniques: string[] = [
            'T1566.001', 'T1566.002', 'T1059.001', 'T1078', 'T1190',
            'T1105', 'T1055', 'T1003', 'T1021', 'T1083'
        ];
        
        console.log(`Using ${commonTechniques.length} common techniques as fallback`);
        
        return commonTechniques.map((technique: string) => {
            const item = new vscode.CompletionItem(technique, vscode.CompletionItemKind.EnumMember);
            item.detail = `MITRE ATT&CK Technique`;
            item.insertText = technique;
            item.sortText = `technique_${technique}`;
            return item;
        });
    }

    // Human-readable notes per severity level, keyed by the canonical capitalised
    // form. Defender custom detections reuse these with lowercase values.
    private static readonly SEVERITY_DESCRIPTIONS: Record<string, string> = {
        High: 'Highest priority. Significant or immediate threat.',
        Medium: 'Notable activity that should be reviewed.',
        Low: 'Lower-priority signal, often benign.',
        Informational: 'No direct impact; contextual awareness only.'
    };

    // Common ISO 8601 durations with human-readable labels, ordered shortest to
    // longest so the completion list reads naturally.
    private static readonly DURATION_OPTIONS: { value: string; label: string; minutes: number }[] = [
        { value: 'PT5M', label: '5 minutes', minutes: 5 },
        { value: 'PT10M', label: '10 minutes', minutes: 10 },
        { value: 'PT15M', label: '15 minutes', minutes: 15 },
        { value: 'PT30M', label: '30 minutes', minutes: 30 },
        { value: 'PT1H', label: '1 hour', minutes: 60 },
        { value: 'PT2H', label: '2 hours', minutes: 120 },
        { value: 'PT3H', label: '3 hours', minutes: 180 },
        { value: 'PT4H', label: '4 hours', minutes: 240 },
        { value: 'PT5H', label: '5 hours', minutes: 300 },
        { value: 'PT6H', label: '6 hours', minutes: 360 },
        { value: 'PT8H', label: '8 hours', minutes: 480 },
        { value: 'PT12H', label: '12 hours', minutes: 720 },
        { value: 'PT24H', label: '24 hours', minutes: 1440 },
        { value: 'P1D', label: '1 day', minutes: 1440 },
        { value: 'P2D', label: '2 days', minutes: 2880 },
        { value: 'P3D', label: '3 days', minutes: 4320 },
        { value: 'P7D', label: '7 days', minutes: 10080 },
        { value: 'P14D', label: '14 days', minutes: 20160 }
    ];

    private isSeverityContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        return this.isScalarValueContext(document, position, ['severity']);
    }

    // Sentinel analytics/NRT rules use capitalised severities; Defender custom
    // detections use the lowercase form. Detect the rule type so the suggested
    // casing is always valid for the file being edited.
    private getSeverityCompletions(document: vscode.TextDocument, range?: vscode.Range): vscode.CompletionItem[] {
        const isDefender = RuleTypeDetector.detectType(document.getText()) === RuleType.DEFENDER;
        // VALID_SEVERITIES is ordered Informational -> High; present most severe first.
        const ordered = [...VALID_SEVERITIES].reverse();
        return ordered.map((severity, index) => {
            const value = isDefender ? severity.toLowerCase() : severity;
            const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember);
            item.detail = isDefender ? 'Defender custom detection severity' : 'Sentinel rule severity';
            const description = SentinelCompletionProvider.SEVERITY_DESCRIPTIONS[severity];
            if (description) {
                item.documentation = new vscode.MarkdownString(`**${value}** — ${description}`);
            }
            item.insertText = value;
            if (range) {
                item.range = range;
            }
            item.sortText = `severity_${index}`;
            item.filterText = value;
            return item;
        });
    }

    private getDurationField(document: vscode.TextDocument, position: vscode.Position): 'schedule' | 'suppression' | undefined {
        if (this.isScalarValueContext(document, position, ['queryFrequency', 'queryPeriod'])) {
            return 'schedule';
        }
        if (this.isScalarValueContext(document, position, ['suppressionDuration'])) {
            return 'suppression';
        }
        return undefined;
    }

    // Scheduled cadence fields accept 5 minutes to 14 days; suppressionDuration is
    // capped at 24 hours, so the longer options are filtered out for it.
    private getDurationCompletions(field: 'schedule' | 'suppression', range?: vscode.Range): vscode.CompletionItem[] {
        const maxMinutes = field === 'suppression' ? 1440 : Number.MAX_SAFE_INTEGER;
        return SentinelCompletionProvider.DURATION_OPTIONS
            .filter(option => option.minutes <= maxMinutes)
            .map((option, index) => {
                const item = new vscode.CompletionItem(
                    { label: option.value, description: option.label },
                    vscode.CompletionItemKind.Value
                );
                item.detail = option.label;
                item.documentation = new vscode.MarkdownString(`\`${option.value}\` — ${option.label} (ISO 8601 duration)`);
                item.insertText = option.value;
                if (range) {
                    item.range = range;
                }
                item.sortText = `duration_${String(index).padStart(2, '0')}`;
                item.filterText = `${option.value} ${option.label}`;
                return item;
            });
    }

    // A scalar (inline) value context: the cursor sits in the value position of a
    // "<key>: <value>" line for one of the given keys. Used for single-value fields
    // (severity, durations) rather than the block-sequence lists above.
    private isScalarValueContext(document: vscode.TextDocument, position: vscode.Position, keys: string[]): boolean {
        const line = document.lineAt(position.line).text;
        const match = /^\s*([A-Za-z0-9_]+):\s*/.exec(line);
        if (!match || !keys.includes(match[1])) {
            return false;
        }
        return position.character >= match[0].length;
    }
}