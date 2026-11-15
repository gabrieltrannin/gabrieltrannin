import { regionUnlocked } from '../core/explore';
import { isElevatorFloor, MAX_MINE_FLOOR } from '../data/mine';
import { REGION_IDS, REGIONS, type RegionId } from '../data/regions';
import { villager } from '../data/villagers';
import { t, type MessageKey } from '../i18n';
import type { PanelKit } from './homePanels';

export interface ExplorePanels {
  /** The boat at the pier: the regions, open or with what they need. */
  openBoat(onTravel: (region: RegionId) => void): void;
  /** The mine elevator: the floors it stops at. */
  openElevator(floor: number, onGo: (floor: number) => void, onSurface: () => void): void;
  /** Options: the peaceful mode and the music. */
  openOptions(music: { enabled: boolean; set(on: boolean): void }): void;
}

const REGION_ICON: Record<RegionId, string> = { beach: '🏖️', forest: '🌲', volcano: '🌋', clouds: '☁️' };

/** Stage 6 windows, in the same cream paper style. */
export function createExplorePanels(k: PanelKit): ExplorePanels {
  const { el, row, button, section, me, dispatch } = k;
  const api: ExplorePanels = {
    openBoat(onTravel) {
      k.open(t('panel.boat.title'), () => {
        k.body.replaceChildren();
        k.body.append(el('p', 'bag__hint', t('panel.boat.hint')));
        for (const id of REGION_IDS) {
          const open = regionUnlocked(me(), id);
          const needs = REGIONS[id].unlock.flatMap(u => [
            ...(u.hearts ? [`${t('unlock.hearts', { hearts: u.hearts.hearts, name: villager(u.hearts.npc).name })}`] : []),
            ...(u.tool ? [t('unlock.tool', { tool: t(`item.tool.${u.tool.tool}`), level: t(`tool.level.${u.tool.level}` as MessageKey) })] : []),
          ]).join(' · ');
          const sub = open ? t(`region.${id}.text` as MessageKey) : t('panel.boat.locked', { needs });
          const go = button(open ? t('panel.boat.go') : '🔒', () => onTravel(id), !open, open);
          k.body.append(row(REGION_ICON[id], t(`region.${id}` as MessageKey), sub, go));
        }
      });
    },

    openElevator(floor, onGo, onSurface) {
      k.open(t('panel.elevator.title'), () => {
        k.body.replaceChildren();
        k.body.append(el('p', 'bag__hint', t('panel.elevator.hint')));
        k.body.append(row('☀️', t('panel.elevator.surface'), '', button(t('panel.elevator.go'), onSurface, false, true)));
        for (let f = 1; f <= Math.min(MAX_MINE_FLOOR, me().explore.deepest); f++) {
          if (!isElevatorFloor(f)) continue;
          const here = f === floor;
          k.body.append(row('🪜', t('panel.elevator.floor', { floor: f }), here ? t('panel.elevator.here') : '', button(t('panel.elevator.go'), () => onGo(f), here, !here)));
        }
      });
    },

    openOptions(music) {
      k.open(t('panel.options.title'), () => {
        k.body.replaceChildren();
        const peaceful = k.game.state.options.peaceful;
        section(t('panel.options.peaceful'));
        k.body.append(row('🫧', peaceful ? t('panel.options.on') : t('panel.options.off'), t('panel.options.peacefulHint'),
          button(peaceful ? t('panel.options.off') : t('panel.options.on'), () => dispatch({ type: 'options.set', peaceful: !peaceful }, t(peaceful ? 'msg.peacefulOff' : 'msg.peacefulOn')), k.actor.role !== 'host', true)));
        section(t('panel.options.music'));
        k.body.append(row('🎵', music.enabled ? t('panel.options.on') : t('panel.options.off'), t('panel.options.musicHint'),
          button(music.enabled ? t('panel.options.off') : t('panel.options.on'), () => {
            music.set(!music.enabled);
            k.refresh();
          }, false, true)));
      });
    },
  };
  return api;
}
