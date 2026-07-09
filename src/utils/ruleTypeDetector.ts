import * as yaml from 'js-yaml';

export enum RuleType {
    SENTINEL = 'sentinel',
    DEFENDER = 'defender',
    UNKNOWN = 'unknown'
}

export class RuleTypeDetector {
    
    // Sentinel-specific fields
    private static readonly sentinelIndicators = [
        'tactics',
        'relevantTechniques',
        'techniques',
        'queryFrequency',
        'triggerOperator',
        'requiredDataConnectors',
        'queryPeriod',
        'triggerThreshold',
        'entityMappings',
        'eventGroupingSettings',
        'incidentConfiguration'
    ];

    // Defender-specific fields
    private static readonly defenderIndicators = [
        'detectorId',
        'queryCondition',
        'detectionAction',
        'impactedAssets',
        'organizationalScope',
        'responseActions',
        'lastRunDetails'
    ];

    /**
     * Detect the type of rule based on content
     */
    public static detectType(content: string): RuleType {
        try {
            // Try to parse as YAML first, then JSON
            let parsedContent: any;
            try {
                parsedContent = yaml.load(content);
            } catch {
                try {
                    parsedContent = JSON.parse(content);
                } catch {
                    return RuleType.UNKNOWN;
                }
            }

            if (!parsedContent || typeof parsedContent !== 'object') {
                return RuleType.UNKNOWN;
            }

            // ABSOLUTE HIGHEST PRIORITY: Multiple Defender fields together
            const hasDetectorId = 'detectorId' in parsedContent;
            const hasQueryCondition = 'queryCondition' in parsedContent;
            const hasDetectionAction = 'detectionAction' in parsedContent;
            const hasNumericId = 'id' in parsedContent && /^\d+$/.test(parsedContent.id?.toString());
            const hasLastRunDetails = 'lastRunDetails' in parsedContent;
            const hasSchedulePeriod = parsedContent.schedule && 'period' in parsedContent.schedule;
            
            // If we have 2 or more Defender-specific indicators, it's definitely Defender
            const defenderIndicatorCount = [
                hasDetectorId,
                hasQueryCondition,
                hasDetectionAction,
                hasNumericId,
                hasLastRunDetails,
                hasSchedulePeriod
            ].filter(Boolean).length;
            
            if (defenderIndicatorCount >= 2) {
                return RuleType.DEFENDER;
            }

            // Single strong Defender indicator
            if (hasDetectorId || hasQueryCondition || hasDetectionAction) {
                return RuleType.DEFENDER;
            }

            // Numeric ID alone is a strong Defender indicator
            if (hasNumericId) {
                return RuleType.DEFENDER;
            }

            // Sentinel-specific: tactics or queryFrequency are definitive
            if ('tactics' in parsedContent || 'queryFrequency' in parsedContent || 'triggerOperator' in parsedContent) {
                return RuleType.SENTINEL;
            }

            // Check for more Defender indicators
            if ('responseActions' in parsedContent) {
                return RuleType.DEFENDER;
            }

            // Count indicators for each type
            let sentinelScore = 0;
            let defenderScore = 0;

            // Check for Sentinel indicators
            for (const field of this.sentinelIndicators) {
                if (field in parsedContent) {
                    sentinelScore++;
                }
            }

            // Check for Defender indicators  
            for (const field of this.defenderIndicators) {
                if (field in parsedContent) {
                    defenderScore++;
                }
            }

            // Determine based on score
            if (defenderScore > sentinelScore) {
                return RuleType.DEFENDER;
            } else if (sentinelScore > defenderScore) {
                return RuleType.SENTINEL;
            }

            // Check for common patterns in the content. The @odata marker is the reliable
            // Defender/Graph signal (a Graph detectionRule export always carries @odata
            // metadata); avoid a bare hostname substring check, which is not a safe URL test.
            const contentStr = JSON.stringify(parsedContent).toLowerCase();
            if (contentStr.includes('@odata')) {
                return RuleType.DEFENDER;
            }

            if (contentStr.includes('azuresentinel') || contentStr.includes('analytics rule')) {
                return RuleType.SENTINEL;
            }

            return RuleType.UNKNOWN;
        } catch (error) {
            console.error('Error detecting rule type:', error);
            return RuleType.UNKNOWN;
        }
    }

    /**
     * Quick check if content appears to be a Defender detection
     */
    public static isDefenderDetection(content: string): boolean {
        return this.detectType(content) === RuleType.DEFENDER;
    }

    /**
     * Quick check if content appears to be a Sentinel rule
     */
    public static isSentinelRule(content: string): boolean {
        return this.detectType(content) === RuleType.SENTINEL;
    }
}