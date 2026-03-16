import * as vscode from 'vscode';
import { callAI } from '../providers/huggingface';
import { detectSymbolAtLine, isAlreadyCommented, getCommentPrefix } from '../providers/symbolDetector';
import { DatabaseManager } from '../db';

const MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';

let ghostDecoration: vscode.TextEditorDecorationType;
let currentSuggestion: { line: number; comment: string } | null = null;
let debounceTimer: NodeJS.Timeout | undefined;

export function initInlineComments(context: vscode.ExtensionContext) {
    ghostDecoration = vscode.window.createTextEditorDecorationType({});
    context.subscriptions.push({ dispose: () => ghostDecoration.dispose() });
}

async function generateComment(snippet: string, langId: string, dbManager: DatabaseManager): Promise<string> {

    const active = dbManager.getActivePersona();

    if (!active) {
        vscode.window.showWarningMessage('Nessuna persona attiva. Seleziona un utente dalla gestione utenti.');
        return '';
    }

    return callAI(snippet, langId, active.persona) ?? '';
}

function showGhostText(
    editor: vscode.TextEditor,
    context: vscode.ExtensionContext,
    lineNumber: number,
    commentText: string
) {
    const prefix = getCommentPrefix(editor.document.languageId);
    const endPos = editor.document.lineAt(lineNumber).range.end;

    editor.setDecorations(ghostDecoration, [{
        range: new vscode.Range(endPos, endPos),
        renderOptions: {
            after: {
                contentText: `  ← ${prefix}${commentText}`,
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic',
            }
        }
    }]);

    currentSuggestion = { line: lineNumber, comment: commentText };
    vscode.commands.executeCommand('setContext', 'aiCommenter.suggestionVisible', true);
}

export function clearGhostText(editor?: vscode.TextEditor) {
    editor?.setDecorations(ghostDecoration, []);
    currentSuggestion = null;
    vscode.commands.executeCommand('setContext', 'aiCommenter.suggestionVisible', false);
}

export async function acceptInlineSuggestion(
    editor: vscode.TextEditor,
    context: vscode.ExtensionContext
) {
    if (!currentSuggestion) return;

    const { line, comment } = currentSuggestion;
    const sourceLine = editor.document.lineAt(line);
    const indent = sourceLine.text.match(/^(\s*)/)?.[1] ?? '';
    const prefix = getCommentPrefix(editor.document.languageId);

    await editor.edit(editBuilder => {
        editBuilder.insert(
            new vscode.Position(line, 0),
            `${indent}${prefix}${comment}\n`
        );
    });

    clearGhostText(editor);
}

export async function triggerInlineComment(
    editor: vscode.TextEditor,
    context: vscode.ExtensionContext,
    lineNumber: number,
    dbManager: DatabaseManager
) {
    const config = vscode.workspace.getConfiguration('aiCommenter');
    const apiKey: string = config.get('apiKey') ?? '';

    if (!apiKey) return;

    const symbol = detectSymbolAtLine(editor.document, lineNumber);
    if (!symbol) return;
    if (isAlreadyCommented(editor.document, lineNumber)) return;

    try {
        const comment = await generateComment(symbol.snippet, editor.document.languageId, dbManager);
        if (comment && vscode.window.activeTextEditor === editor) {
            console.log("Commento generato");
            showGhostText(editor, context, lineNumber, comment);
        }
    } catch (err: any) {
        console.error('AI Commenter inline error:', err.message);
    }
}

export function registerInlineListeners(context: vscode.ExtensionContext, dbManager: DatabaseManager) {

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
            const editor = e.textEditor;
            const currentLine = e.selections[0].active.line;

            if (currentSuggestion && currentLine !== currentSuggestion.line) {
                clearGhostText(editor);
            }

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (vscode.window.activeTextEditor === editor) {
                    triggerInlineComment(editor, context, currentLine, dbManager);
                }
            }, 800);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || e.document !== editor.document) return;

            clearGhostText(editor);

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const line = activeEditor.selection.active.line;
                    triggerInlineComment(activeEditor, context, line, dbManager);
                }
            }, 800);
        })
    );
}