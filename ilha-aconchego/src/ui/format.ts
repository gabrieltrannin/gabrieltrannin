import { formatClock, seasonOf, weekdayOf } from '../core/clock';
import type { GameTime } from '../core/types';
import { t } from '../i18n';

/** "Sex, 12 de Primavera" */
export function formatDate(time: GameTime): string {
  return t('hud.date', {
    weekday: t(`weekday.${weekdayOf(time)}`),
    day: time.day,
    season: t(`season.${seasonOf(time)}`),
  });
}

export function formatTime(time: GameTime): string {
  return formatClock(time.minuteOfDay);
}
