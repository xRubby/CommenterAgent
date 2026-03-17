import * as vscode from 'vscode';

export interface DetectedSymbol {
    line: number;
    name: string;
    kind: 'function' | 'method' | 'class' | 'arrow' | 'constructor';
    snippet: string;
}

// Definisce i pattern per rilevare classi, metodi e funzioni in vari linguaggi di programmazione.
const PATTERNS: Record<string, { regex: RegExp; kind: DetectedSymbol['kind'] }[]> = {
    typescript: [
        { regex: /^\s*(export\s+)?(default\s+)?class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|protected|static|async|\s)*\s*(constructor)\s*\(/, kind: 'constructor' },
        { regex: /^\s*(public|private|protected|static|async|\s)*\s*(\w+)\s*\([^)]*\)\s*[:{]/, kind: 'method' },
        { regex: /^\s*(export\s+)?(async\s+)?function\s*\*?\s*(\w+)\s*[\(<]/, kind: 'function' },
        { regex: /^\s*(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s*)?\(/, kind: 'arrow' },
    ],
    javascript: [
        { regex: /^\s*class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(async\s+)?function\s*\*?\s*(\w+)\s*\(/, kind: 'function' },
        { regex: /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(/, kind: 'arrow' },
        { regex: /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/, kind: 'method' },
    ],
    python: [
        { regex: /^\s*class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*def\s+(__init__)\s*\(/, kind: 'constructor' },
        { regex: /^\s*(async\s+)?def\s+(\w+)\s*\(/, kind: 'function' },
    ],
    c: [
        { regex: /^\s*struct\s+(\w+)\s*\{/, kind: 'class' },
        { regex: /^\s*(static\s+|inline\s+|extern\s+)*(unsigned\s+|const\s+)?\w+[\w\s\*]*\s+(\w+)\s*\([^;]*\)\s*\{?$/, kind: 'function' },
    ],

    cpp: [
        { regex: /^\s*(class|struct)\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(\w+)\s*::\s*(\w+)\s*\(/, kind: 'method' },
        { regex: /^\s*(explicit\s+)?(\w+)\s*\((?!.*=\s*0)/, kind: 'constructor' },
        { regex: /^\s*(virtual\s+|static\s+|inline\s+|override\s+)*(const\s+)?\w[\w\s\*&<>]*\s+(\w+)\s*\(/, kind: 'method' },
        { regex: /^\s*(static\s+|inline\s+|extern\s+)*(const\s+)?\w+[\w\s\*]*\s+(\w+)\s*\([^;]*\)\s*\{?$/, kind: 'function' },
    ],

    rust: [
        { regex: /^\s*(pub\s+)?(struct|enum)\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(pub\s+)?(async\s+)?fn\s+(\w+)\s*[\(<]/, kind: 'function' },
        { regex: /^\s*impl\s+(\w+)/, kind: 'class' },
    ],

    go: [
        { regex: /^\s*type\s+(\w+)\s+struct/, kind: 'class' },
        { regex: /^\s*func\s+\((\w+)\s+\*?(\w+)\)\s+(\w+)\s*\(/, kind: 'method' },
        { regex: /^\s*func\s+(\w+)\s*\(/, kind: 'function' },
    ],

    java: [
        { regex: /^\s*(public|private|protected)?\s*(abstract\s+)?class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|protected)?\s*(\w+)\s*\((?!.*return)/, kind: 'constructor' },
        { regex: /^\s*(public|private|protected|static|final|synchronized|\s)+\w[\w<>\[\]]*\s+(\w+)\s*\(/, kind: 'method' },
    ],

    csharp: [
        { regex: /^\s*(public|private|protected|internal)?\s*(abstract\s+|static\s+)?class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|protected|static|virtual|override|async|\s)+\w[\w<>\[\]]*\s+(\w+)\s*\(/, kind: 'method' },
    ],

    php: [
        { regex: /^\s*(abstract\s+)?class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|protected|static|\s)*\s*function\s+(\w+)\s*\(/, kind: 'method' },
    ],

    ruby: [
        { regex: /^\s*class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*def\s+(initialize)/, kind: 'constructor' },
        { regex: /^\s*def\s+(\w+)/, kind: 'function' },
    ],

    swift: [
        { regex: /^\s*(public|private|internal|open)?\s*class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|internal|open)?\s*struct\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(public|private|internal|open|override|\s)*(func)\s+(\w+)\s*[\(<]/, kind: 'function' },
        { regex: /^\s*init\s*\(/, kind: 'constructor' },
    ],

    kotlin: [
        { regex: /^\s*(data\s+|open\s+|abstract\s+)?class\s+(\w+)/, kind: 'class' },
        { regex: /^\s*(override\s+)?(fun)\s+(\w+)\s*[\(<]/, kind: 'function' },
        { regex: /^\s*constructor\s*\(/, kind: 'constructor' },
    ],
};

const FALLBACK = PATTERNS['c'];

// Determina il simbolo nella linea specificata del documento e 
// restituisce un oggetto DetectedSymbol o null se non viene trovato alcun simbolo.
export function detectSymbolAtLine(
    document: vscode.TextDocument,
    lineNumber: number
): DetectedSymbol | null {
    const line = document.lineAt(lineNumber).text;
    const patterns = PATTERNS[document.languageId] ?? FALLBACK;

    for (const { regex, kind } of patterns) {
        const match = regex.exec(line);
        if (!match) {continue;}

        const name = [...match].reverse().find(g => g && /^\w+$/.test(g)) ?? 'unknown';

        const snippet = extractFullBlock(document, lineNumber);

        return { line: lineNumber, name, kind, snippet };
    }

    return null;
}

// Determina se una linea è già commentata. Restituisce `true` se la linea precedente inizia con un commento.
export function isAlreadyCommented(document: vscode.TextDocument, lineNumber: number): boolean {
    if (lineNumber === 0) {return false;}
    const prev = document.lineAt(lineNumber - 1).text.trim();
    return prev.startsWith('//') || prev.startsWith('*') || prev.startsWith('/*')
        || prev.startsWith('#') || prev.startsWith('"""');
}

// Determina il prefisso del commento in base all'ID del linguaggio.
export function getCommentPrefix(languageId: string): string {
    const hashLangs = ['python', 'ruby', 'bash', 'shellscript', 'r'];
    return hashLangs.includes(languageId) ? '# ' : '// ';
}

// Estrae un blocco completo di codice dal documento in base al linguaggio e alla riga di partenza.
function extractFullBlock(document: vscode.TextDocument, startLine: number): string {
    const langId = document.languageId;

    if (['python', 'ruby'].includes(langId)) {
        return extractByIndentation(document, startLine);
    }

    return extractByBraces(document, startLine);
}

const MAX_LINES = 160;

// Estrae il testo tra parentesi graffe a partire dalla linea specificata. Restituisce il contenuto estratto come una stringa.
function extractByBraces(document: vscode.TextDocument, startLine: number): string {
    const lines: string[] = [];
    let depth = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i < document.lineCount && lines.length < MAX_LINES; i++) {
        const text = document.lineAt(i).text;
        lines.push(text);

        for (const char of text) {
            if (char === '{') { depth++; foundOpenBrace = true; }
            if (char === '}') { depth--; }
        }

        if (foundOpenBrace && depth === 0) {break;}
    }

    return lines.join('\n');
}



// Estrae le righe di un documento partendo dalla linea specificata fino alla fine 
// o al raggiungimento del numero massimo di linee, mantenendo solo quelle con 
// indentation maggiore della linea di partenza. Restituisce una stringa con tutte le righe concatenate.
function extractByIndentation(document: vscode.TextDocument, startLine: number): string {
    const lines: string[] = [];

    const baseIndent = document.lineAt(startLine).text.match(/^(\s*)/)?.[1].length ?? 0;
    lines.push(document.lineAt(startLine).text);

    for (let i = startLine + 1; i < document.lineCount && lines.length < MAX_LINES; i++) {
        const text = document.lineAt(i).text;
        const isEmpty = text.trim() === '';

        if (!isEmpty) {
            const indent = text.match(/^(\s*)/)?.[1].length ?? 0;
            if (indent <= baseIndent) {break;}
        }

        lines.push(text);
    }

    return lines.join('\n');
}