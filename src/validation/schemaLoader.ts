import * as vscode from 'vscode';
import * as path from 'path';

interface DurationConversionPattern {
    regex: RegExp;
    replacement: string;
}

interface SchemaValidation {
    patterns: Map<string, RegExp>;
    enums: Map<string, string[]>;
    required: string[];
    durationFields: string[];
    durationConversionPatterns: DurationConversionPattern[];
    sentinelRuleIndicators: string[];
    minSentinelIndicators: number;
    fieldOrder: string[];
}

export class SchemaLoader {
    private static schema: any = null;
    private static validation: SchemaValidation | null = null;
    private static extensionContext: vscode.ExtensionContext;

    public static setExtensionContext(context: vscode.ExtensionContext) {
        this.extensionContext = context;
    }

    public static async loadSchema(): Promise<void> {
        if (!this.extensionContext) {
            throw new Error('Extension context not set - cannot load schema');
        }

        const schemaPath = path.join(this.extensionContext.extensionPath, 'schemas', 'sentinel-analytics-rule-schema.json');
        const schemaUri = vscode.Uri.file(schemaPath);
        
        try {
            const data = await vscode.workspace.fs.readFile(schemaUri);
            this.schema = JSON.parse(data.toString());
            
            this.extractValidationPatterns();
            console.log('✅ Schema loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load schema:', error);
            throw new Error(`Failed to load validation schema: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error });
        }
    }

    private static extractValidationPatterns(): void {
        if (!this.schema || !this.schema.properties) {
            throw new Error('Invalid schema structure - missing properties');
        }

        const patterns = new Map<string, RegExp>();
        const enums = new Map<string, string[]>();
        const durationFields: string[] = [];

        // Extract patterns from schema properties
        const extractFromProperties = (properties: any, prefix: string = '') => {
            for (const [key, value] of Object.entries(properties)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const prop = value as any;

                if (prop.pattern) {
                    patterns.set(fullKey, new RegExp(prop.pattern));
                    
                    // Check if this is a duration field
                    if (prop.pattern.includes('P([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+S)?)?')) {
                        durationFields.push(key);
                    }
                }

                if (prop.enum) {
                    enums.set(fullKey, prop.enum);
                }

                // Recursively process nested properties
                if (prop.properties) {
                    extractFromProperties(prop.properties, fullKey);
                }

                // Handle array items with properties
                if (prop.items && prop.items.properties) {
                    extractFromProperties(prop.items.properties, `${fullKey}.items`);
                }

                // Handle array items that are simple objects with pattern/enum directly
                if (prop.items && (prop.items.pattern || prop.items.enum)) {
                    const itemKey = `${fullKey}.items`;
                    if (prop.items.pattern) {
                        patterns.set(itemKey, new RegExp(prop.items.pattern));
                    }
                    if (prop.items.enum) {
                        enums.set(itemKey, prop.items.enum);
                    }
                }
            }
        };

        extractFromProperties(this.schema.properties);

        // Extract duration conversion patterns from schema
        const durationConversionPatterns: DurationConversionPattern[] = [];
        if (this.schema['x-durationConversionPatterns']) {
            for (const pattern of this.schema['x-durationConversionPatterns']) {
                durationConversionPatterns.push({
                    regex: new RegExp(pattern.regex, pattern.flags || ''),
                    replacement: pattern.replacement
                });
            }
        }

        // Use x-sentinelRuleIndicators as required fields if no top-level required field exists
        const requiredFields = this.schema.required || this.schema['x-sentinelRuleIndicators'] || [];

        this.validation = {
            patterns,
            enums,
            required: requiredFields,
            durationFields,
            durationConversionPatterns,
            sentinelRuleIndicators: this.schema['x-sentinelRuleIndicators'] || [],
            minSentinelIndicators: this.schema['x-minSentinelIndicators'] || 5,
            fieldOrder: this.schema['x-fieldOrder'] || []
        };

        console.log(`Extracted ${patterns.size} validation patterns from schema`);
        console.log(`Extracted ${enums.size} enum values from schema`);
        console.log(`Required fields from schema: [${requiredFields.join(', ')}]`);
    }

    public static getValidationPattern(fieldPath: string): RegExp {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        
        const pattern = this.validation.patterns.get(fieldPath);
        if (!pattern) {
            throw new Error(`No validation pattern found for field: ${fieldPath}`);
        }
        
        return pattern;
    }

    public static getValidEnums(fieldPath: string): string[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        
        const enums = this.validation.enums.get(fieldPath);
        if (!enums) {
            throw new Error(`No enum values found for field: ${fieldPath}`);
        }
        
        return enums;
    }

    public static getRequiredFields(): string[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.required;
    }

    public static getDurationFields(): string[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.durationFields;
    }

    public static isDurationField(fieldName: string): boolean {
        return this.getDurationFields().includes(fieldName);
    }

    public static hasValidationPattern(fieldPath: string): boolean {
        return this.validation?.patterns.has(fieldPath) || false;
    }

    public static hasValidEnums(fieldPath: string): boolean {
        return this.validation?.enums.has(fieldPath) || false;
    }

    public static validateField(fieldPath: string, value: any): { isValid: boolean; message?: string } {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }

        const pattern = this.validation.patterns.get(fieldPath);
        if (pattern && typeof value === 'string') {
            if (!pattern.test(value)) {
                return {
                    isValid: false,
                    message: `Field '${fieldPath}' does not match expected pattern`
                };
            }
        }

        const validEnums = this.validation.enums.get(fieldPath);
        if (validEnums && !validEnums.includes(value)) {
            return {
                isValid: false,
                message: `Field '${fieldPath}' must be one of: ${validEnums.join(', ')}`
            };
        }

        return { isValid: true };
    }

    // Add new getter methods
    public static getDurationConversionPatterns(): DurationConversionPattern[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.durationConversionPatterns;
    }

    public static getSentinelRuleIndicators(): string[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.sentinelRuleIndicators;
    }

    public static getMinSentinelIndicators(): number {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.minSentinelIndicators;
    }

    public static getFieldOrder(): string[] {
        if (!this.validation) {
            throw new Error('Schema not loaded - call loadSchema() first');
        }
        return this.validation.fieldOrder;
    }

    // Add method for entity types
    public static getValidEntityTypes(): string[] {
        return this.getValidEnums('entityMappings.items.entityType');
    }

    // Add method for severities
    public static getValidSeverities(): string[] {
        return this.getValidEnums('severity');
    }

    // Add method for trigger operators
    public static getValidTriggerOperators(): string[] {
        return this.getValidEnums('triggerOperator');
    }

}