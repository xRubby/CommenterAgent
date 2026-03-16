import { HfInference } from '@huggingface/inference';
import * as vscode from 'vscode';
import { Persona } from '../entities/persona';

const MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';



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
                    Language to use for comments: ${persona.lingua}.
                    Tone: ${persona.tono}.
                    Examples of desired style: ${persona.esempi.join(' | ')}.
                    
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
                    content: `Generate a single inline comment for this ${langId} code:\n\n${code}\n\nReply with ONLY the comment text.`
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