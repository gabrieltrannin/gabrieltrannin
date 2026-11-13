import './style.css';
import type { Room } from 'colyseus.js';
import { MSG, normalizeCode, type SaidMsg } from '@fuzue/shared';
import { sound } from './audio/sound';
import { disposeScene } from './engine/dispose';
import { Input } from './engine/Input';
import { Stage } from './engine/Stage';
import { clearToken, createRoom, friendlyError, isVersionError, joinRoom, loadToken, reconnect, wakeServer } from './net/connection';
import { Net } from './net/Net';
import type { NetState } from './net/types';
import { Chat } from './ui/Chat';
import { $ } from './ui/dom';
import { Menu } from './ui/Menu';
import { toast } from './ui/toast';
import { BoardView } from './views/BoardView';
import { FinalView } from './views/FinalView';
import { LobbyView } from './views/LobbyView';
import { MenuView } from './views/MenuView';
import { MinigameView } from './views/MinigameView';
import type { Ctx, RoomView } from './views/types';

declare const __APP_VERSION__: string;

type Kind = 'lobby' | 'board' | 'minigame' | 'final';

/** Liga menu, conexão e telas da partida. */
class App {
  private stage = new Stage($('scene') as HTMLCanvasElement, $('fx'));
  private input = new Input($('stick'), $('knob'), $('pushBtn'), $('jumpBtn'), $('scene'));
  private menuView = new MenuView(this.stage.camera);
  private chat = new Chat();
  private net: Net | null = null;
  private view: RoomView | null = null;
  private kind: Kind | null = null;
  private mgId = '';
  private board: BoardView | null = null;
  private menu: Menu;

  constructor() {
    // diagnóstico só no modo de desenvolvimento (contagem de triângulos, etc.)
    if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = this.stage;
    this.menu = new Menu({
      onCreate: (name, ch) => void this.connect(() => createRoom(name, ch)),
      onJoin: (code, name, ch) => void this.connect(() => joinRoom(code, name, ch), code),
      onCharacter: i => this.menuView.setCharacter(i),
    });
    this.setupCorner();
    this.setupUpdateCheck();
    document.addEventListener('pointerdown', () => { sound.unlock(); sound.music(this.kind === 'minigame' ? 'fast' : 'calm'); }, { once: true });
    void this.boot();
  }

  /* ---------------- início ---------------- */

  private async boot(): Promise<void> {
    const match = location.pathname.match(/^\/sala\/([^/]+)\/?$/i);
    const code = match ? normalizeCode(decodeURIComponent(match[1])) : null;
    if (match && !code) history.replaceState(null, '', '/');
    this.menu.setJoinCode(code);
    this.showMenu();
    // recarregou a página no meio da partida? volta direto para ela
    const token = code ? loadToken(code) : null;
    if (code && token) {
      this.menu.setBusy(true, 'Voltando para a partida…');
      try {
        await wakeServer(s => this.menu.setStatus(slowText(s)), 30);
        const room = await reconnect(token);
        this.enterRoom(room);
        return;
      } catch {
        clearToken();
        this.menu.setBusy(false);
      }
    }
  }

  private showMenu(): void {
    document.body.dataset.scene = 'menu';
    this.menuView.setCharacter(this.menu.profile.character);
    this.stage.show(this.menuView);
    this.menu.show();
    this.chat.setVisible(false);
    $('leaveBtn').hidden = true;
  }

  private async connect(open: () => Promise<Room>, code?: string): Promise<void> {
    this.menu.setBusy(true, code ? 'Entrando…' : 'Criando sala…');
    this.menu.setStatus(null);
    const awake = await wakeServer(s => this.menu.setStatus(slowText(s)));
    if (!awake) {
      this.menu.setBusy(false);
      this.menu.showError('O servidor do jogo não respondeu. Tente de novo daqui a pouco.');
      return;
    }
    try {
      const room = await open();
      this.enterRoom(room);
    } catch (err) {
      this.menu.setBusy(false);
      this.menu.showError(friendlyError(err, code));
      if (isVersionError(err)) reloadOnce();
    }
  }

  /* ---------------- dentro da sala ---------------- */

  private enterRoom(room: Room): void {
    this.menu.setBusy(false);
    this.menu.hide();
    const net = new Net(room);
    this.net = net;
    history.replaceState(null, '', `/sala/${net.code}`);
    document.title = `Sala ${net.code} · Fuzuê`;
    $('leaveBtn').hidden = false;
    this.chat.attach(net);
    net.onClosed = reason => this.leftRoom(reason);
    net.onReconnecting = on => { $('reconnect').hidden = !on; };
    net.onState(s => this.onState(s));
    net.on<SaidMsg>(MSG.said, m => this.view?.said?.(m.from, m.text, m.emote));
    sound.play('turn');
  }

