import * as vscode from 'vscode';
import { DatabaseManager } from '../db';
import { callAI } from '../providers/huggingface';
import { getCommentPrefix } from '../providers/symbolDetector';

// Genera un commento AI basato sul codice selezionato.
export const generateComment = (dbManager: DatabaseManager) => async () => { 
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    const config = vscode.workspace.getConfiguration('aiCommenter');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        const selection = await vscode.window.showErrorMessage(
            "Hugging Face API Key mancante!",
            "Apri Impostazioni"
        );
        if (selection === "Apri Impostazioni") {
            vscode.commands.executeCommand('workbench.action.openSettings', 'aiCommenter.apiKey');
        }
        return;
    }

    const db = dbManager.load();

    const selectedKey = await vscode.window.showQuickPick(Object.keys(db), {
        placeHolder: 'Chi deve commentare questo codice?'
    });
    if (!selectedKey) {return;}

    const persona = db[selectedKey];
    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    const languageId = editor.document.languageId;
    const prefix = getCommentPrefix(languageId);

    if (!selectedCode) {
        vscode.window.showWarningMessage("Seleziona del codice da commentare.");
        return;
    }

    try {
            const comment =  await callAI(selectedCode, languageId, persona);

            if (comment) {
                await editor.edit(editBuilder => {
                    editBuilder.insert(selection.start, prefix + comment + "\n");
                });

                const feedback = await vscode.window.showInformationMessage(
                    `Commento inserito. Ti piace lo stile?`,
                    "Sì, impara", "Modifica e impara", "Scarta"
                );

                let finalStyle = "";
                if (feedback === "Sì, impara") {
                    finalStyle = comment;
                } else if (feedback === "Modifica e impara") {
                    finalStyle = await vscode.window.showInputBox({
                        value: comment,
                        prompt: "Modifica il commento per insegnare lo stile all'AI"
                    }) || "";
                }

                if (finalStyle) {
                    dbManager.updatePersona(selectedKey, finalStyle);
                    vscode.window.showInformationMessage("Stile aggiornato!");
                }
            }
    } catch (error: any) {
        vscode.window.showErrorMessage("Errore Hugging Face: " + error.message);
    }
};