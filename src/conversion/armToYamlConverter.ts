import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { EXPECTED_ORDER, VALID_ENTITY_TYPES, VALID_SEVERITIES, VALID_TRIGGER_OPERATORS } from '../validation/constants';

// ARM Template Interfaces
export interface ArmTemplate {
    $schema: string;
    contentVersion: string;
    parameters?: Record<string, any>;
    resources: ArmResource[];
}

export interface ArmResource {
    type: string;
    kind?: string;
    apiVersion: string;
    name?: string;
    properties: SentinelRuleProperties;
}

export interface SentinelRuleProperties {
    displayName: string;
    description: string;
    severity: string;
    enabled?: boolean;
    tactics?: string[];
    techniques?: string[];
    subTechniques?: string[];
    query: string;
    queryFrequency?: string;
    queryPeriod?: string;
    triggerOperator?: string;
    triggerThreshold?: number;
    suppressionDuration?: string;
    suppressionEnabled?: boolean;
    incidentConfiguration?: any;
    eventGroupingSettings?: any;
    alertDetailsOverride?: any;
    customDetails?: Record<string, string>;
    entityMappings?: EntityMapping[];
    requiredDataConnectors?: DataConnector[];
    templateVersion?: string;
}

// YAML Rule Interfaces
export interface SentinelYamlRule {
    id: string;
    name: string;
    description: string;
    severity: string;
    requiredDataConnectors: DataConnector[];
    // Scheduling and trigger fields apply to Scheduled rules only; NRT rules omit them.
    queryFrequency?: string;
    queryPeriod?: string;
    triggerOperator?: string;
    triggerThreshold?: number;
    enabled?: boolean;
    tactics: string[];
    relevantTechniques?: string[];
    tags?: string[];
    query: string;
    entityMappings: EntityMapping[];
    incidentConfiguration?: any;
    eventGroupingSettings?: any;
    suppressionDuration?: string;
    suppressionEnabled?: boolean;
    alertDetailsOverride?: any;
    customDetails?: Record<string, string>;
    version: string;
    kind: string;
}

export interface DataConnector {
    connectorId: string;
    dataTypes: string[];
}

export interface EntityMapping {
    entityType: string;
    fieldMappings: FieldMapping[];
}

export interface FieldMapping {
    identifier: string;
    columnName: string;
}

// Conversion Options
export interface ConversionOptions {
    namingStrategy: 'original' | 'displayName' | 'ruleId';
    outputDirectory?: string;
    validateMitre?: boolean;
    autoFormat?: boolean;
    includeOptionalFields?: boolean;
    preserveQueryFormatting?: boolean;
    defaultVersion?: string;
    validateEntityMappings?: boolean;
}

export interface ConversionResult {
    success: boolean;
    yamlContent?: string;
    fileName?: string;
    warnings: string[];
    errors: string[];
    ruleName?: string;
}

export interface BulkConversionResult {
    totalRules: number;
    successfulConversions: number;
    results: ConversionResult[];
    overallSuccess: boolean;
}

export class ArmToYamlConverter {
    private static readonly ARM_RESOURCE_TYPE = 'Microsoft.OperationalInsights/workspaces/providers/alertRules';
    private static readonly DEFAULT_OPTIONS: ConversionOptions = {
        namingStrategy: 'displayName',
        validateMitre: true,
        autoFormat: true,
        includeOptionalFields: true,
        preserveQueryFormatting: true,
        defaultVersion: '1.0.0',
        validateEntityMappings: true
    };

    /**
     * Converts an ARM template to YAML format
     */
    public static async convertArmToYaml(
        armContent: string, 
        options: Partial<ConversionOptions> = {}
    ): Promise<BulkConversionResult> {
        const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
        const result: BulkConversionResult = {
            totalRules: 0,
            successfulConversions: 0,
            results: [],
            overallSuccess: false
        };

        try {
            // Parse ARM template
            const armTemplate = this.parseArmTemplate(armContent);
            
            // Find Sentinel rule resources
            const sentinelRules = this.extractSentinelRules(armTemplate);
            result.totalRules = sentinelRules.length;

            if (sentinelRules.length === 0) {
                result.results.push({
                    success: false,
                    warnings: [],
                    errors: ['No Sentinel Analytics Rules found in ARM template']
                });
                return result;
            }

            // Convert each rule
            for (let i = 0; i < sentinelRules.length; i++) {
                const rule = sentinelRules[i];
                const conversionResult = await this.convertSingleRule(rule, i, mergedOptions);
                result.results.push(conversionResult);
                
                if (conversionResult.success) {
                    result.successfulConversions++;
                }
            }

            result.overallSuccess = result.successfulConversions > 0;
            return result;

        } catch (error) {
            result.results.push({
                success: false,
                warnings: [],
                errors: [`Failed to parse ARM template: ${error instanceof Error ? error.message : 'Unknown error'}`]
            });
            return result;
        }
    }

