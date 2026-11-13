import { describe, expect, it } from 'vitest';
import { createTime } from '../core/clock';
import { t } from '../i18n';
import { formatDate, formatTime } from './format';

describe('formatDate', () => {
  it('writes the date in Portuguese', () => {
    expect(formatDate(createTime())).toBe('Seg, 1 de Primavera');
    expect(formatDate({ ...createTime(), day: 12 })).toBe('Sex, 12 de Primavera');
    expect(formatDate({ ...createTime(), seasonIndex: 1, day: 3 })).toBe('Qua, 3 de Verão');
  });

  it('formats the clock', () => {
    expect(formatTime({ ...createTime(), minuteOfDay: 13 * 60 + 20 })).toBe('13:20');
  });
});

describe('t', () => {
  it('fills placeholders and leaves unknown ones untouched', () => {
    expect(t('hud.island', { name: 'Aconchego' })).toBe('Ilha Aconchego');
    expect(t('hud.year', {})).toBe('Ano {year}');
  });
});
