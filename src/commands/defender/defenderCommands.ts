import * as vscode from 'vscode';
import { DefenderXdrService } from '../../defender/services/defenderXdrService';

export class DefenderCommands {
    private service: DefenderXdrService;

    constructor() {
        this.service = new DefenderXdrService();
    }

    public registerCommands(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand('defender.formatForRepo', async () => {
                await this.service.formatActiveDocumentForRepo();
            }),
            vscode.commands.registerCommand('defender.convertYamlToJson', async () => {
                await this.service.convertYamlToJson();
            }),
            vscode.commands.registerCommand('defender.convertJsonToYaml', async () => {
                await this.service.convertJsonToYaml();
            })
        ];
    }
}