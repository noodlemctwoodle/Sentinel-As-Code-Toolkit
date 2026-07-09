import * as vscode from 'vscode';
import { SentinelRuleValidator } from './validation/validator';
import { SentinelRuleFormatter } from './formatting/formatter';
import { CommandManager } from './commands/index';
import { createFormattingProvider } from './providers/formatProvider';
import { DocumentListenerManager } from './listeners/documentListeners';
import { ContentDiagnosticsManager } from './content/contentDiagnostics';
import { MitreLoader } from './validation/mitreLoader';
import { ConnectorLoader } from './validation/connectorLoader';
import { SentinelCompletionProvider } from './providers/completionProvider';
import { SentinelRuleHoverProvider } from './providers/hoverProvider';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.stack;
    }
    return undefined;
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        console.log('🚀 Sentinel as Code Toolkit: Starting activation...');

        // Set extension context for all components that need it
        SentinelRuleFormatter.setExtensionContext(context);
        MitreLoader.setExtensionContext(context);
        ConnectorLoader.setExtensionContext(context);

        // Initialize loaders
        try {
            await MitreLoader.loadMitreData();
            await ConnectorLoader.loadConnectorData();
            console.log('✅ Sentinel as Code Toolkit: Data loaders initialized');
        } catch (loaderError) {
            console.error('❌ Sentinel as Code Toolkit: Failed to initialize validation loaders:', getErrorMessage(loaderError));
            // Extension will continue with basic validation
        }

        // Create core components
        const validator = new SentinelRuleValidator();
        const commandManager = new CommandManager(context, validator);
        const documentListenerManager = new DocumentListenerManager(validator);
        const contentDiagnosticsManager = new ContentDiagnosticsManager();

        // Register all components
        console.log('🔧 Sentinel as Code Toolkit: Registering components...');
        
        const documentListeners = documentListenerManager.registerListeners();
        console.log(`📄 Sentinel as Code Toolkit: Registered ${documentListeners.length} document listeners`);

        const contentDiagnosticsListeners = contentDiagnosticsManager.registerListeners();
        
        const commands = commandManager.registerCommands();
        console.log(`⚡ Sentinel as Code Toolkit: Registered ${commands.length} commands`);
        
        const formatterProvider = createFormattingProvider();
        console.log('🎨 Sentinel as Code Toolkit: Registered formatting provider');

        const completionProvider = vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'yaml' },
            new SentinelCompletionProvider(),
            ':', '"', "'", '-', ' '  // Trigger characters ('- ' opens the table list)
        );
        
        // Register hover provider for MITRE techniques and tactics
        const hoverProvider = vscode.languages.registerHoverProvider(
            { scheme: 'file', language: 'yaml' },
            new SentinelRuleHoverProvider()
        );
        
        context.subscriptions.push(completionProvider, hoverProvider);

        // Add all disposables to context subscriptions
        context.subscriptions.push(
            validator,
            contentDiagnosticsManager,
            ...documentListeners,
            ...contentDiagnosticsListeners,
            ...commands,
            formatterProvider
        );

        // Validate open documents on activation
        documentListenerManager.validateOpenDocuments();
        contentDiagnosticsManager.updateOpenDocuments();

        console.log('✅ Sentinel as Code Toolkit: Extension activation complete!');
        
        // Test command registration
        const allCommands = await vscode.commands.getCommands(true);
        const sentinelCommands = allCommands.filter((cmd: string) => cmd.startsWith('sentinelAsCode.'));
        console.log('🔍 Sentinel as Code Toolkit: Available commands:', sentinelCommands);
        
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        const errorStack = getErrorStack(error);
        
        console.error('❌ Sentinel as Code Toolkit: Extension activation failed:', errorMessage);
        if (errorStack) {
            console.error('Stack trace:', errorStack);
        }
        
        vscode.window.showErrorMessage(`Sentinel as Code Toolkit activation failed: ${errorMessage}`);
        throw error;
    }
}

export function deactivate() {
    console.log('🛑 Sentinel as Code Toolkit: Extension deactivated');
}