//
// src/utils/validationTriggers.ts
//
// Created by Toby G on 08/10/2026.
//

import * as vscode from 'vscode';

/** Whether live validation should run while the user types. */
export function shouldValidateOnType(): boolean {
    return vscode.workspace.getConfiguration('sentinelAsCode').get<boolean>('validation.onType', true);
}

/** Whether validation should run when a document is saved. */
export function shouldValidateOnSave(): boolean {
    return vscode.workspace.getConfiguration('sentinelAsCode').get<boolean>('validation.onSave', true);
}

/** Whether a configuration change affects validation, formatting, or IntelliSense output. */
export function affectsSentinelSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration('sentinelAsCode');
}
