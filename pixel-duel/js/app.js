/* Pixel Duel — casca do app: armazenamento, utilitários de UI, lobby e desafios online. */
(function () {
  const PD = (window.PD = window.PD || {});

  /* ---------- armazenamento (falha em silêncio em modo privado) ---------- */
  const Store = {
    get(key, def) {
      try { const v = localStorage.getItem('pixelduel.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) { try { localStorage.setItem('pixelduel.' + key, JSON.stringify(val)); } catch (e) { /* sem armazenamento */ } },
  };
  PD.Store = Store;

  /* ---------- DOM ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Elemento visual de uma carta. id nulo = verso. */
  function cardEl(id, opts) {
    const o = opts || {};
    const c = id ? PD.card(id) : null;
    if (!c) return h('div', { class: 'card back', 'data-uid': o.uid });
    const cls = ['card', c.kind === 'monster' ? 'attr-' + c.attr : 'kind-' + c.kind];
    if (o.extraClass) cls.push(o.extraClass);
    let foot;
    if (c.kind === 'monster') {
      const atk = o.atk != null ? o.atk : c.atk;
      const def = o.def != null ? o.def : c.def;
      foot = h('div', { class: 'c-foot' },
        h('span', { class: atk > c.atk ? 'up' : atk < c.atk ? 'down' : '' }, atk),
        h('span', { class: def > c.def ? 'up' : def < c.def ? 'down' : '' }, def));
    } else {
      foot = h('div', { class: 'c-kind' }, c.kind === 'spell' ? (c.sub === 'field' ? 'CAMPO' : 'MAGIA') : 'ARMAD.');
    }
    return h('div', { class: cls.join(' '), 'data-uid': o.uid, 'data-id': c.id, title: o.title ? c.name : null },
      h('div', { class: 'c-name' }, c.name),
      h('div', { class: 'c-art px', style: { backgroundImage: `url(${PD.Sprites.cardArt(c.id)})` } }),
      c.kind === 'monster' ? h('div', { class: 'c-lv' }, '◆'.repeat(c.level)) : null,
      foot);
  }

  function cardSubtitle(c) {
    if (c.kind === 'monster') return `${PD.ATTRS[c.attr].name} · ${PD.kindLabel(c)} · Nível ${c.level}`;
    return PD.kindLabel(c);
  }

  /** Bloco de detalhes (painel lateral e menus). */
  function detailBlock(id, stats) {
    const c = PD.card(id);
    if (!c) return h('div', { class: 'detail empty' }, 'Passe o mouse ou toque em uma carta para ver os detalhes.');
    const text = PD.cardText(c);
    return h('div', { class: 'detail-inner' },
      h('div', { class: 'd-top' },
        h('div', { class: 'd-art px', style: { backgroundImage: `url(${PD.Sprites.cardArt(c.id)})` } }),
        h('div', null,
          h('div', { class: 'd-name' }, c.name),
          h('div', { class: 'd-sub' }, cardSubtitle(c)),
          h('div', { class: 'd-sub' }, `Gen ${PD.GENS[c.gen].roman} · ${PD.GENS[c.gen].name}${c.limit ? ` · Limite ${c.limit}` : ''}`),
          c.kind === 'monster' ? h('div', { class: 'd-stats' }, `ATK ${stats ? stats.atk : c.atk} / DEF ${stats ? stats.def : c.def}`) : null)),
      text ? h('div', { class: 'd-text' }, text) : null,
      c.flavor ? h('div', { class: 'd-flavor' }, c.flavor) : null);
  }

  /* ---------- toast, modal, menu ---------- */
  function toast(msg) {
    const old = $('.toast');
    if (old) old.remove();
    const t = h('div', { class: 'toast win', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2700);
  }

  function modal({ title, body, actions, onClose, dismissable }) {
    const box = h('div', { class: 'modal win', role: 'dialog', 'aria-modal': 'true' });
    const bd = h('div', { class: 'backdrop' }, box);
    const close = () => { bd.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable !== false) close(); };
    function set({ title: t, body: b, actions: acts }) {
      box.innerHTML = '';
      if (t) box.append(h('h2', null, t));
      if (b) box.append(b instanceof Node ? b : h('p', null, b));
      if (acts && acts.length) {
        box.append(h('div', { class: 'm-actions' }, acts.map((a) =>
          h('button', { class: 'btn ' + (a.cls || ''), onclick: () => { PD.Audio.play('select'); if (a.onClick) a.onClick(close); else close(); } }, a.label))));
      }
    }
    set({ title, body, actions });
    if (dismissable !== false) bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(bd);
    const first = box.querySelector('button, input, select');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, set, box };
  }

  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function menu(anchor, { title, text, options }) {
    closeMenu();
    const m = h('div', { class: 'menu win', role: 'menu' },
      title ? h('div', { class: 'm-title' }, title) : null,
      text ? h('div', { class: 'm-text' }, text) : null,
      options.map((o) => [
        h('button', { class: 'opt', role: 'menuitem', disabled: o.disabled ? true : null,
          onclick: (e) => { e.stopPropagation(); closeMenu(); PD.Audio.play('select'); o.onClick(); } }, o.label),
        o.disabled && o.why ? h('div', { class: 'why' }, o.why) : null,
      ]));
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth;
    const mh = m.offsetHeight;
    let x = r.right + 8;
    if (x + mw > window.innerWidth - 8) x = Math.max(8, r.left - mw - 8);
    let y = Math.min(Math.max(8, r.top), window.innerHeight - mh - 8);
    if (window.innerWidth < 560) { x = Math.max(8, (window.innerWidth - mw) / 2); y = Math.max(8, window.innerHeight - mh - 12); }
    m.style.left = x + 'px';
    m.style.top = Math.max(8, y) + 'px';
    openMenu = m;
    const first = m.querySelector('button:not([disabled])');
    if (first) first.focus();
    return m;
  }
  document.addEventListener('click', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  async function copyText(text, inputEl) {
    try { await navigator.clipboard.writeText(text); toast('Copiado!'); }
    catch (e) { if (inputEl) { inputEl.focus(); inputEl.select(); } toast('Selecione e copie o texto (Ctrl+C).'); }
  }

  PD.UI = { h, $, sleep, cardEl, detailBlock, cardSubtitle, toast, modal, menu, closeMenu, copyText };

  /* ---------- configurações e decks ---------- */
  const settings = Object.assign({ name: 'Duelista', sfx: true, music: false, crt: false, ps1: false }, Store.get('settings', {}));
  const saveSettings = () => Store.set('settings', settings);

  function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function starterCopies() { return PD.STARTER_DECKS.map((d) => ({ id: newId(), name: d.name, cards: d.cards.slice() })); }
  let decks = Store.get('decks', null);
  if (!Array.isArray(decks) || !decks.length) decks = starterCopies();
  decks = decks.filter((d) => d && Array.isArray(d.cards)).map((d) => ({ id: d.id || newId(), name: String(d.name || 'Deck'), cards: d.cards.filter((id) => PD.card(id)) }));
  const Decks = {
    all: () => decks,
    get: (id) => decks.find((d) => d.id === id),
    save() { Store.set('decks', decks); },
    add(name, cards) { const d = { id: newId(), name, cards: cards || [] }; decks.push(d); Decks.save(); return d; },
    remove(id) { decks = decks.filter((d) => d.id !== id); if (!decks.length) decks = starterCopies(); Decks.save(); },
    resetStarters() { starterCopies().forEach((d) => decks.push(d)); Decks.save(); },
  };
  PD.Decks = Decks;
  let selectedDeckId = Store.get('selectedDeck', null);
  if (!Decks.get(selectedDeckId)) selectedDeckId = decks[0].id;

  /* ---------- telas ---------- */
  const App = {
    settings, saveSettings,
    get selectedDeck() { return Decks.get(selectedDeckId) || decks[0]; },
    selectDeck(id) { selectedDeckId = id; Store.set('selectedDeck', id); },
    screen: 'lobby',
    show(name) {
      if (App.screen === 'duel' && name !== 'duel' && PD.Battle.active()) {
        PD.Battle.confirmLeave(() => App.show(name));
        return;
      }
      if (App.screen === 'duel' && name !== 'duel') PD.Battle.dispose();
      document.body.classList.toggle('in-duel', name === 'duel');
      App.screen = name;
      document.querySelectorAll('.nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.screen === name ? 'page' : 'false'));
      const root = $('#screen');
      root.className = 'screen' + (name === 'duel' ? ' duel' : '');
      root.innerHTML = '';
      if (name === 'lobby') renderLobby(root);
      else if (name === 'builder') PD.Builder.render(root);
      window.scrollTo(0, 0);
    },
  };
  PD.App = App;

  function deckValidityLine(cards) {
    const ok = PD.FORMATS.filter((f) => PD.validateDeck(cards, f.id).ok);
    if (ok.length) return h('div', { class: 'deck-status ok' }, `${cards.length} cartas · válido em ${ok.map((f) => 'Gen ' + f.name.match(/\[Gen ([IV]+)\]/)[1]).join(', ')}`);
    const v = PD.validateDeck(cards, 'livre');
    return h('div', { class: 'deck-status bad' }, `${cards.length} cartas · ${v.errors[0]}`);
  }

  /* ---------- lobby ---------- */
  function renderLobby(root) {
    const { h: H } = PD.UI;
    const nameInp = H('input', { class: 'inp', id: 'lobby-name', maxlength: '16', value: settings.name,
      oninput: (e) => { settings.name = e.target.value.trim() || 'Duelista'; saveSettings(); } });
    const deckSel = H('select', { class: 'inp', id: 'lobby-deck' },
      decks.map((d) => H('option', { value: d.id, selected: d.id === App.selectedDeck.id ? true : null }, `${d.name} (${d.cards.length})`)));
    const statusBox = H('div', null, deckValidityLine(App.selectedDeck.cards));
    deckSel.addEventListener('change', () => {
      App.selectDeck(deckSel.value);
      statusBox.innerHTML = '';
      statusBox.append(deckValidityLine(App.selectedDeck.cards));
    });

    const fmtSel = H('select', { class: 'inp', id: 'lobby-format' }, PD.FORMATS.map((f) => H('option', { value: f.id, selected: f.id === (Store.get('format', 'livre')) ? true : null }, f.name)));
    fmtSel.addEventListener('change', () => Store.set('format', fmtSel.value));
    const codeInp = H('input', { class: 'inp', id: 'lobby-code', maxlength: '6', placeholder: 'Ex.: K7QX2M', style: { textTransform: 'uppercase' } });
    const localChk = H('input', { type: 'checkbox', id: 'lobby-local' });

    const online = PD.Net.onlineSupported();
    const onlineBody = H('div', { class: 'stack' },
      !online ? H('div', { class: 'notice' }, PD.ARTIFACT_BUILD
        ? 'Esta prévia roda dentro do Claude, onde conexões entre navegadores são bloqueadas. Para desafiar um amigo, abra a versão hospedada do jogo (veja o README do projeto). O modo local de duas abas abaixo também funciona fora da prévia.'
        : 'Seu navegador não suporta WebRTC; o duelo online não vai funcionar aqui.') : null,
      H('div', { class: 'row' },
        H('div', { class: 'field-row grow' }, H('label', { for: 'lobby-format' }, 'FORMATO'), fmtSel),
        H('button', { class: 'btn gold', onclick: () => hostFlow(fmtSel.value, localChk.checked) }, 'Criar desafio')),
      H('div', { class: 'row' },
        H('div', { class: 'field-row grow' }, H('label', { for: 'lobby-code' }, 'CÓDIGO DA SALA'), codeInp),
        H('button', { class: 'btn', onclick: () => {
          const code = codeInp.value.trim().toUpperCase();
          if (!/^[A-Z0-9]{6}$/.test(code)) { toast('O código tem 6 letras/números.'); return; }
          joinFlow(code);
        } }, 'Entrar')),
      H('label', { class: 'small muted', style: { display: 'flex', gap: '8px', alignItems: 'center' } }, localChk,
        'Teste local: duelo entre duas abas deste navegador (sem internet).'));

    const heroCards = ['A18', 'B24', 'D13'];
    root.append(H('div', { class: 'lobby' },
      H('div', { class: 'stack' },
        H('div', { class: 'hero' },
          H('div', { class: 'hero-cards' }, heroCards.map((id) => cardEl(id))),
          H('div', null,
            H('h1', null, 'PIXEL DUEL', H('small', null, PD.GFX3D ? 'ARENA 3D DE CARTAS' : 'ARENA DE CARTAS')),
            H('p', null, 'Monte seu deck com cartas de quatro gerações, escolha um formato e desafie a CPU ou um amigo pelo link.'))),
        H('section', { class: 'win' },
          H('h2', null, 'Seu duelista'),
          H('div', { class: 'row' },
            H('div', { class: 'field-row grow' }, H('label', { for: 'lobby-name' }, 'NOME'), nameInp),
            H('div', { class: 'field-row grow' }, H('label', { for: 'lobby-deck' }, 'DECK'), deckSel),
            H('button', { class: 'btn ghost', onclick: () => App.show('builder') }, 'Editar decks')),
          statusBox),
        H('section', { class: 'win' },
          H('h2', null, 'Duelo contra a CPU'),
          H('div', { class: 'opponents' }, PD.CPU_OPPONENTS.map((o) =>
            H('button', { class: 'opp-card', onclick: () => startCpu(o) },
              H('img', { class: 'px', src: PD.Sprites.portraitArt(o), alt: '' }),
              H('span', null, H('b', null, o.name), H('span', { class: 'muted' }, `${o.title} · deck "${PD.STARTER_DECKS[o.deck].name}"`)))))),
        H('section', { class: 'win' }, H('h2', null, 'Duelo online'), onlineBody)),
      H('div', { class: 'stack' },
        H('section', { class: 'win rules' },
          H('h2', null, 'Como jogar'),
          H('ol', null,
            H('li', null, 'Cada duelista começa com 8000 PV e 5 cartas. Zere os PV do oponente ou deixe-o sem cartas para comprar.'),
            H('li', null, 'Uma Invocação por turno. Nível 5–6 pede 1 sacrifício; nível 7 ou mais, 2.'),
            H('li', null, 'Monstros baixados ficam em Defesa, com a face para baixo. Viram quando são atacados ou quando você os vira.'),
            H('li', null, 'Ataque contra Ataque: o mais fraco é destruído e o dono sofre a diferença. Contra Defesa: só destrói, sem dano (exceto PERFURANTE).'),
            H('li', null, 'Armadilhas são baixadas e disparam no turno do oponente, quando ele ataca ou invoca.'),
            H('li', null, 'Quem começa não ataca no primeiro turno.'))),
        H('section', { class: 'win' },
          H('h2', null, 'Gerações'),
          H('p', { class: 'muted small', style: { margin: 0 } }, 'Os formatos são cumulativos: o formato Gen III aceita cartas das Gen I, II e III.'),
          H('div', { class: 'gen-list' }, Object.entries(PD.GENS).map(([g, info]) =>
            H('div', { class: 'gen-item' },
              H('span', { class: 'gen-tag' }, 'GEN ' + info.roman),
              H('span', null, H('b', null, info.name), ` · ${PD.CARDS.filter((c) => c.gen === +g).length} cartas. `, H('span', { class: 'muted' }, info.blurb)))))))));
  }

  function needDeck(formatId) {
    const deck = App.selectedDeck;
    const v = PD.validateDeck(deck.cards, formatId);
    if (!v.ok) {
      modal({ title: 'Deck inválido', body: h('div', null, h('p', null, `"${deck.name}" não vale em ${PD.formatById(formatId).name}:`), h('ul', { class: 'errors' }, v.errors.slice(0, 6).map((e) => h('li', null, e)))),
        actions: [{ label: 'Editar deck', cls: 'gold', onClick: (c) => { c(); App.show('builder'); } }, { label: 'Fechar', cls: 'ghost' }] });
      return null;
    }
    return deck;
  }

  function startCpu(cpu) {
    PD.Audio.play('select');
    const deck = needDeck('livre');
    if (!deck) return;
    const m = PD.Net.cpuMatch({ deck: deck.cards, name: settings.name, cpu });
    PD.Battle.attach(m);
    m.start();
  }

  /* ---------- online: anfitrião ---------- */
  function hostFlow(formatId, local) {
    const deck = needDeck(formatId);
    if (!deck) return;
    if (!local && !PD.Net.onlineSupported()) { toast('Duelo online indisponível aqui. Use o teste local ou a versão hospedada.'); return; }
    const m = PD.Net.hostMatch({ deck: deck.cards, name: settings.name, format: formatId, local });
    const status = h('p', { class: 'muted' }, 'Criando sala...');
    const md = modal({ title: 'Desafio online', body: status, dismissable: false,
      actions: [{ label: 'Cancelar', cls: 'ghost', onClick: (c) => { m.leave(); c(); } }] });
    m.on('status', (msg) => { status.textContent = msg; });
    m.on('closed', (msg) => { if (!PD.Battle.active()) { md.close(); toast(msg); } });
    PD.Battle.attach(m, () => md.close());
    m.open().then((code) => {
      const link = location.href.split('#')[0] + '#sala-' + code;
      const linkInp = h('input', { class: 'inp', readonly: true, value: local ? code : link, id: 'invite-link' });
      md.set({
        title: 'Desafio criado',
        body: h('div', { class: 'stack' },
          h('div', { class: 'code-big' }, code),
          h('p', null, local
            ? 'Abra este jogo em outra aba do mesmo navegador e entre com o código acima.'
            : `Envie o link para o seu oponente. Formato: ${PD.formatById(formatId).name}. Deixe esta aba aberta.`),
          h('div', { class: 'invite-box' }, linkInp, h('button', { class: 'btn sm', onclick: () => copyText(linkInp.value, linkInp) }, 'Copiar')),
          status),
        actions: [{ label: 'Cancelar', cls: 'ghost', onClick: (c) => { m.leave(); c(); } }],
      });
      status.textContent = 'Esperando o oponente entrar...';
    }).catch((err) => {
      md.set({ title: 'Não deu para criar a sala', body: err.message, actions: [{ label: 'Fechar', onClick: (c) => c() }] });
    });
  }

  /* ---------- online: convidado ---------- */
  function joinFlow(code) {
    if (!code.startsWith('L') && !PD.Net.onlineSupported()) {
      modal({ title: 'Duelo online indisponível', body: 'Esta versão não consegue abrir conexões entre navegadores. Abra o link do convite na versão hospedada do jogo.', actions: [{ label: 'OK' }] });
      return;
    }
    const m = PD.Net.guestMatch({ code, name: settings.name });
    const status = h('p', { class: 'muted' }, `Conectando à sala ${code}...`);
    const md = modal({ title: 'Entrando no desafio', body: status, dismissable: false,
      actions: [{ label: 'Cancelar', cls: 'ghost', onClick: (c) => { m.leave(); c(); } }] });
    m.on('closed', (msg) => { if (!PD.Battle.active()) { md.set({ title: 'Conexão encerrada', body: msg, actions: [{ label: 'OK' }] }); } });
    PD.Battle.attach(m, () => md.close());
    m.on('hello', (msg) => {
      const valid = decks.filter((d) => PD.validateDeck(d.cards, msg.format).ok);
      const fmt = PD.formatById(msg.format);
      const err = h('p', { class: 'bad' });
      if (!valid.length) {
        md.set({ title: 'Nenhum deck válido', body: h('div', null, h('p', null, `${msg.name} desafiou você no formato ${fmt.name}, mas nenhum dos seus decks vale nesse formato.`)),
          actions: [{ label: 'Montar deck', cls: 'gold', onClick: (c) => { m.leave(); c(); App.show('builder'); } }, { label: 'Sair', cls: 'ghost', onClick: (c) => { m.leave(); c(); } }] });
        return;
      }
      const sel = h('select', { class: 'inp', id: 'join-deck' }, valid.map((d) => h('option', { value: d.id, selected: d.id === App.selectedDeck.id ? true : null }, `${d.name} (${d.cards.length})`)));
      md.set({
        title: 'Você foi desafiado!',
        body: h('div', { class: 'stack' },
          h('p', null, h('b', null, msg.name), ` desafiou você para um duelo no formato `, h('b', null, fmt.name), '.'),
          h('div', { class: 'field-row' }, h('label', { for: 'join-deck' }, 'ESCOLHA SEU DECK'), sel), err),
        actions: [
          { label: 'Recusar', cls: 'ghost', onClick: (c) => { m.leave(); c(); } },
          { label: 'Aceitar duelo', cls: 'gold', onClick: () => { App.selectDeck(sel.value); m.join(Decks.get(sel.value).cards); err.textContent = 'Aguardando o anfitrião...'; } },
        ],
      });
      m.on('rejected', (reason) => { err.textContent = 'Deck recusado: ' + reason; });
    });
    m.connect().then(() => { status.textContent = 'Conectado! Recebendo o desafio...'; })
      .catch((e) => md.set({ title: 'Não foi possível entrar', body: e.message, actions: [{ label: 'OK' }] }));
  }

  /* ---------- inicialização ---------- */
  function boot() {
    const root = $('#app');
    const toggles = [
      ['sfx', 'SOM', (on) => PD.Audio.setSfx(on)],
      ['music', 'MÚSICA', (on) => PD.Audio.setMusic(on)],
      ['crt', 'CRT', (on) => document.body.classList.toggle('crt', on)],
    ];
    if (PD.GFX3D) {
      document.body.classList.add('gfx-3d');
      toggles.push(['ps1', 'PS1', (on) => { document.body.classList.toggle('ps1', on); PD.Battle.setLowRes(on); }]);
    }
    root.append(
      h('header', { class: 'topbar' },
        h('div', { class: 'logo', role: 'button', tabindex: '0', onclick: () => App.show('lobby') }, 'PIXEL', h('span', null, ' DUEL')),
        h('nav', { class: 'nav' },
          h('button', { 'data-screen': 'lobby', onclick: () => App.show('lobby') }, 'Lobby'),
          h('button', { 'data-screen': 'builder', onclick: () => App.show('builder') }, 'Decks')),
        h('div', { class: 'top-tools' }, toggles.map(([key, label, fn]) => {
          fn(settings[key]);
          return h('button', { class: 'toggle', 'aria-pressed': String(!!settings[key]), onclick: (e) => {
            settings[key] = !settings[key];
            e.currentTarget.setAttribute('aria-pressed', String(settings[key]));
            fn(settings[key]);
            saveSettings();
            PD.Audio.play('select');
          } }, label);
        }))),
      h('main', { id: 'screen', class: 'screen' }));
    App.show('lobby');
    const m = location.hash.match(/^#sala-([A-Za-z0-9]{6})$/);
    if (m) {
      const code = m[1].toUpperCase();
      history.replaceState(null, '', location.href.split('#')[0]);
      joinFlow(code);
    }
  }
  PD.boot = boot;
})();
