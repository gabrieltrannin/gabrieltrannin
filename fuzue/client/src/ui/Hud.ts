import { CHARACTERS } from '@fuzue/shared';
import { copyText, escapeHtml, toast } from './toast';

export interface HudPlayer {
  id: string;
  name: string;
  character: number;
  ping: number;
  falls: number;
  hits: number;
  me: boolean;
  host: boolean;
}

/** Interface durante a partida: código da sala, link, jogadores e controles. */
export class Hud {
  private root = document.getElementById('hud')!;
  private codeEl = document.getElementById('roomCode')!;
  private listEl = document.getElementById('playerList')!;
  private aloneEl = document.getElementById('aloneCard')!;
  private aloneLink = document.getElementById('aloneLink') as HTMLInputElement;
  private link = '';

  constructor(onLeave: () => void) {
    document.getElementById('leaveBtn')!.addEventListener('click', onLeave);
    const copy = async (btn: HTMLElement) => {
      if (await copyText(this.link)) {
        toast('Link copiado. Agora é só mandar no grupo!');
      } else {
        this.aloneEl.hidden = false;
        this.aloneLink.focus();
        this.aloneLink.select();
        toast('Não consegui copiar sozinho. O link está selecionado: use Ctrl+C.');
      }
      btn.blur();
    };
    document.getElementById('copyBtn')!.addEventListener('click', e => copy(e.currentTarget as HTMLElement));
    document.getElementById('aloneCopy')!.addEventListener('click', e => copy(e.currentTarget as HTMLElement));
  }

  show(code: string): void {
    this.link = `${location.origin}/sala/${code}`;
    this.codeEl.textContent = code;
    this.aloneLink.value = this.link;
    this.listEl.innerHTML = '';
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  setPlayers(players: HudPlayer[]): void {
    this.aloneEl.hidden = players.length > 1;
    this.listEl.innerHTML = players.map(p => {
      const ch = CHARACTERS[p.character] ?? CHARACTERS[0];
      const badges = [p.me ? 'você' : '', p.host ? 'anfitrião' : ''].filter(Boolean).join(' · ');
      return `<li style="--pc:${ch.color}">
        <span class="ava" aria-hidden="true">${escapeHtml(p.name.charAt(0).toUpperCase())}</span>
        <span class="who"><b>${escapeHtml(p.name)}</b><small>${ch.name}${badges ? ` · ${badges}` : ''}</small></span>
        <span class="stat" title="Quedas na água">${p.falls} ${p.falls === 1 ? 'queda' : 'quedas'}</span>
        <span class="ms" title="Ping">${p.ping} ms</span>
      </li>`;
    }).join('');
  }
}