  private ctx(): Ctx {
    return { stage: this.stage, net: this.net!, input: this.input };
  }

  private onState(s: NetState): void {
    const kind: Kind = s.phase === 'lobby' ? 'lobby'
      : s.phase === 'order' || s.phase === 'board' ? 'board'
      : s.phase === 'minigame' ? 'minigame' : 'final';
    if (kind !== this.kind || (kind === 'minigame' && s.mg.id !== this.mgId)) {
      let next: RoomView;
      if (kind === 'lobby') next = new LobbyView(this.ctx());
      else if (kind === 'board') next = this.board ??= new BoardView(this.ctx());
      else if (kind === 'minigame' && s.mg.id) { next = new MinigameView(this.ctx(), s.mg.id); this.mgId = s.mg.id; }
      else next = new FinalView(this.ctx());
      if (kind === 'lobby' && this.kind === 'final') this.disposeBoard();
      this.switchTo(next, kind);
    }
    this.chat.setVisible(kind !== 'minigame');
    this.view?.onState(s);
  }

  private switchTo(next: RoomView, kind: Kind): void {
    const prev = this.view;
    prev?.exit();
    if (prev && prev !== this.board) disposeScene(prev.scene);
    this.view = next;
    this.kind = kind;
    next.enter();
    this.stage.show(next);
    if (kind !== 'minigame') sound.music('calm');
  }

  private disposeBoard(): void {
    if (this.board && this.board !== this.view) disposeScene(this.board.scene);
    this.board = null;
  }

  private leftRoom(reason: string | null): void {
    const code = this.net?.code ?? null;
    this.view?.exit();
    if (this.view && this.view !== this.board) disposeScene(this.view.scene);
    this.view = null;
    this.kind = null;
    this.disposeBoard();
    this.net = null;
    this.chat.attach(null);
    this.input.setEnabled(false);
    $('reconnect').hidden = true;
    $('confirm').hidden = true;
    document.title = 'Fuzuê';
    if (reason) {
      this.menu.setJoinCode(code);
      this.showMenu();
      this.menu.showError(reason);
    } else {
      clearToken();
      history.replaceState(null, '', '/');
      this.menu.setJoinCode(null);
      this.showMenu();
      toast('Você saiu da sala.');
    }
  }

  /* ---------------- canto da tela: som, tela cheia, sair ---------------- */

  private setupCorner(): void {
    const soundBtn = $('soundBtn');
    const paint = () => { soundBtn.textContent = sound.muted ? '🔇' : '🔊'; };
    paint();
    soundBtn.addEventListener('click', () => { sound.unlock(); sound.toggle(); paint(); });

    const full = $('fullBtn');
    if (document.fullscreenEnabled) {
      full.hidden = false;
      full.addEventListener('click', () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      });
    }

    $('leaveBtn').addEventListener('click', () => {
      if (!this.net) return;
      if (this.net.state.phase === 'lobby' || this.net.state.phase === 'podium') this.net.leave();
      else $('confirm').hidden = false;
    });
    $('confirmYes').addEventListener('click', () => { $('confirm').hidden = true; this.net?.leave(); });
    $('confirmNo').addEventListener('click', () => { $('confirm').hidden = true; });
  }

  /* ---------------- aviso de versão nova ---------------- */

  private setupUpdateCheck(): void {
    if (!import.meta.env.PROD) return;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        const { version } = await res.json() as { version: string };
        if (version && version !== __APP_VERSION__) {
          const inGame = !!this.net && this.net.state.phase !== 'lobby';
          $('updateText').textContent = inGame
            ? 'Saiu uma atualização! Recarregue quando a partida acabar.'
            : 'Saiu uma atualização do Fuzuê!';
          $('update').hidden = false;
        }
      } catch { /* sem internet: tenta depois */ }
    };
    $('updateBtn').addEventListener('click', () => location.reload());
    window.setInterval(() => void check(), 120000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  }
}

/**
 * Versão nova no servidor: recarrega a página uma vez para pegar o site novo.
 * Se ainda assim não bater (site ainda publicando), não fica em loop.
 */
function reloadOnce(): void {
  const KEY = 'fuzue:recarregou';
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) ?? 0); } catch { /* ignora */ }
  if (Date.now() - last < 60000) return;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignora */ }
  window.setTimeout(() => location.reload(), 1800);
}

function slowText(seconds: number): string {
  return `Acordando o servidor do jogo… ${seconds}s (na primeira partida do dia pode levar até 1 minuto)`;
}

new App();
