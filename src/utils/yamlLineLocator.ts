//
// src/utils/yamlLineLocator.ts
//
// Created by Toby G on 08/10/2026.
//

const INDEXED_PATH = /^([A-Za-z0-9_]+)\[(\d+)\]\.([A-Za-z0-9_]+)$/;

/**
 * Parses an indexed field path such as `requiredDataConnectors[0].connectorId`
 * into its list key, item index and field name. Returns undefined for any other
 * path shape.
 */
export function parseIndexedPath(fieldPath: string): { listKey: string; index: number; field: string } | undefined {
    const match = INDEXED_PATH.exec(fieldPath);
    if (!match) {
        return undefined;
    }
    return { listKey: match[1], index: Number(match[2]), field: match[3] };
}

/**
 * Finds the 0-based line of a field inside the nth item of a top-level YAML block
 * sequence, for example the `connectorId` of the second `requiredDataConnectors`
 * entry. When a value is given, the line holding that value is returned instead:
 * either the field line itself (inline or flow-style value) or the matching item
 * of a block list under the field. Returns -1 when nothing matches.
 */
export function findIndexedFieldLine(lines: string[], listKey: string, index: number, field: string, value?: string): number {
    const start = lines.findIndex(line => new RegExp(`^${listKey}\\s*:`).test(line));
    if (start === -1) {
        return -1;
    }

    let item = -1;
    let itemIndent = -1;
    let inField = false;
    let fieldIndent = -1;

    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const indent = line.length - line.trimStart().length;
        if (indent === 0) {
            break;
        }

        let content = trimmed;
        let contentIndent = indent;
        if (trimmed.startsWith('-') && (itemIndent === -1 || indent === itemIndent)) {
            itemIndent = indent;
            item++;
            inField = false;
            content = trimmed.slice(1).trim();
            contentIndent = indent + 2;
            if (!content) {
                continue;
            }
        }
        if (item !== index) {
            continue;
        }

        const keyMatch = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(content);
        if (keyMatch && (!inField || contentIndent <= fieldIndent)) {
            inField = keyMatch[1] === field;
            fieldIndent = contentIndent;
            if (inField && (!value || keyMatch[2].includes(value))) {
                return i;
            }
            continue;
        }

        if (inField && value && trimmed.startsWith('-') && unquote(trimmed.slice(1).trim()) === value) {
            return i;
        }
    }
    return -1;
}

function unquote(text: string): string {
    return text.replace(/^(["'])(.*)\1$/, '$2');
}
