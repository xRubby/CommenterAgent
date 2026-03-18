import { HfInference } from '@huggingface/inference';
import * as vscode from 'vscode';
import { Persona } from '../entities/persona';

const MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';



// Chiamata all'API AI per generare un commento inline per il codice fornito. Restituisce una stringa con il commento generato.
export async function callAI(code: string, langId: string, persona: Persona): Promise<string> {
    const apiKey = await getApiKey();

    const client = new HfInference(apiKey);

    try {
        const response = await client.chatCompletion({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Sei ${persona.nome}. Scrivi UN SOLO commento in-line per il codice seguente.

                    LINGUA OBBLIGATORIA: ${persona.lingua}
                    → Scrivi il commento ESCLUSIVAMENTE in ${persona.lingua}.
                    → Se hai dubbi sulla lingua, scrivi in ${persona.lingua} e basta — non chiedere conferma.

                    TONO: ${persona.tono}

                    STILE — analizza questi esempi di ${persona.nome} e identifica:
                    1. Come iniziano i commenti (soggetto fisso, verbo diretto, ecc.)
                    2. Il livello di formalità del linguaggio
                    3. La lunghezza tipica

                    Esempi:
                    ${persona.esempi.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}

                    Replica ESATTAMENTE quella struttura.
                    Se tutti gli esempi iniziano con la stessa parola o frase, il tuo commento DEVE iniziare allo stesso modo.
                    Non usare il tuo stile di default — attieniti al pattern degli esempi.

                    Linguaggio di programmazione: ${langId}
                    REGOLE:
                    - Restituisci SOLO il testo del commento, con il prefisso corretto (// o # ecc.)
                    - Niente spiegazioni, niente virgolette, niente testo extra
                    - Se hai dubbi sulla struttura, segui l'esempio più vicino al codice che stai commentando`
                },
                {
                    role: 'user',
                    content: `Codice ${langId}:\n\n${code}`
                }
            ],
            max_tokens: 80,
            temperature: 0.2,
        });

        const text = response.choices[0]?.message?.content?.trim() ?? '';
        return text.replace(/^\/\/\s*/, '').replace(/^#\s*/, '').replace(/^\/\*+\s*/, '').trim();

    } catch (error: any) {
        vscode.window.showErrorMessage('Errore Hugging Face: ' + error.message);
        return '';
    }
}

export async function getApiKey(){
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
    return apiKey;
}