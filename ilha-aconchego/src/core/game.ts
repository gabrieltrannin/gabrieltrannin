import { applyCommand, type Command, type CommandResult, type GameEvent } from './commands';
import { createInitialState } from './state';
import type { Actor, GameState } from './types';

export type GameListener = (event: GameEvent, state: Readonly<GameState>) => void;

/** The clock and the server act as "system". */
export const SYSTEM: Actor = { id: 'system', role: 'system' };

/**
 * Holds the state on this device and tells the renderer and the interface what changed.
 * It never changes the state itself: everything goes through `applyCommand`.
 */
export class Game {
  private readonly listeners = new Set<GameListener>();

  constructor(public readonly state: GameState = createInitialState()) {}

  dispatch(cmd: Command, actor: Actor): CommandResult {
    const result = applyCommand(this.state, cmd, actor);
    if (result.ok) {
      for (const event of result.events) for (const listener of this.listeners) listener(event, this.state);
    }
    return result;
  }

  /** Subscribes to game events. Returns a function that unsubscribes. */
  on(listener: GameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
