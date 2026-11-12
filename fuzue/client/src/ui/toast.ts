/** Mensagens curtas no topo da tela. */
export function toast(text: string, ms = 2600): void {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast card';
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild?.remove();
  window.setTimeout(() => {
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 300);
  }, ms);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
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
