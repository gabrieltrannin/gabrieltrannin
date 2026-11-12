/** Mensagens curtas no topo da tela. */
export function toast(text: string, tone: 'good' | 'bad' | 'info' = 'info', ms = 2800): void {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast card ${tone}`;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild?.remove();
  window.setTimeout(() => {
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 300);
  }, ms);
}
