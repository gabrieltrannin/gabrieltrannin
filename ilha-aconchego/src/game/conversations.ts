import { absoluteDay, seasonOf } from '../core/clock';
import type { Game } from '../core/game';
import { countItem } from '../core/inventory';
import type { Actor, PlayerState } from '../core/types';
import { isBirthday, shopOpen } from '../core/villagers';
import { ITEMS } from '../data/items';
import { hearts, VILLAGERS, type NpcId, type VillagerDef } from '../data/villagers';
import { fill, lines, t } from '../i18n';
import type { DialogueBox, DialogueChoice } from '../ui/dialogue';
import { itemName } from '../ui/itemText';
import type { PanelHost } from '../ui/panels';
import type { VillagerAgents } from '../world/villagerAgents';
import type { Interactions } from './interactions';
import type { PlayerController } from './playerController';

export interface ConversationContext {
  game: Game;
  actor: Actor;
  player: PlayerController;
  agents: VillagerAgents;
  dialogue: DialogueBox;
  panels: PanelHost;
  interactions: Interactions;
  toast(text: string): void;
  errorText(error: string): string;
  commitMove(): void;
  /** A heart pops over the villager (friendship went up a level). */
  hearts(npc: NpcId, level: number): void;
}

const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/**
 * Talking to the villagers: what they say (time, weather, season, friendship, birthdays, the gift you
 * gave), the special scenes every 2 hearts, and the choices (chat, give a gift, deliver a request,
 * open their shop).
 */
