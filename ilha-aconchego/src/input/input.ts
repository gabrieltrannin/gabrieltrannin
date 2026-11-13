/**
 * One input state for keyboard, touch and gamepad (docs/GAME_DESIGN.md, "Plataforma e controle").
 * Movement is a stick-like vector (x right, y forward, length up to 1); buttons pressed this frame
 * are reported once by `poll()`.
 */
export interface InputFrame {
  moveX: number;
  moveY: number;
  run: boolean;
  /** E, the Ação button or gamepad A, pressed this frame. */
  action: boolean;
  /** The same button held down (reeling in a fish). */
  actionHeld: boolean;
  /** Item bar slot chosen with 1 to 8, or null. */
  slot: number | null;
  /** Gamepad shoulder buttons: -1 previous slot, +1 next slot. */
  slotStep: -1 | 0 | 1;
  toggleBag: boolean;
  toggleMap: boolean;
  escape: boolean;
  /** Camera turn, -1 to 1 (Q/R keys, right stick). */
  turn: number;
}

/** Touch controls write here; the game reads it through `Input.poll`. */
export interface TouchState {
  moveX: number;
  moveY: number;
  run: boolean;
  action: boolean;
  actionHeld: boolean;
  toggleBag: boolean;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Space']);
const DEADZONE = 0.2;

/** Standard gamepad buttons. */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9 } as const;

function typingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export class Input {
  /** Off while a screen like the character creator is open. */
  enabled = true;
  readonly touch: TouchState = { moveX: 0, moveY: 0, run: false, action: false, actionHeld: false, toggleBag: false };
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private padButtons: boolean[] = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', e => {
      if (!this.enabled || typingInField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    target.addEventListener('keyup', e => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  poll(): InputFrame {
    const frame: InputFrame = { moveX: 0, moveY: 0, run: false, action: false, actionHeld: false, slot: null, slotStep: 0, toggleBag: false, toggleMap: false, escape: false, turn: 0 };
    if (!this.enabled) {
      this.pressed.clear();
      this.clearTouchPresses();
      return frame;
    }

    // Keyboard.
    for (const [code, [x, y]] of Object.entries(MOVE_KEYS)) {
      if (this.held.has(code)) {
        frame.moveX += x;
        frame.moveY += y;
      }
    }
    frame.run = this.held.has('ShiftLeft') || this.held.has('ShiftRight');
    frame.action = this.pressed.has('KeyE') || this.pressed.has('Space');
    frame.actionHeld = this.held.has('KeyE') || this.held.has('Space');
    for (let i = 1; i <= 8; i++) if (this.pressed.has(`Digit${i}`) || this.pressed.has(`Numpad${i}`)) frame.slot = i - 1;
    frame.toggleBag = this.pressed.has('Tab');
    frame.toggleMap = this.pressed.has('KeyM');
    frame.escape = this.pressed.has('Escape');
    frame.turn = (this.held.has('KeyR') ? 1 : 0) - (this.held.has('KeyQ') ? 1 : 0);
    this.pressed.clear();

    // Touch.
    const t = this.touch;
    frame.moveX += t.moveX;
    frame.moveY += t.moveY;
    frame.run ||= t.run;
    frame.action ||= t.action;
    frame.actionHeld ||= t.actionHeld;
    frame.toggleBag ||= t.toggleBag;
    this.clearTouchPresses();

    // Gamepad (first connected one).
    const pad = typeof navigator !== 'undefined' && navigator.getGamepads ? Array.from(navigator.getGamepads()).find(p => p) : undefined;
    if (pad) {
      const axis = (i: number) => {
        const v = pad.axes[i] ?? 0;
        return Math.abs(v) < DEADZONE ? 0 : v;
      };
      frame.moveX += axis(0);
      frame.moveY -= axis(1);
      frame.turn += axis(2);
      const down = pad.buttons.map(b => b.pressed);
      const edge = (i: number) => !!down[i] && !this.padButtons[i];
      frame.run ||= !!down[PAD.B];
      frame.action ||= edge(PAD.A);
      frame.actionHeld ||= !!down[PAD.A];
      frame.toggleBag ||= edge(PAD.Y);
      frame.toggleMap ||= edge(PAD.BACK) || edge(PAD.X);
      frame.escape ||= edge(PAD.START);
      if (edge(PAD.LB)) frame.slotStep = -1;
      if (edge(PAD.RB)) frame.slotStep = 1;
      this.padButtons = down;
    }

    const length = Math.hypot(frame.moveX, frame.moveY);
    if (length > 1) {
      frame.moveX /= length;
      frame.moveY /= length;
    }
    frame.turn = Math.max(-1, Math.min(1, frame.turn));
    return frame;
  }

  private clearTouchPresses(): void {
    this.touch.action = false;
    this.touch.toggleBag = false;
  }
}
