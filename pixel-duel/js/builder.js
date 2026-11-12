/* Pixel Duel — construtor de deck. */
(function () {
  const PD = (window.PD = window.PD || {});
  const filters = { q: '', gen: 'all', kind: 'all', sort: 'gen' };
  let current = null;

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const KIND_ORDER = { monster: 0, spell: 1, trap: 2 };

  function counts(cards) { const m = {}; cards.forEach((id) => { m[id] = (m[id] || 0) + 1; }); return m; }
  function maxCopies(c) { return c.limit || PD.RULES.copies; }

  function exportText(deck) {
    const cnt = counts(deck.cards);
    const ids = Object.keys(cnt).sort((a, b) => KIND_ORDER[PD.card(a).kind] - KIND_ORDER[PD.card(b).kind] || a.localeCompare(b));
    return `=== ${deck.name} ===\n` + ids.map((id) => `${cnt[id]}x ${PD.card(id).name}`).join('\n');
  }

  function importText(text) {
    const byName = {};
    PD.CARDS.forEach((c) => { byName[norm(c.name)] = c.id; });
    const cards = [];
    const errors = [];
    let name = null;
    text.split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      const title = line.match(/^===\s*(.+?)\s*===$/);
      if (title) { name = title[1]; return; }
      const mm = line.match(/^(\d+)\s*x?\s+(.+)$/i) || [null, '1', line];
      const id = byName[norm(mm[2].trim())];
      if (!id) { errors.push(`Carta não encontrada: "${mm[2].trim()}"`); return; }
      for (let i = 0; i < Math.min(+mm[1], 9); i++) cards.push(id);
    });
    return { name, cards, errors };
  }

  function render(root) {
    const { h, cardEl, toast, modal } = PD.UI;
    const decks = PD.Decks.all();
    if (!current || !PD.Decks.get(current)) current = PD.App.selectedDeck.id;
    const deck = PD.Decks.get(current);
    root.innerHTML = '';

    const save = () => { PD.Decks.save(); };
    const rerender = () => {
      const y = window.scrollY;
      const poolScroll = root.querySelector('.pool') ? root.querySelector('.pool').scrollTop : 0;
      render(root);
      window.scrollTo(0, y);
      const p = root.querySelector('.pool');
      if (p) p.scrollTop = poolScroll;
    };

    /* lista de decks */
    const list = h('section', { class: 'win' },
      h('h2', null, 'Meus decks'),
      h('div', { class: 'deck-list' }, decks.map((d) => {
        const f = PD.deckFormat(d.cards);
        return h('button', { class: 'deck-item', 'aria-current': d.id === current ? 'true' : 'false', onclick: () => { current = d.id; PD.App.selectDeck(d.id); PD.Audio.play('select'); rerender(); } },
          h('span', { class: 'di-name' }, d.name),
          h('span', { class: 'di-meta' }, `${d.cards.length} cartas · ${f ? PD.formatById(f).name.match(/\[(.+?)\]/)[1] : 'inválido'}`));
      })),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn sm gold', onclick: () => { const d = PD.Decks.add('Novo deck', []); current = d.id; PD.App.selectDeck(d.id); rerender(); } }, '+ Novo deck'),
        h('button', { class: 'btn sm ghost', onclick: () => { PD.Decks.resetStarters(); toast('Decks iniciais adicionados.'); rerender(); } }, 'Decks iniciais')));

    /* cabeçalho do editor */
    const nameInp = h('input', { class: 'inp', id: 'deck-name', maxlength: '28', value: deck.name, oninput: (e) => { deck.name = e.target.value || 'Sem nome'; save(); } });
    nameInp.addEventListener('change', rerender);
    const okFormats = PD.FORMATS.filter((f) => PD.validateDeck(deck.cards, f.id).ok);
    const errs = PD.validateDeck(deck.cards, 'livre').errors;
    const head = h('section', { class: 'win' },
      h('div', { class: 'editor-head' },
        h('div', { class: 'field-row grow' }, h('label', { for: 'deck-name' }, 'NOME DO DECK'), nameInp),
        h('button', { class: 'btn sm', onclick: () => openIO(deck, rerender) }, 'Importar / Exportar'),
        h('button', { class: 'btn sm ghost', onclick: () => { const d = PD.Decks.add(deck.name + ' (cópia)', deck.cards.slice()); current = d.id; rerender(); } }, 'Duplicar'),
        h('button', { class: 'btn sm red', onclick: () => {
          modal({ title: 'Excluir deck?', body: `"${deck.name}" será apagado deste navegador.`,
            actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Excluir', cls: 'red', onClick: (c) => { PD.Decks.remove(deck.id); current = null; c(); rerender(); } }] });
        } }, 'Excluir')),
      okFormats.length
        ? h('div', { class: 'deck-status ok' }, 'Válido em: ', okFormats.map((f) => h('span', { class: 'pill gen', style: { marginRight: '4px' } }, f.name.match(/\[(.+?)\]/)[1])))
        : h('ul', { class: 'errors' }, errs.slice(0, 4).map((e) => h('li', null, e))));

    /* lista do deck */
    const cnt = counts(deck.cards);
    const mons = deck.cards.filter((id) => PD.card(id).kind === 'monster');
    const levels = [1, 2, 3, 4, 5, 6, 7, 8].map((lv) => mons.filter((id) => PD.card(id).level === lv).length);
    const maxLv = Math.max(1, ...levels);
    const sections = [['monster', 'MONSTROS'], ['spell', 'MAGIAS'], ['trap', 'ARMADILHAS']];
    const deckPanel = h('section', { class: 'win' },
      h('h2', null, `Deck · ${deck.cards.length}/${PD.RULES.deckMax}`),
      h('div', { class: 'mix' },
        h('span', null, 'Monstros ', h('b', null, mons.length)),
        h('span', null, 'Magias ', h('b', null, deck.cards.filter((id) => PD.card(id).kind === 'spell').length)),
        h('span', null, 'Armadilhas ', h('b', null, deck.cards.filter((id) => PD.card(id).kind === 'trap').length))),
      h('div', { class: 'curve-wrap' },
        h('div', { class: 'muted small' }, 'Monstros por nível'),
        h('div', { class: 'curve', 'aria-label': 'Curva de níveis' }, levels.map((n, i) =>
          h('div', { style: { height: (n / maxLv) * 100 + '%' }, title: `Nível ${i + 1}: ${n}` }, h('span', null, i + 1))))),
      h('div', { class: 'decklist' },
        deck.cards.length ? null : h('p', { class: 'muted' }, 'Deck vazio. Clique nas cartas da coleção para adicionar.'),
        sections.map(([kind, label]) => {
          const ids = Object.keys(cnt).filter((id) => PD.card(id).kind === kind)
            .sort((a, b) => (PD.card(b).level || 0) - (PD.card(a).level || 0) || a.localeCompare(b));
          if (!ids.length) return null;
          return [h('div', { class: 'dl-section' }, label), ids.map((id) => {
            const c = PD.card(id);
            return h('div', { class: 'dl-row' },
              h('img', { class: 'px', src: PD.Sprites.cardArt(id), alt: '' }),
              h('span', { class: 'dl-name', title: c.name }, c.name),
              h('span', { class: 'dl-ctrl' },
                h('button', { 'aria-label': 'Remover uma cópia', onclick: () => { deck.cards.splice(deck.cards.indexOf(id), 1); save(); PD.Audio.play('back'); rerender(); } }, '−'),
                h('span', null, cnt[id]),
                h('button', { 'aria-label': 'Adicionar uma cópia', disabled: cnt[id] >= maxCopies(c) || deck.cards.length >= PD.RULES.deckMax ? true : null,
                  onclick: () => { deck.cards.push(id); save(); PD.Audio.play('select'); rerender(); } }, '+')));
          })];
        })));

    /* coleção */
    const q = h('input', { class: 'inp', id: 'pool-q', placeholder: 'Buscar por nome ou efeito...', value: filters.q });
    const sel = (id, key, opts) => {
      const s = h('select', { class: 'inp', id }, opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v ? true : null }, l)));
      s.addEventListener('change', () => { filters[key] = s.value; drawPool(); });
      return s;
    };
    const poolBox = h('div', { class: 'pool' });
    function drawPool() {
      poolBox.innerHTML = '';
      const nq = norm(filters.q);
      let cards = PD.CARDS.filter((c) =>
        (filters.gen === 'all' || c.gen === +filters.gen) &&
        (filters.kind === 'all' || c.kind === filters.kind || (filters.kind.startsWith('attr:') && c.attr === filters.kind.slice(5))) &&
        (!nq || norm(c.name).includes(nq) || norm(PD.cardText(c)).includes(nq) || (c.race && norm(PD.RACES[c.race]).includes(nq))));
      const sorters = {
        gen: (a, b) => a.gen - b.gen || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id),
        atk: (a, b) => (b.atk || -1) - (a.atk || -1),
        level: (a, b) => (b.level || 0) - (a.level || 0) || (b.atk || 0) - (a.atk || 0),
        name: (a, b) => a.name.localeCompare(b.name),
      };
      cards = cards.sort(sorters[filters.sort]);
      if (!cards.length) poolBox.append(h('p', { class: 'muted' }, 'Nenhuma carta com esses filtros.'));
      cards.forEach((c) => {
        const n = cnt[c.id] || 0;
        const full = n >= maxCopies(c) || deck.cards.length >= PD.RULES.deckMax;
        poolBox.append(h('button', { class: 'crow' + (full ? ' maxed' : ''), title: full ? 'Limite atingido' : 'Adicionar ao deck',
          onclick: () => {
            if (full) { PD.Audio.play('error'); toast(n >= maxCopies(c) ? `Máximo de ${maxCopies(c)} cópia(s) de ${c.name}.` : 'O deck já tem 40 cartas.'); return; }
            deck.cards.push(c.id); save(); PD.Audio.play('select'); rerender();
          } },
          h('img', { class: 'px', src: PD.Sprites.cardArt(c.id), alt: '' }),
          h('span', { style: { minWidth: 0 } },
            h('span', { class: 'cr-name' }, c.name,
              h('span', { class: 'pill gen' }, 'GEN ' + PD.GENS[c.gen].roman),
              c.kind !== 'monster' ? h('span', { class: 'pill kind-' + c.kind }, c.kind === 'spell' ? 'MAGIA' : 'ARMADILHA') : null,
              c.limit ? h('span', { class: 'pill lim' }, 'LIMITE ' + c.limit) : null),
            h('span', { class: 'cr-meta' }, PD.UI.cardSubtitle(c)),
            PD.cardText(c) ? h('div', { class: 'cr-text' }, PD.cardText(c)) : (c.flavor ? h('div', { class: 'cr-text muted' }, c.flavor) : null)),
          h('span', { class: 'cr-stats' }, c.kind === 'monster' ? [h('div', null, `${c.atk}`), h('div', { class: 'muted' }, `${c.def}`)] : null, h('div', { class: 'muted' }, `${n}/${maxCopies(c)}`))));
      });
    }
    q.addEventListener('input', () => { filters.q = q.value; drawPool(); });
    const poolPanel = h('section', { class: 'win' },
      h('h2', null, `Coleção · ${PD.CARDS.length} cartas`),
      h('div', { class: 'filters' }, q,
        sel('pool-gen', 'gen', [['all', 'Todas as gerações'], ...Object.entries(PD.GENS).map(([g, i]) => [g, `Gen ${i.roman} · ${i.name}`])]),
        sel('pool-kind', 'kind', [['all', 'Todos os tipos'], ['monster', 'Monstros'], ['spell', 'Magias'], ['trap', 'Armadilhas'],
          ...Object.entries(PD.ATTRS).map(([k, a]) => ['attr:' + k, 'Atributo ' + a.name])]),
        sel('pool-sort', 'sort', [['gen', 'Ordem: geração'], ['atk', 'Ordem: ATK'], ['level', 'Ordem: nível'], ['name', 'Ordem: nome']])),
      poolBox);
    drawPool();

    root.append(h('div', { class: 'builder' }, list,
      h('div', { class: 'editor' }, head, h('div', { class: 'editor-cols' }, deckPanel, poolPanel))));
  }

  function openIO(deck, after) {
    const { h, modal, copyText, toast } = PD.UI;
    const ta = h('textarea', { class: 'inp', id: 'deck-io', spellcheck: 'false' });
    ta.value = exportText(deck);
    const err = h('ul', { class: 'errors' });
    modal({
      title: 'Importar / Exportar',
      body: h('div', { class: 'stack' },
        h('p', { class: 'muted small', style: { margin: 0 } }, 'Uma carta por linha, no formato "3x Nome da Carta". Copie para compartilhar ou cole uma lista e importe.'),
        ta, err),
      actions: [
        { label: 'Copiar', cls: 'ghost', onClick: () => copyText(ta.value, ta) },
        { label: 'Importar', cls: 'gold', onClick: (close) => {
          const r = importText(ta.value);
          err.innerHTML = '';
          r.errors.slice(0, 5).forEach((e) => err.append(h('li', null, e)));
          if (r.errors.length) return;
          deck.cards = r.cards;
          if (r.name) deck.name = r.name;
          PD.Decks.save();
          close();
          toast('Deck importado.');
          after();
        } },
      ],
    });
  }

  PD.Builder = { render, exportText, importText };
})();
