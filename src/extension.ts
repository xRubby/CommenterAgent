import * as vscode from 'vscode';
import { DatabaseManager } from './db';
import { generateComment } from './commands/generateComment';

export function activate(context: vscode.ExtensionContext) {
    const dbManager = new DatabaseManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-commenter.generate', generateComment(dbManager))
    );
}