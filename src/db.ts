import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Persona {
    nome: string;
    lingua: string;
    tono: string;
    esempi: string[];
}

export interface PersonaDB {
    [key: string]: Persona;
}

export class DatabaseManager {
    private dbPath: string;

    constructor(context: vscode.ExtensionContext) {
        const storageUri = context.globalStorageUri;
        // Crea la cartella di storage se non esiste
        if (!fs.existsSync(storageUri.fsPath)) {
            fs.mkdirSync(storageUri.fsPath, { recursive: true });
        }
        this.dbPath = path.join(storageUri.fsPath, 'persona.json');
    }

    // Carica tutto il database
    public load(): PersonaDB {
        if (!fs.existsSync(this.dbPath)) {
            const defaultDb: PersonaDB = {
                "default": {
                    nome: "Dev Standard",
                    lingua: "Italiano",
                    tono: "Conciso e tecnico",
                    esempi: ["// Fix bug", "// Refactoring"]
                }
            };
            this.save(defaultDb);
            return defaultDb;
        }
        return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
    }

    // Salva tutto il database
    public save(db: PersonaDB): void {
        fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 4));
    }

    // Aggiorna una singola persona (aggiungendo esempi)
    public updatePersona(key: string, newExample: string): void {
        const db = this.load();
        if (db[key]) {
            db[key].esempi.push(newExample);
            if (db[key].esempi.length > 5) {
                db[key].esempi.shift(); // Rimuove il più vecchio
            }
            this.save(db);
        }
    }

    // Aggiunge un nuovo profilo vuoto
    public addPersona(key: string, persona: Persona): void {
        const db = this.load();
        db[key] = persona;
        this.save(db);
    }
}