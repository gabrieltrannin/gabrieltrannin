/**
 * Every text the player sees, in Brazilian Portuguese (default language).
 * English and Spanish files will use the same keys (stage 8).
 * Placeholders use {name}.
 */
export const ptBR = {
  'app.title': 'Ilha Aconchego',
  'app.webglError': 'Seu navegador não conseguiu abrir a cena 3D. Tente atualizar o navegador ou usar outro.',

  'season.spring': 'Primavera',
  'season.summer': 'Verão',
  'season.autumn': 'Outono',
  'season.winter': 'Inverno',

  'weekday.mon': 'Seg',
  'weekday.tue': 'Ter',
  'weekday.wed': 'Qua',
  'weekday.thu': 'Qui',
  'weekday.fri': 'Sex',
  'weekday.sat': 'Sáb',
  'weekday.sun': 'Dom',

  'festival.flowers': 'Festival das Flores',
  'festival.lanterns': 'Noite das Lanternas',
  'festival.harvest': 'Feira da Colheita',
  'festival.snow': 'Baile da Neve',

  'fruit.apple': 'Maçã',
  'fruit.pear': 'Pera',
  'fruit.peach': 'Pêssego',
  'fruit.orange': 'Laranja',
  'fruit.cherry': 'Cereja',

  'hud.date': '{weekday}, {day} de {season}',
  'hud.year': 'Ano {year}',
  'hud.island': 'Ilha {name}',
  'hud.dayEnded': 'Já são 2h! Hora de dormir.',

  'dev.title': 'Painel de testes',
  'dev.sleep': 'Dormir',
  'dev.plusHour': '+1 hora',
  'dev.fps': '{fps} qps',
  'dev.slept': 'Bom dia! Começou o dia {day} de {season}.',
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof ptBR;
