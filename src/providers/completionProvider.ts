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
        
        console.log('🔍 Sentinel as Code Toolkit: Completion requested at', position.line, position.character);
        
        const lineText = document.lineAt(position).text;
        const beforeCursor = lineText.substring(0, position.character);
        
        console.log('Line text:', lineText);
        console.log('Before cursor:', beforeCursor);
        
        // Check context in order of specificity
        if (this.isConnectorContext(document, position)) {
            console.log('📋 Detected connector context');
            return this.getConnectorCompletions();
        }
        
        if (this.isTacticsContext(document, position)) {
            console.log('🎯 Detected tactics context');
            return this.getTacticsCompletions();
        }
        
        if (this.isTechniquesContext(document, position)) {
            console.log('🔧 Detected techniques context');
            return this.getTechniquesCompletions();
        }
        
        // Fallback: if we're in a YAML file and near certain keywords, provide all completions
        if (document.languageId === 'yaml') {
            const text = document.getText();
            if (text.includes('tactics') || text.includes('techniques') || text.includes('connectorId')) {
                console.log('📝 YAML fallback: providing all completions');
                return [
                    ...this.getConnectorCompletions(),
                    ...this.getTacticsCompletions(),
                    ...this.getTechniquesCompletions()
                ];
            }
        }
        
        console.log('❌ No completion context detected');
        return [];
    }
    
    private isConnectorContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const lineText = document.lineAt(position).text;
        const text = document.getText();
        const offset = document.offsetAt(position);
        const beforeText = text.substring(0, offset);
        
        // More comprehensive connector detection
        return lineText.includes('connectorId') ||
               lineText.includes('requiredDataConnectors') ||
               beforeText.includes('connectorId:') || 
               beforeText.includes('requiredDataConnectors:') ||
               this.isInSection(document, position, 'connectorId') ||
               this.isInSection(document, position, 'requiredDataConnectors');
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
    
    private getConnectorCompletions(): vscode.CompletionItem[] {
        console.log('📋 Getting connector completions...');
        const connectors = ConnectorLoader.getAllConnectors();
        console.log(`Found ${connectors.length} connectors`);
        
        return connectors.map(connector => {
            const item = new vscode.CompletionItem(connector.id, vscode.CompletionItemKind.Value);
            item.detail = connector.name;
            item.documentation = new vscode.MarkdownString(
                `**${connector.name}**\n\n${connector.description}\n\n**Data Types:**\n${connector.dataTypes.map(dt => `• ${dt}`).join('\n')}`
            );
            item.insertText = connector.id;
            item.sortText = `connector_${connector.id}`;
            item.filterText = `${connector.id} ${connector.name}`;
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