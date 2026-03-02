/* eslint-disable curly */
export class Persona {
    private _nome: string;
    private _lingua: string;
    private _tono: string;
    private _esempi: string[];

    constructor(nome: string, lingua: string, tono: string, esempi: string[]) {
        this._nome = nome;
        this._lingua = lingua;
        this._tono = tono;
        this._esempi = esempi;
    }

    public get nome(): string {
        return this._nome;
    }
    public set nome(value: string) {
        if (!value || value.trim() === '') throw new Error('Nome non può essere vuoto');
        this._nome = value.trim();
    }

    public get lingua(): string {
        return this._lingua;
    }
    public set lingua(value: string) {
        if (!value || value.trim() === '') throw new Error('Lingua non può essere vuota');
        this._lingua = value.trim();
    }

    public get tono(): string {
        return this._tono;
    }
    public set tono(value: string) {
        if (!value || value.trim() === '') throw new Error('Tono non può essere vuoto');
        this._tono = value.trim();
    }

    public get esempi(): string[] {
        return [...this._esempi];
    }
    public set esempi(value: string[]) {
        this._esempi = [...value];
    }

    public addEsempio(esempio: string): void {
        if (esempio.trim() === '') throw new Error('Esempio non può essere vuoto');
        this._esempi.push(esempio.trim());
    }

    public removeEsempio(index: number): void {
        if (index < 0 || index >= this._esempi.length) throw new Error('Indice non valido');
        this._esempi.splice(index, 1);
    }

    public toJSON(): object {
        return {
            nome: this._nome,
            lingua: this._lingua,
            tono: this._tono,
            esempi: [...this._esempi],
        };
    }
}