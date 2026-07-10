import * as vscode from 'vscode';
import * as path from 'path';

/**
 * MITRE ATT&CK metadata field names as they appear across the Sentinel-as-Code
 * content types. `tactics` is shared; the technique-list key differs by type:
 * analytics rules use `relevantTechniques`, hunting queries use `techniques`,
 * and Defender custom detections use `mitreTechniques`.
 */
export const MITRE_TACTIC_FIELDS: string[] = ['tactics'];
export const MITRE_TECHNIQUE_FIELDS: string[] = ['relevantTechniques', 'techniques', 'mitreTechniques'];

interface MitreTechnique {
    id: string;
    name: string;
    tactics: string[];
    description?: string;
    parent?: string;
    framework: 'enterprise' | 'mobile' | 'ics';
}

interface MitreTactic {
    id: string;
    name: string;
    description: string;
    framework: 'enterprise' | 'mobile' | 'ics';
}

// STIX format interfaces for the complete dataset
interface StixObject {
    type: string;
    id: string;
    name?: string;
    description?: string;
    external_references?: Array<{
        source_name: string;
        external_id: string;
    }>;
    kill_chain_phases?: Array<{
        kill_chain_name: string;
        phase_name: string;
    }>;
    x_mitre_is_subtechnique?: boolean;
}

interface StixBundle {
    type: string;
    objects: StixObject[];
}

export class MitreLoader {
    private static techniques: Map<string, MitreTechnique> = new Map();
    private static tactics: Set<string> = new Set();
    private static tacticDetails: Map<string, MitreTactic> = new Map();
    private static extensionContext: vscode.ExtensionContext;
    private static loadedFrameworks: Set<string> = new Set();
    private static dataLoaded: boolean = false; // Renamed from isDataLoaded

    // Define available frameworks and their file mappings
    private static readonly FRAMEWORK_FILES = {
        enterprise: 'mitre-v16.json',
        mobile: 'mitre-mobile.json',
        ics: 'mitre-ics.json'
    };

    public static setExtensionContext(context: vscode.ExtensionContext) {
        this.extensionContext = context;
    }

