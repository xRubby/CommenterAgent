import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Persona } from './entities/persona';

export interface PersonaDB {
  [key: string]: Persona;
}

export class DatabaseManager {
  private dbPath: string;

  constructor(context: vscode.ExtensionContext) {
    const storageUri = context.globalStorageUri;
    if (!fs.existsSync(storageUri.fsPath)) {
      fs.mkdirSync(storageUri.fsPath, { recursive: true });
    }
    this.dbPath = path.join(storageUri.fsPath, 'persona.json');
  }

  // Carica tutto il database — deserializza JSON → istanze Persona
  public load(): PersonaDB {
    if (!fs.existsSync(this.dbPath)) {
      const defaultDb: PersonaDB = {
        default: new Persona('Dev Standard', 'Italiano', 'Conciso e tecnico', ['// Fix bug', '// Refactoring'])
      };
      this.save(defaultDb);
      return defaultDb;
    }

    const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));

    // Converte ogni oggetto grezzo in un'istanza Persona
    const db: PersonaDB = {};
    for (const key in raw) {
      const p = raw[key];
      db[key] = new Persona(p.nome, p.lingua, p.tono, p.esempi);
    }
    return db;
  }

  // Salva tutto il database — serializza istanze Persona → JSON
  public save(db: PersonaDB): void {
    const raw: Record<string, object> = {};
    for (const key in db) {
      raw[key] = db[key].toJSON(); // usa toJSON() per serializzare
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(raw, null, 4));
  }

  // Aggiorna una singola persona aggiungendo un esempio
  public updatePersona(key: string, newExample: string): void {
    const db = this.load();
    if (db[key]) {
      db[key].addEsempio(newExample);         // usa il metodo della classe
      if (db[key].esempi.length > 5) {
        db[key].removeEsempio(0);             // rimuove il più vecchio
      }
      this.save(db);
    }
  }

  // Aggiunge un nuovo profilo
  public addPersona(key: string, persona: Persona): void {
    const db = this.load();
    db[key] = persona;
    this.save(db);
  }
}