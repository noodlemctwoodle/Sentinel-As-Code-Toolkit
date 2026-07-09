import * as vscode from 'vscode';
import { ConnectorLoader } from '../validation/connectorLoader';
import { MitreLoader } from '../validation/mitreLoader';

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
        const lineText = document.lineAt(position).text;
        
        // Direct line detection
        if (lineText.includes('tactics:') || lineText.includes('tactics')) {
            return true;
        }
        
        // Array item detection
        if (lineText.trim().startsWith('-') && this.isInSection(document, position, 'tactics')) {
            return true;
        }
        
        return false;
    }
    
    private isTechniquesContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const lineText = document.lineAt(position).text;
        
        // Direct line detection
        if (lineText.includes('techniques:') || lineText.includes('techniques')) {
            return true;
        }
        
        // Array item detection
        if (lineText.trim().startsWith('-') && this.isInSection(document, position, 'techniques')) {
            return true;
        }
        
        // Value position detection (after colon)
        const beforeCursor = lineText.substring(0, position.character);
        if (beforeCursor.includes('techniques:')) {
            return true;
        }
        
        return false;
    }
    
    private isInSection(document: vscode.TextDocument, position: vscode.Position, sectionName: string): boolean {
        // Look backwards to find the section header
        for (let i = position.line; i >= Math.max(0, position.line - 20); i--) {
            const line = document.lineAt(i).text;
            
            // Found our section
            if (line.includes(`${sectionName}:`)) {
                return true;
            }
            
            // Found a different top-level section (stop searching)
            if (line.trim() && !line.startsWith(' ') && !line.startsWith('-') && line.includes(':') && !line.includes(`${sectionName}:`)) {
                break;
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
                return techniquesData.slice(0, 50).map((technique: MitreTechnique) => { // Limit to 50 for performance
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
}