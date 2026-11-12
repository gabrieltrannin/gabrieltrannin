/* Prancheta FC — interface: telas, navegação e interações */

const UI = { tela: 'inicio', visual: 'pixel', escDiv: 'A', elFiltro: 'todos', tabDiv: null, rodVer: null,
  merc: { busca: '', liga: 'todas', pos: 'todas', max: 0, interessados: false, reais: false, ordem: 'ovr', n: 30 },
  tat: { sel: null }, neg: null, partida: null, vista: null, loop: null, vel: 1, pausado: false, ultimo: null, confirmarReset: false, sub: null };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tier = o => o >= 80 ? 't-ouro' : o >= 72 ? 't-prata' : o >= 64 ? 't-bronze' : 't-base';
const posTag = p => `<span class="pos ${POSICOES[p].cor}" title="${POSICOES[p].nome}">${p}</span>`;
const escudo = (id, t = 40) => escudoSVG(CL[id], UI.visual, t);
const dec = (v, n = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n });
const nomeCurto = n => n.length > 13 && n.includes(' ') ? n.split(' ').slice(-1)[0] : n;
const formHTML = f => `<span class="form">${(f || []).map(x => `<i class="${x}">${x}</i>`).join('') || '<span class="dim small">sem jogos</span>'}</span>`;
function img(j, modo = 'corpo', estilo) { return `<img class="spr" alt="" src="${retratoURL({ nome: j.nome, pos: j.pos, look: j.look, kit: kitJog(j) }, estilo || UI.visual, modo)}">`; }
function estrelas(g) { const n = clamp(Math.round((g - 54) / 5), 1, 5); return `<span class="estrelas" aria-label="${n} de 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`; }
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 2600); }

