import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
    VALID_SEVERITIES, 
    EXPECTED_ORDER, 
    REQUIRED_FIELDS,
    VALID_TRIGGER_OPERATORS,
    DURATION_CONVERSION_PATTERNS,
    WEEKS_PATTERN
} from '../validation/constants';

export class SentinelRuleFormatter {
    private static readonly DEFAULT_VALUES: Record<string, () => any> = {
        'id': () => uuidv4(),
        'name': () => 'New Detection Rule',
        'description': () => 'Enter rule description here',
        'severity': () => VALID_SEVERITIES[1], // Medium
        'requiredDataConnectors': () => [{
            connectorId: 'YourConnectorId',
            dataTypes: ['YourDataType']
        }],
        'queryFrequency': () => 'PT5M',
        'queryPeriod': () => 'PT5M', 
        'triggerOperator': () => VALID_TRIGGER_OPERATORS[0], // gt
        'triggerThreshold': () => 0,
        'tactics': () => ['YourTactic'],
        'relevantTechniques': () => ['T0000'],
        'query': () => '// Enter your KQL query here\n// Replace this with your actual query',
        'entityMappings': () => [{
            entityType: 'Account',
            fieldMappings: [{
                identifier: 'FullName',
                columnName: 'YourColumnName'
            }]
        }],
        'version': () => '1.0.0',
        'kind': () => 'Scheduled'
    };

    private static extensionContext: vscode.ExtensionContext;

    public static setExtensionContext(context: vscode.ExtensionContext) {
        this.extensionContext = context;
    }

    public static async loadTemplate(templateName: string): Promise<string> {
        try {
            if (!this.extensionContext) {
                throw new Error('Extension context not set');
            }
            
            const templatePath = path.join(this.extensionContext.extensionPath, 'templates', `${templateName}.template.yaml`);
            const templateContent = await vscode.workspace.fs.readFile(vscode.Uri.file(templatePath));
            const template = Buffer.from(templateContent).toString('utf8');
            
            // Replace placeholder with actual GUID
            const newId = uuidv4();
            return template.replace('{{GUID}}', newId);
        } catch (error) {
            console.error(`Template file not found: ${templateName}`, error);
            // Last resort: return the in-memory minimal template. It is
            // filesystem-independent, so it cannot fail the way a file read can.
            return this.getMinimalTemplate();
        }
    }

    /**
     * Loads a content template by its full filename (e.g. 'parser.template.yaml'
     * or 'summary-rule.template.yaml') without the analytics-rule fallback used by
     * loadTemplate. Content templates are the single source of truth for the
     * interactive scaffolders and the content-type picker. Throws if not found.
     */
    public static async loadContentTemplate(fileName: string): Promise<string> {
        if (!this.extensionContext) {
            throw new Error('Extension context not set');
        }

        const templatePath = path.join(this.extensionContext.extensionPath, 'templates', fileName);
        const templateContent = await vscode.workspace.fs.readFile(vscode.Uri.file(templatePath));
        return Buffer.from(templateContent).toString('utf8');
    }

    private static getMinimalTemplate(): string {
        const newId = uuidv4();
        return `id: ${newId}
name: New Detection Rule
description: Enter rule description here
severity: Medium
requiredDataConnectors:
  - connectorId: YourConnectorId
    dataTypes:
      - YourDataType
queryFrequency: PT5M
queryPeriod: PT5M
triggerOperator: gt
triggerThreshold: 0
tactics:
  - YourTactic
relevantTechniques:
  - T0000
query: |
  // Enter your KQL query here
  // Replace this with your actual query
entityMappings:
  - entityType: Account
    fieldMappings:
      - identifier: FullName
        columnName: YourColumnName
version: 1.0.0
kind: Scheduled
`;
    }

    public static formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const content = document.getText();
        
        try {
            const parsedYaml = yaml.load(content);
            if (!parsedYaml || typeof parsedYaml !== 'object') {
                return edits;
            }

            // Track changes for user feedback
            const changes: string[] = [];

            // Add missing required fields
            const addedFields = this.addMissingFields(parsedYaml);
            if (addedFields.length > 0) {
                changes.push(`Added missing fields: ${addedFields.join(', ')}`);
            }

            // Auto-correct invalid values
            const correctedValues = this.correctInvalidValues(parsedYaml);
            if (correctedValues.length > 0) {
                changes.push(`Auto-corrected values: ${correctedValues.join(', ')}`);
            }

            // Reorder fields according to expected order
            const reorderedYaml = this.reorderFields(parsedYaml);

            // Convert back to YAML
            const newContent = yaml.dump(reorderedYaml, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: false
            });

            // Create edit for entire document
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            edits.push(new vscode.TextEdit(fullRange, newContent));

