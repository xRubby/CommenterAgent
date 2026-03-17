import * as vscode from 'vscode';
import { callAI, getApiKey } from '../providers/huggingface';
import { detectSymbolAtLine, isAlreadyCommented, getCommentPrefix } from '../providers/symbolDetector';
import { DatabaseManager } from '../db';

let ghostDecoration: vscode.TextEditorDecorationType;
let currentSuggestion: { line: number; comment: string } | null = null;
let debounceTimer: NodeJS.Timeout | undefined;

// Inizializza i commenti inline per l'estensione VSCode.
export function initInlineComments(context: vscode.ExtensionContext) { 
    ghostDecoration = vscode.window.createTextEditorDecorationType({});
    context.subscriptions.push({ dispose: () => ghostDecoration.dispose() });
}

// Genera un commento per il codice fornito.
async function generateComment(snippet: string, langId: string, dbManager: DatabaseManager): Promise<string> {

    const active = dbManager.getActivePersona();

    if (!active) {
        vscode.window.showWarningMessage('Nessuna persona attiva. Seleziona un utente dalla gestione utenti.');
        return '';
    }

    return callAI(snippet, langId, active.persona) ?? '';
}

// Mostra testo fantasma nell'editor per una linea specifica.
function showGhostText( 
    editor: vscode.TextEditor,
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

// Cancella il testo fantasma nell'editor se presente e nasconde il contesto del sugggerimento AI.
export function clearGhostText(editor?: vscode.TextEditor) {
    editor?.setDecorations(ghostDecoration, []);
    currentSuggestion = null;
    vscode.commands.executeCommand('setContext', 'aiCommenter.suggestionVisible', false);
}

// Accetta un suggerimento inline nel codice e l'inserisce nella riga corretta con l'indentazione appropriata.
export async function acceptInlineSuggestion(
    editor: vscode.TextEditor,
    context: vscode.ExtensionContext
) {
    if (!currentSuggestion) {return;}

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

// Attiva un commento AI all'interno del codice.
export async function triggerInlineComment( 
    editor: vscode.TextEditor,
    lineNumber: number,
    dbManager: DatabaseManager
) {
    const apiKey = await getApiKey();

    if (!apiKey) {return;}

    const symbol = detectSymbolAtLine(editor.document, lineNumber);
    if (!symbol) {return;}
    if (isAlreadyCommented(editor.document, lineNumber)) {return;}

    try {
        const comment = await generateComment(symbol.snippet, editor.document.languageId, dbManager);
        if (comment && vscode.window.activeTextEditor === editor) {
            console.log("Commento generato");
            showGhostText(editor, lineNumber, comment);
        }
    } catch (err: any) {
        console.error('AI Commenter inline error:', err.message);
    }
}

// Registra listener inline per gestire selezioni e modifiche del documento.
export function registerInlineListeners(context: vscode.ExtensionContext, dbManager: DatabaseManager) {

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
            const editor = e.textEditor;
            const currentLine = e.selections[0].active.line;

            if (currentSuggestion && currentLine !== currentSuggestion.line) {
                clearGhostText(editor);
            }

            if (debounceTimer) {clearTimeout(debounceTimer);}
            debounceTimer = setTimeout(() => {
                if (vscode.window.activeTextEditor === editor) {
                    triggerInlineComment(editor, currentLine, dbManager);
                }
            }, 800);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || e.document !== editor.document) {return;}

            clearGhostText(editor);

            if (debounceTimer) {clearTimeout(debounceTimer);}
            debounceTimer = setTimeout(() => {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const line = activeEditor.selection.active.line;
                    triggerInlineComment(activeEditor, line, dbManager);
                }
            }, 800);
        })
    );
}