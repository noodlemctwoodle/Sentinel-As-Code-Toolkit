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

    // Optional but recommended fields
    private readonly recommendedFields = [
        'detectorId',
        'id'
    ];

    // Valid severity levels for Defender
    private readonly validSeverities = ['informational', 'low', 'medium', 'high'];
    
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
                const period = content.schedule.period;
                if (typeof period !== 'string' && typeof period !== 'number') {
                    errors.push('schedule.period must be a string or number');
                } else {
                    const periodNum = parseInt(period.toString());
                    if (isNaN(periodNum) || periodNum < 0) {
                        errors.push('schedule.period must be a non-negative number');
                    }
                }
            }
        }

        // Validate detectionAction
        if (content.detectionAction) {
            const alertTemplate = content.detectionAction.alertTemplate;
            
            if (alertTemplate) {
                // Validate title
                if (!alertTemplate.title) {
                    warnings.push('detectionAction.alertTemplate should include a title');
                }

                // Validate description
                if (!alertTemplate.description) {
                    warnings.push('detectionAction.alertTemplate should include a description');
                }

                // Validate severity
                if (alertTemplate.severity) {
                    if (!this.validSeverities.includes(alertTemplate.severity.toLowerCase())) {
                        errors.push(`Invalid severity: ${alertTemplate.severity}. Must be one of: ${this.validSeverities.join(', ')}`);
                    }
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

                // Validate category
                if (alertTemplate.category) {
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

        // Check for recommended fields (but don't validate their format)
        for (const field of this.recommendedFields) {
            if (!(field in content)) {
                info.push(`Consider adding recommended field: ${field}`);
            }
        }

        // Validate detectorId as GUID if present (detectorId should be a GUID)
        if (content.detectorId) {
            const detectorIdStr = content.detectorId.toString();
            if (!this.isValidGuid(detectorIdStr)) {
                errors.push(`Invalid GUID format for detectorId: ${content.detectorId}`);
            }
        }

        // Note: id field can be numeric or string, so we don't validate its format
        // Microsoft Graph API returns numeric IDs for custom detections

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            info
        };
    }

    private isValidGuid(guid: string): boolean {
        const guidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
        return guidPattern.test(guid);
    }
}