    /**
     * Validates if a JSON file contains ARM template with Sentinel rules
     */
    public static isValidArmTemplate(jsonContent: string): boolean {
        try {
            const parsed = JSON.parse(jsonContent);
            
            // Check for basic ARM template structure
            if (!parsed.$schema || !parsed.resources || !Array.isArray(parsed.resources)) {
                return false;
            }

            // Check if any resource is a Sentinel rule
            return parsed.resources.some((resource: any) => 
                resource.type === this.ARM_RESOURCE_TYPE
            );
        } catch {
            return false;
        }
    }

    /**
     * Generates filename based on naming strategy
     */
    public static generateFileName(
        rule: SentinelRuleProperties, 
        resourceName: string, 
        index: number, 
        strategy: ConversionOptions['namingStrategy']
    ): string {
        let baseName: string;

        switch (strategy) {
            case 'displayName': {
                baseName = this.sanitizeFileName(rule.displayName);
                break;
            }
            case 'ruleId': {
                // Extract GUID from resource name if possible, otherwise generate new one
                const guidMatch = resourceName.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
                baseName = guidMatch ? guidMatch[0].toLowerCase() : uuidv4(); // Convert GUID to lowercase
                break;
            }
            case 'original':
            default: {
                baseName = `rule${index > 0 ? `_${index + 1}` : ''}`;
                break;
            }
        }

        return `${baseName}.yaml`;
    }

