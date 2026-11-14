import { ptBRDialogue } from './locales/pt-BR.dialogue';
import { ptBR, type MessageKey } from './locales/pt-BR';

export type { MessageKey };
export type Locale = 'pt-BR' | 'en' | 'es';
export type Messages = Partial<Record<MessageKey, string>>;

const dictionaries: Partial<Record<Locale, Messages>> = { 'pt-BR': ptBR };
let current: Locale = 'pt-BR';

/** Registers a translation (English and Spanish arrive in stage 8). Missing keys fall back to Portuguese. */
export function registerLocale(locale: Locale, messages: Messages): void {
  dictionaries[locale] = messages;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Translates a key and fills {placeholders}. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = dictionaries[current]?.[key] ?? ptBR[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}


const dialogues: Partial<Record<Locale, Record<string, readonly string[]>>> = { 'pt-BR': ptBRDialogue };

/** All the lines of a dialogue group (villager speech). Empty when the group does not exist. */
export function lines(key: string): readonly string[] {
  return dialogues[current]?.[key] ?? ptBRDialogue[key] ?? [];
}

/** Fills {placeholders} in a line. */
export function fill(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
