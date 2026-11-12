import { CHARACTERS } from '@fuzue/shared';

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} não existe`);
  return el;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** Bolinha com a inicial e a cor do personagem. */
export function avatar(name: string, character: number, cls = 'ava'): string {
  const c = CHARACTERS[character] ?? CHARACTERS[0];
  return `<span class="${cls}" style="--pc:${c.color}" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
}

/** Atualiza o HTML só quando muda (evita piscar e perder foco). */
export function setHtml(el: HTMLElement, html: string): void {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}

/** Copia um texto; se o navegador não deixar, devolve false. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
