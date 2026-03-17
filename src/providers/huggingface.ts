import { HfInference } from '@huggingface/inference';
import * as vscode from 'vscode';
import { Persona } from '../entities/persona';

const MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';



// Chiamata all'API AI per generare un commento inline per il codice fornito. Restituisce una stringa con il commento generato.
export async function callAI(code: string, langId: string, persona: Persona): Promise<string> {
    const config = vscode.workspace.getConfiguration('aiCommenter');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        const selection = await vscode.window.showErrorMessage('Hugging Face API Key mancante!', 'Apri Impostazioni');
        if (selection === 'Apri Impostazioni') {
            vscode.commands.executeCommand('workbench.action.openSettings');
        }
        return '';
    }

    const client = new HfInference(apiKey);

    try {
        const response = await client.chatCompletion({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a code documentation expert named ${persona.nome}.
                    CRITICAL RULE: You MUST write ALL comments exclusively in ${persona.lingua}. 
                    Never use English. Every single word must be in ${persona.lingua}.

                    Language: ${persona.lingua} (MANDATORY - no exceptions)
                    Tone: ${persona.tono}.
                    Examples of desired style: ${persona.esempi.join(' | ')}.
                    
                    Generate a single concise inline comment for the given code.
                    Rules:
                    - Output ONLY the comment text, nothing else
                    - No code, no markdown, no comment symbols (// or #)
                    - Max 120 characters
                    - Language MUST be ${persona.lingua} — this is non-negotiable
                    - Present tense: "Calculates...", "Returns...", "Handles..."
                    - For functions/methods: what it does and returns
                    - For classes: its purpose`
                },
                {
                    role: 'user',
                    content: `Generate a single inline comment in ${persona.lingua} for this ${langId} code:\n\n${code}\n\nReply with ONLY the comment text in ${persona.lingua}.`
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