    private static parseArmTemplate(armContent: string): ArmTemplate {
        try {
            const parsed = JSON.parse(armContent);
            
            if (!parsed.$schema || !parsed.resources) {
                throw new Error('Invalid ARM template structure: missing $schema or resources');
            }

            return parsed as ArmTemplate;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Invalid JSON syntax in ARM template', { cause: error });
            }
            throw error;
        }
    }

    private static extractSentinelRules(armTemplate: ArmTemplate): ArmResource[] {
        return armTemplate.resources.filter(resource => 
            resource.type === this.ARM_RESOURCE_TYPE &&
            resource.properties &&
            resource.properties.displayName
        );
    }

    private static async convertSingleRule(
        armResource: ArmResource, 
        index: number, 
        options: ConversionOptions
    ): Promise<ConversionResult> {
        const result: ConversionResult = {
            success: false,
            warnings: [],
            errors: []
        };

        try {
            const armProps = armResource.properties;
            const kind = this.normalizeKind(armResource.kind || 'Scheduled');
            const isNrt = kind === 'NRT';

            // Create YAML rule object
            const yamlRule: SentinelYamlRule = {
                id: this.extractOrGenerateId(armResource),
                name: armProps.displayName,
                description: this.formatDescription(armProps.description),
                severity: this.normalizeSeverity(armProps.severity),
                requiredDataConnectors: this.extractDataConnectors(armProps),
                ...(isNrt ? {} : {
                    queryFrequency: this.normalizeFrequency(armProps.queryFrequency || 'PT5M'),
                    queryPeriod: this.normalizeFrequency(armProps.queryPeriod || 'PT5M'),
                    triggerOperator: this.normalizeTriggerOperator(armProps.triggerOperator || 'gt'),
                    triggerThreshold: armProps.triggerThreshold || 0
                }),
                enabled: armProps.enabled !== false,
                tactics: this.normalizeTactics(armProps.tactics || []),
                relevantTechniques: this.normalizeTechniques(armProps),
                query: this.formatQuery(armProps.query, options.preserveQueryFormatting),
                entityMappings: this.normalizeEntityMappings(armProps.entityMappings || []),
                version: armProps.templateVersion || options.defaultVersion || '1.0.0',
                kind
            };

            // Add optional fields if requested
            if (options.includeOptionalFields) {
                if (armProps.incidentConfiguration) {
                    yamlRule.incidentConfiguration = armProps.incidentConfiguration;
                }
                if (armProps.eventGroupingSettings) {
                    yamlRule.eventGroupingSettings = armProps.eventGroupingSettings;
                }
                if (armProps.suppressionDuration) {
                    yamlRule.suppressionDuration = armProps.suppressionDuration;
                }
                if (armProps.suppressionEnabled !== undefined) {
                    yamlRule.suppressionEnabled = armProps.suppressionEnabled;
                }
                if (armProps.alertDetailsOverride) {
                    yamlRule.alertDetailsOverride = armProps.alertDetailsOverride;
                }
                if (armProps.customDetails) {
                    yamlRule.customDetails = armProps.customDetails;
                }
            }

            // Validate and add warnings for missing required fields
            this.validateRequiredFields(yamlRule, result);
            if (options.validateEntityMappings !== false) {
                this.validateEntityMappings(armProps.entityMappings, result);
            }

            // Generate YAML content with proper field ordering
            const orderedRule = this.reorderFields(yamlRule);
            result.yamlContent = this.generateYamlContent(orderedRule);
            result.fileName = this.generateFileName(
                armProps, 
                armResource.name || '', 
                index, 
                options.namingStrategy
            );
            result.ruleName = armProps.displayName;
            result.success = true;

        } catch (error) {
            result.errors.push(`Failed to convert rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return result;
    }

    private static extractOrGenerateId(armResource: ArmResource): string {
        // Try to extract GUID from resource name
        if (armResource.name) {
            const guidMatch = armResource.name.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
            if (guidMatch) {
                return guidMatch[0];
            }
        }
        
        // Generate new GUID
        return uuidv4();
    }

    private static formatDescription(description: string): string {
        if (!description) {
            return 'Enter rule description here';
        }
        
        // Format as pipe scalar for multiline descriptions
        return description.trim();
    }

    private static normalizeSeverity(severity: string): string {
        if (!severity) return 'Medium';
        
        const normalizedSeverity = severity.toLowerCase();
        const validSeverity = VALID_SEVERITIES.find(s => s.toLowerCase() === normalizedSeverity);
        return validSeverity || 'Medium';
    }

    private static extractDataConnectors(armProps: SentinelRuleProperties): DataConnector[] {
        if (!armProps.requiredDataConnectors || !Array.isArray(armProps.requiredDataConnectors)) {
            return [{
                connectorId: 'YourConnectorId',
                dataTypes: ['YourDataType']
            }];
        }
        
        return armProps.requiredDataConnectors;
    }

    private static normalizeFrequency(frequency: string): string {
        if (!frequency) return 'PT5M';
        
        // Ensure ISO 8601 format
        if (frequency.startsWith('P') || frequency.startsWith('PT')) {
            return frequency;
        }
        
        // Convert common formats
        const lowerFreq = frequency.toLowerCase();
        if (lowerFreq.includes('min')) {
            const minutes = parseInt(frequency);
            return `PT${minutes}M`;
        }
        if (lowerFreq.includes('hour') || lowerFreq.includes('h')) {
            const hours = parseInt(frequency);
            return `PT${hours}H`;
        }
        if (lowerFreq.includes('day') || lowerFreq.includes('d')) {
            const days = parseInt(frequency);
            return `P${days}D`;
        }
        
        return frequency;
    }

    private static normalizeTriggerOperator(operator: string): string {
        if (!operator) return 'gt';
        
        const normalizedOp = operator.toLowerCase();
        const validOperator = VALID_TRIGGER_OPERATORS.find(op => op.toLowerCase() === normalizedOp);
        return validOperator || 'gt';
    }

    private static normalizeTactics(tactics: string[]): string[] {
        if (!Array.isArray(tactics) || tactics.length === 0) {
            return ['YourTactic'];
        }
        return tactics;
    }

    private static normalizeTechniques(armProps: SentinelRuleProperties): string[] {
        const techniques = Array.isArray(armProps.techniques) ? armProps.techniques : [];
        const subTechniques = Array.isArray(armProps.subTechniques) ? armProps.subTechniques : [];
        const parentsWithSubTechniques = new Set(subTechniques.map(t => t.split('.')[0]));
        const merged = [
            ...techniques.filter(t => !parentsWithSubTechniques.has(t)),
            ...subTechniques
        ];
        return [...new Set(merged)];
    }

    private static normalizeEntityMappings(entityMappings: any[]): EntityMapping[] {
        if (!Array.isArray(entityMappings) || entityMappings.length === 0) {
            return [{
                entityType: 'Account',
                fieldMappings: [{
                    identifier: 'FullName',
                    columnName: 'YourColumnName'
                }]
            }];
        }
        
        return entityMappings as EntityMapping[];
    }

    private static formatQuery(query: string, preserveFormatting: boolean = true): string {
        if (!query) {
            return '// Enter your KQL query here\n// Replace this with your actual query';
        }
        
        // Convert escape sequences to actual line breaks
        const formattedQuery = query
            .replace(/\\r\\n/g, '\n')  // Convert \r\n to actual line breaks
            .replace(/\\n/g, '\n')     // Convert \n to actual line breaks
            .replace(/\\r/g, '\n')     // Convert \r to actual line breaks
            .replace(/\\t/g, '    ')   // Convert \t to 4 spaces
            .trim();
    
        if (preserveFormatting) {
            // Clean up formatting while preserving structure
            return formattedQuery
                .split('\n')
                .map(line => line.trim())
                .join('\n')
                .replace(/\n{3,}/g, '\n\n'); // Limit consecutive empty lines
        }
        
        // Basic query formatting
        return formattedQuery
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    // ARM exports use kind "NRT" for near-real-time rules ("NearRealTime" is accepted
    // as an alias). MLBehaviorAnalytics is kept as-is; any other kind falls back to
    // Scheduled.
    private static normalizeKind(kind: string): string {
        const lower = kind.toLowerCase();
        if (lower === 'nrt' || lower === 'nearrealtime') {
            return 'NRT';
        }
        if (lower === 'mlbehavioranalytics') {
            return 'MLBehaviorAnalytics';
        }
        return 'Scheduled';
    }

    // Checks the source ARM entity mappings: entity types must be ones Sentinel
    // recognises, and every field mapping needs an identifier and a column name.
    private static validateEntityMappings(entityMappings: unknown, result: ConversionResult): void {
        if (!Array.isArray(entityMappings)) {
            return;
        }
        const validTypes = new Set<string>(VALID_ENTITY_TYPES);
        entityMappings.forEach((mapping: any, i: number) => {
            const label = `Entity mapping ${i + 1}`;
            if (!mapping || typeof mapping.entityType !== 'string' || !validTypes.has(mapping.entityType)) {
                result.warnings.push(`${label}: unknown entity type '${mapping?.entityType ?? ''}'`);
            }
            const fields = Array.isArray(mapping?.fieldMappings) ? mapping.fieldMappings : [];
            if (fields.length === 0) {
                result.warnings.push(`${label}: no field mappings`);
            }
            fields.forEach((field: any, j: number) => {
                if (!field?.identifier || !field?.columnName) {
                    result.warnings.push(`${label}, field ${j + 1}: identifier and columnName are both required`);
                }
            });
        });
    }

    private static validateRequiredFields(yamlRule: SentinelYamlRule, result: ConversionResult): void {
        const requiredFields = ['id', 'name', 'description', 'severity', 'query'];
        
        for (const field of requiredFields) {
            const value = (yamlRule as any)[field];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                result.warnings.push(`Missing or empty required field: ${field}`);
            }
        }

        // Check for default placeholder values
        if (yamlRule.requiredDataConnectors.some(dc => dc.connectorId === 'YourConnectorId')) {
            result.warnings.push('Default connector ID detected - please update with actual connector');
        }

        if (yamlRule.tactics.includes('YourTactic')) {
            result.warnings.push('Default tactic detected - please update with actual MITRE tactic');
        }

        if (yamlRule.entityMappings.some(em => 
            em.fieldMappings.some(fm => fm.columnName === 'YourColumnName'))) {
            result.warnings.push('Default entity mapping detected - please update with actual column names');
        }
    }

    private static reorderFields(yamlRule: SentinelYamlRule): any {
        const orderedRule: any = {};
        
        // Apply expected field order
        for (const field of EXPECTED_ORDER) {
            if (field in yamlRule) {
                orderedRule[field] = (yamlRule as any)[field];
            }
        }
        
        // Add any remaining fields not in the expected order
        for (const [key, value] of Object.entries(yamlRule)) {
            if (!(key in orderedRule)) {
                orderedRule[key] = value;
            }
        }
        
        return orderedRule;
    }

    private static generateYamlContent(orderedRule: any): string {
        const yamlOptions: yaml.DumpOptions = {
            indent: 2,
            lineWidth: -1, // No line wrapping
            noRefs: true,
            sortKeys: false, // Maintain custom field order
            quotingType: '"',
            forceQuotes: false,
            condenseFlow: false,
            styles: {
                '!!str': 'literal' // Use literal style for multiline strings
            }
        };

        return yaml.dump(orderedRule, yamlOptions);
    }

    private static sanitizeFileName(name: string): string {
        // Remove invalid filename characters and replace with underscores, then convert to lowercase
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase()                    // Convert to lowercase
            .substring(0, 100); // Limit length
    }
}