const IC = {
  central: '<path d="M3 11l9-7 9 7v9H15v-6H9v6H3z"/>',
  elenco: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5.5 5"/>',
  tatica: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.5"/><path d="M9 3v3h6V3M9 21v-3h6v3"/>',
  mercado: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  tabela: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v3M8 20h8"/>',
  clube: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  recursos: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M16.5 13v7M13 16.5h7"/>',
};
const icone = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="${UI.visual === 'pixel' ? 'square' : 'round'}" stroke-linejoin="${UI.visual === 'pixel' ? 'miter' : 'round'}" ${UI.visual === 'pixel' ? 'shape-rendering="crispEdges"' : ''} aria-hidden="true">${IC[k]}</svg>`;
const MENU = [['central', 'Central'], ['elenco', 'Elenco'], ['tatica', 'Tática'], ['mercado', 'Mercado'], ['tabela', 'Tabela'], ['clube', 'Clube'], ['recursos', 'Recursos']];

// ---------- visual ----------
function setVisual(v) {
  UI.visual = v; document.documentElement.setAttribute('data-visual', v);
  try { localStorage.setItem('prancheta-visual', v); } catch (e) { }
  if (S) { S.visual = v; salvar(); }
  render();
}
function segVisual() {
  return `<div class="seg" role="group" aria-label="Estilo visual"><button data-a="visual" data-x="pixel" aria-pressed="${UI.visual === 'pixel'}">Pixel</button><button data-a="visual" data-x="3d" aria-pressed="${UI.visual === '3d'}">3D</button></div>`;
}

// ---------- render geral ----------
function render() {
  if (UI.tela !== 'partida') pararLoop();
  const app = $('#app');
  const comCarreira = S && S.clube;
  if (!comCarreira && !['inicio', 'escolha', 'recursos'].includes(UI.tela)) UI.tela = 'inicio';
  const semMenu = !comCarreira || ['partida', 'prejogo', 'posjogo'].includes(UI.tela);
  const telas = { inicio: telaInicio, escolha: telaEscolha, central: telaCentral, elenco: telaElenco, tatica: telaTatica, mercado: telaMercado,
    tabela: telaTabela, clube: telaClube, recursos: telaRecursos, prejogo: telaPreJogo, partida: telaPartida, posjogo: telaPosJogo };
  app.innerHTML = `${topo()}<div class="corpo ${semMenu ? 'sem-menu' : ''}">${semMenu ? '' : menuLateral()}<main id="tela">${telas[UI.tela]()}</main></div>${semMenu ? '' : menuBaixo()}`;
  posRender();
}
function topo() {
  const c = S && S.clube ? CL[S.clube] : null;
  const D = c ? S.div[minhaDiv()] : null;
  return `<header class="topo"><div class="topo-in">
    <button class="logo" data-a="ir" data-x="${c ? 'central' : 'inicio'}" aria-label="Prancheta FC, início"><span class="logo-mark">P</span><span class="logo-txt">Prancheta <b>FC</b></span></button>
    ${c ? `<div class="topo-clube">${escudo(c.id, 26)}<span class="nm">${esc(c.nome)}</span><span class="chip">${DIVISOES[minhaDiv()].curto}</span></div>` : ''}
    <div class="topo-info">
      ${c ? `<div class="kv hide-md"><span class="k">Temporada ${S.ano}</span><span class="v">Rodada ${Math.min(S.rodada + 1, D.rodadas.length)}/${D.rodadas.length}</span></div>
      <div class="kv"><span class="k">Caixa</span><span class="v">${fmtMi(S.caixa)}</span></div>` : ''}
      ${segVisual()}
    </div></div></header>`;
}
function menuLateral() {
  return `<nav class="menu" aria-label="Menu">${MENU.map(([k, n], i) => `${i === 6 ? '<div class="sep"></div>' : ''}<button data-a="ir" data-x="${k}" ${UI.tela === k ? 'aria-current="page"' : ''}>${icone(k)}${n}</button>`).join('')}</nav>`;
}
function menuBaixo() { return `<nav class="menu-baixo" aria-label="Menu">${MENU.map(([k, n]) => `<button data-a="ir" data-x="${k}" ${UI.tela === k ? 'aria-current="page"' : ''}>${icone(k)}<span>${n}</span></button>`).join('')}</nav>`; }
function posRender() {
  document.querySelectorAll('canvas[data-estadio]').forEach(cv => desenhaEstadio(cv, CL[cv.dataset.estadio], UI.visual));
  if (UI.tela === 'partida') iniciarVistaPartida();
}
function ir(t) { UI.tela = t; UI.tat.sel = null; UI.confirmarReset = false; render(); window.scrollTo(0, 0); }

// ---------- jogadores de vitrine (antes de existir carreira) ----------
function vitrine() {
  const mk = (nome, pos, nac, clube) => ({ nome, pos, look: gerarLook(nome, nac), kit: CL[clube].kit });
  return [mk('Hulk', 'ATA', 'BRA', 'cam'), mk('Arrascaeta', 'MEI', 'URU', 'fla'), mk('Neymar', 'MEI', 'BRA', 'san')];
}

// ================= TELAS =================
function telaInicio() {
  const v = vitrine();
  return `<div class="inicio">
    <section class="hero">
      <div>
        <span class="eyebrow">Protótipo jogável · Temporada 2026</span>
        <h1 style="margin-top:10px">Seu clube.<br>Sua <b>prancheta.</b></h1>
        <p class="lead">Assuma um dos 60 clubes das Séries A, B e C, escale o time, contrate jogadores em 11 ligas do mundo e acompanhe cada partida ao vivo, em pixel art ou com bonecos 3D.</p>
        <div class="acoes">
          ${S && S.clube ? `<button class="btn pri lg" data-a="ir" data-x="central">Continuar com o ${esc(CL[S.clube].nome)}</button><button class="btn lg" data-a="novo">Novo jogo</button>`
            : `<button class="btn pri lg" data-a="novo">Novo jogo</button>`}
          <button class="btn lg ghost" data-a="ir" data-x="recursos">Ver funcionalidades</button>
        </div>
      </div>
      <div class="vitrine"><canvas class="est" data-estadio="fla"></canvas><div class="bonecos">${v.map(j => `<img class="spr" alt="" src="${retratoURL(j, UI.visual)}">`).join('')}</div></div>
    </section>
    <section class="stack">
      <div class="card-h" style="margin:0"><h3>Escolha o visual</h3><span class="muted small">Dá para trocar a qualquer momento no topo da tela.</span></div>
      <div class="estilos">
        <button class="estilo-card px" data-a="visual" data-x="pixel" aria-pressed="${UI.visual === 'pixel'}"><div class="prev">${v.map(j => `<img alt="" src="${retratoURL(j, 'pixel')}">`).join('')}</div><div><h3>Pixel art</h3><p class="muted small">Visual 16-bit: bonecos de pixel, fontes retrô e bordas duras, como os jogos de videogame clássicos.</p></div></button>
        <button class="estilo-card d3" data-a="visual" data-x="3d" aria-pressed="${UI.visual === '3d'}"><div class="prev">${v.map(j => `<img alt="" src="${retratoURL(j, '3d')}">`).join('')}</div><div><h3>Bonecos 3D</h3><p class="muted small">Bonecos com volume, luz e sombra, campo em perspectiva e interface de console moderno.</p></div></button>
      </div>
    </section>
    <section class="destaques">
      <div class="destaque"><div class="big">60</div><div class="muted small">clubes reais das Séries A, B e C</div></div>
      <div class="destaque"><div class="big">1.700+</div><div class="muted small">jogadores, com elencos reais da Série A</div></div>
      <div class="destaque"><div class="big">11</div><div class="muted small">ligas estrangeiras no mercado</div></div>
      <div class="destaque"><div class="big">2</div><div class="muted small">estilos visuais: pixel art e 3D</div></div>
    </section>
  </div>`;
}

function telaEscolha() {
  const d = UI.escDiv;
  const ids = Object.keys(CL).filter(id => S.cl[id].div === d).sort((a, b) => CL[b].rep - CL[a].rep);
  return `<div class="stack">
    <div class="row between wrap"><div><span class="eyebrow">Novo jogo</span><h2 style="font-size:1.8rem">Escolha seu clube</h2></div>
      <div class="tabs" role="tablist">${['A', 'B', 'C'].map(x => `<button role="tab" data-a="escdiv" data-x="${x}" aria-selected="${x === d}">${DIVISOES[x].curto}</button>`).join('')}</div></div>
    ${d !== 'A' ? `<p class="aviso">Na Série ${d}, os clubes e estádios são reais, mas os nomes dos jogadores são gerados neste protótipo. A versão completa importa os elencos reais.</p>` : `<p class="aviso">Série A com elencos reais montados a partir das temporadas 2025/26. Alguns nomes podem estar desatualizados.</p>`}
    <div class="clubes">${ids.map(id => { const c = CL[id]; const f = forcaTime(id); const o = objetivoDe(id); return `
      <button class="clube-card" style="--k1:${c.kit.c1}" data-a="escolher" data-x="${id}">
        ${escudo(id, 44)}<div class="grow"><div class="nm">${esc(c.nome)}</div><div class="muted small">${esc(c.cidade)} · ${c.uf}</div>${estrelas(f.geral)}</div>
        <div class="info"><span>${fmtMi(c.caixa)}</span><span>${esc(o.txt)}</span></div>
      </button>`; }).join('')}</div>
  </div>`;
}
function modalAssumir(id) {
  const c = CL[id]; const o = objetivoDe(id); const f = forcaTime(id);
  const top = S.cl[id].elenco.map(x => S.jog[x]).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  abrirModal(`<div class="stack">
    <div class="row">${escudo(id, 64)}<div><span class="eyebrow">${DIVISOES[c.div].nome}</span><h2 style="font-size:1.8rem">${esc(c.nome)}</h2><div class="muted small">${esc(c.estadio)} · ${c.cap.toLocaleString('pt-BR')} lugares · ${esc(c.cidade)}-${c.uf}</div></div></div>
    <div class="infos"><div class="kv"><span class="k">Meta</span><span class="v">${esc(o.txt)}</span></div><div class="kv"><span class="k">Caixa</span><span class="v">${fmtMi(c.caixa)}</span></div><div class="kv"><span class="k">Força</span><span class="v">${dec(f.geral)}</span></div><div class="kv"><span class="k">Folha/mês</span><span class="v">${fmtMi(folhaMensal(id))}</span></div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Destaques do elenco</div><div class="row wrap" style="gap:12px">${top.map(j => `<div class="row" style="gap:8px"><div class="av">${img(j, 'busto')}</div><div><div style="font-weight:600">${esc(j.nome)}</div><div class="small muted">${j.pos} · <span class="${tier(j.ovr)}">${j.ovr}</span></div></div></div>`).join('')}</div></div>
    <label class="stack" style="gap:6px" for="tecnico"><span class="eyebrow">Seu nome de técnico</span><input id="tecnico" class="campo-num" maxlength="24" value="${esc(UI.nomeTec || '')}" placeholder="Ex.: Gabriel"></label>
    <div class="row wrap"><button class="btn pri lg" data-a="assumir" data-x="${id}">Assumir o comando</button><button class="btn ghost" data-a="fechar">Voltar</button></div>
  </div>`);
}

// ---------- central ----------
function telaCentral() {
  const c = CL[S.clube]; const d = minhaDiv(); const pos = posicao(S.clube);
  const moral = Math.round(S.cl[S.clube].elenco.reduce((s, id) => s + (S.jog[id] ? S.jog[id].moral : 0), 0) / S.cl[S.clube].elenco.length);
  const med = (n, v) => { const t = v >= 75 ? 'Ótimo' : v >= 55 ? 'Bom' : v >= 35 ? 'Instável' : 'Crítico'; return `<div class="medidor"><span>${n}</span><span class="small ${v >= 55 ? 'muted' : ''}" style="${v < 35 ? 'color:var(--bad)' : ''}">${t} · ${v}</span><div class="barra ${v < 35 ? 'bad' : v < 55 ? 'warn' : ''}"><i style="width:${v}%"></i></div></div>`; };
  return `<div class="stack">
    <section class="banner"><canvas data-estadio="${S.clube}"></canvas><div class="ov">${escudo(S.clube, 64)}<div class="grow"><span class="eyebrow">Técnico ${esc(S.tecnico)} · Temporada ${S.ano}</span><h1>${esc(c.nome)}</h1>
      <div class="row wrap" style="margin-top:8px;gap:8px"><span class="chip acc">Meta: ${esc(S.objetivo.txt)}</span><span class="chip">${pos}º na ${DIVISOES[d].curto}</span><span class="chip">${esc(c.estadio)}</span></div></div></div></section>
    <div class="grid g-central">
      <div class="stack">${cardProximo()}${cardNews()}</div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Ambiente</h3><span class="muted small">muda a cada jogo</span></div><div class="stack" style="gap:12px">${med('Diretoria', S.diretoria)}${med('Torcida', S.torcida)}${med('Elenco (moral)', moral)}</div></div>
        ${cardMiniTabela()}
        <div class="card"><div class="card-h"><h3>Finanças</h3><button class="btn sm ghost" data-a="ir" data-x="clube">Detalhes</button></div>
          <div class="infos" style="grid-template-columns:1fr 1fr"><div class="kv"><span class="k">Caixa</span><span class="v">${fmtMi(S.caixa)}</span></div><div class="kv"><span class="k">Folha/mês</span><span class="v">${fmtMi(folhaMensal())}</span></div><div class="kv"><span class="k">Teto salarial</span><span class="v">${fmtMi(tetoSalarial())}</span></div><div class="kv"><span class="k">Receita/mês</span><span class="v">${fmtMi(receitaMensalEstimada())}</span></div></div></div>
      </div>
    </div></div>`;
}
function cardProximo() {
  if (fimTemporada()) {
    const r = S.resumo || {}; const d = minhaDiv();
    return `<div class="card"><div class="card-h"><h3>Fim da temporada ${S.ano}</h3><span class="chip ${r.cumpriu ? 'good' : 'bad'}">${r.cumpriu ? 'Meta cumprida' : 'Meta não cumprida'}</span></div>
      <div class="stack"><p style="font-size:1.1rem">${esc(CL[S.clube].nome)} terminou em <b>${r.pos}º lugar</b> na ${DIVISOES[d].curto}.</p>
      <div class="infos" style="grid-template-columns:repeat(3,minmax(0,1fr))">${['A', 'B', 'C'].map(x => `<div class="kv"><span class="k">Campeão ${DIVISOES[x].curto}</span><span class="v row" style="gap:6px">${escudo(r.campeao[x], 18)}${esc(CL[r.campeao[x]].nome)}</span></div>`).join('')}</div>
      <p class="muted small">Na nova temporada sobem e descem 4 clubes entre A e B, e entre B e C. Os jogadores envelhecem e evoluem.</p>
      <button class="btn pri lg" data-a="novatemp">Começar a temporada ${S.ano + 1}</button></div></div>`;
  }
  const j = proximoJogo(); const d = minhaDiv(); const fh = forcaTime(j.h), fa = forcaTime(j.a);
  const tot = fh.geral + fa.geral;
  return `<div class="card"><div class="card-h"><h3>Próximo jogo</h3><span class="muted small">${fmtData(j.data)} · Rodada ${j.rodada + 1}</span></div>
    <div class="prox"><div class="time">${escudo(j.h, 64)}<span class="nm">${esc(CL[j.h].nome)}</span>${formHTML(S.cl[j.h].form)}</div><div class="vs">×</div><div class="time">${escudo(j.a, 64)}<span class="nm">${esc(CL[j.a].nome)}</span>${formHTML(S.cl[j.a].form)}</div></div>
    <div class="stack" style="gap:8px"><div class="comp"><span class="num">${fh.geral.toFixed(0)}</span><div class="duo"><i style="width:${fh.geral / tot * 100}%;background:var(--acc)"></i><i style="flex:1;background:var(--acc2)"></i></div><span class="num right">${fa.geral.toFixed(0)}</span></div>
    <p class="muted small" style="text-align:center">${DIVISOES[d].nome} · ${esc(CL[j.h].estadio)}</p></div>
    <div class="row wrap" style="margin-top:14px"><button class="btn pri lg grow" data-a="ir" data-x="prejogo">Ir para o jogo</button><button class="btn" data-a="ir" data-x="tatica">Ajustar tática</button></div></div>`;
}
function cardNews() {
  const L = S.news.slice(0, 7);
  return `<div class="card"><div class="card-h"><h3>Caixa de entrada</h3><span class="muted small">${S.news.length} mensagens</span></div><div class="news">${L.map(n => `
    <div class="news-item ${n.tipo}"><span class="chip">R${n.rod}</span><div><div class="t">${esc(n.titulo)}</div><div class="small muted">${esc(n.texto)}</div>
      ${n.proposta && !n.resolvida ? `<div class="acts"><button class="btn sm ok" data-a="prop-sim" data-x="${n.id}">Aceitar</button><button class="btn sm no" data-a="prop-nao" data-x="${n.id}">Recusar</button></div>` : n.proposta ? `<div class="small" style="margin-top:4px">Proposta ${n.resolvida}.</div>` : ''}
    </div></div>`).join('')}</div></div>`;
}
function cardMiniTabela() {
  const d = minhaDiv(); const cls = classificacao(d); const p = cls.indexOf(S.clube);
  const ini = clamp(p - 2, 0, cls.length - 5); const T = S.div[d].tabela;
  return `<div class="card"><div class="card-h"><h3>${DIVISOES[d].curto}</h3><button class="btn sm ghost" data-a="ir" data-x="tabela">Tabela completa</button></div>
    <table class="mini-tab"><tbody>${cls.slice(ini, ini + 5).map((id, k) => { const i = ini + k + 1; return `<tr class="${id === S.clube ? 'eu' : ''}"><td class="zona ${zonaDe(d, i)}"></td><td class="num">${i}</td><td><div class="nome-cel">${escudo(id, 18)}<span class="n">${esc(CL[id].nome)}</span></div></td><td class="r num">${T[id].j}j</td><td class="r num"><b>${T[id].pts}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}

// ---------- elenco ----------
function telaElenco() {
  const el = S.cl[S.clube].elenco.map(id => S.jog[id]).filter(Boolean);
  const grupos = { todos: null, gol: ['GOL'], def: ['LD', 'ZAG', 'LE'], mei: ['VOL', 'MC', 'MEI'], ata: ['PE', 'PD', 'ATA'] };
  const L = el.filter(j => !grupos[UI.elFiltro] || grupos[UI.elFiltro].includes(j.pos)).sort((a, b) => ORDEM_POS.indexOf(a.pos) - ORDEM_POS.indexOf(b.pos) || b.ovr - a.ovr);
  const tit = new Set(S.cl[S.clube].tatica.tit);
  const media = dec(el.reduce((s, j) => s + j.idade, 0) / el.length);
  return `<div class="stack">
    <div class="row between wrap"><div><span class="eyebrow">${esc(CL[S.clube].nome)}</span><h2 style="font-size:1.8rem">Elenco</h2></div>
      <div class="row wrap"><span class="chip">${el.length} jogadores</span><span class="chip">Idade média ${media}</span><span class="chip">Folha ${fmtMi(folhaMensal())}/mês</span></div></div>
    <div class="tabs">${[['todos', 'Todos'], ['gol', 'Goleiros'], ['def', 'Defesa'], ['mei', 'Meio'], ['ata', 'Ataque']].map(([k, n]) => `<button data-a="elfiltro" data-x="${k}" aria-selected="${UI.elFiltro === k}">${n}</button>`).join('')}</div>
    <div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th>Jogador</th><th class="c">Pos</th><th class="c hide-sm">Idade</th><th class="c">OVR</th><th class="hide-sm">Condição</th><th class="c hide-sm">Moral</th><th class="r">Valor</th><th class="r hide-sm">Salário</th><th class="c hide-sm">Contrato</th><th class="hide-sm"></th></tr></thead>
      <tbody>${L.map(j => `<tr class="click" data-a="jogador" data-x="${j.id}">
        <td><div class="nome-cel"><div class="av">${img(j, 'busto')}</div><div style="min-width:0"><div class="n">${esc(j.nome)}${j.real ? '' : '<span class="tag-g" title="Nome gerado no protótipo">gerado</span>'}</div><div class="small dim">${j.nac} · ${j.gols} gols</div></div></div></td>
        <td class="c">${posTag(j.pos)}</td><td class="c hide-sm">${j.idade}</td><td class="c"><span class="ovr ${tier(j.ovr)}">${j.ovr}</span></td>
        <td class="hide-sm" style="min-width:90px"><div class="barra ${j.cond < 60 ? 'bad' : j.cond < 80 ? 'warn' : ''}"><i style="width:${j.cond}%"></i></div></td>
        <td class="c hide-sm">${j.moral}</td><td class="r">${fmtMi(j.valor)}</td><td class="r hide-sm">${fmtMil(j.salario)}</td><td class="c hide-sm">${j.contrato}</td>
        <td class="hide-sm">${tit.has(j.id) ? '<span class="chip info">Titular</span>' : ''} ${j.venda ? '<span class="chip warn">À venda</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>
  </div>`;
}
function modalJogador(id) {
  const j = S.jog[id]; const kit = j.pos === 'GOL' ? kitGoleiro(kitJog(j)) : kitJog(j);
  const meu = j.clube === S.clube; const kt = lum(kit.c1) > 0.6 ? '#15161C' : '#FFFFFF';
  const A = j.attrs; const at = j.pos === 'GOL' ? [['Goleiro', A.gol], ['Reflexo', Math.round((A.gol + A.fis) / 2)], ['Passe', A.pas], ['Físico', A.fis]] : [['Finalização', A.fin], ['Passe', A.pas], ['Drible', A.dri], ['Defesa', A.def], ['Físico', A.fis]];
  const [lv, ln] = meu ? ['', ''] : nivelInteresse(j);
  abrirModal(`<div class="ficha">
    <div class="carta" style="--k1:${kit.c1};--kt:${kt}"><div class="topo-c"><div><div class="ovr">${j.ovr}</div><div style="font-family:var(--font-disp);font-weight:700">${j.pos}</div></div><div style="text-align:right;font-family:var(--font-disp);font-weight:700">${j.nac}</div></div>
      <img class="spr" alt="" src="${retratoURL({ nome: j.nome, pos: j.pos, look: j.look, kit: kitJog(j) }, UI.visual)}"><div class="nm">${esc(j.nome)}</div></div>
    <div class="stack">
      <div><span class="eyebrow">${esc(nomeClubeDe(j))} · ${esc(ligaNome(j))}</span><h2 style="font-size:1.7rem">${esc(j.nome)}</h2><div class="muted">${POSICOES[j.pos].nome}, ${j.idade} anos${j.real ? '' : ' · nome gerado'}</div></div>
      <div class="attrs">${at.map(([n, v]) => `<div class="attr"><span>${n}</span><div class="barra ${v >= 80 ? 'acc' : v < 55 ? 'warn' : ''}"><i style="width:${v}%"></i></div><b class="num right">${v}</b></div>`).join('')}</div>
      <div class="infos">
        <div class="kv"><span class="k">Valor</span><span class="v">${fmtMi(meu ? j.valor : pedidaClube(j))}</span></div>
        <div class="kv"><span class="k">${meu ? 'Salário' : 'Pede de salário'}</span><span class="v">${fmtMil(meu ? j.salario : pedidaSalario(j))}</span></div>
        <div class="kv"><span class="k">Contrato</span><span class="v">até ${j.contrato}</span></div>
        <div class="kv"><span class="k">${meu ? 'Gols / jogos' : 'Interesse'}</span><span class="v ${meu ? '' : 'int ' + lv}">${meu ? `${j.gols} / ${j.jogos}` : ln}</span></div>
      </div>
      ${meu ? `<div class="row wrap"><button class="btn" data-a="venda" data-x="${j.id}">${j.venda ? 'Tirar da lista de venda' : 'Colocar à venda'}</button><button class="btn" data-a="renovar" data-x="${j.id}">Renovar por +2 anos</button></div>
        <p class="muted small">Jogadores à venda recebem propostas de clubes do Brasil e do exterior depois das rodadas. Elas chegam na caixa de entrada.</p>`
        : `<div class="row wrap"><button class="btn pri" data-a="negociar" data-x="${j.id}" ${lv === 'nao' ? 'disabled' : ''}>Fazer proposta</button>${lv === 'nao' ? '<span class="small muted">Ele não quer vir agora. Melhore a reputação do clube.</span>' : ''}</div>`}
    </div></div>`);
}

// ---------- tática ----------
function reencaixar(tit, formacao) {
  const slots = FORMACOES[formacao]; const disp = tit.filter(Boolean).map(id => S.jog[id]).filter(Boolean); const usados = new Set(); const nova = Array(11).fill(null);
  const ordem = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GOL' ? -1 : 0) - (slots[b][0] === 'GOL' ? -1 : 0));
  for (const i of ordem) { let b = null, bv = -1; for (const j of disp) { if (usados.has(j.id)) continue; const v = encaixe(slots[i][0], j.pos) * 100 + j.ovr / 10; if (v > bv) { bv = v; b = j; } } if (b) { nova[i] = b.id; usados.add(b.id); } }
  return nova;
}
function telaTatica() {
  const tat = S.cl[S.clube].tatica; const slots = FORMACOES[tat.formacao]; const f = forcaTime(S.clube);
  const banco = S.cl[S.clube].elenco.filter(id => !tat.tit.includes(id)).map(id => S.jog[id]).filter(Boolean).sort((a, b) => ORDEM_POS.indexOf(a.pos) - ORDEM_POS.indexOf(b.pos) || b.ovr - a.ovr);
  const sel = UI.tat.sel;
  const pecas = slots.map(([pos, x, y], i) => {
    const j = S.jog[tat.tit[i]];
    const top = 5 + (1 - x) * 88, left = 6 + y * 88;
    if (!j) return `<button class="peca ${sel && sel.t === 's' && sel.i === i ? 'sel' : ''}" style="left:${left}%;top:${top}%" data-a="tat-slot" data-x="${i}"><span class="nm"><span class="fit f3"></span>Vazio · ${pos}</span></button>`;
    const fit = encaixe(pos, j.pos); const fc = fit >= .97 ? 'f1' : fit >= .84 ? 'f2' : 'f3';
    return `<button class="peca ${sel && sel.t === 's' && sel.i === i ? 'sel' : ''}" style="left:${left}%;top:${top}%" data-a="tat-slot" data-x="${i}" aria-label="${esc(j.nome)}, ${pos}">${img(j)}<span class="nm"><span class="fit ${fc}"></span>${esc(nomeCurto(j.nome))} <span class="${tier(j.ovr)}">${j.ovr}</span></span></button>`;
  }).join('');
  const seg = (campo, ops) => `<div class="seg" role="group">${ops.map(([v, n]) => `<button data-a="tat-${campo}" data-x="${v}" aria-pressed="${tat[campo] === v}">${n}</button>`).join('')}</div>`;
  const fb = (n, v) => `<div class="medidor"><span>${n}</span><b class="num">${v}</b><div class="barra ${v >= 78 ? 'acc' : ''}"><i style="width:${clamp((v - 40) / 50 * 100, 4, 100)}%"></i></div></div>`;
  return `<div class="stack">
    <div class="row between wrap"><div><span class="eyebrow">Tática</span><h2 style="font-size:1.8rem">Prancheta</h2></div><div class="row wrap"><button class="btn" data-a="tat-auto">Escalação automática</button></div></div>
    <p class="muted small">Toque em um jogador do campo e depois em outro (ou num reserva) para trocar. A bolinha mostra se ele está na posição certa: verde, adaptado ou improvisado.</p>
    <div class="tat">
      <div class="campo-wrap"><div class="campo-tat"><div class="linhas"></div><div class="area cima"></div><div class="area baixo"></div>${pecas}</div></div>
      <div class="stack">
        <div class="card ctrl">
          <div><div class="lbl">Formação</div><div class="seg" role="group" style="flex-wrap:wrap">${Object.keys(FORMACOES).map(k => `<button data-a="tat-form" data-x="${k}" aria-pressed="${tat.formacao === k}">${k}</button>`).join('')}</div></div>
          <div><div class="lbl">Postura</div>${seg('postura', [['defensiva', 'Defensiva'], ['equilibrada', 'Equilibrada'], ['ofensiva', 'Ofensiva']])}</div>
          <div><div class="lbl">Marcação</div>${seg('marcacao', [['recuada', 'Recuada'], ['normal', 'Normal'], ['pressao', 'Pressão alta']])}</div>
        </div>
        <div class="card"><div class="card-h"><h3>Força do time</h3><span class="ovr ${tier(f.geral)}">${dec(f.geral)}</span></div><div class="forcas">${fb('Defesa', f.def)}${fb('Meio-campo', f.mei)}${fb('Ataque', f.ata)}</div></div>
        <div class="card"><div class="card-h"><h3>Reservas</h3><span class="muted small">${banco.length}</span></div><div class="banco">${banco.map(j => `<button class="${sel && sel.t === 'b' && sel.id === j.id ? 'sel' : ''}" data-a="tat-banco" data-x="${j.id}"><div class="av">${img(j, 'busto')}</div>${posTag(j.pos)}<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.nome)}</span><span class="small ${j.cond < 70 ? 'int baixo' : 'muted'}">${j.cond}%</span><span class="ovr ${tier(j.ovr)}" style="font-size:1rem">${j.ovr}</span></button>`).join('')}</div></div>
      </div>
    </div></div>`;
}
function tatClique(tipo, v) {
  const tat = S.cl[S.clube].tatica; const sel = UI.tat.sel;
  const cur = tipo === 's' ? { t: 's', i: +v } : { t: 'b', id: v };
  if (!sel) { UI.tat.sel = cur; return render(); }
  if (sel.t === 's' && cur.t === 's') { if (sel.i !== cur.i) [tat.tit[sel.i], tat.tit[cur.i]] = [tat.tit[cur.i], tat.tit[sel.i]]; }
  else if (sel.t === 's' && cur.t === 'b') tat.tit[sel.i] = cur.id;
  else if (sel.t === 'b' && cur.t === 's') tat.tit[cur.i] = sel.id;
  else { UI.tat.sel = sel.id === cur.id ? null : cur; return render(); }
  UI.tat.sel = null; salvar(); render();
}

// ---------- mercado ----------
function telaMercado() {
  const m = UI.merc;
  const ligas = [['todas', 'Todas as ligas'], ['BR', 'Brasil (A, B e C)'], ['A', 'Brasileirão Série A'], ['B', 'Brasileirão Série B'], ['C', 'Brasileirão Série C'], ...MUNDO.map(l => [l.sigla, `${l.liga}`])];
  const sel = (id, ops, v) => `<select id="${id}" data-f="${id.slice(2)}">${ops.map(([k, n]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  return `<div class="stack">
    <div class="row between wrap"><div><span class="eyebrow">Janela aberta · ${S.ano}</span><h2 style="font-size:1.8rem">Mercado da bola</h2></div>
      <div class="row wrap"><span class="chip">Caixa ${fmtMi(S.caixa)}</span><span class="chip ${folhaMensal() > tetoSalarial() * .92 ? 'warn' : ''}">Folha ${fmtMi(folhaMensal())} de ${fmtMi(tetoSalarial())}</span></div></div>
    <div class="card stack">
      <div class="filtros">
        <label for="f-busca">Buscar jogador ou clube<input id="f-busca" data-f="busca" type="search" value="${esc(m.busca)}" placeholder="Ex.: Neymar, Benfica, Boca"></label>
        <label for="f-liga">Liga${sel('f-liga', ligas, m.liga)}</label>
        <label for="f-pos">Posição${sel('f-pos', [['todas', 'Todas'], ...ORDEM_POS.map(p => [p, POSICOES[p].nome])], m.pos)}</label>
        <label for="f-max">Valor máximo${sel('f-max', [[0, 'Qualquer valor'], [1, 'Até R$ 1 mi'], [5, 'Até R$ 5 mi'], [20, 'Até R$ 20 mi'], [60, 'Até R$ 60 mi'], [150, 'Até R$ 150 mi']], m.max)}</label>
        <label for="f-ordem">Ordenar${sel('f-ordem', [['ovr', 'Melhores'], ['valor', 'Mais baratos'], ['idade', 'Mais jovens']], m.ordem)}</label>
      </div>
      <div class="checks"><label for="f-interessados"><input id="f-interessados" data-f="interessados" type="checkbox" ${m.interessados ? 'checked' : ''}> Só quem aceita conversar</label><label for="f-reais"><input id="f-reais" data-f="reais" type="checkbox" ${m.reais ? 'checked' : ''}> Só jogadores reais</label></div>
    </div>
    <div id="merc-res">${resultadosMercado()}</div>
  </div>`;
}
function resultadosMercado() {
  const L = listaMercado(UI.merc); const vis = L.slice(0, UI.merc.n);
  if (!L.length) return '<div class="card vazio">Nenhum jogador com esses filtros.</div>';
  return `<div class="lista-merc">${vis.map(j => { const [lv, ln] = nivelInteresse(j); return `
    <div class="merc-item">
      <div class="nome-cel" style="cursor:pointer" data-a="jogador" data-x="${j.id}"><div class="av">${img(j, 'busto')}</div><div style="min-width:0"><div class="n">${esc(j.nome)}${j.real ? '' : '<span class="tag-g">gerado</span>'}</div><div class="sub">${posTag(j.pos)} ${j.idade} anos · ${j.nac} · ${esc(nomeClubeDe(j))}</div><div class="sub mob">${fmtMi(pedidaClube(j))} · <span class="int ${lv}">${ln}</span></div></div></div>
      <div class="c"><span class="ovr ${tier(j.ovr)}">${j.ovr}</span></div>
      <div class="col-x"><div class="small muted">Pedida</div><div class="num" style="font-weight:600">${fmtMi(pedidaClube(j))}</div></div>
      <div class="col-x col-sal"><div class="small muted">Salário</div><div class="num">${fmtMil(pedidaSalario(j))}</div></div>
      <div class="col-x"><div class="small muted">Interesse</div><div class="int ${lv}" style="font-weight:700">${ln}</div></div>
      <button class="btn sm ${lv === 'nao' ? '' : 'pri'}" data-a="negociar" data-x="${j.id}" ${lv === 'nao' ? 'disabled' : ''}>Negociar</button>
    </div>`; }).join('')}</div>
    <div class="row between" style="margin-top:12px"><span class="muted small">Mostrando ${vis.length} de ${L.length.toLocaleString('pt-BR')} jogadores</span>${L.length > vis.length ? '<button class="btn" data-a="maismerc">Mostrar mais</button>' : ''}</div>`;
}

function modalNegociacao() {
  const N = UI.neg; const j = S.jog[N.id]; const ped = pedidaClube(j), pedS = pedidaSalario(j);
  const passos = `<div class="passos"><span class="${N.fase === 'clube' ? 'on' : ''}">1. Proposta ao ${esc(nomeClubeDe(j))}</span><span class="${N.fase === 'jogador' ? 'on' : ''}">2. Contrato com o jogador</span></div>`;
  const cab = `<div class="row" style="margin-bottom:14px"><div class="av" style="width:56px;height:46px">${img(j, 'busto')}</div><div class="grow"><h3 style="font-size:1.3rem">${esc(j.nome)}</h3><div class="small muted">${posTag(j.pos)} ${j.idade} anos · ${esc(nomeClubeDe(j))} · ${esc(ligaNome(j))}</div></div><span class="ovr ${tier(j.ovr)}" style="font-size:1.8rem">${j.ovr}</span></div>`;
  const msg = N.msg ? `<div class="resp ${N.msg.ok ? 'ok' : 'no'}">${esc(N.msg.txt)}</div>` : '';
  if (N.fase === 'fechado') {
    const c = CL[S.clube];
    return abrirModal(`<div class="fechado"><span class="eyebrow">Negócio fechado</span>${img(j)}<h2>${esc(j.nome)}</h2><p>É o novo reforço do <b>${esc(c.nome)}</b>, com contrato até ${j.contrato}.</p><div class="row wrap" style="justify-content:center"><button class="btn pri" data-a="ir-fechar" data-x="elenco">Ver elenco</button><button class="btn" data-a="ir-fechar" data-x="tatica">Escalar</button><button class="btn ghost" data-a="fechar">Continuar no mercado</button></div></div>`);
  }
  if (N.fase === 'clube') {
    return abrirModal(`${cab}${passos}<div class="stack">
      <div class="infos" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kv"><span class="k">Pedida do clube</span><span class="v">${fmtMi(ped)}</span></div><div class="kv"><span class="k">Seu caixa</span><span class="v">${fmtMi(S.caixa)}</span></div><div class="kv"><span class="k">Interesse dele</span><span class="v int ${nivelInteresse(j)[0]}">${nivelInteresse(j)[1]}</span></div></div>
      <label class="stack" style="gap:6px" for="neg-valor"><span class="eyebrow">Sua oferta (R$ milhões)</span><input id="neg-valor" class="campo-num" type="number" min="0" step="0.1" value="${N.valor}"></label>
      <div class="atalhos">${[[.85, '−15%'], [1, 'Pedida'], [1.1, '+10%'], [1.25, '+25%']].map(([k, n]) => `<button class="btn sm" data-a="neg-atalho" data-x="${(ped * k).toFixed(2)}">${n} · ${fmtMi(ped * k)}</button>`).join('')}</div>
      ${msg}
      <div class="row wrap"><button class="btn pri" data-a="neg-clube">Enviar proposta</button><button class="btn ghost" data-a="fechar">Desistir</button></div></div>`);
  }
  const folhaDepois = folhaMensal() + N.salario / 1000;
  return abrirModal(`${cab}${passos}<div class="stack">
    <div class="infos" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kv"><span class="k">Ele pede</span><span class="v">${fmtMil(pedS)}/mês</span></div><div class="kv"><span class="k">Folha depois</span><span class="v" style="${folhaDepois > tetoSalarial() ? 'color:var(--bad)' : ''}">${fmtMi(folhaDepois)}</span></div><div class="kv"><span class="k">Teto salarial</span><span class="v">${fmtMi(tetoSalarial())}</span></div></div>
    <label class="stack" style="gap:6px" for="neg-sal"><span class="eyebrow">Salário mensal (R$ mil)</span><input id="neg-sal" class="campo-num" type="number" min="0" step="1" value="${N.salario}"></label>
    <div><div class="eyebrow" style="margin-bottom:6px">Duração do contrato</div><div class="seg">${[1, 2, 3, 4, 5].map(a => `<button data-a="neg-anos" data-x="${a}" aria-pressed="${N.anos === a}">${a} ano${a > 1 ? 's' : ''}</button>`).join('')}</div></div>
    ${msg}
    <div class="row wrap"><button class="btn pri" data-a="neg-jog">Oferecer contrato</button><button class="btn ghost" data-a="fechar">Desistir</button></div></div>`);
}

// ---------- tabela ----------
function telaTabela() {
  const d = UI.tabDiv || minhaDiv(); const D = S.div[d]; const T = D.tabela; const cls = classificacao(d);
  const rv = UI.rodVer === null || UI.rodVer === undefined ? Math.max(0, D.feitas - 1) : clamp(UI.rodVer, 0, D.rodadas.length - 1);
  const res = D.res[rv]; const jogos = D.rodadas[rv];
  const art = Object.values(S.jog).filter(j => j.clube && S.cl[j.clube].div === d && j.gols > 0).sort((a, b) => b.gols - a.gols).slice(0, 10);
  return `<div class="stack">
    <div class="row between wrap"><div><span class="eyebrow">Temporada ${S.ano}</span><h2 style="font-size:1.8rem">${DIVISOES[d].nome}</h2></div>
      <div class="tabs" role="tablist">${['A', 'B', 'C'].map(x => `<button role="tab" data-a="tabdiv" data-x="${x}" aria-selected="${x === d}">${DIVISOES[x].curto}</button>`).join('')}</div></div>
    <div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th class="zona"></th><th>#</th><th>Clube</th><th class="c">P</th><th class="c">J</th><th class="c">V</th><th class="c hide-sm">E</th><th class="c hide-sm">D</th><th class="c hide-sm">GP</th><th class="c hide-sm">GC</th><th class="c">SG</th><th class="hide-sm">Últimos</th></tr></thead>
      <tbody>${cls.map((id, k) => { const t = T[id]; return `<tr class="${id === S.clube ? 'eu' : ''}"><td class="zona ${zonaDe(d, k + 1)}"></td><td class="num">${k + 1}</td><td><div class="nome-cel">${escudo(id, 20)}<span class="n">${esc(CL[id].nome)}</span></div></td><td class="c"><b>${t.pts}</b></td><td class="c">${t.j}</td><td class="c">${t.v}</td><td class="c hide-sm">${t.e}</td><td class="c hide-sm">${t.d}</td><td class="c hide-sm">${t.gp}</td><td class="c hide-sm">${t.gc}</td><td class="c">${t.gp - t.gc > 0 ? '+' : ''}${t.gp - t.gc}</td><td class="hide-sm">${formHTML(S.cl[id].form)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="legenda">${DIVISOES[d].zonas.map(([a, b, z, n]) => `<span style="--c:var(--z-${z})">${n} (${a}º–${b}º)</span>`).join('')}</div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><button class="btn sm" data-a="rod" data-x="${rv - 1}" ${rv <= 0 ? 'disabled' : ''} aria-label="Rodada anterior">‹</button><h3>Rodada ${rv + 1}</h3><button class="btn sm" data-a="rod" data-x="${rv + 1}" ${rv >= D.rodadas.length - 1 ? 'disabled' : ''} aria-label="Próxima rodada">›</button></div>
        <div class="stack" style="gap:6px">${jogos.map(([h, a], i) => { const r = res && res[i]; return `<div class="row" style="padding:6px 8px;background:var(--s2);border-radius:var(--r-sm);${h === S.clube || a === S.clube ? 'box-shadow:inset 3px 0 0 var(--acc)' : ''}"><span class="grow right" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(CL[h].nome)}</span>${escudo(h, 18)}<b class="num" style="min-width:52px;text-align:center">${r ? `${r.gh} × ${r.ga}` : '×'}</b>${escudo(a, 18)}<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(CL[a].nome)}</span></div>`; }).join('')}</div>
        <p class="muted small" style="margin-top:8px">${fmtData(dataRodada(rv))}</p></div>
      <div class="card"><div class="card-h"><h3>Artilharia</h3></div>${art.length ? `<table><tbody>${art.map((j, k) => `<tr class="click" data-a="jogador" data-x="${j.id}"><td class="num dim">${k + 1}</td><td><div class="nome-cel"><div class="av" style="width:30px;height:25px">${img(j, 'busto')}</div><span class="n">${esc(j.nome)}</span></div></td><td><div class="nome-cel">${escudo(j.clube, 16)}<span class="small muted">${CL[j.clube].sigla}</span></div></td><td class="r"><b>${j.gols}</b></td></tr>`).join('')}</tbody></table>` : '<p class="vazio">Ainda não houve gols.</p>'}</div>
    </div></div>`;
}

// ---------- clube ----------
function telaClube() {
  const c = CL[S.clube]; const d = minhaDiv(); const pub = publicoEstimado();
  const custoCT = +(4 * S.estrutura.ct * S.estrutura.ct * ({ A: 1, B: .3, C: .1 }[d])).toFixed(2);
  return `<div class="stack">
    <div class="row between wrap"><div class="row">${escudo(S.clube, 56)}<div><span class="eyebrow">${esc(c.cidade)}-${c.uf}</span><h2 style="font-size:1.8rem">${esc(c.nome)}</h2></div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Finanças</h3></div>
        <div class="infos" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="kv"><span class="k">Caixa</span><span class="v">${fmtMi(S.caixa)}</span></div><div class="kv"><span class="k">Receita/mês (estimada)</span><span class="v">${fmtMi(receitaMensalEstimada())}</span></div><div class="kv"><span class="k">Folha salarial/mês</span><span class="v">${fmtMi(folhaMensal())}</span></div><div class="kv"><span class="k">Custos do clube/mês</span><span class="v">${fmtMi(custoOperacional())}</span></div></div>
        <p class="muted small" style="margin:10px 0">A diretoria limita a folha a ${fmtMi(tetoSalarial())} por mês.</p>
        <div class="eyebrow" style="margin-bottom:6px">Extrato</div>
        ${S.extrato.length ? `<div class="tbl-wrap" style="max-height:240px;overflow:auto"><table><tbody>${S.extrato.slice(0, 30).map(e => `<tr><td class="dim num">R${e.rod}</td><td style="white-space:normal">${esc(e.desc)}</td><td class="r num" style="color:${e.valor >= 0 ? 'var(--good)' : 'var(--bad)'}">${e.valor >= 0 ? '+' : ''}${fmtMi(e.valor)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Os lançamentos aparecem depois da primeira rodada.</p>'}
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>${esc(c.estadio)}</h3><span class="chip">${c.cap.toLocaleString('pt-BR')} lugares</span></div>
          <label class="stack" style="gap:8px" for="preco"><span class="row between"><span>Preço médio do ingresso</span><b id="preco-v" class="num">R$ ${S.preco}</b></span><input id="preco" type="range" min="10" max="250" step="5" value="${S.preco}" style="width:100%"></label>
          <div class="infos" style="grid-template-columns:1fr 1fr;margin-top:10px"><div class="kv"><span class="k">Público estimado</span><span class="v" id="pub-v">${pub.toLocaleString('pt-BR')}</span></div><div class="kv"><span class="k">Bilheteria por jogo</span><span class="v" id="bil-v">${fmtMi(pub * S.preco / 1e6)}</span></div></div>
          <p class="muted small" style="margin-top:8px">Ingresso caro enche menos o estádio. Torcida animada e boa fase atraem mais gente.</p></div>
        <div class="card"><div class="card-h"><h3>Estrutura</h3></div><div class="stack" style="gap:10px">
          <div class="row between"><div><b>Centro de treinamento · nível ${S.estrutura.ct}</b><div class="small muted">Jogadores recuperam mais condição física entre os jogos.</div></div><button class="btn sm" data-a="ct" ${S.estrutura.ct >= 5 || S.caixa < custoCT ? 'disabled' : ''}>${S.estrutura.ct >= 5 ? 'Máximo' : 'Melhorar · ' + fmtMi(custoCT)}</button></div>
          <div class="row between"><div><b>Categorias de base</b><div class="small muted">Revelar jogadores a cada temporada.</div></div><span class="chip">Versão completa</span></div>
          <div class="row between"><div><b>Ampliação do estádio</b><div class="small muted">Mais lugares e camarotes.</div></div><span class="chip">Versão completa</span></div>
        </div></div>
        <div class="card"><div class="card-h"><h3>Diretoria</h3></div><p>Meta: <b>${esc(S.objetivo.txt)}</b> (terminar até o ${S.objetivo.pos}º lugar).</p><p class="muted small" style="margin-top:6px">Hoje: ${posicao(S.clube)}º lugar. Confiança da diretoria: ${S.diretoria}/100.</p></div>
        <div class="card"><div class="card-h"><h3>Opções</h3></div><div class="stack" style="gap:10px">
          <div class="row between wrap"><span>Estilo visual</span>${segVisual()}</div>
          ${UI.confirmarReset ? `<div class="resp no">Apagar a carreira atual e começar outra? Isso não pode ser desfeito.</div><div class="row"><button class="btn no" data-a="reset-sim">Apagar e recomeçar</button><button class="btn ghost" data-a="reset-nao">Cancelar</button></div>` : '<button class="btn" data-a="reset">Recomeçar carreira</button>'}
        </div></div>
      </div></div></div>`;
}

// ---------- recursos ----------
function telaRecursos() {
  const v = vitrine();
  const ok = [
    ['Séries A, B e C com os 60 clubes reais', 'Cidades, estádios e capacidades reais. Escudos genéricos com as cores de cada clube.'],
    ['Elencos reais da Série A', 'Cerca de 380 jogadores reais dos 20 clubes, com posição, idade e nota.'],
    ['Mercado em 11 ligas + Brasil', 'Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Portugal, Arábia, Turquia, MLS, Argentina e México.'],
    ['Negociação em duas etapas', 'Proposta ao clube (com contraproposta) e contrato com o jogador, com teto salarial da diretoria.'],
    ['Interesse do jogador', 'Craques na Europa não querem vir para a Série C; veteranos brasileiros topam voltar.'],
    ['Venda de jogadores', 'Coloque à venda e receba propostas do Brasil e do exterior na caixa de entrada.'],
    ['Tática na prancheta', '5 formações, postura, marcação, trocas por toque e indicador de posição improvisada.'],
    ['Partida ao vivo animada', '22 bonecos em campo, narração, placar, estatísticas, intervalo, substituições e mudança de postura durante o jogo.'],
    ['Simulação rápida', 'Para quem quer só o resultado. Todas as outras partidas da rodada são simuladas.'],
    ['Classificação, rodadas e artilharia', 'Para as três divisões, com zonas de Libertadores, acesso e rebaixamento.'],
    ['Finanças e estádio', 'Cota de TV, patrocínio, bilheteria com preço do ingresso, folha salarial e extrato.'],
    ['Diretoria, torcida e moral', 'Reagem aos resultados e à meta da temporada.'],
    ['Temporadas seguidas', 'Acesso e rebaixamento entre as divisões, jogadores envelhecem e evoluem.'],
    ['Dois estilos visuais', 'Pixel art e bonecos 3D, trocando a qualquer momento. A carreira fica salva no navegador.'],
  ];
  const prox = [
    ['Copa do Brasil, estaduais, Libertadores e Sul-Americana', 'Calendário completo com jogos no meio de semana.'],
    ['Base de dados completa', 'Elencos reais das Séries B, C e D e das ligas estrangeiras inteiras, com atualização a cada janela.'],
    ['Formato real da Série C', 'Segunda fase com quadrangulares e final.'],
    ['Treinos e evolução', 'Plano semanal, foco por setor e evolução de atributos.'],
    ['Lesões, suspensões e cartões acumulados', 'Departamento médico e gestão do elenco.'],
    ['Empréstimos, cláusulas e luvas', 'Contratos mais detalhados e jogadores livres.'],
    ['Categorias de base', 'Revelações anuais e promoção ao profissional.'],
    ['Demissão e propostas de outros clubes', 'Carreira de técnico com convites e currículo.'],
    ['Estádios desenhados', 'Um estádio em pixel art e em 3D para cada clube.'],
    ['Liga online com amigos', 'Cada amigo comanda um clube e o mercado é compartilhado.'],
  ];
  const lista = (L, cls) => L.map(([t, s]) => `<div class="feat"><span class="ic ${cls}">${cls === 'ok' ? '✓' : '+'}</span><div><b>${t}</b><span>${s}</span></div></div>`).join('');
  return `<div class="stack">
    <div><span class="eyebrow">Protótipo</span><h2 style="font-size:1.8rem">Funcionalidades</h2><p class="muted" style="max-width:70ch;margin-top:6px">O que já dá para jogar aqui e o que entraria numa versão completa. Tudo roda no navegador, sem servidor.</p></div>
    <div class="card"><div class="card-h"><h3>Os dois visuais</h3>${segVisual()}</div>
      <div class="comparativo"><div class="lado px"><div class="bonecos">${v.map(j => `<img alt="" src="${retratoURL(j, 'pixel')}">`).join('')}</div><b style="font-family:'Silkscreen',monospace;text-transform:uppercase">Pixel art</b><span class="small muted">Sprites 16×22 com contorno, fonte retrô, cores chapadas e campo visto de cima.</span></div>
      <div class="lado d3"><div class="bonecos">${v.map(j => `<img alt="" src="${retratoURL(j, '3d')}">`).join('')}</div><b style="font-family:'Barlow Condensed',sans-serif;font-size:1.3rem;font-style:italic;text-transform:uppercase">Bonecos 3D</b><span class="small muted">Bonecos com volume, sombra e brilho, campo em perspectiva e interface de console.</span></div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Neste protótipo</h3><span class="chip good">${ok.length} recursos</span></div>${lista(ok, 'ok')}</div>
      <div class="card"><div class="card-h"><h3>Na versão completa</h3><span class="chip">${prox.length} ideias</span></div>${lista(prox, 'prox')}</div>
    </div>
    <p class="aviso">Sobre os dados: jogo pessoal e sem fins comerciais. Elencos da Série A e do exterior foram montados de memória (temporadas 2025/26) e podem ter jogadores que já trocaram de clube. Nas Séries B e C, os nomes de jogadores são gerados. Uniformes e escudos são aproximações com as cores dos clubes, sem logos oficiais.</p>
    ${S && S.clube ? '' : '<div><button class="btn pri lg" data-a="novo">Começar um jogo</button></div>'}
  </div>`;
}

// ---------- pré-jogo ----------
function telaPreJogo() {
  const j = proximoJogo(); if (!j) { UI.tela = 'central'; return telaCentral(); }
  const adv = j.casa ? j.a : j.h; S.cl[adv].tatica = taticaAuto(adv);
  const fh = forcaTime(j.h), fa = forcaTime(j.a); const tat = S.cl[S.clube].tatica;
  const falta = tat.tit.filter(id => !S.jog[id]).length;
  const lista = id => { const t = S.cl[id].tatica; const sl = FORMACOES[t.formacao]; return `<ol>${t.tit.map((pid, i) => { const p = S.jog[pid]; return p ? `<li>${posTag(sl[i][0])}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.nome)}${id === S.clube && p.cond < 70 ? ` <span class="small int baixo">${p.cond}%</span>` : ''}</span><span class="ovr ${tier(p.ovr)}" style="font-size:.95rem">${p.ovr}</span></li>` : `<li>${posTag(sl[i][0])}<span class="int nao">Vazio</span><span></span></li>`; }).join('')}</ol>`; };
  const linha = (n, a, b) => { const t = a + b; return `<div class="stat"><span class="lbl">${n}</span><b>${a}</b><div class="comp" style="grid-template-columns:1fr"><div class="duo"><i style="width:${a / t * 100}%;background:var(--acc)"></i><i style="flex:1;background:var(--acc2)"></i></div></div><b>${b}</b></div>`; };
  const seg = `<div class="seg">${[['defensiva', 'Defensiva'], ['equilibrada', 'Equilibrada'], ['ofensiva', 'Ofensiva']].map(([v, n]) => `<button data-a="postura" data-x="${v}" aria-pressed="${tat.postura === v}">${n}</button>`).join('')}</div>`;
  return `<div class="stack" style="max-width:980px;margin:0 auto;width:100%">
    <div class="row between wrap"><button class="btn ghost sm" data-a="ir" data-x="central">‹ Central</button><span class="muted small">${DIVISOES[minhaDiv()].nome} · Rodada ${j.rodada + 1} · ${fmtData(j.data)} · ${esc(CL[j.h].estadio)}</span></div>
    <div class="card"><div class="prox"><div class="time">${escudo(j.h, 72)}<span class="nm">${esc(CL[j.h].nome)}</span><span class="small muted">${S.cl[j.h].tatica.formacao}</span></div><div class="vs">×</div><div class="time">${escudo(j.a, 72)}<span class="nm">${esc(CL[j.a].nome)}</span><span class="small muted">${S.cl[j.a].tatica.formacao}</span></div></div>
      <div class="stats" style="max-width:520px;margin:0 auto">${linha('Defesa', fh.def, fa.def)}${linha('Meio-campo', fh.mei, fa.mei)}${linha('Ataque', fh.ata, fa.ata)}</div></div>
    ${falta ? `<div class="resp no">Faltam ${falta} titular(es) na sua escalação. <button class="btn sm" data-a="tat-auto">Completar automaticamente</button></div>` : ''}
    <div class="grid g2 escal"><div class="card"><div class="card-h"><h3>${esc(CL[j.h].nome)}</h3>${j.h === S.clube ? '<button class="btn sm ghost" data-a="ir" data-x="tatica">Editar</button>' : ''}</div>${lista(j.h)}</div><div class="card"><div class="card-h"><h3>${esc(CL[j.a].nome)}</h3>${j.a === S.clube ? '<button class="btn sm ghost" data-a="ir" data-x="tatica">Editar</button>' : ''}</div>${lista(j.a)}</div></div>
    <div class="card row between wrap"><div><div class="lbl small muted" style="margin-bottom:6px">Postura do seu time</div>${seg}</div>
      <div class="row wrap"><button class="btn lg" data-a="simular">Simular resultado</button><button class="btn pri lg" data-a="aovivo">Jogar ao vivo</button></div></div>
  </div>`;
}

// ---------- partida ao vivo ----------
function telaPartida() {
  const P = UI.partida; const [h, a] = P.ids;
  const tat = S.cl[S.clube].tatica;
  return `<div class="stack">
    <div class="placar"><div class="lado">${escudo(h, 36)}<span class="nm">${esc(CL[h].nome)}</span></div>
      <div class="gols"><b id="pl-g0">${P.placar[0]}</b><div class="relogio"><span id="pl-rel">0'</span><small id="pl-per">1º TEMPO</small></div><b id="pl-g1">${P.placar[1]}</b></div>
      <div class="lado fora"><span class="nm">${esc(CL[a].nome)}</span>${escudo(a, 36)}</div></div>
    <div class="jogo">
      <div>
        <div class="tela-campo"><canvas id="cv-jogo"></canvas><div id="sobre"></div><div class="ticker"><span id="ticker" class="muted">Aguardando o apito inicial</span><span class="muted small">${esc(CL[h].estadio)}</span></div></div>
        <div class="controles">
          <button class="btn sm" data-a="pausa" id="bt-pausa">${UI.pausado ? '▶ Continuar' : '❚❚ Pausar'}</button>
          <div class="seg" role="group" aria-label="Velocidade">${[1, 2, 4].map(v => `<button data-a="vel" data-x="${v}" aria-pressed="${UI.vel === v}">${v}x</button>`).join('')}</div>
          <button class="btn sm" data-a="subs">Substituições <span class="chip" id="subs-n">${P.subs}/5</span></button>
          <button class="btn sm ghost" data-a="pular">Pular para o fim</button>
        </div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Postura</h3></div><div class="seg full">${[['defensiva', 'Defensiva'], ['equilibrada', 'Equilibrada'], ['ofensiva', 'Ofensiva']].map(([v, n]) => `<button data-a="postura" data-x="${v}" aria-pressed="${tat.postura === v}">${n}</button>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>Estatísticas</h3></div><div class="stats" id="stats"></div></div>
        <div class="card"><div class="card-h"><h3>Narração</h3></div><div class="narr" id="narr"></div></div>
      </div>
    </div></div>`;
}
function iniciarVistaPartida() {
  const cv = $('#cv-jogo'); if (!cv || !UI.partida) return;
  UI.vista = new CampoView(cv, UI.partida, UI.visual);
  UI._narrN = -1; atualizarDOMPartida(true);
  pararLoop();
  let last = performance.now(), acc = 0;
  const loop = now => {
    const dt = Math.min(60, now - last); last = now;
    const P = UI.partida; if (!P || UI.tela !== 'partida') return;
    if (!UI.pausado && $('#modal').hidden) P.passo(dt * UI.vel);
    UI.vista.desenhar(dt);
    acc += dt; if (acc > 120) { acc = 0; atualizarDOMPartida(); }
    UI.loop = requestAnimationFrame(loop);
  };
  UI.loop = requestAnimationFrame(loop);
}
function pararLoop() { if (UI.loop) cancelAnimationFrame(UI.loop); UI.loop = null; }
window.addEventListener('resize', () => { if (UI.vista && UI.tela === 'partida') UI.vista.redimensionar(); });
function atualizarDOMPartida(forcar) {
  const P = UI.partida; if (!P) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== String(v)) el.textContent = v; };
  set('pl-g0', P.placar[0]); set('pl-g1', P.placar[1]);
  const m = Math.floor(P.min); const ext = P.tempo === 1 && m > 45 ? `45+${m - 45}` : m > 90 ? `90+${m - 90}` : m;
  set('pl-rel', P.fase === 'pre' ? "0'" : `${ext}'`);
  set('pl-per', P.fase === 'fim' ? 'FIM' : P.fase === 'intervalo' ? 'INTERVALO' : P.tempo === 2 ? '2º TEMPO' : '1º TEMPO');
  set('ticker', P.portador && P.fase === 'jogo' ? `Com a bola: ${P.portador.j.nome} (${CL[P.ids[P.portador.t]].sigla})` : P.fase === 'pre' ? 'Aguardando o apito inicial' : '');
  set('subs-n', `${P.subs}/5`);
  const narr = document.getElementById('narr');
  if (narr && (forcar || UI._narrN !== P.narr.length || UI._narrTop !== (P.narr[0] && P.narr[0].txt))) {
    UI._narrN = P.narr.length; UI._narrTop = P.narr[0] && P.narr[0].txt;
    narr.innerHTML = P.narr.length ? P.narr.map(n => `<div class="${n.tipo}"><span class="m">${n.min}'</span><span>${esc(n.txt)}</span></div>`).join('') : '<p class="muted small">A narração começa com o apito inicial.</p>';
  }
  const st = document.getElementById('stats');
  if (st) {
    const [p0, p1] = P.posseP(); const s = P.stats;
    const linha = (n, a, b) => { const t = (a + b) || 1; return `<div class="stat"><span class="lbl">${n}</span><b>${a}</b><div class="comp" style="grid-template-columns:1fr"><div class="duo"><i style="width:${a / t * 100}%;background:var(--acc)"></i><i style="flex:1;background:var(--acc2)"></i></div></div><b>${b}</b></div>`; };
    st.innerHTML = linha('Posse de bola (%)', p0, p1) + linha('Finalizações', s.chutes[0], s.chutes[1]) + linha('No gol', s.noGol[0], s.noGol[1]) + linha('Escanteios', s.esc[0], s.esc[1]) + linha('Cartões', s.cart[0], s.cart[1]);
  }
  const sob = document.getElementById('sobre'); const fase = P.fase + (P.fase === 'fim' ? '' : '');
  if (sob && sob.dataset.f !== fase) { sob.dataset.f = fase; sob.innerHTML = sobrePartida(); }
}
function sobrePartida() {
  const P = UI.partida; const [h, a] = P.ids;
  if (P.fase === 'pre') return `<div class="sobre"><div class="card stack"><span class="eyebrow">${esc(CL[h].estadio)}</span><h2>${esc(CL[h].nome)} × ${esc(CL[a].nome)}</h2><p class="muted small">Você pode mudar a postura e fazer até 5 substituições durante o jogo.</p><button class="btn pri lg" data-a="apito">Apito inicial</button></div></div>`;
  if (P.fase === 'intervalo') return `<div class="sobre"><div class="card stack"><span class="eyebrow">Intervalo</span><h2 class="num">${CL[h].sigla} ${P.placar[0]} × ${P.placar[1]} ${CL[a].sigla}</h2><p class="muted small">Ajuste a postura ao lado ou mexa no time antes de voltar.</p><div class="row wrap" style="justify-content:center"><button class="btn" data-a="subs">Substituições</button><button class="btn pri" data-a="segundo">Começar 2º tempo</button></div></div></div>`;
  if (P.fase === 'fim') {
    const gols = P.gols.map(g => `<div class="small">${g.min}' ${esc(S.jog[g.jog].nome)} (${CL[g.clube].sigla})</div>`).join('') || '<div class="small muted">Sem gols.</div>';
    const cont = {}; P.gols.forEach(g => cont[g.jog] = (cont[g.jog] || 0) + 1);
    let craque = Object.keys(cont).sort((x, y) => cont[y] - cont[x])[0];
    if (!craque) { const t = P.placar[0] >= P.placar[1] ? 0 : 1; craque = P.pl.filter(p => p.t === t).sort((x, y) => y.j.ovr - x.j.ovr)[0].j.id; }
    return `<div class="sobre"><div class="card stack"><span class="eyebrow">Fim de jogo</span><h2 class="num">${CL[h].sigla} ${P.placar[0]} × ${P.placar[1]} ${CL[a].sigla}</h2>${gols}<p class="small">Melhor em campo: <b>${esc(S.jog[craque].nome)}</b></p><button class="btn pri lg" data-a="concluir">Ver a rodada</button></div></div>`;
  }
  return '';
}
function modalSubs() {
  const P = UI.partida; const t = P.tUser; P.saiu = P.saiu || new Set();
  const campo = P.pl.filter(p => p.t === t).map(p => p.j);
  const emCampo = new Set(campo.map(j => j.id));
  const banco = S.cl[S.clube].elenco.filter(id => !emCampo.has(id) && !P.saiu.has(id)).map(id => S.jog[id]).filter(Boolean).sort((a, b) => ORDEM_POS.indexOf(a.pos) - ORDEM_POS.indexOf(b.pos));
  const s = UI.sub || {};
  const item = (j, lado) => `<button class="${s[lado] === j.id ? 'sel' : ''}" data-a="sub-${lado}" data-x="${j.id}"><div class="av">${img(j, 'busto')}</div>${posTag(j.pos)}<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.nome)}</span><span class="small muted">${lado === 'sai' ? Math.round(j.cond - P.min / 4) + '%' : j.cond + '%'}</span><span class="ovr ${tier(j.ovr)}" style="font-size:1rem">${j.ovr}</span></button>`;
  abrirModal(`<div class="stack"><div><span class="eyebrow">${P.subs}/5 substituições usadas</span><h2 style="font-size:1.6rem">Substituições</h2></div>
    ${P.subs >= 5 ? '<div class="resp no">Você já fez as 5 substituições.</div>' : ''}
    <div class="grid g2"><div><div class="eyebrow" style="margin-bottom:6px">Sai</div><div class="banco">${campo.map(j => item(j, 'sai')).join('')}</div></div><div><div class="eyebrow" style="margin-bottom:6px">Entra</div><div class="banco">${banco.map(j => item(j, 'entra')).join('')}</div></div></div>
    <div class="row wrap"><button class="btn pri" data-a="sub-ok" ${s.sai && s.entra && P.subs < 5 ? '' : 'disabled'}>Confirmar troca</button><button class="btn ghost" data-a="fechar">Voltar ao jogo</button></div></div>`);
}

// ---------- pós-jogo ----------
function telaPosJogo() {
  const U = UI.ultimo; if (!U) { UI.tela = 'central'; return telaCentral(); }
  const r = U.res; const d = U.div; const lista = S.div[d].res[U.rod] || [];
  const meu = r.h === S.clube ? [r.gh, r.ga] : [r.ga, r.gh]; const st = meu[0] > meu[1] ? ['good', 'Vitória'] : meu[0] < meu[1] ? ['bad', 'Derrota'] : ['', 'Empate'];
  const gl = c => r.gols.filter(g => g.clube === c).map(g => `<div class="small">${g.min}' ${esc(S.jog[g.jog].nome)}</div>`).join('');
  return `<div class="stack" style="max-width:980px;margin:0 auto;width:100%">
    <div class="card"><div class="row between"><span class="chip ${st[0]}">${st[1]}</span><span class="muted small">${DIVISOES[d].curto} · Rodada ${U.rod + 1}</span></div>
      <div class="prox"><div class="time">${escudo(r.h, 72)}<span class="nm">${esc(CL[r.h].nome)}</span>${gl(r.h)}</div><div class="vs" style="color:var(--ink);font-size:2.6rem">${r.gh} × ${r.ga}</div><div class="time">${escudo(r.a, 72)}<span class="nm">${esc(CL[r.a].nome)}</span>${gl(r.a)}</div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Outros jogos</h3></div><div class="stack" style="gap:6px">${lista.filter(x => x !== r && !(x.h === r.h && x.a === r.a)).map(x => `<div class="row" style="padding:6px 8px;background:var(--s2);border-radius:var(--r-sm)"><span class="grow right" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(CL[x.h].nome)}</span>${escudo(x.h, 18)}<b class="num" style="min-width:52px;text-align:center">${x.gh} × ${x.ga}</b>${escudo(x.a, 18)}<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(CL[x.a].nome)}</span></div>`).join('')}</div></div>
      ${cardMiniTabela()}
    </div>
    <div class="row wrap" style="justify-content:flex-end"><button class="btn" data-a="ir" data-x="tabela">Tabela completa</button><button class="btn pri lg" data-a="ir" data-x="central">Voltar à Central</button></div>
  </div>`;
}
function concluirPartida(P) {
  const d = minhaDiv(), rod = S.rodada; const res = P.resultado();
  concluirRodada(res);
  UI.ultimo = { res, div: d, rod }; UI.partida = null; UI.pausado = false;
  ir('posjogo');
}

// ---------- modal ----------
function abrirModal(html) { const m = $('#modal'); m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}<button class="modal-x" data-a="fechar" aria-label="Fechar">×</button></div>`; m.hidden = false; }
function fecharModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; UI.neg = null; UI.sub = null; }

// ---------- eventos ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) { if (e.target.id === 'modal') fecharModal(); return; }
  const a = el.dataset.a, x = el.dataset.x;
  switch (a) {
    case 'ir': fecharModal(); return ir(x);
    case 'ir-fechar': fecharModal(); return ir(x);
    case 'visual': return setVisual(x);
    case 'novo': criarCarreira(UI.visual); UI.escDiv = 'A'; return ir('escolha');
    case 'escdiv': UI.escDiv = x; return render();
    case 'escolher': return modalAssumir(x);
    case 'assumir': { const nome = ($('#tecnico').value || '').trim() || 'Técnico'; UI.nomeTec = nome; assumirClube(x, nome); fecharModal(); return ir('central'); }
    case 'fechar': fecharModal(); if (UI.tela === 'mercado') { const r = $('#merc-res'); if (r) r.innerHTML = resultadosMercado(); } return;
    case 'jogador': return modalJogador(x);
    case 'elfiltro': UI.elFiltro = x; return render();
    case 'venda': { const j = S.jog[x]; j.venda = !j.venda; salvar(); toast(j.venda ? `${j.nome} está à venda` : `${j.nome} saiu da lista de venda`); modalJogador(x); if (UI.tela === 'elenco') { const scr = window.scrollY; render(); window.scrollTo(0, scr); modalJogador(x); } return; }
    case 'renovar': { const j = S.jog[x]; j.contrato += 2; j.salario = Math.round(j.salario * 1.1); j.moral = clamp(j.moral + 8, 0, 100); salvar(); toast(`${j.nome} renovou até ${j.contrato}`); return modalJogador(x); }
    case 'tat-slot': return tatClique('s', x);
    case 'tat-banco': return tatClique('b', x);
    case 'tat-auto': { const t = S.cl[S.clube].tatica; S.cl[S.clube].tatica = taticaAuto(S.clube, t.formacao); salvar(); toast('Escalação montada com os melhores disponíveis'); return render(); }
    case 'tat-form': { const t = S.cl[S.clube].tatica; t.formacao = x; t.tit = reencaixar(t.tit, x); salvar(); return render(); }
    case 'tat-postura': S.cl[S.clube].tatica.postura = x; salvar(); return render();
    case 'tat-marcacao': S.cl[S.clube].tatica.marcacao = x; salvar(); return render();
    case 'postura': S.cl[S.clube].tatica.postura = x; salvar(); if (UI.tela === 'partida') { document.querySelectorAll('[data-a="postura"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.x === x)); if (UI.partida) UI.partida.falar(`O técnico manda o time jogar de forma ${x}.`, 'sub'); return; } return render();
    case 'maismerc': UI.merc.n += 30; $('#merc-res').innerHTML = resultadosMercado(); return;
    case 'negociar': { const j = S.jog[x]; UI.neg = { id: x, fase: 'clube', valor: +pedidaClube(j).toFixed(2), salario: pedidaSalario(j), anos: 3, msg: null }; return modalNegociacao(); }
    case 'neg-atalho': UI.neg.valor = +x; UI.neg.msg = null; return modalNegociacao();
    case 'neg-clube': { const j = S.jog[UI.neg.id]; const v = +$('#neg-valor').value; UI.neg.valor = v; const r = negociarClube(j, v); UI.neg.msg = { ok: r.ok, txt: r.msg }; if (r.ok) { UI.neg.fase = 'jogador'; UI.neg.valorFechado = v; } else if (r.contra) UI.neg.valor = r.contra; return modalNegociacao(); }
    case 'neg-anos': UI.neg.anos = +x; UI.neg.salario = +$('#neg-sal').value || UI.neg.salario; return modalNegociacao();
    case 'neg-jog': { const j = S.jog[UI.neg.id]; const s = Math.round(+$('#neg-sal').value); UI.neg.salario = s; const r = negociarJogador(j, s, UI.neg.anos); UI.neg.msg = { ok: r.ok, txt: r.msg }; if (r.ok) { concluirContratacao(j, UI.neg.valorFechado, s, UI.neg.anos); UI.neg.fase = 'fechado'; if (UI.tela === 'mercado') { const scr = window.scrollY; render(); window.scrollTo(0, scr); } } else if (r.contra) UI.neg.salario = r.contra; return modalNegociacao(); }
    case 'tabdiv': UI.tabDiv = x; UI.rodVer = null; return render();
    case 'rod': UI.rodVer = +x; return render();
    case 'prop-sim': responderProposta(x, true); toast('Venda concluída'); return render();
    case 'prop-nao': responderProposta(x, false); return render();
    case 'ct': { const d = minhaDiv(); const custo = +(4 * S.estrutura.ct * S.estrutura.ct * ({ A: 1, B: .3, C: .1 }[d])).toFixed(2); if (S.caixa < custo) return; lancar(`Obras no CT (nível ${S.estrutura.ct + 1})`, -custo); S.estrutura.ct++; salvar(); toast('CT melhorado'); return render(); }
    case 'reset': UI.confirmarReset = true; return render();
    case 'reset-nao': UI.confirmarReset = false; return render();
    case 'reset-sim': apagarSave(); S = null; UI.confirmarReset = false; return ir('inicio');
    case 'novatemp': novaTemporada(); toast(`Temporada ${S.ano} começou`); return render();
    case 'simular': { const j = proximoJogo(); const P = new Partida(j.h, j.a, hashStr(S.ano + '-' + S.rodada + S.clube)); P.simularAteOFim(); return concluirPartida(P); }
    case 'aovivo': { const j = proximoJogo(); UI.partida = new Partida(j.h, j.a, hashStr(S.ano + '-' + S.rodada + S.clube)); UI.pausado = false; return ir('partida'); }
    case 'apito': UI.partida.comecar(); return atualizarDOMPartida(true);
    case 'segundo': UI.partida.segundoTempo(); return atualizarDOMPartida(true);
    case 'pausa': UI.pausado = !UI.pausado; el.textContent = UI.pausado ? '▶ Continuar' : '❚❚ Pausar'; return;
    case 'vel': UI.vel = +x; document.querySelectorAll('[data-a="vel"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.x === x)); return;
    case 'pular': UI.partida.simularAteOFim(); return atualizarDOMPartida(true);
    case 'concluir': return concluirPartida(UI.partida);
    case 'subs': UI.sub = {}; return modalSubs();
    case 'sub-sai': UI.sub.sai = x; return modalSubs();
    case 'sub-entra': UI.sub.entra = x; return modalSubs();
    case 'sub-ok': { const P = UI.partida; if (P.substituir(UI.sub.sai, UI.sub.entra)) { P.saiu = P.saiu || new Set(); P.saiu.add(UI.sub.sai); } fecharModal(); salvar(); return atualizarDOMPartida(true); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) fecharModal(); });
let _tBusca;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.f) {
    const k = t.dataset.f; const m = UI.merc;
    m[k] = t.type === 'checkbox' ? t.checked : k === 'max' ? +t.value : t.value; m.n = 30;
    clearTimeout(_tBusca); _tBusca = setTimeout(() => { const r = $('#merc-res'); if (r) r.innerHTML = resultadosMercado(); }, k === 'busca' ? 180 : 0);
  }
  if (t.id === 'preco') { S.preco = +t.value; const p = publicoEstimado(); $('#preco-v').textContent = 'R$ ' + S.preco; $('#pub-v').textContent = p.toLocaleString('pt-BR'); $('#bil-v').textContent = fmtMi(p * S.preco / 1e6); salvar(); }
});

// ---------- início ----------
function boot(data) {
  let v = 'pixel'; try { v = localStorage.getItem('prancheta-visual') || v; } catch (e) { }
  if (data && data.S) { S = data.S; _seq = data.seq || _seq; v = S.visual || v; UI.tela = data.tela || 'central'; }
  else if (carregar()) { v = S.visual || v; UI.tela = 'central'; }
  UI.visual = v; document.documentElement.setAttribute('data-visual', v);
  if (!S || !S.clube) UI.tela = 'inicio';
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (UI.tela !== 'partida') render(); });
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S, seq: _seq, tela: ['partida', 'prejogo', 'posjogo'].includes(UI.tela) ? 'central' : UI.tela }));
(window.claude && window.claude.hot && window.claude.hot.ready) ? window.claude.hot.ready(boot) : boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
