import * as vscode from 'vscode';
import { DatabaseManager } from '../db';

// Classe che gestisce la visualizzazione degli utenti in un Webview.
export class GestioneUtentiWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'scribe.userView';

    constructor(private readonly dbManager: DatabaseManager) {}

    // Configura e gestisce i messaggi ricevuti dalla WebView, eseguendo azioni come la cancellazione dell'utente, 
    // l'editing e l'attivazione della persona selezionata.
    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            const db = this.dbManager.load();
            if (msg.command === 'deleteUser') {
                const key = msg.key;
                const confirmed = await vscode.window.showWarningMessage(
                    `Sei sicuro di voler cancellare l'utente "${key}"?`,
                    { modal: true },
                    'Sì'
                );
                if (confirmed === 'Sì') {
                    delete db[key];
                    this.dbManager.save(db);
                    webviewView.webview.html = this.getHtml();
                    vscode.window.showInformationMessage(`Utente "${key}" cancellato.`);
                }
            } else if (msg.command === 'editUser') {
                vscode.commands.executeCommand('scribe.editUser', msg.key);
            } else if (msg.command === 'setActive') {
                this.dbManager.setActivePersona(msg.key);
                webviewView.webview.html = this.getHtml();
            } else if (msg.command === 'refresh') {
                webviewView.webview.html = this.getHtml();
            }
        });
    }

    // Genera una tabella HTML con informazioni sugli utenti e bottoni per modifiche.
    private getHtml(): string {
        const db = this.dbManager.load();

        const rows = Object.keys(db).map(key => {
            const u = db[key];
            if (!u) {return '';}
            const nome = u.nome || '';
            const safeKey = key.replace(/'/g, "\\'");

            const activeCell = u.active
                ? `<span class="in-uso">✔ In uso</span>`
                : `<button onclick="setActive('${safeKey}')">Utilizza</button>`;

            return `
                <tr>
                    <td>${key}</td>
                    <td>${nome}</td>
                    <td>${activeCell}</td>
                    <td>
                        <button onclick="editUser('${safeKey}')">Visualizza</button>
                        <button onclick="deleteUser('${safeKey}')">Cancella</button>
                    </td>
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid var(--vscode-input-border); padding: 4px; text-align: center; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
                    border: 1px solid black; padding: 6px 12px; cursor: pointer; width: 100%; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                .in-uso { color: var(--vscode-terminal-ansiGreen); font-weight: bold; }
                .msg { margin-top: 8px; font-size: 12px; }
            </style>
        </head>
        <body>
            <button onclick="refresh()">🔄 Refresh</button>
            <h3>Gestione Utenti</h3>
            <table>
                <thead>
                    <tr>
                        <th>Chiave</th>
                        <th>Nome</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <script>
                const vscode = acquireVsCodeApi();
                function deleteUser(key) { vscode.postMessage({ command: 'deleteUser', key }); }
                function editUser(key) { vscode.postMessage({ command: 'editUser', key }); }
                function setActive(key) { vscode.postMessage({ command: 'setActive', key }); }
                function refresh() { vscode.postMessage({ command: 'refresh' }); }
            </script>
        </body>
        </html>`;
    }

    // Mostra la sidebar dell'estensione AI Commenter in Visual Studio Code.
    public static show() {
        vscode.commands.executeCommand('workbench.view.extension.scribe-sidebar');
    }
}