    public static async loadMitreData(): Promise<void> {
        if (!this.extensionContext) {
            throw new Error('Extension context not set - cannot load MITRE data');
        }

        try {
            const config = vscode.workspace.getConfiguration('sentinelAsCode');
            const enabledFrameworks = config.get<string[]>('mitre.frameworks', ['enterprise', 'mobile', 'ics']);
            
            console.log(`🔄 Loading MITRE ATT&CK frameworks: ${enabledFrameworks.join(', ')}`);
            
            // Clear existing data
            this.techniques.clear();
            this.tactics.clear();
            this.tacticDetails.clear();
            this.loadedFrameworks.clear();
            this.dataLoaded = false; // Updated reference

            let anyLoaded = false;
            const loadErrors: string[] = [];

            // Load each enabled framework
            for (const framework of enabledFrameworks) {
                if (this.FRAMEWORK_FILES[framework as keyof typeof this.FRAMEWORK_FILES]) {
                    try {
                        const loaded = await this.loadFramework(framework as keyof typeof this.FRAMEWORK_FILES);
                        if (loaded) {
                            this.loadedFrameworks.add(framework);
                            anyLoaded = true;
                        }
                    } catch (error) {
                        const errorMessage = `Failed to load ${framework}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        loadErrors.push(errorMessage);
                        console.error(errorMessage);
                    }
                } else {
                    console.warn(`Unknown framework: ${framework}`);
                }
            }

            if (!anyLoaded) {
                const errorMsg = `Failed to load any MITRE frameworks. Errors: ${loadErrors.join(', ')}`;
                console.error(errorMsg);
                vscode.window.showErrorMessage(
                    'Sentinel as Code Toolkit: Failed to load MITRE ATT&CK data. MITRE validation will be limited.',
                    { modal: false }
                );
                return;
            }

            this.dataLoaded = true; // Updated reference
            console.log(`✅ Loaded MITRE frameworks: ${Array.from(this.loadedFrameworks).join(', ')}`);
            console.log(`📊 Total: ${this.tactics.size} tactics, ${this.techniques.size} techniques`);

            // Show success message if not all frameworks loaded
            if (loadErrors.length > 0) {
                vscode.window.showWarningMessage(
                    `Sentinel as Code Toolkit: Partially loaded MITRE data. Some frameworks failed: ${loadErrors.join(', ')}`,
                    { modal: false }
                );
            }

        } catch (error) {
            console.error('Critical error loading MITRE data:', error);
            vscode.window.showErrorMessage(
                `Sentinel as Code Toolkit: Critical error loading MITRE data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { modal: false }
            );
        }
    }

    private static async loadFramework(framework: keyof typeof this.FRAMEWORK_FILES): Promise<boolean> {
        if (!this.extensionContext) {
            throw new Error('Extension context not set');
        }

        const fileName = this.FRAMEWORK_FILES[framework];
        const mitreDataPath = path.join(this.extensionContext.extensionPath, 'data', fileName);
        const mitreDataUri = vscode.Uri.file(mitreDataPath);
        
        try {
            const data = await vscode.workspace.fs.readFile(mitreDataUri);
            const stixBundle: StixBundle = JSON.parse(data.toString());
            
            if (stixBundle.type !== 'bundle' || !stixBundle.objects) {
                throw new Error(`Invalid STIX bundle format in ${fileName}`);
            }

            await this.processFrameworkData(stixBundle, framework);
            console.log(`✅ Loaded ${framework} framework from ${fileName}`);
            return true;

        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                throw new Error(`File not found: ${fileName}. Please ensure MITRE data files are included in the extension.`, { cause: error });
            }
            throw error;
        }
    }

    private static async processFrameworkData(stixBundle: StixBundle, framework: keyof typeof this.FRAMEWORK_FILES): Promise<void> {
        let tacticsCount = 0;
        let techniquesCount = 0;

        // Extract tactics from STIX objects
        const tacticObjects = stixBundle.objects.filter(obj => obj.type === 'x-mitre-tactic');
        for (const tacticObj of tacticObjects) {
            const externalRef = tacticObj.external_references?.find(ref => ref.source_name === 'mitre-attack');
            if (externalRef && tacticObj.name) {
                const tacticName = this.formatTacticName(tacticObj.name);
                this.tactics.add(tacticName);
                
                // Only add if not already exists, or if this is a more complete definition
                if (!this.tacticDetails.has(tacticName) || !this.tacticDetails.get(tacticName)?.id) {
                    this.tacticDetails.set(tacticName, {
                        id: externalRef.external_id,
                        name: tacticName,
                        description: tacticObj.description || '',
                        framework: framework
                    });
                    tacticsCount++;
                }
            }
        }

        // Extract techniques from STIX objects
        const techniqueObjects = stixBundle.objects.filter(obj => 
            obj.type === 'attack-pattern' && 
            obj.external_references?.some(ref => ref.source_name === 'mitre-attack')
        );
        
        for (const techniqueObj of techniqueObjects) {
            const externalRef = techniqueObj.external_references?.find(ref => ref.source_name === 'mitre-attack');
            if (externalRef && techniqueObj.name) {
                const tactics = techniqueObj.kill_chain_phases
                    ?.filter(phase => phase.kill_chain_name === 'mitre-attack')
                    .map(phase => this.formatTacticName(phase.phase_name.replace(/-/g, ' '))) || [];

                const isSubTechnique = techniqueObj.x_mitre_is_subtechnique === true;
                const techniqueId = externalRef.external_id;
                
                // Only add if not already exists (prevent duplicates across frameworks)
                if (!this.techniques.has(techniqueId)) {
                    this.techniques.set(techniqueId, {
                        id: techniqueId,
                        name: techniqueObj.name,
                        tactics: tactics,
                        description: techniqueObj.description,
                        parent: isSubTechnique ? techniqueId.split('.')[0] : undefined,
                        framework: framework
                    });
                    techniquesCount++;
                }

                // Add tactics to the tactics set if not already present
                tactics.forEach(tactic => {
                    if (!this.tactics.has(tactic)) {
                        this.tactics.add(tactic);
                        if (!this.tacticDetails.has(tactic)) {
                            this.tacticDetails.set(tactic, {
                                id: '',
                                name: tactic,
                                description: `MITRE ATT&CK ${framework} Tactic: ${tactic}`,
                                framework: framework
                            });
                        }
                    }
                });
            }
        }

        console.log(`📊 ${framework}: ${tacticsCount} tactics, ${techniquesCount} techniques`);
    }

    private static formatTacticName(tacticName: string): string {
        // Convert tactic names to Sentinel format
        return tacticName
            .split(/[-\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    // Public API methods with data validation
    public static getValidTactics(): string[] {
        if (!this.dataLoaded) { // Updated reference
            console.warn('MITRE data not loaded - returning empty tactics list');
            return [];
        }
        return Array.from(this.tactics);
    }

    public static getAllTactics(): MitreTactic[] {
        if (!this.dataLoaded) { // Updated reference
            console.warn('MITRE data not loaded - returning empty tactics list');
            return [];
        }
        return Array.from(this.tacticDetails.values());
    }

    public static getAllTechniques(): MitreTechnique[] {
        if (!this.dataLoaded) { // Updated reference
            console.warn('MITRE data not loaded - returning empty techniques list');
            return [];
        }
        return Array.from(this.techniques.values());
    }

    public static getTechniquesForTactic(tactic: string): MitreTechnique[] {
        if (!this.dataLoaded) { // Updated reference
            return [];
        }
        return Array.from(this.techniques.values()).filter(technique => 
            technique.tactics.includes(tactic)
        );
    }

    public static getLoadedFrameworks(): string[] {
        return Array.from(this.loadedFrameworks);
    }

    public static getTechniquesByFramework(framework: 'enterprise' | 'mobile' | 'ics'): MitreTechnique[] {
        if (!this.dataLoaded) { // Updated reference
            return [];
        }
        return Array.from(this.techniques.values()).filter(technique => 
            technique.framework === framework
        );
    }

    public static getTacticsByFramework(framework: 'enterprise' | 'mobile' | 'ics'): MitreTactic[] {
        if (!this.dataLoaded) { // Updated reference
            return [];
        }
        return Array.from(this.tacticDetails.values()).filter(tactic => 
            tactic.framework === framework
        );
    }

    public static isValidTechnique(technique: string): boolean {
        if (!this.dataLoaded) { // Updated reference
            return false;
        }
        return this.techniques.has(technique);
    }

    public static getTechnique(id: string): MitreTechnique | undefined {
        if (!this.dataLoaded) { // Updated reference
            return undefined;
        }
        return this.techniques.get(id);
    }

    public static getTacticDetails(name: string): MitreTactic | undefined {
        if (!this.dataLoaded) { // Updated reference
            return undefined;
        }
        return this.tacticDetails.get(name);
    }

    public static hasDataLoaded(): boolean { // Renamed method
        return this.dataLoaded;
    }

    public static validateTactic(tactic: string): {
        isKnown: boolean;
        isValidFormat: boolean;
        message?: string;
        severity: vscode.DiagnosticSeverity;
    } {
        const config = vscode.workspace.getConfiguration('sentinelAsCode');
        const allowUnknown = config.get('mitre.allowUnknownTactics', true);
        const strictValidation = config.get('mitre.strictValidation', false);

        const isValidFormat = /^[A-Z][a-zA-Z]{2,30}$/.test(tactic);

        // If data isn't loaded, be more permissive
        if (!this.dataLoaded) { // Updated reference
            if (!isValidFormat) {
                return {
                    isKnown: false,
                    isValidFormat: false,
                    message: `Tactic '${tactic}' has invalid format. Should start with uppercase letter and contain only letters.`,
                    severity: vscode.DiagnosticSeverity.Error
                };
            }
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Cannot validate tactic '${tactic}' - MITRE data not loaded`,
                severity: vscode.DiagnosticSeverity.Information
            };
        }

        const isKnown = this.tactics.has(tactic);

        if (isKnown) {
            const tacticDetails = this.getTacticDetails(tactic);
            const frameworkInfo = tacticDetails ? ` (${tacticDetails.framework})` : '';
            return { 
                isKnown: true, 
                isValidFormat: true, 
                severity: vscode.DiagnosticSeverity.Information,
                message: `Valid MITRE ATT&CK tactic${frameworkInfo}`
            };
        }

        if (!isValidFormat) {
            return {
                isKnown: false,
                isValidFormat: false,
                message: `Tactic '${tactic}' has invalid format. Should start with uppercase letter and contain only letters.`,
                severity: vscode.DiagnosticSeverity.Error
            };
        }

        if (strictValidation) {
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Unknown tactic '${tactic}'. Enable 'Allow Unknown Tactics' or use a known MITRE tactic.`,
                severity: vscode.DiagnosticSeverity.Error
            };
        }

        if (!allowUnknown) {
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Unknown tactic '${tactic}'. Consider using a known MITRE tactic.`,
                severity: vscode.DiagnosticSeverity.Warning
            };
        }

        return {
            isKnown: false,
            isValidFormat: true,
            message: `Custom tactic '${tactic}' (not in MITRE ATT&CK framework)`,
            severity: vscode.DiagnosticSeverity.Information
        };
    }

    public static validateTechnique(technique: string): {
        isKnown: boolean;
        isValidFormat: boolean;
        message?: string;
        severity: vscode.DiagnosticSeverity;
    } {
        const config = vscode.workspace.getConfiguration('sentinelAsCode');
        const allowUnknown = config.get('mitre.allowUnknownTechniques', true);
        const strictValidation = config.get('mitre.strictValidation', false);

        const isValidFormat = /^T\d{4}(\.\d{3})?$/.test(technique);

        // If data isn't loaded, be more permissive
        if (!this.dataLoaded) { // Updated reference
            if (!isValidFormat) {
                return {
                    isKnown: false,
                    isValidFormat: false,
                    message: `Technique '${technique}' has invalid format. Should be T#### or T####.### (e.g., T1566 or T1566.001)`,
                    severity: vscode.DiagnosticSeverity.Error
                };
            }
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Cannot validate technique '${technique}' - MITRE data not loaded`,
                severity: vscode.DiagnosticSeverity.Information
            };
        }

        const isKnown = this.techniques.has(technique);

        if (isKnown) {
            const techniqueDetails = this.getTechnique(technique);
            const frameworkInfo = techniqueDetails ? ` (${techniqueDetails.framework})` : '';
            return { 
                isKnown: true, 
                isValidFormat: true, 
                severity: vscode.DiagnosticSeverity.Information,
                message: `Valid MITRE ATT&CK technique${frameworkInfo}`
            };
        }

        if (!isValidFormat) {
            return {
                isKnown: false,
                isValidFormat: false,
                message: `Technique '${technique}' has invalid format. Should be T#### or T####.### (e.g., T1566 or T1566.001)`,
                severity: vscode.DiagnosticSeverity.Error
            };
        }

        if (strictValidation) {
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Unknown technique '${technique}'. Enable 'Allow Unknown Techniques' or use a known MITRE technique.`,
                severity: vscode.DiagnosticSeverity.Error
            };
        }

        if (!allowUnknown) {
            return {
                isKnown: false,
                isValidFormat: true,
                message: `Unknown technique '${technique}'. Consider using a known MITRE technique.`,
                severity: vscode.DiagnosticSeverity.Warning
            };
        }

        return {
            isKnown: false,
            isValidFormat: true,
            message: `Custom technique '${technique}' (not in MITRE ATT&CK framework)`,
            severity: vscode.DiagnosticSeverity.Information
        };
    }
}