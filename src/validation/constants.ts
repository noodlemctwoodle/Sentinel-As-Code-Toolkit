/**
 * Microsoft Sentinel Analytics Rules - Validation Constants
 * 
 * This file contains constant values used for validating Sentinel analytics rules.
 * Entity types are based on the official Microsoft documentation:
 * https://learn.microsoft.com/en-us/azure/sentinel/entities-reference
 */

// ============================================================================
// ENTITY TYPES
// ============================================================================
// Complete list based on Microsoft Sentinel entities reference
export const VALID_ENTITY_TYPES = [
    // Core Identity & Access
    'Account',
    'SecurityGroup',
    
    // Infrastructure
    'Host',
    'IP',
    'DNS',
    'URL',
    'NetworkConnection',
    'IoTDevice',
    
    // Files & Processes
    'File',
    'FileHash',
    'Process',
    'RegistryKey',
    'RegistryValue',
    
    // Cloud & Applications
    'AzureResource',
    'CloudApplication',
    
    // Communication
    'MailboxConfiguration',
    'MailMessage',
    'SubmissionMail',
    'MailCluster',
    
    // Security & Hunting
    'Malware',
    'Bookmark',
    'HuntingBookmark'
];

// ============================================================================
// SEVERITY LEVELS
// ============================================================================
// Supported alert severity levels in Microsoft Sentinel
export const VALID_SEVERITIES = [
    'Informational',
    'Low', 
    'Medium',
    'High'
];

// ============================================================================
// FIELD ORDERING
// ============================================================================
// Expected field order for Sentinel Analytics Rules (based on Microsoft best practices)
export const EXPECTED_ORDER = [
    // Rule Identity
    'id',
    'name',
    'description',

    // Rule Configuration (queryFrequency/queryPeriod/triggerOperator/triggerThreshold are Scheduled-only)
    'severity',
    'requiredDataConnectors',
    'queryFrequency',
    'queryPeriod',
    'triggerOperator',
    'triggerThreshold',
    'enabled',

    // MITRE ATT&CK Framework (relevantTechniques is canonical; techniques kept for compatibility)
    'tactics',
    'relevantTechniques',
    'techniques',

    // Core Detection Logic
    'query',

    // Entity Mapping
    'entityMappings',

    // Alert Customisation
    'alertDetailsOverride',
    'customDetails',

    // Grouping & Incident Configuration
    'eventGroupingSettings',
    'incidentConfiguration',

    // Suppression
    'suppressionDuration',
    'suppressionEnabled',
    'lookbackDuration',

    // Rule Metadata
    'version',
    'kind',

    // Freeform labels (optional; canonical position is last)
    'tags'
];

// ============================================================================
// REQUIRED FIELDS
// ============================================================================
// Common fields required for all rule types
export const COMMON_REQUIRED_FIELDS = [
    // Essential Identity
    'id',
    'name',
    'description',
    
    // Rule Configuration (Common)
    'severity',
    'requiredDataConnectors',
    
    // MITRE Classification (Required)
    'tactics',
    
    // Core Detection Logic
    'query',
    
    // Rule Metadata (Required)
    'version',
    'kind',
];

// Additional fields required specifically for Scheduled rules
export const SCHEDULED_REQUIRED_FIELDS = [
    'queryFrequency',
    'queryPeriod',
    'triggerOperator',
    'triggerThreshold',
];

// Additional fields required specifically for NRT rules
export const NRT_REQUIRED_FIELDS = [
    // NRT rules don't require queryFrequency, queryPeriod, triggerOperator, or triggerThreshold
];

/**
 * Get required fields for a specific rule kind
 */
export function getRequiredFieldsForKind(kind: string): string[] {
    const commonFields = [...COMMON_REQUIRED_FIELDS];
    
    switch (kind?.toLowerCase()) {
        case 'scheduled':
            return [...commonFields, ...SCHEDULED_REQUIRED_FIELDS];
        case 'nrt':
            return [...commonFields, ...NRT_REQUIRED_FIELDS];
        default:
            // Default to Scheduled rules for unknown kinds
            return [...commonFields, ...SCHEDULED_REQUIRED_FIELDS];
    }
}

// Legacy export for backward compatibility (defaults to Scheduled rules)
export const REQUIRED_FIELDS = [
    ...COMMON_REQUIRED_FIELDS,
    ...SCHEDULED_REQUIRED_FIELDS
];

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================
// Regular expressions for validating field formats

