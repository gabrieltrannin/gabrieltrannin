import type { FestivalDef } from '../data/festivals';
import { t, type MessageKey } from '../i18n';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** One running game: draws into `stage`, calls `end(score)` when over, cleans up with `stop`. */
interface Running {
  stop(): void;
  key?(key: string): void;
}
type Start = (stage: HTMLElement, status: (text: string) => void, end: (score: number) => void, def: FestivalDef) => Running;

const shuffle = <T>(list: T[]): T[] => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
};

/** Flores: find the pairs of flowers in 60 seconds. */
const memory: Start = (stage, status, end) => {
  const flowers = ['🌷', '🌻', '🌹', '🌼', '🌸', '💐'];
  const cards = shuffle([...flowers, ...flowers]);
  const grid = el('div', 'game-memory');
  let open: number[] = [];
  let found = 0;
  let left = 60;
  let busy = false;
  const buttons = cards.map((flower, i) => {
    const b = el('button', 'game-card', '');
    b.type = 'button';
    b.setAttribute('aria-label', String(i + 1));
    b.addEventListener('click', () => {
      if (busy || b.classList.contains('game-card--up') || open.length >= 2) return;
      b.textContent = flower;
      b.classList.add('game-card--up');
      open.push(i);
      if (open.length < 2) return;
      const [a, c] = open as [number, number];
      if (cards[a] === cards[c]) {
        found += 1;
        buttons[a]!.classList.add('game-card--done');
        buttons[c]!.classList.add('game-card--done');
        open = [];
        if (found === flowers.length) finish();
      } else {
        busy = true;
        setTimeout(() => {
          for (const k of [a, c]) {
            buttons[k]!.textContent = '';
            buttons[k]!.classList.remove('game-card--up');
          }
          open = [];
          busy = false;
        }, 650);
      }
      show();
    });
    grid.append(b);
    return b;
  });
  stage.append(grid);
  const show = () => status(`${t('game.score', { score: found })} · ${t('game.time', { seconds: left })}`);
  const timer = setInterval(() => {
    left -= 1;
    show();
    if (left <= 0) finish();
  }, 1000);
  let over = false;
  const finish = () => {
    if (over) return;
    over = true;
    clearInterval(timer);
    end(found);
  };
  show();
  return { stop: () => clearInterval(timer) };
};

/** Lanternas: watch the lanterns light up and repeat the order. */
const sequence: Start = (stage, status, end, def) => {
  const colors = ['#E5484D', '#F2C14E', '#5B8DD9', '#3FA7A0'];
  const row = el('div', 'game-lanterns');
  const lanterns = colors.map((c, i) => {
    const b = el('button', 'game-lantern', String(i + 1));
    b.type = 'button';
    b.style.setProperty('--lantern', c);
    b.addEventListener('click', () => press(i));
    row.append(b);
    return b;
  });
  stage.append(row);
  const order: number[] = [];
  let input = 0;
  let listening = false;
  let round = 0;
  const timers: number[] = [];
  const flash = (i: number) => {
    lanterns[i]!.classList.add('game-lantern--on');
    timers.push(window.setTimeout(() => lanterns[i]!.classList.remove('game-lantern--on'), 380));
  };
  const nextRound = () => {
    if (round >= def.maxScore) return end(round);
    order.push(Math.floor(Math.random() * colors.length));
    listening = false;
    input = 0;
    status(`${t('game.round', { round: round + 1 })} · ${t('game.watch')}`);
    order.forEach((i, k) => timers.push(window.setTimeout(() => flash(i), 700 + k * 600)));
    timers.push(window.setTimeout(() => {
      listening = true;
      status(`${t('game.round', { round: round + 1 })} · ${t('game.yourTurn')}`);
    }, 700 + order.length * 600));
  };
  const press = (i: number) => {
    if (!listening) return;
    flash(i);
    if (order[input] !== i) {
      listening = false;
      return end(round);
    }
    input += 1;
    if (input === order.length) {
      round += 1;
      listening = false;
      timers.push(window.setTimeout(nextRound, 500));
    }
  };
  nextRound();
  return {
    stop: () => timers.forEach(clearTimeout),
    key: k => {
      const n = Number(k);
      if (n >= 1 && n <= 4) press(n - 1);
    },
  };
};

