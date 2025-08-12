import * as vscode from 'vscode';
import {
    Configuration,
    ConfidentialClientApplication,
    ClientCredentialRequest,
    AuthenticationResult
} from '@azure/msal-node';

export type AuthMode = 'servicePrincipal';

interface StoredAuthConfig {
    mode: AuthMode;
    tenantId: string;
    clientId: string;
    authority: string;
    hasClientSecret?: boolean;
    scopes?: string[];
}

const SECRET_KEYS = {
    config: 'defender.auth.config',
    clientSecret: 'defender.auth.clientSecret'
};

const GRAPH_SCOPE_DEFAULT = ['https://graph.microsoft.com/.default'];
const OUTPUT_CHANNEL_NAME = 'Defender XDR Auth';

export class DefenderAuthProvider {
    private context: vscode.ExtensionContext;
    private confidentialApp?: ConfidentialClientApplication;
    private tokenCache?: AuthenticationResult;
    private config?: StoredAuthConfig;
    private outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async load(): Promise<void> {
        const raw = await this.context.secrets.get(SECRET_KEYS.config);
        if (raw) {
            try {
                this.config = JSON.parse(raw) as StoredAuthConfig;
                await this.instantiateClient();
            } catch {
                this.config = undefined;
            }
        }
    }

    private async persist(): Promise<void> {
        if (this.config) {
            await this.context.secrets.store(SECRET_KEYS.config, JSON.stringify(this.config));
        }
    }

    private async instantiateClient(): Promise<void> {
        if (!this.config) return;
        const authority = `https://login.microsoftonline.com/${this.config.tenantId}`;
        const clientSecret = await this.context.secrets.get(SECRET_KEYS.clientSecret);
        if (!clientSecret) return;

        const base: Configuration = {
            auth: {
                clientId: this.config.clientId,
                authority,
                clientSecret
            },
            system: {
                loggerOptions: {
                    loggerCallback: () => {},
                    piiLoggingEnabled: false,
                    logLevel: 0
                }
            }
        };

        this.confidentialApp = new ConfidentialClientApplication(base);
    }

    public getAuthSummary(): string {
        if (!this.config) return 'Not configured';
        return `servicePrincipal | tenant=${this.config.tenantId} client=${this.config.clientId}`;
    }

    public async clear(): Promise<void> {
        this.tokenCache = undefined;
        this.config = undefined;
        await this.context.secrets.delete(SECRET_KEYS.config);
        await this.context.secrets.delete(SECRET_KEYS.clientSecret);
        vscode.window.showInformationMessage('Defender XDR auth cleared.');
    }

    private static readonly LAST_CLIENT_ID_SECRET = 'defender.lastClientId';

    private async getLastClientId(): Promise<string | undefined> {
        return await this.context.secrets.get(DefenderAuthProvider.LAST_CLIENT_ID_SECRET) || undefined;
    }

    private async saveLastClientId(id: string): Promise<void> {
        await this.context.secrets.store(DefenderAuthProvider.LAST_CLIENT_ID_SECRET, id);
    }

    public async configure(): Promise<void> {
        const tenantId = await vscode.window.showInputBox({
            title: 'Tenant ID (GUID)',
            validateInput: v => v && v.length > 10 ? undefined : 'Tenant ID required',
            ignoreFocusOut: true
        });
        if (!tenantId) return;

        const last = await this.getLastClientId();
        const clientId = await vscode.window.showInputBox({
            title: 'Client (Application) ID',
            validateInput: v => v && v.length > 10 ? undefined : 'Client ID required',
            value: last || '',
            ignoreFocusOut: true
        });
        if (!clientId) return;

        const clientSecret = await vscode.window.showInputBox({
            title: 'Client Secret',
            password: true,
            validateInput: v => v && v.length > 0 ? undefined : 'Client secret required',
            ignoreFocusOut: true
        });
        if (!clientSecret) return;

        await this.context.secrets.store(SECRET_KEYS.clientSecret, clientSecret);

        this.config = {
            mode: 'servicePrincipal',
            tenantId,
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            scopes: GRAPH_SCOPE_DEFAULT
        };
        this.config.hasClientSecret = true;

        await this.persist();
        await this.instantiateClient();

        try {
            await this.acquireToken(true);
            await this.saveLastClientId(clientId);
            vscode.window.showInformationMessage('Defender XDR service principal authentication validated.');
        } catch (e: any) {
            vscode.window.showErrorMessage(`Authentication failed: ${e.message || e}`);
        }
    }

    public async acquireToken(force?: boolean): Promise<string> {
        if (!this.config) throw new Error('Auth not configured.');
        if (!force && this.tokenCache?.expiresOn && (this.tokenCache.expiresOn.getTime() - Date.now()) > 120000) {
            return this.tokenCache.accessToken;
        }
        if (!this.confidentialApp) throw new Error('Confidential client not ready (reconfigure).');

        const result = await this.confidentialApp.acquireTokenByClientCredential({
            scopes: GRAPH_SCOPE_DEFAULT
        } as ClientCredentialRequest);

        if (!result) throw new Error('No token returned.');
        this.tokenCache = result;
        return result.accessToken;
    }

    public getAuthSummaryDetailed(): string {
        if (!this.config) return 'Not configured';
        return [
            'Mode: servicePrincipal',
            `Tenant: ${this.config.tenantId}`,
            `ClientId: ${this.config.clientId}`,
            `Has Secret: ${this.config.hasClientSecret ? 'Yes' : 'No'}`
        ].join(' | ');
    }
}