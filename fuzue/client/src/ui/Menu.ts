import { CHARACTERS, CODE_LENGTH, normalizeCode, sanitizeName } from '@fuzue/shared';
import { sound } from '../audio/sound';
import { $ } from './dom';

const STORE_KEY = 'fuzue:perfil';

interface Profile { name: string; character: number }

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      const ch = Number(p.character);
      return { name: typeof p.name === 'string' ? p.name : '', character: ch >= 0 && ch < CHARACTERS.length ? ch : 0 };
    }
  } catch { /* armazenamento bloqueado: segue sem lembrar */ }
  return { name: '', character: Math.floor(Math.random() * CHARACTERS.length) };
}

export function saveProfile(p: Profile): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* ignora */ }
}

export interface MenuHandlers {
  onCreate(name: string, character: number): void;
  onJoin(code: string, name: string, character: number): void;
  onCharacter(index: number): void;
}

/** Tela inicial: apelido, personagem e criar/entrar numa sala. */
export class Menu {
  private root = $('menu');
  private nameInput = $('nameInput') as HTMLInputElement;
  private grid = $('charGrid');
  private primary = $('primaryBtn') as HTMLButtonElement;
  private title = $('menuTitle');
  private joinRow = $('joinRow');
  private newRoom = $('newRoomLink') as HTMLAnchorElement;
  private codeInput = $('codeInput') as HTMLInputElement;
  private status = $('menuStatus');
  private error = $('menuError');
  readonly profile = loadProfile();
  private joinCode: string | null = null;
  private busy = false;

  constructor(private h: MenuHandlers) {
    this.nameInput.value = this.profile.name;
    this.grid.innerHTML = CHARACTERS.map((c, i) => `
      <button type="button" class="char" data-i="${i}" style="--pc:${c.color};--pb:${c.belly}" aria-pressed="false">
        <span class="swatch" aria-hidden="true"></span><span>${c.name}</span>
      </button>`).join('');
    this.grid.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-i]');
      if (!b) return;
      sound.unlock();
      sound.play('click');
      this.pick(Number(b.dataset.i));
    });
    this.pick(this.profile.character);

    $('menuForm').addEventListener('submit', e => {
      e.preventDefault();
      sound.unlock();
      if (this.busy) return;
      const name = this.readName();
      if (!name) return;
      if (this.joinCode) this.h.onJoin(this.joinCode, name, this.profile.character);
      else this.h.onCreate(name, this.profile.character);
    });
    $('codeForm').addEventListener('submit', e => {
      e.preventDefault();
      sound.unlock();
      if (this.busy) return;
      const code = normalizeCode(this.codeInput.value);
      if (!code) {
        this.showError(`O código tem ${CODE_LENGTH} caracteres, como K7QX.`);
        this.codeInput.focus();
        return;
      }
      const name = this.readName();
      if (name) this.h.onJoin(code, name, this.profile.character);
    });
    this.newRoom.addEventListener('click', e => {
      e.preventDefault();
      history.replaceState(null, '', '/');
      this.setJoinCode(null);
    });
  }

  private pick(i: number): void {
    this.profile.character = i;
    this.grid.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.i) === i));
    });
    this.h.onCharacter(i);
  }

  private readName(): string | null {
    const raw = this.nameInput.value.trim();
    if (!raw) {
      this.showError('Escolha um apelido para os amigos te reconhecerem.');
      this.nameInput.focus();
      return null;
    }
    this.profile.name = sanitizeName(raw);
    saveProfile(this.profile);
    return this.profile.name;
  }

  setJoinCode(code: string | null): void {
    this.joinCode = code;
    this.title.textContent = code ? `Te chamaram para a sala ${code}` : 'Jogar com os amigos';
    this.primary.textContent = code ? `Entrar na sala ${code}` : 'Criar sala';
    this.joinRow.hidden = !!code;
    this.newRoom.hidden = !code;
  }

  setBusy(busy: boolean, label?: string): void {
    this.busy = busy;
    this.primary.disabled = busy;
    if (busy && label) this.primary.textContent = label;
    if (!busy) {
      this.setJoinCode(this.joinCode);
      this.setStatus(null);
    }
  }

  setStatus(text: string | null): void {
    this.status.hidden = !text;
    this.status.textContent = text ?? '';
  }

  showError(text: string): void {
    this.error.textContent = text;
    this.error.hidden = false;
  }

  show(): void {
    this.root.hidden = false;
    this.error.hidden = true;
    // no celular não foca sozinho: abriria o teclado por cima de tudo
    if (!this.nameInput.value && window.matchMedia('(pointer: fine)').matches) this.nameInput.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }
}
