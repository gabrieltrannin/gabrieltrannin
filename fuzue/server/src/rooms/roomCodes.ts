import { CODE_ALPHABET, CODE_LENGTH } from '@fuzue/shared';

/** Códigos em uso neste processo. Com um só servidor isso basta. */
const inUse = new Set<string>();

export function reserveCode(): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!inUse.has(code)) {
      inUse.add(code);
      return code;
    }
  }
  throw new Error('Não há códigos de sala livres.');
}

export function releaseCode(code: string): void {
  inUse.delete(code);
}
