/*
 * Esconderijo: o diário, o painel lateral e a gaveta de arquivos.
 */
(function (global) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var Armazem = global.Armazem;
  var Cofre = global.Cofre;
  var config = global.DIARIO_CONFIG;

  var NIVEL = { confidencial: "Confidencial", secreto: "Secreto", ultrassecreto: "Ultrassecreto" };
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  var estado = {
    agente: null,
    registros: [],
    info: { modo: "local", conectando: false, aviso: "" },
    aba: "diario",
    filtro: { tag: "", data: "" },
    calendario: null,
    editandoId: null,
    tags: [],
    recemSalvo: null
  };

  /* ================= utilidades ================= */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function semAcento(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function iso(d) {
    var m = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dia < 10 ? "0" : "") + dia;
  }

  function hojeISO() {
    return iso(new Date());
  }

  function deISO(s) {
    var p = String(s).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function dataCurta(s) {
    var d = deISO(s);
    return (d.getDate() < 10 ? "0" : "") + d.getDate() + " " + MESES[d.getMonth()].toUpperCase() + " " + d.getFullYear();
  }

  function dataLonga(s) {
    var d = deISO(s);
    var dia = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][d.getDay()];
    return dia + ", " + d.getDate() + " de " + MESES_LONGOS[d.getMonth()] + " de " + d.getFullYear();
  }

  function dataMedia(s) {
    var d = deISO(s);
    return d.getDate() + " de " + MESES_LONGOS[d.getMonth()] + " de " + d.getFullYear();
  }

  function hora(ms) {
    var d = new Date(ms);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function nomeAgente(id) {
    var ag = Cofre.agentePorId(id);
    return ag ? ag.codinome : id || "Desconhecido";
  }

  function plural(n, um, varios) {
    return n + " " + (n === 1 ? um : varios);
  }

  function protocolo(dataISO) {
    var letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var cod = "";
    for (var i = 0; i < 3; i++) cod += letras[Math.floor(Math.random() * letras.length)];
    return "DS-" + dataISO.slice(2).replace(/-/g, "") + "-" + cod;
  }

  var toastTimer = null;
  function avisar(texto) {
    var t = $("toast");
    t.textContent = texto;
    t.classList.add("toast--visivel");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("toast--visivel"); }, 2800);
  }

  function contarTags(lista) {
    var cont = {};
    lista.forEach(function (r) {
      r.tags.forEach(function (t) { cont[t] = (cont[t] || 0) + 1; });
    });
    return Object.keys(cont)
      .map(function (t) { return { tag: t, n: cont[t] }; })
      .sort(function (a, b) { return b.n - a.n || a.tag.localeCompare(b.tag, "pt-BR"); });
  }

  function contarDias(lista) {
    var cont = {};
    lista.forEach(function (r) { cont[r.data] = (cont[r.data] || 0) + 1; });
    return cont;
  }

  /* ================= exemplos (só no primeiro uso local) ================= */

  function exemplos() {
    var hoje = new Date();
    function diasAtras(n, h, m) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n, h, m);
      return { data: iso(d), ms: d.getTime() };
    }
    var a = config.agentes[0] ? config.agentes[0].id : "noir";
    var b = config.agentes[1] ? config.agentes[1].id : a;
    var d1 = diasAtras(3, 8, 40);
    var d2 = diasAtras(1, 19, 5);
    var d3 = diasAtras(0, 7, 55);
    return [
      {
        id: "exemplo-1", protocolo: protocolo(d1.data), exemplo: true,
        titulo: "Contato estabelecido no café da estação",
        texto: "Cheguei às 8h40, mesa do canto, de costas para a parede. O contato pediu um café sem açúcar e deixou o jornal dobrado na página das palavras cruzadas.\n\nA senha combinou. Ele disse que a encomenda chega amanhã, guarda-volumes 14.",
        data: d1.data, nivel: "confidencial", tags: ["estacao-central", "contato", "cafe"], autor: a, criadoEm: d1.ms
      },
      {
        id: "exemplo-2", protocolo: protocolo(d2.data), exemplo: true,
        titulo: "Mala trocada no guarda-volumes 14",
        texto: "A mala não era a combinada: couro marrom em vez de preto. Dentro, três envelopes lacrados e um bilhete de trem para sexta.\n\nFotografei tudo antes de devolver. Fui seguida por um homem de capa cinza até a saída norte. Despistei pela farmácia.",
        data: d2.data, nivel: "secreto", tags: ["estacao-central", "entrega", "vigilancia"], autor: b, criadoEm: d2.ms
      },
      {
        id: "exemplo-3", protocolo: protocolo(d3.data), exemplo: true,
        titulo: "Nova frequência para o rádio",
        texto: "A partir de hoje, transmissões só às 23h, na frequência anotada no verso da foto do farol. Quem não confirmar até domingo fica fora do canal.",
        data: d3.data, nivel: "ultrassecreto", tags: ["radio", "protocolo"], autor: a, criadoEm: d3.ms
      }
    ];
  }

  /* ================= documento (registro) ================= */

  function docHTML(r, opcoes) {
    opcoes = opcoes || {};
    var tags = r.tags.map(function (t) {
      return '<li><button type="button" class="etiqueta" data-tag="' + esc(t) + '">#' + esc(t) + "</button></li>";
    }).join("");
    var classes = "doc doc--" + r.nivel + (estado.recemSalvo === r.id ? " doc--novo" : "");
    return (
      '<article class="' + classes + '" data-id="' + esc(r.id) + '">' +
      (r.exemplo ? '<span class="doc-exemplo">Exemplo</span>' : "") +
      '<dl class="doc-ficha">' +
      "<div><dt>Protocolo</dt><dd>" + esc(r.protocolo) + "</dd></div>" +
      '<div><dt>Data</dt><dd><time datetime="' + esc(r.data) + '">' + dataCurta(r.data) + "</time></dd></div>" +
      "<div><dt>Hora</dt><dd>" + hora(r.criadoEm) + "</dd></div>" +
      "<div><dt>Agente</dt><dd>" + esc(nomeAgente(r.autor)) + "</dd></div>" +
      "</dl>" +
      '<div class="doc-cab">' +
      (opcoes.completo ? '<h2 class="doc-titulo" id="dossie-titulo">' : '<h3 class="doc-titulo">') + esc(r.titulo) + (opcoes.completo ? "</h2>" : "</h3>") +
      '<p class="carimbo carimbo--' + r.nivel + '"><span class="visualmente-oculto">Classificação: </span>' + NIVEL[r.nivel] + "</p>" +
      "</div>" +
      '<div class="doc-texto' + (opcoes.completo ? "" : " doc-texto--recorte") + '">' + esc(r.texto) + "</div>" +
      (opcoes.completo ? "" : '<button type="button" class="doc-mais" hidden>Ler relatório completo</button>') +
      '<footer class="doc-rodape">' +
      (tags ? '<ul class="etiquetas" aria-label="Etiquetas">' + tags + "</ul>" : '<p class="doc-sem-tag">Sem etiquetas</p>') +
      (opcoes.acoes ? '<div class="doc-acoes">' + acoesHTML() + "</div>" : "") +
      "</footer>" +
      (r.editadoEm ? '<p class="doc-editado">Corrigido em ' + dataCurta(iso(new Date(r.editadoEm))) + " às " + hora(r.editadoEm) + "</p>" : "") +
      "</article>"
    );
  }

  function acoesHTML() {
    return '<button type="button" class="doc-acao" data-acao="editar">Editar</button>' +
      '<button type="button" class="doc-acao doc-acao--perigo" data-acao="incinerar">Incinerar</button>';
  }

  /* ================= diário ================= */

  function renderDiario() {
    var lista = estado.registros;
    var alvo = $("lista-registros");

    if (estado.info.conectando && !lista.length) {
      alvo.innerHTML = '<div class="vazio"><p class="vazio-titulo">Abrindo o arquivo central…</p><p>Os registros aparecem aqui em instantes.</p></div>';
      return;
    }

    if (!lista.length) {
      alvo.innerHTML =
        '<div class="vazio"><p class="vazio-titulo">Nenhum registro no diário.</p>' +
        "<p>Datilografe o primeiro relatório na máquina acima. Ele aparece aqui, com as etiquetas embaixo, e vai direto para a gaveta.</p></div>";
      $("aviso-exemplos").hidden = true;
      return;
    }

    var html = [];
    var diaAtual = null;
    lista.forEach(function (r) {
      if (r.data !== diaAtual) {
        if (diaAtual !== null) html.push("</div></section>");
        diaAtual = r.data;
        html.push('<section class="dia"><h2 class="dia-titulo"><time datetime="' + r.data + '">' + dataLonga(r.data) + "</time></h2><div class=\"dia-docs\">");
      }
      html.push(docHTML(r, { acoes: true }));
    });
    html.push("</div></section>");
    alvo.innerHTML = html.join("");

    $("aviso-exemplos").hidden = !lista.some(function (r) { return r.exemplo; });

    // mostra "ler completo" só quando o texto foi cortado
    requestAnimationFrame(function () {
      alvo.querySelectorAll(".doc-texto--recorte").forEach(function (el) {
        var botao = el.parentNode.querySelector(".doc-mais");
        if (botao) botao.hidden = el.scrollHeight <= el.clientHeight + 4;
      });
    });

    if (estado.recemSalvo) {
      var novo = alvo.querySelector('[data-id="' + CSS.escape(estado.recemSalvo) + '"]');
      estado.recemSalvo = null;
      if (novo && novo.scrollIntoView) {
        var r = novo.getBoundingClientRect();
        if (r.top < 0 || r.top > global.innerHeight - 80) novo.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function aoClicarNaLista(ev) {
    var alvo = ev.target;
    var etiqueta = alvo.closest(".etiqueta");
    if (etiqueta) {
      abrirGaveta({ tag: etiqueta.dataset.tag, data: "" });
      return;
    }

    var doc = alvo.closest(".doc");
    if (!doc) return;
    var id = doc.dataset.id;

    if (alvo.closest(".doc-mais")) {
      var texto = doc.querySelector(".doc-texto");
      var aberto = texto.classList.toggle("doc-texto--aberto");
      alvo.closest(".doc-mais").textContent = aberto ? "Recolher relatório" : "Ler relatório completo";
      return;
    }

    var botao = alvo.closest("[data-acao]");
    if (!botao) return;
    var acoes = doc.querySelector(".doc-acoes");

    switch (botao.dataset.acao) {
      case "editar":
        editar(id);
        break;
      case "incinerar":
        acoes.innerHTML =
          '<span class="doc-confirma">Incinerar este registro?</span>' +
          '<button type="button" class="doc-acao doc-acao--perigo" data-acao="confirmar">Sim, incinerar</button>' +
          '<button type="button" class="doc-acao" data-acao="manter">Manter</button>';
        acoes.querySelector('[data-acao="manter"]').focus();
        break;
      case "manter":
        acoes.innerHTML = acoesHTML();
        acoes.querySelector('[data-acao="incinerar"]').focus();
        break;
      case "confirmar":
        doc.classList.add("doc--queimando");
        setTimeout(function () {
          if (estado.editandoId === id) cancelarEdicao();
          Armazem.excluir(id)
            .then(function () { avisar("Registro incinerado."); })
            .catch(function (err) {
              doc.classList.remove("doc--queimando");
              avisar(err.message);
            });
        }, 480);
        break;
    }
  }

  /* ================= máquina de escrever (formulário) ================= */

  function renderTagsComposer() {
    $("tags-escolhidas").innerHTML = estado.tags.map(function (t, i) {
      return '<li class="tag-chip">#' + esc(t) +
        '<button type="button" data-remover="' + i + '" aria-label="Remover etiqueta ' + esc(t) + '">×</button></li>';
    }).join("");
  }

  function adicionarTags(texto) {
    String(texto).split(",").forEach(function (parte) {
      var t = Armazem.normalizarTag(parte);
      if (t && estado.tags.indexOf(t) < 0 && estado.tags.length < 16) estado.tags.push(t);
    });
    renderTagsComposer();
  }

  function ajustarAltura(area) {
    area.style.height = "auto";
    area.style.height = Math.min(area.scrollHeight + 2, 520) + "px";
  }

  function limparFormulario() {
    $("reg-titulo").value = "";
    $("reg-texto").value = "";
    $("reg-data").value = hojeISO();
    $("reg-nivel").value = "confidencial";
    $("reg-tag").value = "";
    $("reg-erro").textContent = "";
    estado.tags = [];
    renderTagsComposer();
    ajustarAltura($("reg-texto"));
  }

  function pintarModoMaquina() {
    var editando = !!estado.editandoId;
    var r = editando && Armazem.buscar(estado.editandoId);
    $("maquina-titulo").textContent = editando ? "Editando " + (r ? r.protocolo : "registro") : "Novo registro";
    $("btn-arquivar").textContent = editando ? "Salvar alterações" : "Arquivar no diário";
    $("btn-cancelar-edicao").hidden = !editando;
    $("form-registro").classList.toggle("maquina--editando", editando);
    $("maquina-modo").textContent = estado.agente ? "Datilografando como agente " + estado.agente.codinome : "Datilografando";
  }

  function editar(id) {
    var r = Armazem.buscar(id);
    if (!r) return;
    estado.editandoId = id;
    $("reg-titulo").value = r.titulo;
    $("reg-texto").value = r.texto;
    $("reg-data").value = r.data;
    $("reg-nivel").value = r.nivel;
    $("reg-erro").textContent = "";
    estado.tags = r.tags.slice();
    renderTagsComposer();
    pintarModoMaquina();
    irPara("diario");
    requestAnimationFrame(function () {
      ajustarAltura($("reg-texto"));
      $("form-registro").scrollIntoView({ behavior: "smooth", block: "start" });
      $("reg-titulo").focus({ preventScroll: true });
    });
  }

  function cancelarEdicao() {
    estado.editandoId = null;
    limparFormulario();
    pintarModoMaquina();
  }

  function aoEnviarRegistro(ev) {
    ev.preventDefault();
    var erro = $("reg-erro");
    var pendente = $("reg-tag").value;
    if (pendente.trim()) {
      adicionarTags(pendente);
      $("reg-tag").value = "";
    }

    var titulo = $("reg-titulo").value.trim();
    var texto = $("reg-texto").value.trim();
    var data = $("reg-data").value || hojeISO();

    if (!titulo) {
      erro.textContent = "Dê um título ao registro.";
      $("reg-titulo").focus();
      return;
    }
    if (!texto) {
      erro.textContent = "Escreva o relatório antes de arquivar.";
      $("reg-texto").focus();
      return;
    }
    erro.textContent = "";

    var antigo = estado.editandoId ? Armazem.buscar(estado.editandoId) : null;
    var registro = antigo
      ? Object.assign({}, antigo, {
          titulo: titulo, texto: texto, data: data, nivel: $("reg-nivel").value,
          tags: estado.tags.slice(), editadoEm: Date.now(), exemplo: false
        })
      : {
          id: Armazem.novoId(), protocolo: protocolo(data), titulo: titulo, texto: texto, data: data,
          nivel: $("reg-nivel").value, tags: estado.tags.slice(),
          autor: estado.agente ? estado.agente.id : "", criadoEm: Date.now()
        };

    var botao = $("btn-arquivar");
    botao.disabled = true;
    estado.recemSalvo = registro.id;
    Armazem.salvar(registro)
      .then(function () {
        avisar(antigo ? "Alterações salvas." : "Registro arquivado no diário.");
        estado.editandoId = null;
        limparFormulario();
        pintarModoMaquina();
      })
      .catch(function (err) {
        estado.recemSalvo = null;
        erro.textContent = err.message;
      })
      .then(function () { botao.disabled = false; });
  }

  /* ================= painel ================= */

  function renderPainel() {
    var lista = estado.registros;
    var tags = contarTags(lista);
    var dias = contarDias(lista);

    $("n-registros").textContent = lista.length;
    $("n-etiquetas").textContent = tags.length;
    $("n-dias").textContent = Object.keys(dias).length;

    var modo = $("modo-armazem");
    if (estado.info.modo === "central") {
      modo.textContent = "Sincronizado com o arquivo central: os dois agentes veem os mesmos registros.";
    } else if (estado.info.conectando) {
      modo.textContent = "Conectando ao arquivo central…";
    } else {
      modo.textContent = "Guardado neste aparelho e neste navegador.";
    }
    // Exportar usa download de arquivo, que não funciona dentro de um Artifact do claude.ai.
    $("bloco-transmissao").hidden = estado.info.modo === "central" || estado.info.conectando || !!global.claude;

    $("nuvem-tags").innerHTML = tags.length
      ? tags.slice(0, 24).map(function (t) {
          return '<button type="button" class="etiqueta" data-tag="' + esc(t.tag) + '">#' + esc(t.tag) + ' <span class="etiqueta-n">' + t.n + "</span></button>";
        }).join("")
      : '<p class="dica">As etiquetas dos registros aparecem aqui.</p>';

    $("lista-tags").innerHTML = tags.map(function (t) { return '<option value="' + esc(t.tag) + '"></option>'; }).join("");

    renderCalendario(dias);

    var aviso = $("faixa-aviso");
    aviso.hidden = !estado.info.aviso;
    aviso.textContent = estado.info.aviso || "";
  }

  function renderCalendario(dias) {
    if (!estado.calendario) {
      var h = new Date();
      estado.calendario = { ano: h.getFullYear(), mes: h.getMonth() };
    }
    var ano = estado.calendario.ano;
    var mes = estado.calendario.mes;
    $("cal-mes").textContent = MESES_LONGOS[mes] + " " + ano;

    var primeiro = new Date(ano, mes, 1).getDay();
    var total = new Date(ano, mes + 1, 0).getDate();
    var hoje = hojeISO();
    var html = DIAS.map(function (d) { return '<span class="cal-semana" aria-hidden="true">' + d.charAt(0) + "</span>"; }).join("");
    for (var i = 0; i < primeiro; i++) html += '<span class="cal-vazio"></span>';
    for (var d = 1; d <= total; d++) {
      var chave = iso(new Date(ano, mes, d));
      var n = dias[chave] || 0;
      var cls = "cal-dia" + (chave === hoje ? " cal-dia--hoje" : "");
      if (n) {
        html += '<button type="button" class="' + cls + ' cal-dia--tem" data-data="' + chave + '" aria-label="' +
          dataMedia(chave) + ": " + plural(n, "registro", "registros") + '">' + d + "</button>";
      } else {
        html += '<span class="' + cls + '">' + d + "</span>";
      }
    }
    $("calendario").innerHTML = html;
  }

  function mudarMes(delta) {
    var c = estado.calendario;
    var d = new Date(c.ano, c.mes + delta, 1);
    estado.calendario = { ano: d.getFullYear(), mes: d.getMonth() };
    renderCalendario(contarDias(estado.registros));
  }

  function exportar() {
    var texto = Armazem.exportar();
    var blob = new Blob([texto], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "dossie-diario-secreto-" + hojeISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    avisar("Dossiê exportado.");
  }

  function importar(ev) {
    var arquivo = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!arquivo) return;
    arquivo.text()
      .then(Armazem.importar)
      .then(function (n) { avisar(plural(n, "registro importado", "registros importados") + "."); })
      .catch(function (err) { avisar(err.message); });
  }

  /* ================= gaveta de arquivos ================= */

  function filtrar() {
    var q = semAcento(Armazem.normalizarTag(estado.filtro.tag));
    var data = estado.filtro.data;
    return estado.registros.filter(function (r) {
      if (data && r.data !== data) return false;
      if (q && !r.tags.some(function (t) { return semAcento(t).indexOf(q) >= 0; })) return false;
      return true;
    });
  }

  function renderGaveta() {
    var lista = estado.registros;
    var q = semAcento(Armazem.normalizarTag(estado.filtro.tag));
    var data = estado.filtro.data;
    var tags = contarTags(lista);
    var dias = contarDias(lista);

    $("indice-tags").innerHTML = tags.length
      ? tags.map(function (t) {
          var ativa = q && semAcento(t.tag) === q;
          return '<button type="button" class="aba-pasta' + (ativa ? " aba-pasta--ativa" : "") + '" data-tag="' + esc(t.tag) + '" aria-pressed="' + ativa + '">#' +
            esc(t.tag) + ' <span class="aba-pasta-n">' + t.n + "</span></button>";
        }).join("")
      : '<p class="dica">Nenhuma etiqueta ainda.</p>';

    var chaves = Object.keys(dias).sort().reverse();
    $("indice-dias").innerHTML = chaves.length
      ? chaves.map(function (k) {
          var ativa = k === data;
          return '<button type="button" class="aba-pasta aba-pasta--dia' + (ativa ? " aba-pasta--ativa" : "") + '" data-data="' + k + '" aria-pressed="' + ativa + '">' +
            dataCurta(k) + ' <span class="aba-pasta-n">' + dias[k] + "</span></button>";
        }).join("")
      : '<p class="dica">Nenhum dia registrado ainda.</p>';

    var achados = filtrar();
    var exata = q && tags.some(function (t) { return semAcento(t.tag) === q; });
    var partes = [];
    if (q) partes.push(exata ? "com a etiqueta #" + Armazem.normalizarTag(estado.filtro.tag) : "com etiqueta contendo “" + estado.filtro.tag.trim() + "”");
    if (data) partes.push("de " + dataMedia(data));
    $("resultado-resumo").textContent = partes.length
      ? plural(achados.length, "arquivo", "arquivos") + " " + partes.join(" e ") + "."
      : "Todos os arquivos da gaveta: " + achados.length + ".";

    $("gaveta").classList.toggle("gaveta--filtrando", !!(q || data));

    var pastas = $("pastas");
    if (!achados.length) {
      pastas.innerHTML = lista.length
        ? '<div class="vazio vazio--gaveta"><p class="vazio-titulo">Nada nesta gaveta.</p><p>Nenhum arquivo bate com essa busca. Tente outra etiqueta ou limpe a data.</p></div>'
        : '<div class="vazio vazio--gaveta"><p class="vazio-titulo">A gaveta está vazia.</p><p>Todo registro do diário é arquivado aqui, separado por etiqueta e por dia.</p></div>';
      return;
    }

    var html = [];
    var dia = null;
    var i = 0;
    achados.forEach(function (r) {
      if (r.data !== dia) {
        if (dia !== null) html.push("</div></section>");
        dia = r.data;
        var n = achados.filter(function (x) { return x.data === dia; }).length;
        html.push('<section class="divisoria"><h3 class="divisoria-titulo"><span>' + dataLonga(dia) + '</span><span class="divisoria-n">' +
          plural(n, "arquivo", "arquivos") + '</span></h3><div class="divisoria-pastas">');
      }
      var tagsHtml = r.tags.map(function (t) {
        var marca = q && semAcento(t).indexOf(q) >= 0;
        return (marca ? "<mark>#" : "<span>#") + esc(t) + (marca ? "</mark>" : "</span>");
      }).join(" ");
      html.push(
        '<button type="button" class="pasta pasta--' + r.nivel + '" data-id="' + esc(r.id) + '" style="--i:' + Math.min(i++, 12) + '">' +
        '<span class="pasta-aba">' + esc(r.protocolo) + "</span>" +
        '<span class="pasta-nivel">' + NIVEL[r.nivel] + "</span>" +
        '<span class="pasta-titulo">' + esc(r.titulo) + "</span>" +
        '<span class="pasta-meta">' + dataCurta(r.data) + " · " + hora(r.criadoEm) + " · Agente " + esc(nomeAgente(r.autor)) + "</span>" +
        '<span class="pasta-tags">' + (tagsHtml || "<span>sem etiquetas</span>") + "</span>" +
        "</button>"
      );
    });
    html.push("</div></section>");
    pastas.innerHTML = html.join("");
  }

  function animarGaveta() {
    var g = $("gaveta");
    g.classList.remove("gaveta--puxando");
    void g.offsetWidth;
    g.classList.add("gaveta--puxando");
  }

  function abrirGaveta(filtro) {
    estado.filtro = { tag: filtro.tag || "", data: filtro.data || "" };
    $("busca-tag").value = estado.filtro.tag;
    $("busca-data").value = estado.filtro.data;
    renderGaveta();
    animarGaveta();
    irPara("arquivo");
    global.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ================= dossiê ================= */

  var dossieId = null;

  function abrirDossie(id) {
    var r = Armazem.buscar(id);
    if (!r) return;
    dossieId = id;
    $("dossie-aba").textContent = r.protocolo;
    $("dossie-corpo").innerHTML = docHTML(r, { completo: true });
    var dlg = $("dossie");
    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
    $("dossie-fechar").focus();
  }

  function fecharDossie() {
    var dlg = $("dossie");
    if (typeof dlg.close === "function" && dlg.open) dlg.close();
    else dlg.removeAttribute("open");
    dossieId = null;
  }

  /* ================= navegação ================= */

  function abaDoHash() {
    return location.hash === "#arquivo" ? "arquivo" : "diario";
  }

  function mostrarAba(nome) {
    estado.aba = nome;
    $("vista-diario").hidden = nome !== "diario";
    $("vista-arquivo").hidden = nome !== "arquivo";
    document.querySelectorAll(".aba").forEach(function (a) {
      if (a.dataset.aba === nome) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (nome === "arquivo") renderGaveta();
  }

  function irPara(nome) {
    if (abaDoHash() !== nome) {
      try {
        history.replaceState(null, "", "#" + nome);
      } catch (e) {
        location.hash = nome;
      }
    }
    mostrarAba(nome);
  }

  function relogio() {
    var d = new Date();
    var el = $("relogio");
    el.dateTime = d.toISOString();
    el.textContent = DIAS[d.getDay()].toUpperCase() + " " + dataCurta(iso(d)).slice(0, 6) + " · " + hora(d.getTime());
  }

  /* ================= entrada e saída ================= */

  function entrar(agente, opcoes) {
    estado.agente = agente;
    $("agente-atual").textContent = "Agente " + agente.codinome;
    pintarModoMaquina();
    var base = $("esconderijo");
    base.hidden = false;
    mostrarAba(abaDoHash());
    if (opcoes && opcoes.animado) {
      base.classList.remove("esconderijo--chegando");
      void base.offsetWidth;
      base.classList.add("esconderijo--chegando");
      global.scrollTo(0, 0);
    }
    relogio();
  }

  function sair() {
    fecharDossie();
    if (estado.editandoId) cancelarEdicao();
    $("esconderijo").hidden = true;
    estado.agente = null;
    Cofre.trancar();
  }

  /* ================= ligações ================= */

  function ligar() {
    $("lista-registros").addEventListener("click", aoClicarNaLista);
    $("form-registro").addEventListener("submit", aoEnviarRegistro);
    $("btn-cancelar-edicao").addEventListener("click", cancelarEdicao);
    $("reg-texto").addEventListener("input", function (e) { ajustarAltura(e.target); });

    var campoTag = $("reg-tag");
    campoTag.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        adicionarTags(campoTag.value);
        campoTag.value = "";
      } else if (e.key === "Backspace" && !campoTag.value && estado.tags.length) {
        estado.tags.pop();
        renderTagsComposer();
      }
    });
    campoTag.addEventListener("blur", function () {
      if (campoTag.value.trim()) {
        adicionarTags(campoTag.value);
        campoTag.value = "";
      }
    });
    $("tags-entrada").addEventListener("click", function (e) {
      var rem = e.target.closest("[data-remover]");
      if (rem) {
        estado.tags.splice(Number(rem.dataset.remover), 1);
        renderTagsComposer();
        campoTag.focus();
      } else if (e.target === e.currentTarget || e.target.id === "tags-escolhidas") {
        campoTag.focus();
      }
    });

    $("btn-remover-exemplos").addEventListener("click", function () {
      Armazem.excluirExemplos().then(function () { avisar("Exemplos incinerados."); });
    });

    $("nuvem-tags").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tag]");
      if (b) abrirGaveta({ tag: b.dataset.tag });
    });
    $("calendario").addEventListener("click", function (e) {
      var b = e.target.closest("[data-data]");
      if (b) abrirGaveta({ data: b.dataset.data });
    });
    $("cal-ant").addEventListener("click", function () { mudarMes(-1); });
    $("cal-prox").addEventListener("click", function () { mudarMes(1); });
    $("btn-exportar").addEventListener("click", exportar);
    $("arquivo-importar").addEventListener("change", importar);

    // gaveta
    var temporizador = null;
    $("busca-tag").addEventListener("input", function (e) {
      estado.filtro.tag = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(function () { renderGaveta(); animarGaveta(); }, 160);
    });
    $("busca-data").addEventListener("change", function (e) {
      estado.filtro.data = e.target.value;
      renderGaveta();
      animarGaveta();
    });
    $("form-busca").addEventListener("submit", function (e) { e.preventDefault(); });
    $("btn-limpar-busca").addEventListener("click", function () {
      abrirGaveta({ tag: "", data: "" });
      $("busca-tag").focus();
    });
    $("indice-tags").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tag]");
      if (!b) return;
      var mesma = semAcento(estado.filtro.tag) === semAcento(b.dataset.tag);
      abrirGaveta({ tag: mesma ? "" : b.dataset.tag, data: estado.filtro.data });
    });
    $("indice-dias").addEventListener("click", function (e) {
      var b = e.target.closest("[data-data]");
      if (!b) return;
      abrirGaveta({ tag: estado.filtro.tag, data: estado.filtro.data === b.dataset.data ? "" : b.dataset.data });
    });
    $("pastas").addEventListener("click", function (e) {
      var p = e.target.closest(".pasta");
      if (p) abrirDossie(p.dataset.id);
    });

    // dossiê
    var dlg = $("dossie");
    $("dossie-fechar").addEventListener("click", fecharDossie);
    $("dossie-editar").addEventListener("click", function () {
      var id = dossieId;
      fecharDossie();
      if (id) editar(id);
    });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) {
        fecharDossie();
        return;
      }
      var et = e.target.closest(".etiqueta");
      if (et) {
        fecharDossie();
        abrirGaveta({ tag: et.dataset.tag });
      }
    });
    dlg.addEventListener("close", function () { dossieId = null; });

    // navegação
    global.addEventListener("hashchange", function () {
      if (estado.agente) mostrarAba(abaDoHash());
    });
    $("btn-trancar").addEventListener("click", sair);
    setInterval(relogio, 15000);
  }

  /* ================= início ================= */

  function iniciar() {
    limparFormulario();
    ligar();

    Armazem.ouvir(function (lista, info) {
      estado.registros = lista;
      estado.info = info;
      renderDiario();
      renderPainel();
      if (estado.aba === "arquivo") renderGaveta();
      if (dossieId && !Armazem.buscar(dossieId)) fecharDossie();
      if (estado.editandoId && !Armazem.buscar(estado.editandoId)) cancelarEdicao();
    });
    Armazem.iniciar(exemplos);

    Cofre.iniciar({ aoEntrar: entrar });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
