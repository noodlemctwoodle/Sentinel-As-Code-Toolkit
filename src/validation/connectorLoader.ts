import * as vscode from 'vscode';
import * as path from 'path';

interface ConnectorInfo {
    id: string;
    displayName: string;
    dataTypes: string[];
    category?: string;
    deprecated?: boolean;
    description?: string;
    publisher?: string;
    source?: string;
}

interface ConnectorDataStructure {
    tablesByConnector: Array<{
        connectorId: string;
        connectorTitle: string;
        publisher: string;
        descriptionMarkdown: string;
        tables: string | string[];
        source: string;
    }>;
    metadata: {
        extractionMethod: string;
        generatedDate: string;
        totalConnectors: number;
        totalTables: number;
        sourceRepository: string;
        extractionVersion: string;
    };
}

export class ConnectorLoader {
    private static connectors: Map<string, ConnectorInfo> = new Map();
    private static tableConnectorIndex?: Map<string, ConnectorInfo[]>;
    private static extensionContext: vscode.ExtensionContext;

    public static setExtensionContext(context: vscode.ExtensionContext) {
        this.extensionContext = context;
    }

    public static async loadConnectorData(): Promise<void> {
        this.tableConnectorIndex = undefined;
        try {
            await this.loadFromEmbeddedData();
        } catch (error) {
            console.warn('Could not load connector data from embedded file, using fallback:', error);
            this.loadFallbackData();
        }
        
        // Always load workspace and custom connectors in addition to the base set
        await this.loadFromWorkspace();
        await this.loadCustomConnectors();
        
        console.log(`✅ Total connectors available: ${this.connectors.size}`);
    }

    private static async loadFromEmbeddedData(): Promise<void> {
        try {
            if (!this.extensionContext) {
                throw new Error('Extension context not set');
            }

            // Use extension context to load the single source of truth
            const connectorDataPath = path.join(this.extensionContext.extensionPath, 'data', 'connectors.json');
            const connectorDataUri = vscode.Uri.file(connectorDataPath);
            
            const data = await vscode.workspace.fs.readFile(connectorDataUri);
            const connectorData: ConnectorDataStructure = JSON.parse(data.toString());
            
            this.connectors.clear();
            
            // Process the tablesByConnector array from our single source of truth
            for (const connector of connectorData.tablesByConnector) {
                // Extract data types from tables field (this is the key mapping)
                let dataTypes: string[] = [];
                if (typeof connector.tables === 'string') {
                    dataTypes = [connector.tables];
                } else if (Array.isArray(connector.tables)) {
                    dataTypes = connector.tables;
                }

                // Determine if deprecated based on title
                const isDeprecated = connector.connectorTitle.toLowerCase().includes('[deprecated]') || 
                                   connector.connectorTitle.toLowerCase().includes('deprecated');

                // Create ConnectorInfo from the data
                const connectorInfo: ConnectorInfo = {
                    id: connector.connectorId,
                    displayName: connector.connectorTitle,
                    dataTypes: dataTypes,
                    category: this.determineCategory(connector.publisher, connector.source),
                    deprecated: isDeprecated,
                    description: connector.descriptionMarkdown,
                    publisher: connector.publisher,
                    source: connector.source
                };

                this.connectors.set(connector.connectorId, connectorInfo);
            }
            
            console.log(`✅ Loaded ${this.connectors.size} connector definitions from Sentinel Content Hub`);
            console.log(`📊 Data extracted on: ${connectorData.metadata.generatedDate}`);
            console.log(`📦 Source: ${connectorData.metadata.sourceRepository}`);
        } catch (error) {
            console.error('Error loading connector data from embedded file:', error);
            throw error; // Re-throw to trigger fallback
        }
    }

    private static determineCategory(publisher: string, source: string): string {
        // Categorize based on publisher and source
        if (publisher === 'Microsoft') {
            return 'microsoft';
        }
        
        if (source.includes('Solutions/')) {
            return 'solution';
        }
        
        if (source === 'DataConnectors') {
            return 'built-in';
        }
        
        return 'third-party';
    }