export const VALIDATION_PATTERNS = {
    // GUID format for rule IDs
    GUID: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    
    // Semantic version format (e.g., 1.0.0)
    VERSION: /^[0-9]+\.[0-9]+\.[0-9]+$/,
    
    // ISO 8601 duration format for Sentinel Analytics Rules (e.g., PT5M, P1D, PT1H30M)
    // Supports only Days (D), Hours (H), and Minutes (M)
    ISO_DURATION: /^P(?:[0-9]+D(?:T(?:[0-9]+H)?(?:[0-9]+M)?)?|T(?:[0-9]+H(?:[0-9]+M)?|[0-9]+M))$/,
    
    // MITRE ATT&CK technique format (e.g., T1566, T1566.001)
    MITRE_TECHNIQUE: /^T[0-9]{4}(?:\.[0-9]{3})?$/,
    
    // Valid tactic name format - Updated to allow spaces for real MITRE tactics like "Credential Access"
    TACTIC_NAME: /^[A-Z][a-zA-Z\s]{2,30}$/,
    
    // Valid entity type format (PascalCase) - Updated to enforce reasonable length limit
    ENTITY_TYPE: /^[A-Z][a-zA-Z0-9]{0,49}$/,
    
    // Valid connector ID format - Updated to match real connector IDs including dots, numbers, etc.
    CONNECTOR_ID: /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
} as const;

// ============================================================================
// RULE KINDS
// ============================================================================
// Rule types that users can actually create in Microsoft Sentinel
export const VALID_RULE_KINDS = [
    'Scheduled',    // Custom KQL-based detection rules (most common)
    'NRT'          // Near Real-Time rules (sub-minute latency)
] as const;

// System-managed rule types (read-only, cannot be created by users)
export const SYSTEM_RULE_KINDS = [
    'MicrosoftSecurityIncidentCreation',  // Auto-generated from Microsoft security products
    'MLBehaviorAnalytics',               // Microsoft's machine learning behavioral rules
    'Fusion',                            // AI multistage attack detection
    'ThreatIntelligence'                 // Microsoft threat intelligence matching
] as const;

// ============================================================================
// TRIGGER OPERATORS
// ============================================================================
// Valid operators for trigger conditions
export const VALID_TRIGGER_OPERATORS = [
    'gt',    // Greater than
    'lt',    // Less than
    'eq',    // Equal to
    'ne'     // Not equal to
] as const;

// ============================================================================
// DURATION CONVERSION PATTERNS
// ============================================================================
// Common duration format patterns for auto-correction to ISO 8601
export const DURATION_CONVERSION_PATTERNS = [
    { regex: /^(\d+)h$/i, replacement: 'PT$1H' },          // 5h -> PT5H
    { regex: /^(\d+)m$/i, replacement: 'PT$1M' },          // 30m -> PT30M
    { regex: /^(\d+)s$/i, replacement: 'PT$1S' },          // 60s -> PT60S
    { regex: /^(\d+)d$/i, replacement: 'P$1D' },           // 1d -> P1D
    { regex: /^(\d+):(\d+):(\d+)$/i, replacement: 'PT$1H$2M$3S' }, // 1:30:00 -> PT1H30M0S
] as const;

// Special case pattern for weeks (needs calculation)
export const WEEKS_PATTERN = /^(\d+)w$/i;

// ============================================================================
// SENTINEL RULE DETECTION
// ============================================================================
// Fields that indicate this is likely a Sentinel analytics rule
export const SENTINEL_RULE_INDICATORS = [
    // Core Sentinel-specific fields
    'tactics',
    'relevantTechniques',
    'techniques', 
    'queryFrequency',
    'queryPeriod',
    'triggerOperator',
    'triggerThreshold',
    'entityMappings',
    'requiredDataConnectors',
    
    // Additional Sentinel fields
    'suppressionDuration',
    'alertDetailsOverride',
    'incidentConfiguration',
    'eventGroupingSettings'
] as const;

// Minimum number of indicators required to consider it a Sentinel rule
export const MIN_SENTINEL_INDICATORS = 3;

// ============================================================================
// DATA TYPE NORMALIZATION
// ============================================================================
// Patterns for normalizing data type names during validation
export const DATA_TYPE_NORMALIZATION_PATTERNS = [
    // Remove parenthetical vendor/product info: "CommonSecurityLog (Fortinet)" -> "CommonSecurityLog"
    { pattern: /\s*\([^)]*\)/g, replacement: '' },
    
    // Remove _CL suffix for custom logs: "MyLogs_CL" -> "MyLogs"
    { pattern: /_CL$/i, replacement: '' },
    
    // Normalize whitespace
    { pattern: /\s+/g, replacement: ' ' },
    
    // Trim
    { pattern: /^\s+|\s+$/g, replacement: '' }
] as const;

// ============================================================================
// EXPORTS
// ============================================================================
// Export type definitions for better TypeScript support
export type EntityType = typeof VALID_ENTITY_TYPES[number];
export type Severity = typeof VALID_SEVERITIES[number];
export type RuleKind = typeof VALID_RULE_KINDS[number];
export type TriggerOperator = typeof VALID_TRIGGER_OPERATORS[number];