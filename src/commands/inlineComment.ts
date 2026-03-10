import * as vscode from 'vscode';
import { HfInference } from '@huggingface/inference';
import { detectSymbolAtLine, isAlreadyCommented, getCommentPrefix } from '../providers/symbolDetector';

const MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';

let ghostDecoration: vscode.TextEditorDecorationType;
let currentSuggestion: { line: number; comment: string } | null = null;
let debounceTimer: NodeJS.Timeout | undefined;

export function initInlineComments(context: vscode.ExtensionContext) {
    ghostDecoration = vscode.window.createTextEditorDecorationType({});
    context.subscriptions.push({ dispose: () => ghostDecoration.dispose() });
}

async function callAI(snippet: string, apiKey: string, langId: string): Promise<string> {
    const hf = new HfInference(apiKey);

    const response = await hf.chatCompletion({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are a code documentation expert. 
Generate a single concise inline comment for the given code.
Rules:
- Output ONLY the comment text, nothing else
- No code, no markdown, no comment symbols (// or #)  
- Max 120 characters
- Present tense: "Calculates...", "Returns...", "Handles..."
- For functions/methods: what it does and returns
- For classes: its purpose`
            },
            {
                role: 'user',
                content: `Generate a single inline comment for this ${langId} code:\n\n${snippet}\n\nReply with ONLY the comment text.`
            }
        ],
        max_tokens: 80,
        temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return text.replace(/^\/\/\s*/, '').replace(/^#\s*/, '').replace(/^\/\*+\s*/, '').trim();
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
    lineNumber: number
) {
    const config = vscode.workspace.getConfiguration('aiCommenter');
    const apiKey: string = config.get('apiKey') ?? '';

    if (!apiKey) return;

    const symbol = detectSymbolAtLine(editor.document, lineNumber);
    if (!symbol) return;
    if (isAlreadyCommented(editor.document, lineNumber)) return;

    try {
        const comment = await callAI(symbol.snippet, apiKey, editor.document.languageId);
        if (comment && vscode.window.activeTextEditor === editor) {
            console.log("Commento generato");
            showGhostText(editor, context, lineNumber, comment);
        }
    } catch (err: any) {
        console.error('AI Commenter inline error:', err.message);
    }
}

export function registerInlineListeners(context: vscode.ExtensionContext) {

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
                    triggerInlineComment(editor, context, currentLine);
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
                    triggerInlineComment(activeEditor, context, line);
                }
            }, 800);
        })
    );
}