    private static loadFallbackData() {
        console.log('Loading fallback connector data...');
        
        // Clear any existing connectors
        this.connectors.clear();
        
        // Provide basic Microsoft connectors as fallback to ensure core functionality
        const basicConnectors = [
            {
                id: 'AzureActiveDirectory',
                displayName: 'Azure Active Directory',
                dataTypes: ['SigninLogs', 'AuditLogs', 'NonInteractiveUserSignInLogs', 'ServicePrincipalSignInLogs'],
                category: 'microsoft'
            },
            {
                id: 'AzureSecurityCenter',
                displayName: 'Microsoft Defender for Cloud',
                dataTypes: ['SecurityAlert', 'SecurityRecommendation'],
                category: 'microsoft'
            },
            {
                id: 'MicrosoftThreatProtection',
                displayName: 'Microsoft 365 Defender',
                dataTypes: ['AlertInfo', 'AlertEvidence', 'DeviceEvents', 'DeviceFileEvents', 'DeviceNetworkEvents'],
                category: 'microsoft'
            },
            {
                id: 'SecurityEvents',
                displayName: 'Security Events',
                dataTypes: ['SecurityEvent'],
                category: 'microsoft'
            },
            {
                id: 'Office365',
                displayName: 'Office 365',
                dataTypes: ['OfficeActivity'],
                category: 'microsoft'
            }
        ];

        for (const connector of basicConnectors) {
            this.connectors.set(connector.id, connector);
        }
        
        console.log(`✅ Fallback mode: loaded ${this.connectors.size} essential Microsoft connectors`);
        console.log('⚠️  For full connector support, ensure data/connectors.json is accessible');
    }

