//
// src/content/huntingQueryValidator.ts
//
// Created by Toby G on 09/07/2026.
//

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { VALIDATION_PATTERNS } from '../validation/constants';
import { MitreLoader } from '../validation/mitreLoader';

/**
 * Validates Sentinel-as-Code hunting queries against the documented schema.
 * Required: id, name, query. Optional: description, tactics, techniques, tags.
 */
export class HuntingQueryValidator {
    private static readonly REQUIRED_FIELDS = ['id', 'name', 'query'];

    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const content = document.getText();
        const lines = content.split('\n');

        let parsed: any;
        try {
            parsed = yaml.load(content);
        } catch (yamlError: any) {
            const line = yamlError.mark?.line ?? 0;
            const character = yamlError.mark?.column ?? 0;
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(line, character, line, character + 10),
                `YAML Syntax Error: ${yamlError.message}`,
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics;
        }

        if (!parsed || typeof parsed !== 'object') {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 10),
                'Invalid hunting query: expected a YAML object',
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics;
        }

        this.validateRequiredFields(parsed, lines, diagnostics);
        this.validateIdField(parsed, lines, diagnostics);
        this.validateTechniques(parsed, lines, diagnostics);
        this.validateTactics(parsed, lines, diagnostics);
        this.validateTags(parsed, lines, diagnostics);

        return diagnostics;
    }

    private validateRequiredFields(parsed: any, lines: string[], diagnostics: vscode.Diagnostic[]) {
        for (const field of HuntingQueryValidator.REQUIRED_FIELDS) {
            if (!(field in parsed) || parsed[field] === null || parsed[field] === undefined || parsed[field] === '') {
                const lastLine = Math.max(0, lines.length - 1);
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(lastLine, 0, lastLine, lines[lastLine]?.length ?? 0),
                    `Missing required field for hunting query: ${field}`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    }

    private validateIdField(parsed: any, lines: string[], diagnostics: vscode.Diagnostic[]) {
        if (!('id' in parsed) || parsed.id === null || parsed.id === undefined) {
            return;
        }

        const id = parsed.id.toString();
        if (!VALIDATION_PATTERNS.GUID.test(id)) {
            const line = this.findFieldLine(lines, 'id');
            if (line !== -1) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(line, 0, line, lines[line].length),
                    'Hunting query id should be a GUID (generate with New-Guid or uuidgen). It must remain stable after first deployment.',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }

    private validateTechniques(parsed: any, lines: string[], diagnostics: vscode.Diagnostic[]) {
        if (!parsed.techniques || !Array.isArray(parsed.techniques)) {
            return;
        }

        parsed.techniques.forEach((technique: string) => {
            const validation = MitreLoader.validateTechnique(technique);
            if (!validation.isValidFormat || (!validation.isKnown && validation.message)) {
                const line = this.findFieldLine(lines, 'techniques', technique);
                if (line !== -1) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(line, 0, line, lines[line].length),
                        validation.message || `Technique validation failed for: ${technique}`,
                        validation.severity
                    ));
                }
            }
        });
    }

    private validateTactics(parsed: any, lines: string[], diagnostics: vscode.Diagnostic[]) {
        if (!parsed.tactics || !Array.isArray(parsed.tactics)) {
            return;
        }

        parsed.tactics.forEach((tactic: string) => {
            const validation = MitreLoader.validateTactic(tactic);
            if (!validation.isValidFormat || (!validation.isKnown && validation.message)) {
                const line = this.findFieldLine(lines, 'tactics', tactic);
                if (line !== -1) {
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(line, 0, line, lines[line].length),
                        validation.message || `Tactic validation failed for: ${tactic}`,
                        validation.severity
                    ));
                }
            }
        });
    }

    private validateTags(parsed: any, lines: string[], diagnostics: vscode.Diagnostic[]) {
        if (!('tags' in parsed) || parsed.tags === null || parsed.tags === undefined) {
            return;
        }

        const line = this.findFieldLine(lines, 'tags');
        const range = line !== -1
            ? new vscode.Range(line, 0, line, lines[line].length)
            : new vscode.Range(0, 0, 0, 10);

        if (!Array.isArray(parsed.tags)) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Hunting query 'tags' must be an array of { name, value } objects.",
                vscode.DiagnosticSeverity.Error
            ));
            return;
        }

        const malformed = parsed.tags.some((tag: any) =>
            !tag || typeof tag !== 'object' || typeof tag.name !== 'string' || typeof tag.value !== 'string'
        );
        if (malformed) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                "Each hunting query tag must have string 'name' and 'value' properties.",
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    private findFieldLine(lines: string[], fieldName: string, value?: string): number {
        let inSection = false;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            if (trimmed.startsWith('-')) {
                if (inSection && value) {
                    const arrayValue = trimmed.substring(1).trim();
                    if (arrayValue === value || arrayValue.includes(value)) {
                        return i;
                    }
                }
                continue;
            }

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) {
                continue;
            }

            const name = trimmed.substring(0, colonIndex).trim();
            const indentation = lines[i].length - lines[i].trimStart().length;
            if (indentation === 0) {
                inSection = name === fieldName;
                if (name === fieldName && !value) {
                    return i;
                }
            }
        }
        return -1;
    }
}