            // Show user feedback
            if (changes.length > 0) {
                vscode.window.showInformationMessage(`Sentinel rule formatted: ${changes.join('; ')}`);
            } else {
                vscode.window.showInformationMessage('Sentinel rule formatted (field order corrected)');
            }

        } catch (error) {
            console.error('Formatting error:', error);
            vscode.window.showErrorMessage(`Failed to format document: ${error}`);
        }

        return edits;
    }

    public static reorderFieldsOnly(document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const content = document.getText();
        
        try {
            const parsedYaml = yaml.load(content);
            if (!parsedYaml || typeof parsedYaml !== 'object') {
                return edits;
            }

            // Only reorder fields, don't change values
            const reorderedYaml = this.reorderFields(parsedYaml);

            // Convert back to YAML
            const newContent = yaml.dump(reorderedYaml, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                quotingType: '"',
                forceQuotes: false
            });

            // Create edit for entire document
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );

            edits.push(new vscode.TextEdit(fullRange, newContent));

            vscode.window.showInformationMessage('Field order corrected');

        } catch (error) {
            console.error('Field reordering error:', error);
            vscode.window.showErrorMessage(`Failed to reorder fields: ${error}`);
        }

        return edits;
    }

    private static addMissingFields(parsedYaml: any): string[] {
        const addedFields: string[] = [];
        
        for (const field of REQUIRED_FIELDS) {
            if (!(field in parsedYaml)) {
                if (this.DEFAULT_VALUES[field]) {
                    parsedYaml[field] = this.DEFAULT_VALUES[field]();
                    addedFields.push(field);
                }
            }
        }
        
        return addedFields;
    }

    private static correctInvalidValues(parsedYaml: any): string[] {
        const correctedValues: string[] = [];

        // Function to convert common duration formats to ISO 8601
        const convertToISO8601 = (value: string): string => {
            const trimmedValue = value.trim();
            
            // Handle weeks format (e.g., "1 week", "2weeks")
            const weekMatch = trimmedValue.match(WEEKS_PATTERN);
            if (weekMatch) {
                const weeks = parseInt(weekMatch[1]);
                const days = weeks * 7;
                return `P${days}D`;
            }
            
            // Apply duration conversion patterns
            for (const pattern of DURATION_CONVERSION_PATTERNS) {
                if (pattern.regex.test(trimmedValue)) {
                    return trimmedValue.replace(pattern.regex, pattern.replacement);
                }
            }
            
            return trimmedValue;
        };

        // Function to recursively correct duration fields
        const correctDurationFields = (obj: any, path: string[] = []): void => {
            if (typeof obj !== 'object' || obj === null) {
                return;
            }

            const durationFields = ['queryFrequency', 'queryPeriod', 'suppressionDuration', 'lookbackDuration'];

            for (const [key, value] of Object.entries(obj)) {
                const currentPath = [...path, key];
                const fieldName = currentPath.join('.');

                if (durationFields.includes(key) && typeof value === 'string') {
                    const correctedValue = convertToISO8601(value);
                    if (correctedValue !== value) {
                        obj[key] = correctedValue;
                        correctedValues.push(`${fieldName}: "${value}" → "${correctedValue}"`);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    correctDurationFields(value, currentPath);
                }
            }
        };

        // Correct duration fields
        correctDurationFields(parsedYaml);

        // Correct severity case
        if (parsedYaml.severity && typeof parsedYaml.severity === 'string') {
            const normalizedSeverity = parsedYaml.severity.toLowerCase();
            const correctSeverity = VALID_SEVERITIES.find(s => s.toLowerCase() === normalizedSeverity);
            if (correctSeverity && correctSeverity !== parsedYaml.severity) {
                correctedValues.push(`severity: "${parsedYaml.severity}" → "${correctSeverity}"`);
                parsedYaml.severity = correctSeverity;
            }
        }

        // Correct trigger operator case
        if (parsedYaml.triggerOperator && typeof parsedYaml.triggerOperator === 'string') {
            const normalizedOperator = parsedYaml.triggerOperator.toLowerCase();
            const correctOperator = VALID_TRIGGER_OPERATORS.find(op => op.toLowerCase() === normalizedOperator);
            if (correctOperator && correctOperator !== parsedYaml.triggerOperator) {
                correctedValues.push(`triggerOperator: "${parsedYaml.triggerOperator}" → "${correctOperator}"`);
                parsedYaml.triggerOperator = correctOperator;
            }
        }

        return correctedValues;
    }

    private static reorderFields(parsedYaml: any): any {
        const reordered: any = {};
        
        // Add fields in expected order
        for (const field of EXPECTED_ORDER) {
            if (field in parsedYaml) {
                reordered[field] = parsedYaml[field];
            }
        }
        
        // Add any remaining fields not in expected order
        for (const [key, value] of Object.entries(parsedYaml)) {
            if (!EXPECTED_ORDER.includes(key)) {
                reordered[key] = value;
            }
        }
        
        return reordered;
    }

    // Utility method to normalize line endings
    private static normalizeContent(content: string): string {
        return content
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0)
            .join('\n');
    }
}