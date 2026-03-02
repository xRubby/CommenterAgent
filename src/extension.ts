import * as vscode from 'vscode';
import { DatabaseManager } from './db';
import { generateComment } from './commands/generateComment';
import { PersonaWebviewProvider } from './views/PersonaWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    const dbManager = new DatabaseManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-commenter.generate', generateComment(dbManager))
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(PersonaWebviewProvider.viewType, new PersonaWebviewProvider(dbManager))
    );
}