import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Persona, PersonaDB } from './entities/persona';

export class DatabaseManager {
  private dbPath: string;

  constructor(context: vscode.ExtensionContext) {
    const storageUri = context.globalStorageUri;
    if (!fs.existsSync(storageUri.fsPath)) {
      fs.mkdirSync(storageUri.fsPath, { recursive: true });
    }
    this.dbPath = path.join(storageUri.fsPath, 'persona.json');
  }


  public load(): PersonaDB {
    if (!fs.existsSync(this.dbPath)) {
        return {
            default: new Persona('Dev Standard', 'Italiano', 'Conciso e tecnico', ['// Fix bug', '// Refactoring'], true)
        };
    }

    const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
    const db: PersonaDB = {};
    for (const key in raw) {
        const p = raw[key];
        db[key] = new Persona(p.nome, p.lingua, p.tono, p.esempi, p.active ?? false);
    }
    return db;
  }


  public save(db: PersonaDB): void {
    const raw: Record<string, object> = {};
    for (const key in db) {
      raw[key] = db[key].toJSON();
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(raw, null, 4));
  }

  public updatePersona(key: string, newExample: string): void {
    const db = this.load();
    if (db[key]) {
      db[key].addEsempio(newExample);       
      if (db[key].esempi.length > 5) {
        db[key].removeEsempio(0);            
      }
      this.save(db);
    }
  }


  public addPersona(key: string, persona: Persona): void {
    const db = this.load();
    if (db[key]) {throw new Error(`Persona con chiave '${key}' esiste già`);}   
    db[key] = persona;
    this.save(db);
  }

  public setActivePersona(key: string): void {
    const db = this.load();
    if (!db[key]) {throw new Error(`Persona '${key}' non trovata`);}

  
    const current = Object.values(db).find(p => p.active);
    if (current) {current.active = false;}

    db[key].active = true;
    this.save(db);
  }

  public getActivePersona(): { key: string; persona: Persona } | null {
      const db = this.load();
      const entry = Object.entries(db).find(([, p]) => p.active);
      if (!entry) {return null;}
      return { key: entry[0], persona: entry[1] };
  }
}
