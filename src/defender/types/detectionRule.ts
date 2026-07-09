export interface DetectionRule {
    id?: string;
    displayName: string;
    isEnabled: boolean;
    queryCondition: {
        queryText: string;
    };
    schedule: {
        period: string; // e.g. "1H","3H","12H","24H","0"
    };
    detectionAction?: {
        alertTemplate?: {
            title?: string;
            description?: string;
            severity?: string;
            category?: string;
            mitreTechniques?: string[];
            impactedAssets?: any;
            relatedEvidence?: any;
        };
        organizationalScope?: any;
        responseActions?: any[];
    };
    createdDateTime?: string;
    lastModifiedDateTime?: string;
    isSystemRule?: boolean;
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

export interface ExportPerRuleFile {
    metadata: {
        exportDate: string;
        source: string;
    };
    rule: DetectionRule;
}