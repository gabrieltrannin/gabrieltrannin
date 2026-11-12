import './style.css';
import type { Room } from 'colyseus.js';
import { normalizeCode } from '@fuzue/shared';
import { animateCritter, makeCritter, type Critter } from './game/critter';
import { Input } from './game/Input';
import { Session } from './game/Session';
import { Stage } from './game/Stage';
import { createRoom, friendlyError, joinRoom } from './net/connection';
import { Hud } from './ui/Hud';
import { Menu } from './ui/Menu';
import { toast } from './ui/toast';

const stage = new Stage(
  document.getElementById('scene') as HTMLCanvasElement,
  document.getElementById('fx')!,
);
const input = new Input(
  document.getElementById('stick')!,
  document.getElementById('knob')!,
  document.getElementById('pushBtn')!,
);

let session: Session | null = null;
const hud = new Hud(() => session?.leave());

/* ---------- boneco de vitrine no menu ---------- */
let preview: Critter | null = null;
function showPreview(character: number): void {
  if (preview) stage.scene.remove(preview.root);
  preview = makeCritter(character);
  preview.root.position.copy(stage.menuSpot);
  stage.scene.add(preview.root);
}
function hidePreview(): void {
  if (preview) stage.scene.remove(preview.root);
  preview = null;
}
function menuFrame(_dt: number, t: number): void {
  if (!preview) return;
  preview.root.rotation.y = Math.sin(t * 0.6) * 0.45;
  animateCritter(preview, t, { speed: 0, punching: false, stunned: false, falling: false, waving: true });
}

/* ---------- menu ---------- */
const menu = new Menu({
  onCreate: opts => connect(() => createRoom(opts)),
  onJoin: (code, opts) => connect(() => joinRoom(code, opts), code),
  onCharacter: i => showPreview(i),
});

async function connect(open: () => Promise<Room>, code?: string): Promise<void> {
  menu.setBusy(true, code ? 'Entrando…' : 'Criando sala…');
  try {
    const room = await open();
    enterRoom(room);
  } catch (err) {
    menu.setBusy(false);
    menu.showError(friendlyError(err, code));
  }
}

function enterRoom(room: Room): void {
  const code = room.roomId;
  menu.setBusy(false);
  menu.hide();
  hidePreview();
  history.replaceState(null, '', `/sala/${code}`);
  document.title = `Sala ${code} · Fuzuê`;
  hud.show(code);
  session = new Session(room, stage, hud, input, reason => backToMenu(code, reason));
}

function backToMenu(code: string, reason: string | null): void {
  session = null;
  hud.hide();
  document.title = 'Fuzuê';
  stage.setMode('menu');
  stage.onFrame(menuFrame);
  showPreview(menu.character);
  if (reason) {
    // caiu sem querer: oferece voltar para a mesma sala
    menu.setJoinCode(code);
    menu.show();
    menu.showError(reason);
  } else {
    history.replaceState(null, '', '/');
    menu.setJoinCode(null);
    menu.show();
    toast('Você saiu da sala.');
  }
}

/* ---------- início ---------- */
const match = location.pathname.match(/^\/sala\/([^/]+)\/?$/i);
const linkCode = match ? normalizeCode(decodeURIComponent(match[1])) : null;
if (match && !linkCode) history.replaceState(null, '', '/');
menu.setJoinCode(linkCode);
stage.setMode('menu');
stage.onFrame(menuFrame);
menu.show();