export function createConversations(ctx: ConversationContext): void {
  const { game, actor, dialogue, agents } = ctx;
  const me = (): PlayerState => game.state.players[actor.id]!;
  const params = (def: VillagerDef, extra: Record<string, string | number> = {}) => ({
    player: me().name, island: game.state.island.name, name: def.name, season: t(`season.${seasonOf(game.state.time)}`),
    Obrigado: def.gender === 'f' ? 'Obrigada' : 'Obrigado', obrigado: def.gender === 'f' ? 'obrigada' : 'obrigado', ...extra,
  });
  const say = (def: VillagerDef, key: string, extra: Record<string, string | number> = {}) => fill(pick(lines(key)) ?? '', params(def, extra));
  const speaker = (def: VillagerDef) => ({ name: def.name, icon: def.icon, pitch: def.pitch });

  const timeKey = () => {
    const m = game.state.time.minuteOfDay;
    return m < 720 ? 'morning' : m < 1050 ? 'afternoon' : m < 1260 ? 'evening' : 'night';
  };

  /** Everyday talk: a greeting and one more thing about the day, their life or you. */
  const smallTalk = (def: VillagerDef, first: boolean): string[] => {
    const p = def.personality;
    const out = [say(def, `greet.${p}.${timeKey()}`)];
    const friend = me().friends[def.id];
    const today = absoluteDay(game.state.time);
    if (isBirthday(def, game.state.time)) out.push(say(def, `birthday.${p}`));
    else if (first && friend.lastGift && today - friend.lastGift.day === 1) out.push(say(def, `remember.${p}`, { item: t(`item.${friend.lastGift.item}`) }));
    else {
      const h = hearts(friend.points);
      const options = [
        `weather.${p}.${game.state.weather}`,
        `season.${p}.${seasonOf(game.state.time)}`,
        `friend.${p}.${h < 3 ? 'low' : h < 7 ? 'mid' : 'high'}`,
        `npc.${def.id}.job`,
      ];
      out.push(say(def, pick(options)!));
    }
    const request = game.state.requests.find(r => r.npc === def.id && !r.done);
    if (request && first) out.push(request.id === 1 ? say(def, 'request.lumi') : say(def, 'request.ask', { qty: request.qty, item: t(`item.${request.item}`) }));
    return out;
  };

  const sceneLines = (def: VillagerDef, tier: number): string[] => {
    const fields = Object.fromEntries(['hobby', 'memory', 'secret', 'dream'].map(f => [f, pick(lines(`npc.${def.id}.${f}`)) ?? '']));
    return lines(`scene.${tier}`).map(line => fill(line, params(def, fields)));
  };

  const end = (def: VillagerDef) => {
    agents.setTalking(def.id, null);
  };

  /** The menu after talking. */
  const choicesFor = (def: VillagerDef) => (): DialogueChoice[] => {
    const list: DialogueChoice[] = [];
    const counterShop = def.shop && shopOpen(game.state, def.shop) ? def.shop : null;
    if (counterShop === 'smithy') list.push({ label: t('dialogue.upgrade'), run: () => { dialogue.close(); ctx.panels.openSmithy(); } });
    else if (counterShop) list.push({ label: t('dialogue.shop'), run: () => { dialogue.close(); ctx.panels.openShop(counterShop); } });
    if (def.id === 'celeste' && game.state.projects.museum.done) list.push({ label: t('dialogue.museum'), run: () => { dialogue.close(); ctx.panels.openMuseum(); } });
    if (def.id === 'lino') list.push({ label: t('dialogue.projects'), run: () => { dialogue.close(); ctx.panels.openBoard(); } });
    const request = game.state.requests.find(r => r.npc === def.id && !r.done);
    if (request && countItem(me().inventory, request.item) >= request.qty) {
      list.push({
        label: t('dialogue.deliver', { qty: request.qty, item: t(`item.${request.item}`) }),
        run: () => {
          ctx.commitMove();
          const r = game.dispatch({ type: 'request.deliver', request: request.id }, actor);
          if (!r.ok) return dialogue.say(speaker(def), [ctx.errorText(r.error)], choicesFor(def));
          ctx.toast(t('msg.requestDone', { coins: request.reward }));
          dialogue.say(speaker(def), [say(def, 'request.thanks')], choicesFor(def));
        },
      });
    }
    if (me().friends[def.id].giftDay !== absoluteDay(game.state.time)) list.push({ label: t('dialogue.gift'), run: () => giftMenu(def) });
    list.push({ label: t('dialogue.chat'), run: () => chat(def) });
    list.push({ label: t('dialogue.bye'), run: () => dialogue.say(speaker(def), [say(def, `bye.${def.personality}`)]) });
    return list;
  };

  const chat = (def: VillagerDef) => {
    const q = pick(['q1', 'q2', 'q3', 'q4'])!;
    dialogue.say(speaker(def), [say(def, `ask.${q}`)], () => [
      { label: say(def, `ask.${q}.a`), run: () => dialogue.say(speaker(def), [say(def, `ask.${q}.ra`)], choicesFor(def)) },
      { label: say(def, `ask.${q}.b`), run: () => dialogue.say(speaker(def), [say(def, `ask.${q}.rb`)], choicesFor(def)) },
    ]);
  };

  const giftMenu = (def: VillagerDef) => {
    const stacks = me().inventory
      .map((stack, slot) => ({ stack: stack!, slot }))
      .filter(e => e.stack && ITEMS[e.stack.item].kind !== 'tool' && ITEMS[e.stack.item].kind !== 'placeable');
    dialogue.pickItem(t('dialogue.pickGift', { name: def.name }), stacks, slot => {
      const item = me().inventory[slot]!;
      ctx.commitMove();
      const r = game.dispatch({ type: 'npc.gift', npc: def.id, slot }, actor);
      if (!r.ok) return dialogue.say(speaker(def), [r.error === 'already' ? say(def, 'gift.again') : ctx.errorText(r.error)], choicesFor(def));
      const gifted = r.events.find(e => e.type === 'npc.gifted');
      const reaction = gifted && gifted.type === 'npc.gifted' ? gifted.reaction : 'neutral';
      const out = [say(def, `gift.${def.personality}.${reaction}`, { item: itemName(item) })];
      if (gifted && gifted.type === 'npc.gifted' && gifted.birthday) out.push(say(def, 'gift.birthday'));
      dialogue.say(speaker(def), out, choicesFor(def));
    }, () => dialogue.say(speaker(def), [say(def, `friend.${def.personality}.mid`)], choicesFor(def)));
  };

  const talk = (def: VillagerDef) => {
    ctx.commitMove();
    const r = game.dispatch({ type: 'npc.talk', npc: def.id }, actor);
    if (!r.ok) return ctx.toast(ctx.errorText(r.error));
    const talked = r.events.find(e => e.type === 'npc.talked');
    const first = talked?.type === 'npc.talked' ? talked.first : false;
    const scene = talked?.type === 'npc.talked' ? talked.scene : 0;
    const pos = agents.positionOf(def.id);
    agents.setTalking(def.id, ctx.player.object.position);
    const body = scene ? sceneLines(def, scene) : smallTalk(def, first);
    if (scene && pos) ctx.hearts(def.id, scene);
    dialogue.say(speaker(def), body, choicesFor(def), () => end(def));
  };

  for (const def of VILLAGERS) {
    ctx.interactions.add({
      id: `npc-${def.id}`,
      at: () => {
        const p = agents.positionOf(def.id);
        return p ? { x: p.x, z: p.z } : { x: 999, z: 999 };
      },
      // Shopkeepers stand behind a counter, so they can be reached from a bit further.
      radius: def.shop ? 2.7 : 1.7,
      enabled: () => agents.positionOf(def.id) !== null,
      label: () => (def.shop && shopOpen(game.state, def.shop) ? t('act.talkShop', { name: def.name }) : t('act.talk', { name: def.name })),
      act: () => talk(def),
    });
  }
}
