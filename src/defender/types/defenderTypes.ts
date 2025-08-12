export interface DetectionRule {
    id?: string;
    displayName: string;
    isEnabled: boolean;
    isSystemRule?: boolean;
    queryCondition: {
        queryText: string;
    };
    schedule: {
        period: string;
    };
    detectionAction?: {
        alertTemplate?: {
            title?: string;
            description?: string;
            severity?: string;
            category?: string;
            mitreTechniques?: string[];
            customProperties?: Record<string, string>;
        };
    };
    createdDateTime?: string;
    lastModifiedDateTime?: string;
    createdBy?: string;
    lastModifiedBy?: string;
}

export interface ExportPerRuleFile {
    metadata: {
        exportDate: string;
        source: string;
    };
    rule: DetectionRule;
}

export interface ExportSingleFile {
    metadata: {
        exportDate: string;
        rulesCount: number;
        source: string;
        exportType: string;
    };
    rules: DetectionRule[];
}