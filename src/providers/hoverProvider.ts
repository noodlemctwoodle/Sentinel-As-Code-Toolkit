import * as vscode from 'vscode';
import { MitreLoader, MITRE_TACTIC_FIELDS, MITRE_TECHNIQUE_FIELDS } from '../validation/mitreLoader';
import { ConnectorLoader } from '../validation/connectorLoader';

export class SentinelRuleHoverProvider implements vscode.HoverProvider {
    
    public provideHover(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        
        // First, try to match MITRE technique IDs
        let wordRange = document.getWordRangeAtPosition(position, /T\d{4}(?:\.\d{3})?/);
        if (wordRange) {
            const techniqueId = document.getText(wordRange);
            return this.createTechniqueHover(techniqueId, wordRange);
        }
        
        // Then try to match tactic names, but only in the right context
        const mitreContext = this.getMitreContext(document, position);
        if (mitreContext) {
            wordRange = document.getWordRangeAtPosition(position, /[A-Z][a-zA-Z]+/);
            if (wordRange) {
                const tacticName = document.getText(wordRange);
                
                // Only provide hover for tactics context, not techniques
                if (mitreContext === 'tactics') {
                    return this.createTacticHover(tacticName, wordRange);
                }
            }
        }
        
        // Check for connector ID hover
        const connectorContext = this.getConnectorContext(document, position);
        if (connectorContext) {
            wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_-]*/);
            if (wordRange) {
                const connectorId = document.getText(wordRange);
                return this.createConnectorHover(connectorId, wordRange);
            }
        }
        
        return undefined;
    }
    
    /**
     * Determines if the current position is within a MITRE-related YAML section
     * Returns 'tactics', 'techniques', or null
     */
    private getMitreContext(document: vscode.TextDocument, position: vscode.Position): 'tactics' | 'techniques' | null {
        // Walk up to the nearest governing YAML key. Matching is anchored to the
        // key name so tactic-name hovers fire for `tactics`, while every
        // technique-list field (relevantTechniques / techniques / mitreTechniques)
        // is recognised regardless of content type.
        for (let i = position.line; i >= 0 && i >= position.line - 20; i--) {
            const keyMatch = /^(\s*)([A-Za-z0-9_]+):/.exec(document.lineAt(i).text);
            if (!keyMatch) {
                continue;
            }
            const key = keyMatch[2];
            if (MITRE_TACTIC_FIELDS.includes(key)) {
                return 'tactics';
            }
            if (MITRE_TECHNIQUE_FIELDS.includes(key)) {
                return 'techniques';
            }
            // A different top-level key means we've left the MITRE block.
            if (keyMatch[1].length === 0) {
                return null;
            }
        }
        
        return null;
    }
    
    /**
     * Creates hover information for MITRE techniques
     */
    private createTechniqueHover(techniqueId: string, range: vscode.Range): vscode.Hover | undefined {
        const technique = MitreLoader.getTechnique(techniqueId);
        
        if (!technique) {
            // Show basic info even for unknown techniques
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**${techniqueId}**\n\n`);
            markdown.appendMarkdown(`*MITRE ATT&CK Technique ID*\n\n`);
            markdown.appendMarkdown(`⚠️ This technique is not found in the loaded MITRE data.`);
            return new vscode.Hover(markdown, range);
        }
        
        const markdown = new vscode.MarkdownString();
        
        // Header with framework badge
        const frameworkBadge = this.getFrameworkBadge(technique.framework);
        markdown.appendMarkdown(`**${technique.id}: ${technique.name}** ${frameworkBadge}\n\n`);
        
        // Description
        if (technique.description) {
            markdown.appendMarkdown(`${technique.description}\n\n`);
        }
        
        // Framework information
        markdown.appendMarkdown(`**Framework:** MITRE ATT&CK ${technique.framework.toUpperCase()}\n\n`);
        
        // Tactics
        if (technique.tactics && technique.tactics.length > 0) {
            markdown.appendMarkdown(`**Tactics:** ${technique.tactics.join(', ')}\n\n`);
        }
        
        // Parent technique for sub-techniques
        if (technique.parent) {
            markdown.appendMarkdown(`**Parent Technique:** ${technique.parent}\n\n`);
        }
        
        // Link to MITRE ATT&CK
        const mitreUrl = this.getMitreUrl(technique.id, technique.framework);
        if (mitreUrl) {
            markdown.appendMarkdown(`[View on MITRE ATT&CK](${mitreUrl})`);
        }
        
        return new vscode.Hover(markdown, range);
    }
    
    /**
     * Creates hover information for MITRE tactics
     */
    private createTacticHover(tacticName: string, range: vscode.Range): vscode.Hover | undefined {
        const tactic = MitreLoader.getTacticDetails(tacticName);
        
        if (!tactic) {
            // Show basic info even for unknown tactics
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**${tacticName}**\n\n`);
            markdown.appendMarkdown(`*MITRE ATT&CK Tactic*\n\n`);
            markdown.appendMarkdown(`⚠️ This tactic is not found in the loaded MITRE data.`);
            return new vscode.Hover(markdown, range);
        }
        
        const markdown = new vscode.MarkdownString();
        
        // Header with framework badge
        const frameworkBadge = this.getFrameworkBadge(tactic.framework);
        markdown.appendMarkdown(`**${tactic.name}** ${frameworkBadge}\n\n`);
        
        // Description
        if (tactic.description) {
            markdown.appendMarkdown(`${tactic.description}\n\n`);
        }
        
        // Framework information
        markdown.appendMarkdown(`**Framework:** MITRE ATT&CK ${tactic.framework.toUpperCase()}\n\n`);
        
        // Related techniques
        const techniques = MitreLoader.getTechniquesForTactic(tacticName);
        if (techniques.length > 0) {
            markdown.appendMarkdown(`**Related Techniques:** ${techniques.length} techniques\n\n`);
            
            // Show a few example techniques
            const exampleTechniques = techniques.slice(0, 5);
            markdown.appendMarkdown(`*Examples:* ${exampleTechniques.map(t => t.id).join(', ')}`);
            if (techniques.length > 5) {
                markdown.appendMarkdown(` (and ${techniques.length - 5} more)`);
            }
            markdown.appendMarkdown('\n\n');
        }
        
        // Link to MITRE ATT&CK
        const mitreUrl = this.getMitreTacticUrl(tactic.id, tactic.framework);
        if (mitreUrl) {
            markdown.appendMarkdown(`[View on MITRE ATT&CK](${mitreUrl})`);
        }
        
        return new vscode.Hover(markdown, range);
    }
    
    /**
     * Gets a framework badge for display
     */
    private getFrameworkBadge(framework: 'enterprise' | 'mobile' | 'ics'): string {
        switch (framework) {
            case 'enterprise':
                return '`Enterprise`';
            case 'mobile':
                return '`Mobile`';
            case 'ics':
                return '`ICS`';
            default:
                return '';
        }
    }
    
    /**
     * Gets the MITRE ATT&CK URL for a technique
     */
    private getMitreUrl(techniqueId: string, framework: 'enterprise' | 'mobile' | 'ics'): string | null {
        const baseUrls = {
            enterprise: 'https://attack.mitre.org/techniques',
            mobile: 'https://attack.mitre.org/techniques',
            ics: 'https://attack.mitre.org/techniques'
        };
        
        const baseUrl = baseUrls[framework];
        if (!baseUrl) return null;
        
        // Convert T1234.567 to T1234/567 for URL
        const urlId = techniqueId.replace('.', '/');
        return `${baseUrl}/${urlId}/`;
    }
    
    /**
     * Gets the MITRE ATT&CK URL for a tactic
     */
    private getMitreTacticUrl(tacticId: string, framework: 'enterprise' | 'mobile' | 'ics'): string | null {
        if (!tacticId) return null;
        
        const baseUrls = {
            enterprise: 'https://attack.mitre.org/tactics',
            mobile: 'https://attack.mitre.org/tactics',
            ics: 'https://attack.mitre.org/tactics'
        };
        
        const baseUrl = baseUrls[framework];
        if (!baseUrl) return null;
        
        return `${baseUrl}/${tacticId}/`;
    }
    
    /**
     * Determines if the current position is within a connector-related YAML section
     */
    private getConnectorContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        // Look backwards to find if we're in a connector context
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text;
            const trimmedLine = line.trim();
            
            if (trimmedLine.includes('connectorId:') || trimmedLine.includes('requiredDataConnectors:')) {
                return true;
            }
            
            // Stop if we hit another top-level field
            if (i < position.line && /^[a-zA-Z]/.test(trimmedLine)) {
                break;
            }
        }
        return false;
    }
    
    /**
     * Creates hover information for connectors
     */
    private createConnectorHover(connectorId: string, range: vscode.Range): vscode.Hover | undefined {
        const connectorInfo = ConnectorLoader.getConnectorInfo(connectorId);
        
        if (connectorInfo) {
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            
            markdown.appendMarkdown(`### ${connectorInfo.displayName}\n\n`);
            
            if (connectorInfo.deprecated) {
                markdown.appendMarkdown(`⚠️ **This connector is deprecated**\n\n`);
            }
            
            if (connectorInfo.description) {
                markdown.appendMarkdown(`${connectorInfo.description}\n\n`);
            }
            
            if (connectorInfo.dataTypes.length > 0) {
                markdown.appendMarkdown(`**Available Data Types:**\n`);
                connectorInfo.dataTypes.forEach(dataType => {
                    markdown.appendMarkdown(`• \`${dataType}\`\n`);
                });
            }
            
            if (connectorInfo.publisher) {
                markdown.appendMarkdown(`\n**Publisher:** ${connectorInfo.publisher}`);
            }
            
            return new vscode.Hover(markdown, range);
        }
        
        return undefined;
    }
}