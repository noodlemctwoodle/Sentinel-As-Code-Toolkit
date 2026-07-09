import * as path from 'path';
import * as fs from 'fs';

/**
 * Find the workspace root directory by looking for package.json
 */
function findWorkspaceRoot(): string {
    let currentDir = __dirname;
    while (currentDir !== path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    throw new Error('Could not find workspace root (package.json not found)');
}

/**
 * Load a data file from the data directory
 */
export function loadDataFile(filename: string): any {
    const workspaceRoot = findWorkspaceRoot();
    const dataPath = path.join(workspaceRoot, 'data', filename);
    
    if (!fs.existsSync(dataPath)) {
        throw new Error(`Data file not found: ${dataPath}`);
    }
    
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse data file ${filename}: ${error}`, { cause: error });
    }
}

/**
 * Extract MITRE techniques from a MITRE data object
 */
export function extractMitreTechniques(data: any): string[] {
    const techniques: string[] = [];
    if (data && data.objects && Array.isArray(data.objects)) {
        data.objects
            .filter((obj: any) => obj.type === 'attack-pattern')
            .forEach((technique: any) => {
                if (technique.external_references && Array.isArray(technique.external_references)) {
                    const mitreRef = technique.external_references.find(
                        (ref: any) => ref.source_name === 'mitre-attack'
                    );
                    if (mitreRef && mitreRef.external_id) {
                        techniques.push(mitreRef.external_id);
                    }
                }
            });
    }
    return techniques;
}

/**
 * Extract MITRE tactics from a MITRE data object
 */
export function extractMitreTactics(data: any): string[] {
    const tactics: string[] = [];
    if (data && data.objects && Array.isArray(data.objects)) {
        data.objects
            .filter((obj: any) => obj.type === 'x-mitre-tactic')
            .forEach((tactic: any) => {
                if (tactic.name) {
                    tactics.push(tactic.name);
                }
            });
    }
    return tactics;
}

/**
 * Extract connector IDs from connector data
 */
export function extractConnectorIds(connectorData: any): string[] {
    const connectorIds: string[] = [];
    if (connectorData && connectorData.tablesByConnector && Array.isArray(connectorData.tablesByConnector)) {
        connectorData.tablesByConnector.forEach((connector: any) => {
            if (connector.connectorId) {
                connectorIds.push(connector.connectorId);
            }
        });
    }
    return connectorIds;
}

/**
 * Check if a date is within the last N days
 */
export function isDateWithinDays(dateString: string, days: number): boolean {
    const date = new Date(dateString);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date > cutoff;
}

/**
 * Read a UTF-8 text file relative to the workspace root
 * (for example, 'templates/custom-detection.template.yaml').
 */
export function readRepoFile(relativePath: string): string {
    const workspaceRoot = findWorkspaceRoot();
    const filePath = path.join(workspaceRoot, relativePath);
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
}