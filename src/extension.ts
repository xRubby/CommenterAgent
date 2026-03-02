import * as vscode from 'vscode';
import { HfInference } from '@huggingface/inference';
import { DatabaseManager } from './db';

export function activate(context: vscode.ExtensionContext) {

    // 1. Inizializziamo il Database Manager
    const dbManager = new DatabaseManager(context);

    // 3. Registrazione del comando di generazione
    let disposable = vscode.commands.registerCommand('ai-commenter.generate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Configurazione API Key
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

        // CARICAMENTO DB tramite Manager
        const db = dbManager.load();

        // Selezione Persona
        const selectedKey = await vscode.window.showQuickPick(Object.keys(db), {
            placeHolder: 'Chi deve commentare questo codice?'
        });
        if (!selectedKey) return;
        
        const persona = db[selectedKey];
        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);
        const languageId = editor.document.languageId;

        if (!selectedCode) {
            vscode.window.showWarningMessage("Seleziona del codice da commentare.");
            return;
        }

        const client = new HfInference(apiKey);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Generazione commento (${persona.nome})...`,
                cancellable: false
            }, async () => {
                
                const systemPrompt = `Sei un clone di ${persona.nome}. 
                Scrivi UN SOLO commento per il codice seguente.
                Linguaggio: ${languageId}. Lingua: ${persona.lingua}. Tono: ${persona.tono}.
                Esempi: ${persona.esempi.join(' | ')}.
                REGOLE: Restituisci SOLO il testo del commento con il prefisso corretto (es. // o #).`;

                const response = await client.chatCompletion({
                    model: "Qwen/Qwen2.5-Coder-7B-Instruct",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Codice:\n${selectedCode}` }
                    ],
                    max_tokens: 120,
                    temperature: 0.7
                });

                const comment = response.choices[0].message.content?.trim() || "";

                if (comment) {
                    await editor.edit(editBuilder => {
                        editBuilder.insert(selection.start, comment + "\n");
                    });

                    // Feedback e Apprendimento tramite Manager
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
                        // Usiamo la funzione centralizzata del manager
                        dbManager.updatePersona(selectedKey, finalStyle);
                        vscode.window.showInformationMessage("Stile aggiornato!");
                    }
                }
            });
        } catch (error: any) {
            vscode.window.showErrorMessage("Errore Hugging Face: " + error.message);
        }
    });

    context.subscriptions.push(disposable);
}