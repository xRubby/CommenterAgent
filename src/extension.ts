import * as vscode from 'vscode';
import { DatabaseManager } from './db';
import { generateComment } from './commands/generateComment';
import { AggiungiPersonaWebviewProvider } from './views/AggiungiPersonaProvider';
import { GestioneUtentiWebviewProvider } from './views/GestioneUtentiProvider';
import { editUserCommand } from './views/ModificaUtenteProvider';

export function activate(context: vscode.ExtensionContext) {
    const dbManager = new DatabaseManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-commenter.generate', generateComment(dbManager))
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(AggiungiPersonaWebviewProvider.viewType, new AggiungiPersonaWebviewProvider(dbManager))
    );

     context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GestioneUtentiWebviewProvider.viewType, new GestioneUtentiWebviewProvider(dbManager))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-commenter.editUser', editUserCommand(dbManager))
    );
}