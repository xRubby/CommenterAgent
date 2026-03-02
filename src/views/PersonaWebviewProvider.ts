import * as vscode from 'vscode';
import { DatabaseManager } from '../db';
import { Persona } from '../entities/persona';

export class PersonaWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-commenter.personaView';

    constructor(private readonly dbManager: DatabaseManager) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'addPersona') {
                const { key, nome, lingua, tono, esempi } = msg.data;
                try {
                    const esempiArray = esempi.split(',').map((e: string) => e.trim()).filter(Boolean);
                    const persona = new Persona(nome, lingua, tono, esempiArray);
                    this.dbManager.addPersona(key, persona);
                    webviewView.webview.postMessage({ command: 'success' });
                    vscode.window.showInformationMessage(`Persona "${nome}" aggiunta!`);
                } catch (e: any) {
                    webviewView.webview.postMessage({ command: 'error', message: e.message });
                }
            }
        });
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { padding: 10px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                input, textarea { width: 100%; margin-bottom: 8px; background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);
                    padding: 4px; box-sizing: border-box; }
                label { font-size: 11px; display: block; margin-bottom: 2px; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
                    border: none; padding: 6px 12px; cursor: pointer; width: 100%; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                .msg { margin-top: 8px; font-size: 12px; }
                .ok { color: var(--vscode-terminal-ansiGreen); }
                .err { color: var(--vscode-errorForeground); }
            </style>
        </head>
        <body>
            <h3>➕ Nuova Persona</h3>
            <label>Chiave (ID univoco)</label>
            <input id="key" placeholder="es. mario" />
            <label>Nome</label>
            <input id="nome" placeholder="es. Mario Rossi" />
            <label>Lingua</label>
            <input id="lingua" placeholder="es. Italiano" />
            <label>Tono</label>
            <input id="tono" placeholder="es. Ironico e diretto" />
            <label>Esempi (separati da virgola)</label>
            <textarea id="esempi" rows="3" placeholder="es. // roba inutile, // già fatto mille volte"></textarea>
            <button onclick="submit()">Aggiungi Persona</button>
            <div id="msg" class="msg"></div>
            <script>
                const vscode = acquireVsCodeApi();
                function submit() {
                    vscode.postMessage({ command: 'addPersona', data: {
                        key: document.getElementById('key').value,
                        nome: document.getElementById('nome').value,
                        lingua: document.getElementById('lingua').value,
                        tono: document.getElementById('tono').value,
                        esempi: document.getElementById('esempi').value,
                    }});
                }
                window.addEventListener('message', e => {
                    const msg = document.getElementById('msg');
                    if (e.data.command === 'success') {
                        msg.className = 'msg ok';
                        msg.textContent = '✅ Persona aggiunta!';
                        ['key','nome','lingua','tono','esempi'].forEach(id => document.getElementById(id).value = '');
                    } else if (e.data.command === 'error') {
                        msg.className = 'msg err';
                        msg.textContent = '❌ ' + e.data.message;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}