/** Colheita: tap the vegetables that pop up before they hide (30 seconds). */
const whack: Start = (stage, status, end, def) => {
  const veggies = ['🎃', '🥕', '🌽', '🍅', '🥬', '🍆'];
  const grid = el('div', 'game-holes');
  let score = 0;
  let left = 30;
  const up = new Set<number>();
  const holes = Array.from({ length: 9 }, (_, i) => {
    const b = el('button', 'game-hole', '');
    b.type = 'button';
    b.setAttribute('aria-label', String(i + 1));
    b.addEventListener('click', () => hit(i));
    grid.append(b);
    return b;
  });
  stage.append(grid);
  const show = () => status(`${t('game.score', { score })} · ${t('game.time', { seconds: left })}`);
  const hit = (i: number) => {
    if (!up.has(i)) return;
    up.delete(i);
    holes[i]!.textContent = '✨';
    holes[i]!.classList.remove('game-hole--up');
    score = Math.min(def.maxScore, score + 1);
    show();
  };
  const pop = window.setInterval(() => {
    const free = holes.map((_, i) => i).filter(i => !up.has(i));
    const i = free[Math.floor(Math.random() * free.length)];
    if (i === undefined) return;
    up.add(i);
    holes[i]!.textContent = veggies[Math.floor(Math.random() * veggies.length)]!;
    holes[i]!.classList.add('game-hole--up');
    window.setTimeout(() => {
      if (!up.has(i)) return;
      up.delete(i);
      holes[i]!.textContent = '';
      holes[i]!.classList.remove('game-hole--up');
    }, 1000);
  }, 650);
  const clock = window.setInterval(() => {
    left -= 1;
    show();
    if (left <= 0) {
      clearInterval(pop);
      clearInterval(clock);
      end(score);
    }
  }, 1000);
  show();
  return {
    stop: () => {
      clearInterval(pop);
      clearInterval(clock);
    },
    key: k => {
      const n = Number(k);
      if (n >= 1 && n <= 9) hit(n - 1);
    },
  };
};

/** Neve: throw when the snowman passes the target (8 snowballs). */
const timing: Start = (stage, status, end, def) => {
  const lane = el('div', 'game-lane');
  const target = el('div', 'game-target');
  const snowman = el('div', 'game-snowman', '⛄');
  lane.append(target, snowman);
  const throwBtn = el('button', 'ui-btn ui-btn--primary', '❄️');
  throwBtn.type = 'button';
  stage.append(lane, throwBtn);
  let left = def.maxScore;
  let score = 0;
  let pos = 0;
  let speed = 0.55;
  let last = performance.now();
  let raf = 0;
  let cooldown = 0;
  const show = () => status(`${t('game.score', { score })} · ${t('game.throws', { left })}`);
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    cooldown = Math.max(0, cooldown - dt);
    pos += speed * dt;
    if (pos > 1 || pos < 0) {
      speed = -speed;
      pos = Math.max(0, Math.min(1, pos));
    }
    snowman.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const shoot = () => {
    if (left <= 0 || cooldown > 0) return;
    cooldown = 0.35;
    left -= 1;
    const good = Math.abs(pos - 0.5) < 0.09;
    if (good) score += 1;
    snowman.textContent = good ? '💥' : '⛄';
    setTimeout(() => (snowman.textContent = '⛄'), 300);
    speed *= 1.12;
    show();
    if (left <= 0) setTimeout(() => end(score), 400);
  };
  throwBtn.addEventListener('click', shoot);
  show();
  return {
    stop: () => cancelAnimationFrame(raf),
    key: k => {
      if (k === 'e' || k === ' ' || k === 'Enter') shoot();
    },
  };
};

const GAMES = { memory, sequence, whack, timing };

/**
 * Stage 6: the festival game window (docs: "um minijogo em cada um"). It explains the game, plays it, and
 * then hands the score to `onFinish` (which sends the command that pays the prize).
 */
export class FestivalGame {
  private readonly overlay: HTMLElement;
  private running: Running | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (this.overlay.hidden) return;
    if (e.key === 'Escape') return this.close();
    this.running?.key?.(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };

  constructor(root: HTMLElement, private readonly onClose: () => void) {
    this.overlay = el('div', 'bag-overlay game-overlay');
    this.overlay.hidden = true;
    root.append(this.overlay);
    window.addEventListener('keydown', this.onKey);
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(def: FestivalDef, onFinish: (score: number) => void): void {
    this.overlay.replaceChildren();
    const card = el('div', 'bag panel game');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const header = el('div', 'bag__header');
    const close = el('button', 'ui-btn ui-btn--small', t('panel.close'));
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    header.append(el('h2', 'bag__title', `🎉 ${t(`game.${def.game}` as MessageKey)}`), close);
    const status = el('div', 'game__status');
    const stage = el('div', 'game__stage');
    card.append(header, el('p', 'bag__hint', t(`game.${def.game}.hint` as MessageKey)), status, stage);
    const start = el('button', 'ui-btn ui-btn--primary', t('game.start'));
    start.type = 'button';
    stage.append(start);
    start.addEventListener('click', () => {
      stage.replaceChildren();
      this.running = GAMES[def.game](stage, text => (status.textContent = text), score => {
        this.running?.stop();
        this.running = null;
        stage.replaceChildren(el('p', 'game__done', t('game.done', { score })));
        const collect = el('button', 'ui-btn ui-btn--primary', t('game.collect'));
        collect.type = 'button';
        collect.addEventListener('click', () => {
          onFinish(score);
          this.close();
        });
        stage.append(collect);
        collect.focus();
      }, def);
    });
    this.overlay.append(card);
    this.overlay.hidden = false;
    start.focus();
  }

  close(): void {
    this.running?.stop();
    this.running = null;
    if (this.overlay.hidden) return;
    this.overlay.hidden = true;
    this.onClose();
  }
}
