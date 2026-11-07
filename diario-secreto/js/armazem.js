/*
 * Armazém: onde os registros do diário ficam guardados.
 *
 * - Modo "local": salva no navegador (localStorage). Funciona em qualquer
 *   hospedagem estática (GitHub Pages, Vercel, abrir o arquivo direto).
 *   Cada aparelho tem o seu próprio arquivo; use Exportar/Importar dossiê
 *   para levar os registros de um aparelho para outro.
 * - Modo "central": quando a página roda como Artifact do claude.ai com a
 *   capacidade `db`, os registros ficam num banco compartilhado e aparecem
 *   ao vivo para todo mundo que tem acesso à página.
 */
(function (global) {
  "use strict";

  var CHAVE = "diario-secreto:registros:v1";
  var COLECAO = "registros";
  var NIVEIS = ["confidencial", "secreto", "ultrassecreto"];

  var ouvintes = [];
  var registros = [];
  var modo = "local";
  var estado = { conectando: false, aviso: "" };
  var colecao = null;
  var fabricaDeExemplos = null;

  /* ---------- utilidades ---------- */

  function lerLocal() {
    try {
      var texto = global.localStorage.getItem(CHAVE);
      return texto ? JSON.parse(texto) : null;
    } catch (e) {
      return null;
    }
  }

  function gravarLocal() {
    try {
      global.localStorage.setItem(CHAVE, JSON.stringify(registros));
      return true;
    } catch (e) {
      return false;
    }
  }

  function normalizarTag(tag) {
    return String(tag || "")
      .trim()
      .replace(/^#+/, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
  }

  function limpar(r) {
    if (!r || typeof r !== "object") return null;
    if (typeof r.id !== "string" || !r.id) return null;
    if (typeof r.titulo !== "string") return null;
    var tags = Array.isArray(r.tags) ? r.tags.map(normalizarTag).filter(Boolean) : [];
    var vistos = {};
    tags = tags.filter(function (t) {
      if (vistos[t]) return false;
      vistos[t] = true;
      return true;
    });
    return {
      id: r.id,
      protocolo: typeof r.protocolo === "string" ? r.protocolo : "DS-" + r.id.slice(-6).toUpperCase(),
      titulo: r.titulo.slice(0, 160),
      texto: typeof r.texto === "string" ? r.texto.slice(0, 20000) : "",
      data: /^\d{4}-\d{2}-\d{2}$/.test(r.data) ? r.data : new Date(r.criadoEm || Date.now()).toISOString().slice(0, 10),
      nivel: NIVEIS.indexOf(r.nivel) >= 0 ? r.nivel : "confidencial",
      tags: tags.slice(0, 16),
      autor: typeof r.autor === "string" ? r.autor : "",
      criadoEm: typeof r.criadoEm === "number" ? r.criadoEm : Date.now(),
      editadoEm: typeof r.editadoEm === "number" ? r.editadoEm : null,
      exemplo: r.exemplo === true
    };
  }

  function ordenados() {
    return registros.slice().sort(function (a, b) {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return b.criadoEm - a.criadoEm;
    });
  }

  function info() {
    return { modo: modo, conectando: estado.conectando, aviso: estado.aviso };
  }

  function emitir() {
    var lista = ordenados();
    var i = info();
    ouvintes.slice().forEach(function (fn) { fn(lista, i); });
  }

  function erroLegivel(err) {
    var code = err && err.code;
    if (code === "quota_exceeded") return "O arquivo central está cheio. Incinere registros antigos para abrir espaço.";
    if (code === "invalid_argument") return "Seu acesso a esta página é só de leitura. Peça ao dono acesso de colaborador.";
    if (code === "revoked" || code === "not_granted") return "O acesso ao arquivo central foi retirado.";
    return "O arquivo central não respondeu. Tente de novo em instantes.";
  }

  function comRetentativa(fn) {
    return fn().catch(function (err) {
      if (err && err.code === "unavailable") {
        return new Promise(function (ok) { setTimeout(ok, 400 + Math.random() * 600); }).then(fn);
      }
      throw err;
    });
  }

  /* ---------- modo local ---------- */

  function iniciarLocal() {
    modo = "local";
    estado.conectando = false;
    var salvos = lerLocal();
    if (salvos === null) {
      registros = (fabricaDeExemplos ? fabricaDeExemplos() : []).map(limpar).filter(Boolean);
      gravarLocal();
    } else {
      registros = (Array.isArray(salvos) ? salvos : []).map(limpar).filter(Boolean);
    }
    emitir();
  }

  global.addEventListener("storage", function (e) {
    if (modo !== "local" || e.key !== CHAVE) return;
    var salvos = lerLocal();
    registros = (Array.isArray(salvos) ? salvos : []).map(limpar).filter(Boolean);
    emitir();
  });

  /* ---------- modo central (Artifact com db) ---------- */

  function conectarCentral() {
    var claude = global.claude;
    if (!claude || typeof claude.use !== "function") {
      iniciarLocal();
      return;
    }

    estado.conectando = true;
    emitir();

    Promise.resolve()
      .then(function () { return claude.use("db"); })
      .catch(function () { return null; })
      .then(function (db) {
        if (!db) {
          iniciarLocal();
          return;
        }
        modo = "central";
        registros = [];
        colecao = db.collection(COLECAO);

        var timer = setTimeout(function () {
          estado.aviso = "O arquivo central ainda não respondeu. Os registros podem demorar a aparecer.";
          estado.conectando = false;
          emitir();
        }, 10000);

        colecao.onSnapshot(
          function (snap) {
            if (!snap.metadata.fromCache) {
              clearTimeout(timer);
              estado.aviso = "";
            }
            estado.conectando = false;
            registros = snap.docs
              .filter(function (d) { return d.exists; })
              .map(function (d) {
                var corpo = Object.assign({}, d.data());
                corpo.id = d.id;
                return limpar(corpo);
              })
              .filter(Boolean);
            emitir();
          },
          function (err) {
            clearTimeout(timer);
            estado.conectando = false;
            estado.aviso = err && err.code === "revoked" ? "" : erroLegivel(err);
            emitir();
          }
        );
      });
  }

  /* ---------- API pública ---------- */

  var Armazem = {
    NIVEIS: NIVEIS,
    normalizarTag: normalizarTag,

    get modo() {
      return modo;
    },

    iniciar: function (exemplos) {
      fabricaDeExemplos = exemplos || null;
      conectarCentral();
    },

    ouvir: function (fn) {
      ouvintes.push(fn);
      fn(ordenados(), info());
      return function () {
        ouvintes = ouvintes.filter(function (f) { return f !== fn; });
      };
    },

    todos: function () {
      return ordenados();
    },

    buscar: function (id) {
      for (var i = 0; i < registros.length; i++) if (registros[i].id === id) return registros[i];
      return null;
    },

    novoId: function () {
      return "r-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    },

    salvar: function (registro) {
      var r = limpar(registro);
      if (!r) return Promise.reject(new Error("Registro inválido."));

      if (modo === "central" && colecao) {
        var corpo = Object.assign({}, r);
        delete corpo.id;
        return comRetentativa(function () { return colecao.doc(r.id).set(corpo); })
          .then(function () { return r; })
          .catch(function (err) { throw new Error(erroLegivel(err)); });
      }

      var achou = false;
      registros = registros.map(function (x) {
        if (x.id === r.id) {
          achou = true;
          return r;
        }
        return x;
      });
      if (!achou) registros.push(r);
      if (!gravarLocal()) {
        return Promise.reject(new Error("O navegador recusou guardar o registro (memória cheia ou modo privado)."));
      }
      emitir();
      return Promise.resolve(r);
    },

    excluir: function (id) {
      if (modo === "central" && colecao) {
        return comRetentativa(function () { return colecao.doc(id).delete(); })
          .catch(function (err) { throw new Error(erroLegivel(err)); });
      }
      registros = registros.filter(function (x) { return x.id !== id; });
      gravarLocal();
      emitir();
      return Promise.resolve();
    },

    excluirExemplos: function () {
      var ids = registros.filter(function (r) { return r.exemplo; }).map(function (r) { return r.id; });
      return ids.reduce(function (p, id) {
        return p.then(function () { return Armazem.excluir(id); });
      }, Promise.resolve());
    },

    exportar: function () {
      return JSON.stringify(
        { formato: "diario-secreto", versao: 1, exportadoEm: new Date().toISOString(), registros: ordenados() },
        null,
        2
      );
    },

    importar: function (texto) {
      var dados;
      try {
        dados = JSON.parse(texto);
      } catch (e) {
        return Promise.reject(new Error("Este arquivo não é um dossiê válido (JSON ilegível)."));
      }
      var lista = Array.isArray(dados) ? dados : dados && dados.registros;
      if (!Array.isArray(lista)) return Promise.reject(new Error("Este arquivo não contém registros do diário."));
      var limpos = lista.map(limpar).filter(Boolean);
      return limpos.reduce(function (p, r) {
        return p.then(function () { return Armazem.salvar(r); });
      }, Promise.resolve()).then(function () { return limpos.length; });
    }
  };

  global.Armazem = Armazem;
})(window);
