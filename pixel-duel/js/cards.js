/* Pixel Duel — banco de cartas (todas originais).
 * Cada geração é um "set". Os formatos são cumulativos, como no Showdown:
 * o formato Gen II aceita cartas da Gen I e da Gen II, e assim por diante. */
(function () {
  const PD = (window.PD = window.PD || {});

  PD.ATTRS = {
    fogo:   { name: 'Fogo',   color: '#e0582f', hue: 12 },
    agua:   { name: 'Água',   color: '#2f7fe0', hue: 212 },
    terra:  { name: 'Terra',  color: '#a5763a', hue: 32 },
    vento:  { name: 'Vento',  color: '#3fae5a', hue: 130 },
    luz:    { name: 'Luz',    color: '#e8c547', hue: 48 },
    trevas: { name: 'Trevas', color: '#8a55c9', hue: 275 },
  };

  PD.RACES = {
    dragao: 'Dragão', guerreiro: 'Guerreiro', mago: 'Mago', fera: 'Fera',
    maquina: 'Máquina', demonio: 'Demônio', planta: 'Planta', inseto: 'Inseto',
    aquatico: 'Aquático', espirito: 'Espírito',
  };

  PD.GENS = {
    1: { roman: 'I',   name: 'Alvorada',            blurb: 'Monstros clássicos, magias simples e as primeiras armadilhas.' },
    2: { roman: 'II',  name: 'Ruínas Esquecidas',   blurb: 'Efeitos de VIRAR, maldições e Magias de Campo.' },
    3: { roman: 'III', name: 'Engrenagens de Ferro', blurb: 'Máquinas com Aura, dano perfurante e ataques diretos.' },
    4: { roman: 'IV',  name: 'Céus em Chamas',      blurb: 'Dragões colossais, ataque duplo e destruição em massa.' },
  };

  PD.FORMATS = [
    { id: 'gen1', name: '[Gen I] Alvorada',            gens: [1] },
    { id: 'gen2', name: '[Gen II] Ruínas Esquecidas',   gens: [1, 2] },
    { id: 'gen3', name: '[Gen III] Engrenagens de Ferro', gens: [1, 2, 3] },
    { id: 'livre', name: '[Gen IV] Livre (todas)',      gens: [1, 2, 3, 4] },
  ];

  PD.RULES = { deckMin: 20, deckMax: 40, copies: 3, startLP: 8000, startHand: 5 };

  const CARDS = [];
  let curGen = 1;
  const gen = (g) => { curGen = g; };

  function M(id, name, attr, race, level, atk, def, extra) {
    CARDS.push(Object.assign({ id, name, kind: 'monster', gen: curGen, attr, race, level, atk, def }, extra || {}));
  }
  function S(id, name, sub, ops, extra) {
    CARDS.push(Object.assign({ id, name, kind: 'spell', gen: curGen, sub, ops }, extra || {}));
  }
  function T(id, name, trigger, ops, extra) {
    CARDS.push(Object.assign({ id, name, kind: 'trap', gen: curGen, trigger, ops }, extra || {}));
  }

  /* ---------------- GERAÇÃO I — Alvorada ---------------- */
  gen(1);
  M('A01', 'Lobo de Cinzas', 'fogo', 'fera', 4, 1600, 1000, { flavor: 'Uiva para brasas que ainda não se apagaram.' });
  M('A02', 'Escudeiro de Bronze', 'terra', 'guerreiro', 4, 1400, 1700, { flavor: 'Jurou proteger o portão, mesmo sem saber o que há atrás dele.' });
  M('A03', 'Aprendiz do Farol', 'luz', 'mago', 3, 1200, 1000, { flavor: 'Acende a lanterna toda noite para guiar duelistas perdidos.' });
  M('A04', 'Serpente do Brejo', 'agua', 'aquatico', 4, 1700, 900, { flavor: 'Só os olhos ficam acima da lama.' });
  M('A05', 'Morcego Uivante', 'trevas', 'fera', 3, 1300, 700, { flavor: 'Seu grito racha vitrais.' });
  M('A06', 'Golem de Musgo', 'terra', 'planta', 4, 800, 2000, { flavor: 'Dormiu tanto tempo que virou jardim.' });
  M('A07', 'Cavaleiro da Aurora', 'luz', 'guerreiro', 4, 1800, 1200, { flavor: 'Ataca sempre com o sol nas costas.' });
  M('A08', 'Diabrete de Carvão', 'fogo', 'demonio', 2, 1000, 600, { flavor: 'Rouba brasas das lareiras alheias.' });
  M('A09', 'Gafanhoto Gigante', 'vento', 'inseto', 3, 1100, 1100, { flavor: 'Um salto e a plantação inteira some.' });
  M('A10', 'Mercenário Rubro', 'fogo', 'guerreiro', 4, 1900, 400, { flavor: 'Bate forte, mas esqueceu o escudo em casa.' });
  M('A11', 'Tartaruga Muralha', 'agua', 'aquatico', 4, 500, 2100, { flavor: 'Paciência de mil marés.' });
  M('A12', 'Fantasma do Poço', 'trevas', 'espirito', 3, 1200, 1400, { flavor: 'Quem joga uma moeda ouve um sussurro de volta.' });
  M('A13', 'Draconete Celeste', 'vento', 'dragao', 4, 1700, 1300, { flavor: 'Ainda pequeno, já dono das nuvens.' });
  M('A14', 'Autômato de Lata', 'terra', 'maquina', 3, 1300, 1300, { flavor: 'Range a cada passo, mas nunca para.' });
  M('A15', 'Bruxa da Névoa', 'trevas', 'mago', 4, 1500, 1600, { flavor: 'Some na neblina antes do contra-ataque.' });
  M('A16', 'Grifo das Dunas', 'vento', 'fera', 5, 2100, 1600, { flavor: 'Caça do alto, onde o calor distorce o horizonte.' });
  M('A17', 'Ogro do Desfiladeiro', 'terra', 'demonio', 6, 2400, 1700, { flavor: 'Cobra pedágio em pedras do tamanho de carroças.' });
  M('A18', 'Dragão Rubi Ancestral', 'fogo', 'dragao', 7, 2700, 2200, { flavor: 'Suas escamas guardam o calor da primeira manhã do mundo.' });
  M('A19', 'Arcanjo de Quartzo', 'luz', 'espirito', 7, 2600, 2500, { flavor: 'Asas de cristal que cantam ao vento.' });
  S('A20', 'Faísca', 'normal', [{ op: 'damage', n: 500 }]);
  S('A21', 'Erva Curativa', 'normal', [{ op: 'heal', n: 1000 }]);
  S('A22', 'Sabedoria Antiga', 'normal', [{ op: 'draw', n: 2 }], { limit: 1 });
  S('A23', 'Raio Fulminante', 'normal', [{ op: 'destroy', t: 'oppMonster' }], { limit: 1 });
  S('A24', 'Lâmina Afiada', 'equip', [{ op: 'buff', t: 'ownMonster', atk: 500 }]);
  S('A25', 'Vendaval', 'normal', [{ op: 'destroy', t: 'oppST' }]);
  S('A26', 'Chamado da Tumba', 'normal', [{ op: 'revive', from: 'own' }], { limit: 1 });
  T('A27', 'Barreira de Vento', 'attack', [{ op: 'negate' }]);
  T('A28', 'Fosso de Espinhos', 'summon', [{ op: 'destroy', t: 'summoned' }], { cond: { minAtk: 1500 } });
  T('A29', 'Contra-Golpe', 'attack', [{ op: 'destroy', t: 'attacker' }], { limit: 2 });

  /* ---------------- GERAÇÃO II — Ruínas Esquecidas ---------------- */
  gen(2);
  M('B01', 'Múmia Sussurrante', 'trevas', 'espirito', 2, 600, 700, { fx: { on: 'flip', ops: [{ op: 'destroy', t: 'randOppMonster' }] }, limit: 2 });
  M('B02', 'Sacerdotisa de Areia', 'luz', 'mago', 4, 1300, 1400, { fx: { on: 'flip', ops: [{ op: 'draw', n: 1 }, { op: 'heal', n: 500 }] } });
  M('B03', 'Sentinela de Pedra', 'terra', 'guerreiro', 4, 1000, 1900, { fx: { on: 'flip', ops: [{ op: 'damage', n: 600 }] } });
  M('B04', 'Escaravelho Dourado', 'luz', 'inseto', 3, 900, 1000, { fx: { on: 'destroyed', ops: [{ op: 'draw', n: 1 }] } });
  M('B05', 'Serpente de Jade', 'agua', 'aquatico', 4, 1500, 1100, { fx: { on: 'destroyed', ops: [{ op: 'damage', n: 500 }] } });
  M('B06', 'Guardião da Cripta', 'trevas', 'guerreiro', 4, 1650, 1300, { flavor: 'Conta os passos de cada visitante. Nenhum voltou.' });
  M('B07', 'Esfinge Partida', 'terra', 'fera', 5, 2200, 1800, { flavor: 'Metade do rosto caiu, mas o enigma continua.' });
  M('B08', 'Lich da Biblioteca', 'trevas', 'mago', 6, 2300, 2000, { fx: { on: 'summon', ops: [{ op: 'destroy', t: 'randOppST' }] } });
  M('B09', 'Faraó Esquecido', 'luz', 'espirito', 7, 2500, 2300, { fx: { on: 'destroyed', ops: [{ op: 'damage', n: 1000 }] } });
  M('B10', 'Rato das Catacumbas', 'terra', 'fera', 2, 800, 400, { fx: { on: 'flip', ops: [{ op: 'destroy', t: 'randOppST' }] } });
  M('B11', 'Flor Carnívora', 'terra', 'planta', 4, 1500, 900, { fx: { on: 'summon', ops: [{ op: 'damage', n: 300 }] } });
  M('B12', 'Morcego Vampiro', 'trevas', 'fera', 4, 1400, 1000, { fx: { on: 'destroyed', ops: [{ op: 'heal', n: 1000 }] } });
  M('B13', 'Golem de Obsidiana', 'trevas', 'maquina', 5, 1800, 2400, { flavor: 'Esculpido em lava resfriada por um rei sem nome.' });
  M('B14', 'Hidra do Oásis', 'agua', 'dragao', 6, 2450, 1600, { flavor: 'Cada cabeça guarda uma nascente diferente.' });
  S('B15', 'Areias Movediças', 'field', [], { field: { attr: 'terra', atk: 300, def: 300 } });
  S('B16', 'Oásis Sagrado', 'field', [], { field: { attr: 'agua', atk: 300, def: 300 } });
  S('B17', 'Pergaminho Proibido', 'normal', [{ op: 'draw', n: 1 }, { op: 'damage', n: 300 }]);
  S('B18', 'Maldição da Múmia', 'normal', [{ op: 'debuff', t: 'oppMonster', atk: 800 }]);
  S('B19', 'Tumba Aberta', 'normal', [{ op: 'revive', from: 'any' }], { limit: 1 });
  S('B20', 'Tempestade de Areia', 'normal', [{ op: 'destroy', t: 'allST' }], { limit: 1 });
  T('B21', 'Areia Traiçoeira', 'summon', [{ op: 'debuff', t: 'summoned', atk: 1000 }]);
  T('B22', 'Maldição Refletida', 'attack', [{ op: 'reflect' }]);
  T('B23', 'Ídolo Amaldiçoado', 'manual', [{ op: 'damage', n: 800 }]);
  T('B24', 'Selo da Esfinge', 'attack', [{ op: 'negate' }, { op: 'endBattle' }]);

  /* ---------------- GERAÇÃO III — Engrenagens de Ferro ---------------- */
  gen(3);
  M('C01', 'Soldado Engrenagem', 'terra', 'maquina', 4, 1500, 1300, { aura: { race: 'maquina', atk: 200 } });
  M('C02', 'Drone Batedor', 'vento', 'maquina', 3, 1000, 800, { kw: ['direct'] });
  M('C03', 'Tanque de Vapor', 'fogo', 'maquina', 4, 1500, 1600, { kw: ['pierce'] });
  M('C04', 'Engenheira Prodígio', 'luz', 'mago', 4, 1200, 1000, { fx: { on: 'summon', ops: [{ op: 'draw', n: 1 }] } });
  M('C05', 'Canhão Ferrugem', 'fogo', 'maquina', 4, 1400, 1000, { fx: { on: 'summon', ops: [{ op: 'damage', n: 500 }] } });
  M('C06', 'Golem Sucata', 'terra', 'maquina', 4, 1850, 1000, { flavor: 'Montado com peças de cem máquinas derrotadas.' });
  M('C07', 'Aranha Mecânica', 'trevas', 'inseto', 3, 1100, 900, { fx: { on: 'summon', ops: [{ op: 'destroy', t: 'randOppST' }] } });
  M('C08', 'Titã de Vapor', 'fogo', 'maquina', 6, 2400, 1800, { kw: ['pierce'] });
  M('C09', 'Colosso de Engrenagens', 'terra', 'maquina', 7, 2700, 2400, { aura: { race: 'maquina', atk: 300 } });
  M('C10', 'Sentinela Elétrica', 'luz', 'maquina', 4, 1300, 1800, { fx: { on: 'flip', ops: [{ op: 'destroy', t: 'randOppMonster' }] }, limit: 1 });
  M('C11', 'Fera Blindada', 'terra', 'fera', 4, 1700, 1300, { fx: { on: 'destroyed', ops: [{ op: 'damage', n: 500 }] } });
  M('C12', 'Vespa de Aço', 'vento', 'inseto', 3, 1200, 800, { kw: ['double'] });
  S('C13', 'Fábrica Abandonada', 'field', [], { field: { race: 'maquina', atk: 400, def: 200 } });
  S('C14', 'Sobrecarga', 'normal', [{ op: 'buff', t: 'allOwn', atk: 700, temp: true }]);
  S('C15', 'Armadura Reforçada', 'equip', [{ op: 'buff', t: 'ownMonster', atk: 300, def: 800 }]);
  S('C16', 'Pulso Magnético', 'normal', [{ op: 'destroy', t: 'allOppMonsters', maxAtk: 1500 }], { limit: 1 });
  S('C17', 'Campo Estático', 'normal', [{ op: 'stun' }], { limit: 1 });
  S('C18', 'Kit de Reparos', 'normal', [{ op: 'heal', n: 600 }, { op: 'draw', n: 1 }]);
  T('C19', 'Inversão de Polaridade', 'attack', [{ op: 'debuff', t: 'attacker', atk: 1000 }]);
  T('C20', 'Mina Terrestre', 'summon', [{ op: 'destroy', t: 'summoned' }], { cond: { maxAtk: 1500 } });
  T('C21', 'Escudo Hidráulico', 'attack', [{ op: 'negate' }, { op: 'heal', n: 500 }]);

  /* ---------------- GERAÇÃO IV — Céus em Chamas ---------------- */
  gen(4);
  M('D01', 'Filhote de Dragão', 'fogo', 'dragao', 3, 1200, 800, { fx: { on: 'destroyed', ops: [{ op: 'draw', n: 1 }] } });
  M('D02', 'Wyvern Tempestuosa', 'vento', 'dragao', 4, 1800, 1000, { kw: ['pierce'] });
  M('D03', 'Dragão de Escamas Prateadas', 'luz', 'dragao', 5, 2200, 1800, { fx: { on: 'summon', ops: [{ op: 'heal', n: 1000 }] } });
  M('D04', 'Dragão Abissal', 'trevas', 'dragao', 6, 2500, 1900, { fx: { on: 'summon', ops: [{ op: 'destroy', t: 'randOppMonster' }] }, limit: 1 });
  M('D05', 'Imperador Dracônico', 'fogo', 'dragao', 8, 3000, 2500, { kw: ['double'], limit: 1 });
  M('D06', 'Fênix Solar', 'fogo', 'espirito', 7, 2500, 2000, { fx: { on: 'destroyed', ops: [{ op: 'damage', n: 1000 }] } });
  M('D07', 'Sábio Dracônico', 'luz', 'mago', 4, 1400, 1500, { aura: { race: 'dragao', atk: 300 } });
  M('D08', 'Cavaleira Dragão', 'vento', 'guerreiro', 4, 1700, 1200, { kw: ['pierce'] });
  M('D09', 'Dragão Glacial', 'agua', 'dragao', 7, 2600, 2800, { fx: { on: 'summon', ops: [{ op: 'debuff', t: 'allOpp', atk: 500 }] } });
  M('D10', 'Ovo de Dragão', 'fogo', 'dragao', 1, 0, 1500, { fx: { on: 'flip', ops: [{ op: 'draw', n: 2 }] } });
  M('D11', 'Dragão de Tempestade', 'vento', 'dragao', 6, 2300, 2000, { fx: { on: 'summon', ops: [{ op: 'destroy', t: 'randOppST' }] } });
  S('D12', 'Sopro Flamejante', 'normal', [{ op: 'damage', n: 800 }]);
  S('D13', 'Vale dos Dragões', 'field', [], { field: { race: 'dragao', atk: 400, def: 300 } });
  S('D14', 'Cataclismo', 'normal', [{ op: 'destroy', t: 'allMonsters' }], { limit: 1 });
  S('D15', 'Rugido Ancestral', 'normal', [{ op: 'draw', n: 1 }, { op: 'damage', n: 500 }]);
  S('D16', 'Coroa de Chamas', 'equip', [{ op: 'buff', t: 'ownMonster', atk: 700 }], { limit: 2 });
  T('D17', 'Escamas Espelhadas', 'attack', [{ op: 'destroy', t: 'attacker' }, { op: 'damage', n: 300 }], { limit: 1 });
  T('D18', 'Ninho Protegido', 'summon', [{ op: 'debuff', t: 'summoned', atk: 1500 }], { cond: { minAtk: 2000 } });
  T('D19', 'Chamas do Renascer', 'manual', [{ op: 'revive', from: 'own' }], { limit: 1 });

  PD.CARDS = CARDS;
  PD.CARD_MAP = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  PD.card = (id) => PD.CARD_MAP[id] || null;

  /* ---------------- Texto das cartas (gerado a partir das regras) ---------------- */
  const fmtBuff = (op) => {
    const parts = [];
    if (op.atk) parts.push(`+${op.atk} ATK`);
    if (op.def) parts.push(`+${op.def} DEF`);
    return parts.join(' e ');
  };

  function opText(op) {
    switch (op.op) {
      case 'damage': return `Cause ${op.n} de dano ao oponente.`;
      case 'heal': return `Ganhe ${op.n} PV.`;
      case 'draw': return op.n === 1 ? 'Compre 1 carta.' : `Compre ${op.n} cartas.`;
      case 'destroy':
        switch (op.t) {
          case 'oppMonster': return 'Destrua 1 monstro do oponente.';
          case 'oppST': return 'Destrua 1 Magia/Armadilha do oponente.';
          case 'randOppMonster': return 'Destrua 1 monstro aleatório do oponente.';
          case 'randOppST': return 'Destrua 1 Magia/Armadilha aleatória do oponente.';
          case 'attacker': return 'Destrua o monstro atacante.';
          case 'summoned': return 'Destrua esse monstro.';
          case 'allOppMonsters': return op.maxAtk
            ? `Destrua todos os monstros com face para cima do oponente com ${op.maxAtk} de ATK ou menos.`
            : 'Destrua todos os monstros do oponente.';
          case 'allMonsters': return 'Destrua todos os monstros no campo.';
          case 'allST': return 'Destrua todas as Magias e Armadilhas no campo.';
        }
        break;
      case 'buff':
        if (op.t === 'ownMonster') return `1 monstro seu com face para cima ganha ${fmtBuff(op)}${op.temp ? ' até o fim do turno' : ''}.`;
        if (op.t === 'self') return `Este monstro ganha ${fmtBuff(op)}.`;
        if (op.t === 'allOwn') return `Todos os seus monstros com face para cima ganham ${fmtBuff(op)}${op.temp ? ' até o fim do turno' : ''}.`;
        break;
      case 'debuff':
        if (op.t === 'oppMonster') return `1 monstro do oponente com face para cima perde ${op.atk} de ATK.`;
        if (op.t === 'attacker') return `O monstro atacante perde ${op.atk} de ATK.`;
        if (op.t === 'summoned') return `Esse monstro perde ${op.atk} de ATK.`;
        if (op.t === 'allOpp') return `Todos os monstros do oponente com face para cima perdem ${op.atk} de ATK.`;
        break;
      case 'revive': return op.from === 'any'
        ? 'Invoque 1 monstro de qualquer Cemitério para o seu lado do campo, em Posição de Ataque.'
        : 'Invoque 1 monstro do seu Cemitério em Posição de Ataque.';
      case 'negate': return 'Negue o ataque.';
      case 'endBattle': return 'Encerre a Fase de Batalha.';
      case 'reflect': return 'Negue o ataque e cause dano ao oponente igual à metade do ATK do monstro atacante.';
      case 'stun': return 'O oponente não pode declarar ataques no próximo turno dele.';
    }
    return '';
  }

  const KW_TEXT = {
    pierce: 'PERFURANTE: ao atacar um monstro em Defesa, causa a diferença como dano.',
    direct: 'ATAQUE DIRETO: pode atacar o oponente diretamente, mesmo com monstros no campo.',
    double: 'ATAQUE DUPLO: pode atacar duas vezes por Fase de Batalha.',
  };
  const FX_PREFIX = { summon: 'INVOCADO', flip: 'VIRAR', destroyed: 'DESTRUÍDO' };

  function condText(cond) {
    if (!cond) return '';
    if (cond.minAtk) return ` com ${cond.minAtk} de ATK ou mais`;
    if (cond.maxAtk) return ` com ${cond.maxAtk} de ATK ou menos`;
    return '';
  }

  PD.cardText = function (c) {
    if (!c) return '';
    if (c.kind === 'monster') {
      const lines = [];
      if (c.fx) lines.push(`${FX_PREFIX[c.fx.on]}: ${c.fx.ops.map(opText).join(' ')}`);
      (c.kw || []).forEach((k) => lines.push(KW_TEXT[k]));
      if (c.aura) {
        const who = c.aura.race ? PD.RACES[c.aura.race] : PD.ATTRS[c.aura.attr].name;
        lines.push(`AURA: seus outros monstros ${who} ganham +${c.aura.atk} ATK.`);
      }
      return lines.join('\n');
    }
    if (c.kind === 'spell') {
      if (c.sub === 'field') {
        const f = c.field;
        const who = f.race ? `do tipo ${PD.RACES[f.race]}` : `de ${PD.ATTRS[f.attr].name.toUpperCase()}`;
        return `CAMPO: todos os monstros ${who} no campo ganham +${f.atk} ATK e +${f.def} DEF. Substitui a Magia de Campo anterior.`;
      }
      const pre = c.sub === 'equip' ? 'EQUIPAR: ' : '';
      return pre + c.ops.map(opText).join(' ');
    }
    if (c.kind === 'trap') {
      let pre = '';
      if (c.trigger === 'attack') pre = `Quando um monstro do oponente${condText(c.cond)} declarar um ataque: `;
      else if (c.trigger === 'summon') pre = `Quando o oponente Invocar um monstro${condText(c.cond)}: `;
      else pre = 'Ative no seu turno, a partir do turno seguinte ao que foi baixada: ';
      return pre + c.ops.map(opText).join(' ');
    }
    return '';
  };

  PD.kindLabel = function (c) {
    if (c.kind === 'monster') {
      const tags = [PD.RACES[c.race]];
      if (c.fx || c.kw || c.aura) tags.push('Efeito');
      return tags.join(' / ');
    }
    if (c.kind === 'spell') return { normal: 'Magia', equip: 'Magia de Equipamento', field: 'Magia de Campo' }[c.sub];
    return { attack: 'Armadilha de Batalha', summon: 'Armadilha de Invocação', manual: 'Armadilha' }[c.trigger];
  };

  PD.tributesFor = (level) => (level >= 7 ? 2 : level >= 5 ? 1 : 0);

  /* ---------------- Decks prontos ---------------- */
  const D = (spec) => spec.flatMap(([id, n]) => Array(n).fill(id));
  PD.STARTER_DECKS = [
    {
      name: 'Alvorada Inicial', format: 'gen1',
      cards: D([['A01', 2], ['A02', 2], ['A04', 2], ['A07', 3], ['A10', 2], ['A11', 1], ['A13', 2], ['A15', 2], ['A06', 1],
        ['A16', 1], ['A17', 1], ['A18', 1], ['A20', 2], ['A21', 1], ['A22', 1], ['A23', 1], ['A24', 2], ['A25', 1], ['A26', 1],
        ['A27', 2], ['A28', 1], ['A29', 2]]),
    },
    {
      name: 'Segredos das Ruínas', format: 'gen2',
      cards: D([['B01', 2], ['B02', 2], ['B03', 2], ['B05', 2], ['B06', 3], ['B11', 2], ['B12', 2], ['A15', 2], ['A12', 1],
        ['B07', 1], ['B08', 1], ['B09', 1], ['B13', 1], ['B15', 1], ['B17', 2], ['B18', 2], ['B19', 1], ['A23', 1],
        ['B21', 1], ['B22', 2], ['B24', 1], ['A28', 1]]),
    },
    {
      name: 'Linha de Montagem', format: 'gen3',
      cards: D([['C01', 3], ['C02', 2], ['C03', 2], ['C05', 2], ['C06', 3], ['C04', 2], ['C10', 1], ['C11', 2], ['C12', 1],
        ['C08', 1], ['C09', 1], ['B13', 1], ['C13', 1], ['C14', 1], ['C15', 2], ['C16', 1], ['C18', 1], ['A23', 1],
        ['C19', 2], ['C20', 1], ['C21', 1], ['A29', 1]]),
    },
    {
      name: 'Fúria dos Dragões', format: 'livre',
      cards: D([['D01', 2], ['D02', 3], ['D07', 2], ['D08', 2], ['A13', 2], ['D10', 1], ['A07', 2], ['D03', 1], ['D04', 1],
        ['D11', 1], ['D05', 1], ['D09', 1], ['A18', 1], ['D13', 1], ['D12', 2], ['D16', 2], ['D14', 1], ['A22', 1],
        ['D17', 1], ['D18', 1], ['D19', 1], ['A27', 2]]),
    },
  ];

  /* ---------------- Oponentes da CPU ---------------- */
  PD.CPU_OPPONENTS = [
    { id: 'bento', name: 'Bento, o Aprendiz', title: 'Gen I · fácil', deck: 0, seed: 'bento', hair: 30, cloth: 210, skin: 28 },
    { id: 'nefra', name: 'Nefra das Ruínas', title: 'Gen II · médio', deck: 1, seed: 'nefra', hair: 280, cloth: 45, skin: 24 },
    { id: 'volt', name: 'Engenheiro Volt', title: 'Gen III · médio', deck: 2, seed: 'volt', hair: 200, cloth: 25, skin: 30 },
    { id: 'ignis', name: 'Rainha Ignis', title: 'Gen IV · difícil', deck: 3, seed: 'ignis', hair: 5, cloth: 350, skin: 22 },
  ];

  /* ---------------- Validação de deck ---------------- */
  PD.formatById = (id) => PD.FORMATS.find((f) => f.id === id) || PD.FORMATS[PD.FORMATS.length - 1];

  PD.validateDeck = function (cards, formatId) {
    const fmt = PD.formatById(formatId);
    const errors = [];
    const R = PD.RULES;
    if (cards.length < R.deckMin) errors.push(`O deck tem ${cards.length} cartas; o mínimo é ${R.deckMin}.`);
    if (cards.length > R.deckMax) errors.push(`O deck tem ${cards.length} cartas; o máximo é ${R.deckMax}.`);
    const counts = {};
    cards.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    for (const [id, n] of Object.entries(counts)) {
      const c = PD.card(id);
      if (!c) { errors.push(`Carta desconhecida: ${id}.`); continue; }
      const max = c.limit || R.copies;
      if (n > max) errors.push(`${c.name}: ${n} cópias (máximo ${max}).`);
      if (!fmt.gens.includes(c.gen)) errors.push(`${c.name} é da Gen ${PD.GENS[c.gen].roman} e não vale em ${fmt.name}.`);
    }
    return { ok: errors.length === 0, errors };
  };

  /** Menor formato em que o deck é válido (ou null). */
  PD.deckFormat = function (cards) {
    for (const f of PD.FORMATS) if (PD.validateDeck(cards, f.id).ok) return f.id;
    return null;
  };
})();
