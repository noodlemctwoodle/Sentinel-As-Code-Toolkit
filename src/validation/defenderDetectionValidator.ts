export interface DefenderDetectionValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: string[];
}

export class DefenderDetectionValidator {
    
    // Required fields for Defender Custom Detection
    private readonly requiredFields = [
        'displayName',
        'isEnabled',
        'queryCondition',
        'schedule',
        'detectionAction'
    ];

    // Read-only / runtime fields returned by Graph that must NOT be committed to the repo
    private readonly runtimeFields = [
        'id', 'detectorId', 'isSystemRule',
        'createdBy', 'createdDateTime', 'lastModifiedBy', 'lastModifiedDateTime',
        'lastRunDetails', 'lastRunDateTime',
        '@odata.context', '@odata.etag', '@odata.type'
    ];

    // Valid severity levels for Defender
    private readonly validSeverities = ['informational', 'low', 'medium', 'high'];

    // Valid schedule periods (Advanced Hunting custom detection cadence)
    private readonly validPeriods = ['0', '1H', '3H', '12H', '24H'];
    
    // Valid MITRE techniques pattern
    private readonly mitreTechniquePattern = /^T\d{4}(\.\d{3})?$/;

    public validate(content: any): DefenderDetectionValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const info: string[] = [];

        // Check required fields
        for (const field of this.requiredFields) {
            if (!(field in content) || content[field] === null || content[field] === undefined) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate displayName
        if (content.displayName) {
            if (typeof content.displayName !== 'string') {
                errors.push('displayName must be a string');
            } else if (content.displayName.length > 255) {
                warnings.push('displayName should not exceed 255 characters');
            } else if (content.displayName.trim().length === 0) {
                errors.push('displayName cannot be empty');
            }
        }

        // Validate isEnabled
        if (content.isEnabled !== undefined && typeof content.isEnabled !== 'boolean') {
            errors.push('isEnabled must be a boolean value');
        }

        // Validate queryCondition
        if (content.queryCondition) {
            if (!content.queryCondition.queryText) {
                errors.push('queryCondition must contain queryText');
            } else if (typeof content.queryCondition.queryText !== 'string') {
                errors.push('queryCondition.queryText must be a string');
            } else if (content.queryCondition.queryText.trim().length === 0) {
                errors.push('queryCondition.queryText cannot be empty');
            }
        }

        // Validate schedule
        if (content.schedule) {
            if (!('period' in content.schedule)) {
                errors.push('schedule must contain period');
            } else {
                const period = String(content.schedule.period);
                if (!this.validPeriods.includes(period)) {
                    errors.push(`Invalid schedule.period: ${period}. Must be one of: ${this.validPeriods.join(', ')}`);
                }
            }
        }

        // Validate detectionAction
        if (content.detectionAction) {
            const alertTemplate = content.detectionAction.alertTemplate;
            
            if (alertTemplate) {
                // Validate title (required)
                if (!alertTemplate.title) {
                    errors.push('detectionAction.alertTemplate.title is required');
                }

                // Validate severity (required)
                if (!alertTemplate.severity) {
                    errors.push('detectionAction.alertTemplate.severity is required');
                } else if (!this.validSeverities.includes(String(alertTemplate.severity).toLowerCase())) {
                    errors.push(`Invalid severity: ${alertTemplate.severity}. Must be one of: ${this.validSeverities.join(', ')}`);
                } else if (alertTemplate.severity !== String(alertTemplate.severity).toLowerCase()) {
                    warnings.push(`severity should be lowercase: "${String(alertTemplate.severity).toLowerCase()}"`);
                }

                // Description (optional but recommended)
                if (!alertTemplate.description) {
                    info.push('detectionAction.alertTemplate.description is recommended');
                }

                // MITRE techniques (recommended)
                if (!alertTemplate.mitreTechniques || (Array.isArray(alertTemplate.mitreTechniques) && alertTemplate.mitreTechniques.length === 0)) {
                    warnings.push('detectionAction.alertTemplate.mitreTechniques is recommended');
                }

                // Validate MITRE techniques
                if (alertTemplate.mitreTechniques) {
                    if (!Array.isArray(alertTemplate.mitreTechniques)) {
                        errors.push('mitreTechniques must be an array');
                    } else {
                        for (const technique of alertTemplate.mitreTechniques) {
                            if (!this.mitreTechniquePattern.test(technique)) {
                                warnings.push(`Invalid MITRE technique format: ${technique}. Expected format: T####[.###]`);
                            }
                        }
                    }
                }

                // Validate impactedAssets
                if (alertTemplate.impactedAssets) {
                    if (!Array.isArray(alertTemplate.impactedAssets)) {
                        errors.push('impactedAssets must be an array');
                    } else {
                        for (let i = 0; i < alertTemplate.impactedAssets.length; i++) {
                            const asset = alertTemplate.impactedAssets[i];
                            if (!asset.identifier) {
                                warnings.push(`impactedAssets[${i}] missing identifier field`);
                            }
                        }
                    }
                }

                // Validate category (required)
                if (!alertTemplate.category) {
                    errors.push('detectionAction.alertTemplate.category is required');
                } else {
                    const validCategories = [
                        'InitialAccess', 'Execution', 'Persistence', 'PrivilegeEscalation',
                        'DefenseEvasion', 'CredentialAccess', 'Discovery', 'LateralMovement',
                        'Collection', 'CommandAndControl', 'Exfiltration', 'Impact'
                    ];
                    if (!validCategories.includes(alertTemplate.category)) {
                        warnings.push(`Unusual category: ${alertTemplate.category}. Common categories are: ${validCategories.join(', ')}`);
                    }
                }
            } else {
                warnings.push('detectionAction should include alertTemplate');
            }
        }

        // Flag runtime / read-only fields that should be stripped before committing to the repo
        for (const field of this.runtimeFields) {
            if (field in content) {
                warnings.push(`Remove runtime field "${field}" before committing to the repo (use Format Custom Detection for Repo)`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            info
        };
    }
}