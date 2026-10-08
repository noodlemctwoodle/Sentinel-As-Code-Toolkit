//
// src/providers/intellisenseSettings.ts
//
// Created by Toby G on 08/10/2026.
//

import * as vscode from 'vscode';

/** Whether Sentinel completions and hovers are enabled (sentinelAsCode.intellisense.enabled). */
export function isIntelliSenseEnabled(): boolean {
    return vscode.workspace.getConfiguration('sentinelAsCode').get<boolean>('intellisense.enabled', true);
}
