import * as vscode from 'vscode';
import { DatabaseManager } from '../db';
import { Persona } from '../entities/persona';

export function editUserCommand(dbManager: DatabaseManager) {
    return (key: string) => {
        const db = dbManager.load();
        const user = db[key];
        if (!user) {return;}

        const panel = vscode.window.createWebviewPanel(
            'editUser',
            `Modifica Utente: ${key}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getEditUserHtml(key, user);

        panel.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'save') {
                user.nome = msg.nome;
                user.lingua = msg.lingua;
                user.tono = msg.tono;
                user.esempi = msg.esempi.split(',').map((e: string) => e.trim()).filter(Boolean);
                dbManager.save(db);
                vscode.window.showInformationMessage(`Utente "${key}" aggiornato!`);
                panel.dispose();
            }
        });
    };
}

function getEditUserHtml(key: string, user: Persona): string {
    return `<!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: var(--vscode-font-family); padding: 10px; }
            input, textarea { width: 100%; margin-bottom: 8px; padding: 4px; }
            button { padding: 6px 12px; }
        </style>
    </head>
    <body>
        <h3>Modifica Utente: ${key}</h3>
        <label>Nome</label>
        <input id="nome" value="${user.nome}" />
        <label>Lingua</label>
        <input id="lingua" value="${user.lingua}" />
        <label>Tono</label>
        <input id="tono" value="${user.tono}" />
        <label>Esempi (separati da virgola)</label>
        <textarea id="esempi">${user.esempi.join(', ')}</textarea>
        <button onclick="save()">Salva</button>
        <script>
            const vscode = acquireVsCodeApi();
            function save() {
                vscode.postMessage({
                    command: 'save',
                    nome: document.getElementById('nome').value,
                    lingua: document.getElementById('lingua').value,
                    tono: document.getElementById('tono').value,
                    esempi: document.getElementById('esempi').value
                });
            }
        </script>
    </body>
    </html>`;
}