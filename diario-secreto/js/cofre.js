/*
 * Cofre: tela de login, porta do cofre desenhada em SVG, sons mecânicos
 * sintetizados e a animação de abertura depois da senha certa.
 */
(function (global) {
  "use strict";

  var config = global.DIARIO_CONFIG;
  var SESSAO = "diario-secreto:sessao";
  var BLOQUEIO = "diario-secreto:bloqueio-ate";
  var SOM = "diario-secreto:som";
  var C = 220; // centro do desenho (viewBox 0 0 440 440)

  var $ = function (id) { return document.getElementById(id); };

  global.gerarHash = function (idAgente, senha) {
    return global.sha256("diario-secreto|" + idAgente + "|" + senha);
  };

  /* ================= DESENHO DO COFRE ================= */

  function polar(r, grausDoTopo) {
    var a = (grausDoTopo - 90) * Math.PI / 180;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  }

  var ANGULOS_TRAVAS = [0, 45, 90, 135, 180, 225, 270, 315];

  function desenharBatente() {
    var s = [];
    s.push('<svg viewBox="0 0 440 440" xmlns="http://www.w3.org/2000/svg">');
    s.push("<defs>");
    s.push('<linearGradient id="g-chapa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34383c"/><stop offset=".5" stop-color="#25282b"/><stop offset="1" stop-color="#17191b"/></linearGradient>');
    s.push('<linearGradient id="g-anel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a9096"/><stop offset=".35" stop-color="#4b5056"/><stop offset=".7" stop-color="#2a2d31"/><stop offset="1" stop-color="#5a6066"/></linearGradient>');
    s.push('<linearGradient id="g-dobradica" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2e32"/><stop offset=".5" stop-color="#8c9298"/><stop offset="1" stop-color="#33373b"/></linearGradient>');
    s.push("</defs>");
    // chapa com o furo redondo
    s.push('<path fill-rule="evenodd" fill="url(#g-chapa)" d="M26 2H414A24 24 0 0 1 438 26V414A24 24 0 0 1 414 438H26A24 24 0 0 1 2 414V26A24 24 0 0 1 26 2Z M220 34A186 186 0 1 0 220 406A186 186 0 1 0 220 34Z"/>');
    s.push('<rect x="2.5" y="2.5" width="435" height="435" rx="24" fill="none" stroke="#0a0b0c" stroke-width="3"/>');
    // parafusos dos cantos
    [[30, 30], [410, 30], [30, 410], [410, 410]].forEach(function (p) {
      s.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" fill="#1a1c1f" stroke="#55595e" stroke-width="2"/>');
      s.push('<path d="M' + (p[0] - 4) + " " + p[1] + "H" + (p[0] + 4) + '" stroke="#0b0c0d" stroke-width="2"/>');
    });
    // anel de aço
    s.push('<circle cx="220" cy="220" r="198" fill="none" stroke="url(#g-anel)" stroke-width="22"/>');
    s.push('<circle cx="220" cy="220" r="187" fill="none" stroke="#08090a" stroke-width="3"/>');
    s.push('<circle cx="220" cy="220" r="209" fill="none" stroke="#0e1012" stroke-width="2"/>');
    // encaixes das travas
    ANGULOS_TRAVAS.forEach(function (a) {
      s.push('<g transform="rotate(' + a + ' 220 220)"><rect x="207" y="13" width="26" height="24" rx="3" fill="#0b0c0d" stroke="#3c4146" stroke-width="1.5"/></g>');
    });
    // dobradiças
    s.push('<rect x="4" y="128" width="40" height="54" rx="6" fill="url(#g-dobradica)" stroke="#0a0b0c" stroke-width="2"/>');
    s.push('<rect x="4" y="258" width="40" height="54" rx="6" fill="url(#g-dobradica)" stroke="#0a0b0c" stroke-width="2"/>');
    // plaqueta
    s.push('<rect x="170" y="410" width="100" height="20" rx="3" fill="#1b1d20" stroke="#4b5056" stroke-width="1.5"/>');
    s.push('<text x="220" y="424.5" text-anchor="middle" font-family="IBM Plex Sans Condensed, Arial Narrow, sans-serif" font-size="10" letter-spacing="2.5" fill="#8b9096">COFRE · SUB 3</text>');
    s.push("</svg>");
    return s.join("");
  }

  function desenharPorta() {
    var s = [];
    s.push('<svg viewBox="0 0 440 440" xmlns="http://www.w3.org/2000/svg" overflow="visible">');
    s.push("<defs>");
    s.push('<radialGradient id="g-porta" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#717880"/><stop offset=".55" stop-color="#3b4046"/><stop offset="1" stop-color="#1c1f22"/></radialGradient>');
    s.push('<linearGradient id="g-cromo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6c7278"/><stop offset=".45" stop-color="#e6e9eb"/><stop offset="1" stop-color="#5d6369"/></linearGradient>');
    s.push('<radialGradient id="g-cromo-r" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f1f3f4"/><stop offset=".5" stop-color="#9aa0a6"/><stop offset="1" stop-color="#3e4348"/></radialGradient>');
    s.push('<radialGradient id="g-dial" cx="40%" cy="32%" r="80%"><stop offset="0" stop-color="#43494f"/><stop offset="1" stop-color="#101214"/></radialGradient>');
    s.push("</defs>");

    // disco da porta
    s.push('<circle cx="220" cy="220" r="184" fill="url(#g-porta)" stroke="#0a0b0c" stroke-width="3"/>');
    s.push('<circle cx="220" cy="220" r="174" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="2"/>');
    s.push('<circle cx="220" cy="220" r="170" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>');

    // travas (atrás dos rebites para parecer que saem de dentro da porta)
    ANGULOS_TRAVAS.forEach(function (a) {
      s.push('<g transform="rotate(' + a + ' 220 220)">');
      s.push('<rect x="205" y="52" width="30" height="34" rx="4" fill="#15171a" stroke="#4a4f55" stroke-width="1.5"/>');
      s.push('<g class="trava"><rect x="211" y="20" width="18" height="58" rx="6" fill="url(#g-cromo)" stroke="#2a2d31" stroke-width="1.5"/></g>');
      s.push("</g>");
    });

    // rebites
    for (var i = 0; i < 32; i++) {
      var p = polar(156, i * (360 / 32) + 5.6);
      s.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.6" fill="url(#g-cromo-r)" stroke="#16181b" stroke-width="1"/>');
    }

    // sulcos
    s.push('<circle cx="220" cy="220" r="138" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="7"/>');
    s.push('<circle cx="220" cy="220" r="134" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1.5"/>');

    // volante de três raios
    s.push('<g id="volante" class="volante">');
    [30, 150, 270].forEach(function (a) {
      s.push('<g transform="rotate(' + a + ' 220 220)">');
      s.push('<rect x="213" y="100" width="14" height="66" rx="5" fill="url(#g-cromo)" stroke="#25282c" stroke-width="1.5"/>');
      s.push('<circle cx="220" cy="98" r="15" fill="url(#g-cromo-r)" stroke="#25282c" stroke-width="1.5"/>');
      s.push("</g>");
    });
    s.push('<circle cx="220" cy="220" r="74" fill="#16181b" stroke="url(#g-cromo)" stroke-width="7"/>');
    s.push("</g>");

    // segredo (disco numerado)
    s.push('<g id="dial" class="dial">');
    s.push('<circle cx="220" cy="220" r="62" fill="url(#g-dial)" stroke="#07080a" stroke-width="2"/>');
    for (var t = 0; t < 100; t++) {
      var longo = t % 10 === 0;
      var medio = t % 5 === 0;
      var a1 = polar(61, t * 3.6);
      var a2 = polar(longo ? 50 : medio ? 54 : 56.5, t * 3.6);
      s.push('<line x1="' + a1.x.toFixed(1) + '" y1="' + a1.y.toFixed(1) + '" x2="' + a2.x.toFixed(1) + '" y2="' + a2.y.toFixed(1) + '" stroke="#d9dcdf" stroke-opacity="' + (longo ? 0.95 : 0.55) + '" stroke-width="' + (longo ? 1.8 : 1) + '"/>');
      if (longo) {
        var n = polar(41.5, t * 3.6);
        s.push('<text x="' + n.x.toFixed(1) + '" y="' + n.y.toFixed(1) + '" transform="rotate(' + (t * 3.6) + " " + n.x.toFixed(1) + " " + n.y.toFixed(1) + ')" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="10" fill="#e8eaec">' + t + "</text>");
      }
    }
    s.push('<circle cx="220" cy="220" r="27" fill="url(#g-cromo-r)" stroke="#16181b" stroke-width="1.5"/>');
    for (var k = 0; k < 24; k++) {
      var b1 = polar(27, k * 15);
      var b2 = polar(22, k * 15);
      s.push('<line x1="' + b1.x.toFixed(1) + '" y1="' + b1.y.toFixed(1) + '" x2="' + b2.x.toFixed(1) + '" y2="' + b2.y.toFixed(1) + '" stroke="#3d4247" stroke-width="1.4"/>');
    }
    s.push('<circle cx="220" cy="220" r="10" fill="#22252a"/>');
    s.push("</g>");

    // marcador fixo do segredo
    s.push('<path d="M213 146 L227 146 L220 158 Z" fill="#c4352b" stroke="#2a0d0a" stroke-width="1"/>');
    s.push("</svg>");
    return s.join("");
  }

  /* ================= SOM ================= */

  var Som = {
    ctx: null,
    ligado: true,

    preparar: function () {
      if (!this.ligado || pulou) return null;
      try {
        if (!this.ctx) {
          var AC = global.AudioContext || global.webkitAudioContext;
          if (!AC) return null;
          this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) {
        this.ctx = null;
      }
      return this.ctx;
    },

    ruido: function (dur) {
      var ctx = this.ctx;
      var buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    },

    clique: function (quando, volume) {
      var ctx = this.preparar();
      if (!ctx) return;
      var t = ctx.currentTime + (quando || 0);
      var src = this.ruido(0.03);
      var filtro = ctx.createBiquadFilter();
      filtro.type = "bandpass";
      filtro.frequency.value = 2600 + Math.random() * 900;
      filtro.Q.value = 3;
      var g = ctx.createGain();
      g.gain.setValueAtTime(volume || 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      src.connect(filtro).connect(g).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.04);
    },

    baque: function (quando, volume) {
      var ctx = this.preparar();
      if (!ctx) return;
      var t = ctx.currentTime + (quando || 0);
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      var g = ctx.createGain();
      g.gain.setValueAtTime(volume || 0.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);

      var src = this.ruido(0.12);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime((volume || 0.6) * 0.5, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(lp).connect(g2).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.13);
    },

    rangido: function (quando, dur) {
      var ctx = this.preparar();
      if (!ctx) return;
      var t = ctx.currentTime + (quando || 0);
      var osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(52, t);
      osc.frequency.linearRampToValueAtTime(74, t + dur * 0.6);
      osc.frequency.linearRampToValueAtTime(46, t + dur);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp).connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    erro: function () {
      var ctx = this.preparar();
      if (!ctx) return;
      var t = ctx.currentTime;
      [0, 0.16].forEach(function (d) {
        var osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 180;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.06, t + d);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        osc.connect(g).connect(ctx.destination);
        osc.start(t + d);
        osc.stop(t + d + 0.13);
      });
    }
  };

  /* ================= ANIMAÇÃO ================= */

  function animar(el, quadros, opcoes) {
    if (!el || typeof el.animate !== "function") return Promise.resolve();
    var a = el.animate(quadros, Object.assign({ fill: "forwards" }, opcoes));
    animacoes.push(a);
    if (pulou) {
      try { a.finish(); } catch (e) { /* nada */ }
    }
    return a.finished.catch(function () {});
  }

  var animacoes = [];
  var pulou = false;

  function esperar(ms) {
    return new Promise(function (ok) { setTimeout(ok, pulou ? 0 : ms); });
  }

  function reduzirMovimento() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function abrirCofre() {
    var login = $("tela-login");
    var cofre = $("cofre");
    var porta = $("cofre-porta");
    var luz = cofre.querySelector(".cofre-luz");
    var dial = porta.querySelector("#dial");
    var volante = porta.querySelector("#volante");
    var travas = porta.querySelectorAll(".trava");
    var terminal = $("form-login");
    var pular = $("btn-pular");

    pulou = false;
    animacoes = [];

    if (reduzirMovimento()) {
      return animar(login, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
    }

    pular.hidden = false;
    login.classList.add("login--abrindo");

    // 1. o terminal sai e o cofre vai para o centro da tela
    var r = cofre.getBoundingClientRect();
    var dx = global.innerWidth / 2 - (r.left + r.width / 2);
    var dy = global.innerHeight / 2 - (r.top + r.height / 2);
    var alvo = Math.min(global.innerWidth * 0.86, global.innerHeight * 0.78, 620);
    var escala = Math.max(1, alvo / r.width);
    var centro = "translate(" + dx + "px," + dy + "px) scale(" + escala + ")";

    return Promise.all([
      animar(terminal, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px)" }], { duration: 380, easing: "ease-in" }),
      animar(cofre, [{ transform: "none" }, { transform: centro }], { duration: 760, easing: "cubic-bezier(.65,0,.25,1)" })
    ])
      .then(function () {
        // 2. gira o segredo
        var d = 1250;
        for (var i = 0; i < 16; i++) Som.clique((i / 16) * (d / 1000) + Math.random() * 0.03, 0.22 + Math.random() * 0.12);
        return animar(dial, [
          { transform: "rotate(0deg)" },
          { transform: "rotate(310deg)", offset: 0.38 },
          { transform: "rotate(130deg)", offset: 0.72 },
          { transform: "rotate(252deg)" }
        ], { duration: d, easing: "cubic-bezier(.45,.05,.35,1)" });
      })
      .then(function () {
        // 3. recolhe as travas
        Som.baque(0.3, 0.7);
        return Promise.all(Array.prototype.map.call(travas, function (t, i) {
          return animar(t, [{ transform: "translateY(0)" }, { transform: "translateY(34px)" }], {
            duration: 300, delay: i * 18, easing: "cubic-bezier(.7,0,.3,1)"
          });
        }));
      })
      .then(function () {
        // 4. gira o volante
        Som.rangido(0, 0.65);
        return animar(volante, [{ transform: "rotate(0deg)" }, { transform: "rotate(-240deg)" }], {
          duration: 680, easing: "cubic-bezier(.5,0,.3,1)"
        });
      })
      .then(function () {
        // 5. a porta abre
        Som.baque(0, 0.45);
        Som.rangido(0.05, 1.1);
        animar(luz, [{ opacity: 0.25, filter: "brightness(.7)" }, { opacity: 1, filter: "brightness(1.15)" }], { duration: 1100, easing: "ease-out" });
        return animar(porta, [
          { transform: "perspective(1400px) rotateY(0deg)", filter: "brightness(1)" },
          { transform: "perspective(1400px) rotateY(-112deg)", filter: "brightness(.45)" }
        ], { duration: 1150, easing: "cubic-bezier(.55,.02,.25,1)" });
      })
      .then(function () {
        // 6. entra no cofre
        return Promise.all([
          animar(cofre, [{ transform: centro }, { transform: "translate(" + dx + "px," + dy + "px) scale(" + (escala * 4.2) + ")" }], { duration: 720, easing: "cubic-bezier(.6,0,.9,.4)" }),
          animar(login, [{ opacity: 1 }, { opacity: 0 }], { duration: 720, easing: "ease-in" })
        ]);
      });
  }

  function pularAnimacao() {
    pulou = true;
    animacoes.forEach(function (a) {
      try { a.finish(); } catch (e) { /* animação já terminou */ }
    });
  }

  function restaurarCena() {
    animacoes.forEach(function (a) {
      try { a.cancel(); } catch (e) { /* nada */ }
    });
    animacoes = [];
    pulou = false;
    var login = $("tela-login");
    login.classList.remove("login--abrindo");
    login.style.opacity = "";
    $("btn-pular").hidden = true;
  }

  /* ================= LOGIN ================= */

  var tentativas = 0;
  var timerBloqueio = null;

  function lerNumero(chave) {
    try { return Number(global.localStorage.getItem(chave)) || 0; } catch (e) { return 0; }
  }

  function gravar(chave, valor) {
    try {
      if (valor === null) global.localStorage.removeItem(chave);
      else global.localStorage.setItem(chave, String(valor));
    } catch (e) { /* armazenamento indisponível */ }
  }

  function sessaoAtual() {
    try {
      var id = global.sessionStorage.getItem(SESSAO);
      return agentePorId(id);
    } catch (e) {
      return null;
    }
  }

  function agentePorId(id) {
    for (var i = 0; i < config.agentes.length; i++) if (config.agentes[i].id === id) return config.agentes[i];
    return null;
  }

  function mensagem(texto, tipo) {
    var msg = $("login-msg");
    msg.textContent = texto || "";
    msg.dataset.tipo = tipo || "";
    $("led").dataset.estado = tipo || "";
  }

  function status(texto) {
    $("status-terminal").textContent = texto;
  }

  function verificarBloqueio() {
    var ate = lerNumero(BLOQUEIO);
    var resta = Math.ceil((ate - Date.now()) / 1000);
    var botao = $("btn-destrancar");
    if (resta > 0) {
      botao.disabled = true;
      mensagem("Terminal bloqueado por segurança. Aguarde " + resta + " s.", "erro");
      status("Bloqueio ativo.");
      clearTimeout(timerBloqueio);
      timerBloqueio = setTimeout(verificarBloqueio, 1000);
      return true;
    }
    if (botao.disabled && ate) {
      botao.disabled = false;
      gravar(BLOQUEIO, null);
      tentativas = 0;
      mensagem("Bloqueio encerrado. Tente de novo.", "");
      status("Canal seguro. Aguardando credenciais.");
    }
    return false;
  }

  function montarAgentes() {
    var campo = $("agentes");
    config.agentes.forEach(function (ag, i) {
      var label = document.createElement("label");
      label.className = "agente agente--" + (ag.tom === "claro" ? "claro" : "escuro");
      label.innerHTML =
        '<input type="radio" name="agente" value="' + ag.id + '"' + (i === 0 ? " checked" : "") + ">" +
        '<span class="agente-cartao">' +
        '<svg class="agente-chapeu" viewBox="0 0 64 64" aria-hidden="true">' +
        '<path d="M17 30C16 19 21 12 28 13.5L32 17L36 13.5C43 12 48 19 47 30Z"/>' +
        '<rect class="agente-faixa" x="17" y="24.5" width="30" height="4"/>' +
        '<ellipse cx="32" cy="31" rx="27" ry="4.6"/>' +
        '<path d="M22 33Q32 47 42 33Z"/>' +
        '<path d="M12 64L21 41L32 54L43 41L52 64Z"/>' +
        "</svg>" +
        '<span class="agente-txt"><span class="agente-rotulo">Agente</span>' +
        '<span class="agente-nome"></span><span class="agente-lema"></span></span>' +
        "</span>";
      label.querySelector(".agente-nome").textContent = ag.codinome;
      label.querySelector(".agente-lema").textContent = ag.lema || "";
      campo.appendChild(label);
    });
  }

  function iniciar(opcoes) {
    var aoEntrar = opcoes.aoEntrar;

    $("cofre-batente").innerHTML = desenharBatente();
    $("cofre-porta").innerHTML = desenharPorta();
    montarAgentes();

    try { Som.ligado = global.localStorage.getItem(SOM) !== "desligado"; } catch (e) { Som.ligado = true; }
    var btnSom = $("btn-som");
    function pintarSom() {
      btnSom.setAttribute("aria-pressed", String(Som.ligado));
      btnSom.textContent = Som.ligado ? "Som ligado" : "Som desligado";
    }
    pintarSom();
    btnSom.addEventListener("click", function () {
      Som.ligado = !Som.ligado;
      gravar(SOM, Som.ligado ? null : "desligado");
      pintarSom();
      if (Som.ligado) Som.clique(0, 0.3);
    });

    $("btn-pular").addEventListener("click", pularAnimacao);

    $("form-login").addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (verificarBloqueio()) return;

      var escolhido = document.querySelector('input[name="agente"]:checked');
      var agente = escolhido && agentePorId(escolhido.value);
      var senha = $("senha").value;
      if (!agente) {
        mensagem("Escolha o seu codinome.", "erro");
        return;
      }
      if (!senha) {
        mensagem("Digite a senha do cofre.", "erro");
        $("senha").focus();
        return;
      }

      Som.preparar();

      if (global.gerarHash(agente.id, senha) !== agente.hash) {
        tentativas++;
        var max = config.tentativasAntesDoBloqueio || 3;
        Som.erro();
        var terminal = $("form-login");
        terminal.classList.remove("terminal--tremer");
        void terminal.offsetWidth;
        terminal.classList.add("terminal--tremer");
        $("senha").select();
        if (tentativas >= max) {
          gravar(BLOQUEIO, Date.now() + (config.segundosDeBloqueio || 30) * 1000);
          verificarBloqueio();
        } else {
          var resta = max - tentativas;
          mensagem("Senha recusada. " + (resta === 1 ? "Resta 1 tentativa." : "Restam " + resta + " tentativas."), "erro");
          status("Tentativa de acesso registrada.");
        }
        return;
      }

      tentativas = 0;
      $("senha").value = "";
      $("btn-destrancar").disabled = true;
      mensagem("Acesso concedido. Bem-vindo, agente " + agente.codinome + ".", "ok");
      status("Destrancando…");
      try { global.sessionStorage.setItem(SESSAO, agente.id); } catch (e) { /* sessão só nesta aba */ }

      esperar(450)
        .then(abrirCofre)
        .then(function () {
          $("tela-login").hidden = true;
          restaurarCena();
          aoEntrar(agente, { animado: true });
        });
    });

    var atual = sessaoAtual();
    if (atual) {
      $("tela-login").hidden = true;
      aoEntrar(atual, { animado: false });
    } else {
      verificarBloqueio();
      setTimeout(function () { $("senha").focus({ preventScroll: true }); }, 50);
    }
  }

  function trancar() {
    try { global.sessionStorage.removeItem(SESSAO); } catch (e) { /* nada */ }
    restaurarCena();
    var login = $("tela-login");
    login.hidden = false;
    $("btn-destrancar").disabled = false;
    mensagem("", "");
    status("Cofre trancado. Aguardando credenciais.");
    Som.baque(0, 0.5);
    if (!verificarBloqueio()) $("senha").focus({ preventScroll: true });
  }

  global.Cofre = { iniciar: iniciar, trancar: trancar, agentePorId: agentePorId, Som: Som };
})(window);