    private static async loadFromWorkspace(): Promise<void> {
        // Look for connector definitions in workspace (for custom/codeless connectors)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        for (const folder of workspaceFolders) {
            try {
                // Look for .sentinel-connectors.json in workspace
                const connectorFile = vscode.Uri.joinPath(folder.uri, '.sentinel-connectors.json');
                const data = await vscode.workspace.fs.readFile(connectorFile);
                const connectorData = JSON.parse(data.toString());
                
                // Support both legacy and new format
                const connectors = connectorData.connectors || connectorData.tablesByConnector || [];
                
                for (const connector of connectors) {
                    // Handle both formats
                    const connectorInfo: ConnectorInfo = {
                        id: connector.connectorId || connector.id,
                        displayName: connector.connectorTitle || connector.displayName || connector.name,
                        dataTypes: this.extractDataTypes(connector),
                        category: 'workspace',
                        description: connector.descriptionMarkdown || connector.description,
                        publisher: connector.publisher || 'Custom'
                    };

                    this.connectors.set(connectorInfo.id, connectorInfo);
                }
                
                console.log(`📁 Loaded ${connectors.length} workspace-specific connectors from ${folder.name}`);
            } catch {
                // No workspace connector file found, that's ok
            }
        }
    }

    private static extractDataTypes(connector: any): string[] {
        // Handle various data type formats
        if (connector.dataTypes && Array.isArray(connector.dataTypes)) {
            return connector.dataTypes;
        }
        
        if (connector.tables) {
            if (typeof connector.tables === 'string') {
                return [connector.tables];
            }
            if (Array.isArray(connector.tables)) {
                return connector.tables;
            }
        }
        
        return [];
    }

    private static async loadCustomConnectors(): Promise<void> {
        const config = vscode.workspace.getConfiguration('sentinelAsCode');
        const customConnectors = config.get<string[]>('connectors.customConnectors', []);
        
        for (const connectorId of customConnectors) {
            if (!this.connectors.has(connectorId)) {
                this.connectors.set(connectorId, {
                    id: connectorId,
                    displayName: connectorId,
                    dataTypes: [],
                    category: 'custom',
                    description: 'Custom connector configured in user settings'
                });
            }
        }
        
        if (customConnectors.length > 0) {
            console.log(`⚙️  Loaded ${customConnectors.length} custom connectors from settings`);
        }
    }

    public static getValidationMode(): 'strict' | 'workspace' | 'permissive' {
        const config = vscode.workspace.getConfiguration('sentinelAsCode');
        return config.get<'strict' | 'workspace' | 'permissive'>('connectors.validationMode', 'permissive');
    }

    /**
     * Validates a complete data connector configuration from a YAML rule
     */
    public static validateDataConnector(connectorConfig: {
        connectorId: string;
        dataTypes: string[];
    }): {
        isValid: boolean;
        connectorValidation: {
            isValid: boolean;
            message?: string;
            severity: vscode.DiagnosticSeverity;
        };
        dataTypeValidation: {
            validDataTypes: string[];
            invalidDataTypes: string[];
            missingDataTypes: string[];
            message?: string;
            severity?: vscode.DiagnosticSeverity;
        };
    } {
        // First validate the connector ID
        const connectorValidation = this.validateConnector(connectorConfig.connectorId);
        
        // Then validate data types against the connector
        const dataTypeValidation = this.validateDataTypes(connectorConfig.connectorId, connectorConfig.dataTypes);
        
        const isValid = connectorValidation.isValid && dataTypeValidation.validDataTypes.length > 0;
        
        return {
            isValid,
            connectorValidation,
            dataTypeValidation
        };
    }

    /**
     * Validates data types against a specific connector's available tables
     */
    public static validateDataTypes(connectorId: string, dataTypes: string[]): {
        validDataTypes: string[];
        invalidDataTypes: string[];
        missingDataTypes: string[];
        message?: string;
        severity?: vscode.DiagnosticSeverity;
    } {
        const connector = this.connectors.get(connectorId);
        const validDataTypes: string[] = [];
        const invalidDataTypes: string[] = [];
        const missingDataTypes: string[] = [];
        
        if (!connector) {
            // If connector not found, can't validate data types
            return {
                validDataTypes: [],
                invalidDataTypes: dataTypes,
                missingDataTypes: [],
                message: `Cannot validate data types: connector '${connectorId}' not found`,
                severity: vscode.DiagnosticSeverity.Warning
            };
        }
        
        // Check each provided data type against connector's available tables
        for (const dataType of dataTypes) {
            if (connector.dataTypes.some(availableType => 
                this.normalizeDataType(availableType) === this.normalizeDataType(dataType)
            )) {
                validDataTypes.push(dataType);
            } else {
                invalidDataTypes.push(dataType);
            }
        }
        
        // Check for missing essential data types (if we know what the connector provides)
        if (connector.dataTypes.length > 0 && validDataTypes.length === 0) {
            missingDataTypes.push(...connector.dataTypes);
        }
        
        // Generate appropriate message
        let message: string | undefined;
        let severity: vscode.DiagnosticSeverity | undefined;
        
        if (invalidDataTypes.length > 0) {
            const available = connector.dataTypes.map(dt => this.normalizeDataType(dt)).join(', ');
            message = `Invalid data types [${invalidDataTypes.join(', ')}] for connector '${connectorId}'. Available: [${available}]`;
            severity = vscode.DiagnosticSeverity.Error;
        } else if (validDataTypes.length > 0) {
            message = `Valid data types for connector '${connectorId}'`;
            severity = vscode.DiagnosticSeverity.Information;
        }
        
        return {
            validDataTypes,
            invalidDataTypes,
            missingDataTypes,
            message,
            severity
        };
    }

    /**
     * Normalize data type names for comparison (handles variations in naming)
     */
    private static normalizeDataType(dataType: string): string {
        // Remove common suffixes and prefixes, normalize case
        return dataType
            .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical content like "(Fortinet)"
            .replace(/_CL$/, '') // Remove "_CL" suffix
            .trim()
            .toLowerCase();
    }

    private static getTableConnectorIndex(): Map<string, ConnectorInfo[]> {
        if (this.tableConnectorIndex) {
            return this.tableConnectorIndex;
        }
        const index = new Map<string, ConnectorInfo[]>();
        for (const connector of this.connectors.values()) {
            for (const dataType of connector.dataTypes) {
                const key = this.normalizeDataType(dataType);
                if (!key) {
                    continue;
                }
                const list = index.get(key) ?? [];
                list.push(connector);
                index.set(key, list);
            }
        }
        this.tableConnectorIndex = index;
        return index;
    }

    // Connectors that provide a table, ranked non-deprecated + Microsoft first.
    private static rankConnectorsForTable(table: string): ConnectorInfo[] {
        const matches = this.getTableConnectorIndex().get(this.normalizeDataType(table)) ?? [];
        return [...matches].sort((a, b) => {
            if (!!a.deprecated !== !!b.deprecated) {
                return a.deprecated ? 1 : -1;
            }
            const aMicrosoft = a.publisher === 'Microsoft' ? 0 : 1;
            const bMicrosoft = b.publisher === 'Microsoft' ? 0 : 1;
            if (aMicrosoft !== bMicrosoft) {
                return aMicrosoft - bMicrosoft;
            }
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Extracts the Log Analytics tables referenced by a KQL query (identifiers that
     * match a known connector table) and maps them to their best-fit data connectors,
     * grouped as ready-to-use requiredDataConnectors entries.
     */
    public static suggestRequiredDataConnectorsForQuery(query: string): Array<{ connectorId: string; dataTypes: string[] }> {
        const index = this.getTableConnectorIndex();
        const seen = new Set<string>();
        const tables: string[] = [];

        const tokenRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
        let match: RegExpExecArray | null;
        while ((match = tokenRegex.exec(query)) !== null) {
            const key = this.normalizeDataType(match[0]);
            if (index.has(key) && !seen.has(key)) {
                seen.add(key);
                tables.push(match[0]);
            }
        }

        const byConnector = new Map<string, string[]>();
        for (const table of tables) {
            const ranked = this.rankConnectorsForTable(table);
            if (ranked.length === 0) {
                continue;
            }
            const bestConnectorId = ranked[0].id;
            const list = byConnector.get(bestConnectorId) ?? [];
            list.push(table);
            byConnector.set(bestConnectorId, list);
        }

        return [...byConnector.entries()].map(([connectorId, dataTypes]) => ({ connectorId, dataTypes }));
    }

    public static validateConnector(connectorId: string): {
        isValid: boolean;
        message?: string;
        severity: vscode.DiagnosticSeverity;
    } {
        const mode = this.getValidationMode();
        
        switch (mode) {
            case 'strict':
                if (this.connectors.has(connectorId)) {
                    const connector = this.connectors.get(connectorId)!;
                    if (connector.deprecated) {
                        return {
                            isValid: true,
                            message: `Connector '${connectorId}' is deprecated. Consider using an alternative.`,
                            severity: vscode.DiagnosticSeverity.Warning
                        };
                    }
                    return { isValid: true, severity: vscode.DiagnosticSeverity.Information };
                } else {
                    return {
                        isValid: false,
                        message: `Unknown connector '${connectorId}'. In strict mode, only known connectors are allowed.`,
                        severity: vscode.DiagnosticSeverity.Error
                    };
                }
                
            case 'workspace':
                if (this.connectors.has(connectorId)) {
                    const connector = this.connectors.get(connectorId)!;
                    if (connector.deprecated) {
                        return {
                            isValid: true,
                            message: `Connector '${connectorId}' is deprecated. Consider using an alternative.`,
                            severity: vscode.DiagnosticSeverity.Warning
                        };
                    }
                    return { isValid: true, severity: vscode.DiagnosticSeverity.Information };
                } else {
                    return {
                        isValid: false,
                        message: `Connector '${connectorId}' not found. Add to .sentinel-connectors.json, settings, or use a known connector.`,
                        severity: vscode.DiagnosticSeverity.Warning
                    };
                }
                
            case 'permissive':
            default:
                // Check if it's a known connector
                if (this.connectors.has(connectorId)) {
                    const connector = this.connectors.get(connectorId)!;
                    if (connector.deprecated) {
                        return {
                            isValid: true,
                            message: `Connector '${connectorId}' is deprecated. Consider using an alternative.`,
                            severity: vscode.DiagnosticSeverity.Warning
                        };
                    }
                    return { 
                        isValid: true, 
                        message: `Known ${connector.category} connector`,
                        severity: vscode.DiagnosticSeverity.Information 
                    };
                }
                
                // Basic validation for unknown connectors
                if (!connectorId || connectorId.trim() === '') {
                    return {
                        isValid: false,
                        message: 'Connector ID cannot be empty',
                        severity: vscode.DiagnosticSeverity.Error
                    };
                }
                
                // Basic format check for potentially custom/codeless connectors
                if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(connectorId)) {
                    return {
                        isValid: false,
                        message: `Connector ID '${connectorId}' should use alphanumeric characters and underscores only, starting with a letter`,
                        severity: vscode.DiagnosticSeverity.Warning
                    };
                }
                
                return { 
                    isValid: true, 
                    message: `Custom or codeless connector '${connectorId}' (format valid)`,
                    severity: vscode.DiagnosticSeverity.Information 
                };
        }
    }

    public static getConnectorInfo(connectorId: string): ConnectorInfo | undefined {
        return this.connectors.get(connectorId);
    }

    public static getAllConnectors(): Array<{id: string, name: string, description: string, dataTypes: string[], category: string, deprecated?: boolean}> {
        return Array.from(this.connectors.values()).map(connector => ({
            id: connector.id,
            name: connector.displayName,
            description: connector.description || `${connector.displayName} data connector${connector.category ? ` (${connector.category})` : ''}`,
            dataTypes: connector.dataTypes,
            category: connector.category || 'unknown',
            deprecated: connector.deprecated
        }));
    }

    public static getConnectorSuggestions(partial: string): string[] {
        const suggestions = Array.from(this.connectors.keys())
            .filter(id => id.toLowerCase().includes(partial.toLowerCase()))
            .sort((a, b) => {
                // Prioritize non-deprecated connectors
                const aConnector = this.connectors.get(a);
                const bConnector = this.connectors.get(b);
                
                if (aConnector?.deprecated && !bConnector?.deprecated) return 1;
                if (!aConnector?.deprecated && bConnector?.deprecated) return -1;
                
                // Then sort by category (Microsoft first, then built-in, etc.)
                const categoryOrder = ['microsoft', 'built-in', 'solution', 'workspace', 'custom', 'third-party'];
                const aOrder = categoryOrder.indexOf(aConnector?.category || 'unknown');
                const bOrder = categoryOrder.indexOf(bConnector?.category || 'unknown');
                
                if (aOrder !== bOrder) return aOrder - bOrder;
                
                // Finally sort alphabetically
                return a.localeCompare(b);
            })
            .slice(0, 20); // Increase limit for better suggestions
            
        return suggestions;
    }

    /**
     * Get data type suggestions for a specific connector
     */
    public static getDataTypeSuggestions(connectorId: string, partial: string = ''): string[] {
        const connector = this.connectors.get(connectorId);
        if (!connector) {
            return [];
        }
        
        return connector.dataTypes
            .filter(dataType => 
                partial === '' || 
                this.normalizeDataType(dataType).includes(partial.toLowerCase()) ||
                dataType.toLowerCase().includes(partial.toLowerCase())
            )
            .map(dataType => this.normalizeDataType(dataType))
            .slice(0, 10);
    }

    /**
     * Get connectors by category for better organization
     */
    public static getConnectorsByCategory(): Record<string, ConnectorInfo[]> {
        const categories: Record<string, ConnectorInfo[]> = {};
        
        for (const connector of this.connectors.values()) {
            const category = connector.category || 'unknown';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(connector);
        }
        
        return categories;
    }

    /**
     * Get statistics about loaded connectors
     */
    public static getConnectorStats(): {
        total: number;
        byCategory: Record<string, number>;
        deprecated: number;
    } {
        const stats = {
            total: this.connectors.size,
            byCategory: {} as Record<string, number>,
            deprecated: 0
        };
        
        for (const connector of this.connectors.values()) {
            const category = connector.category || 'unknown';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            
            if (connector.deprecated) {
                stats.deprecated++;
            }
        }
        
        return stats;
    }
}