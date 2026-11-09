"""A janela do app."""

from __future__ import annotations

import queue
import re
import threading
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont
from tkinter import messagebox, ttk
from tkinter.scrolledtext import ScrolledText

from . import VERSAO, sistema
from . import otimizacoes as otm
from . import programas as prg
from .execucao import Resumo, executar, montar_etapas
from .executor import EH_WINDOWS, Executor

CINZA = "#6b6b6b"
VERDE = "#1a7f37"
VERMELHO = "#c62828"
AZUL = "#1f5fbf"

CORES_FONTE = {"arquivo": VERDE, "url": AZUL, "winget": AZUL}


class ListaRolavel(ttk.Frame):
    """Um quadro com barra de rolagem, para quando a lista crescer."""

    def __init__(self, pai: tk.Misc, fundo: str):
        super().__init__(pai)
        self.canvas = tk.Canvas(self, highlightthickness=0, borderwidth=0, background=fundo)
        barra = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.conteudo = ttk.Frame(self.canvas)
        janela = self.canvas.create_window((0, 0), window=self.conteudo, anchor="nw")
        self.conteudo.bind(
            "<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfigure(janela, width=e.width))
        self.canvas.configure(yscrollcommand=barra.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        barra.pack(side="right", fill="y")
        self.descricoes: list[ttk.Label] = []
        self.conteudo.bind("<Configure>", self._ajustar_quebra, add="+")

    def _ajustar_quebra(self, evento: tk.Event) -> None:
        for rotulo in self.descricoes:
            rotulo.configure(wraplength=max(evento.width - 40, 150))

    def rolar(self, passos: int) -> None:
        if self.conteudo.winfo_height() > self.canvas.winfo_height():
            self.canvas.yview_scroll(passos, "units")

    def adicionar(
        self,
        nome: str,
        variavel: tk.BooleanVar,
        descricao: str = "",
        etiqueta: str = "",
        cor: str = CINZA,
        habilitado: bool = True,
    ) -> ttk.Checkbutton:
        linha = ttk.Frame(self.conteudo)
        linha.pack(fill="x", pady=(8, 0), padx=(4, 8))
        caixa = ttk.Checkbutton(linha, text=nome, variable=variavel)
        caixa.pack(side="left")
        if not habilitado:
            caixa.state(["disabled"])
        if etiqueta:
            ttk.Label(linha, text=etiqueta, foreground=cor).pack(side="right")
        if descricao:
            rotulo = ttk.Label(self.conteudo, text=descricao, foreground=CINZA, wraplength=300)
            rotulo.pack(fill="x", padx=(28, 8))
            self.descricoes.append(rotulo)
        return caixa


class App:
    def __init__(
        self,
        raiz: tk.Tk,
        programas: list[prg.Programa],
        pasta_base: Path,
        caminho_config: Path,
        simular: bool = False,
        so_teste: bool = False,
        automatico: bool = False,
        avisos: list[str] | None = None,
    ):
        self.raiz = raiz
        self.pasta_base = pasta_base
        self.automatico = automatico
        self.so_teste = so_teste
        self.codigo_saida = 0
        self.rodando = False
        self.fila: queue.Queue = queue.Queue()
        self.caixas: list[ttk.Checkbutton] = []

        raiz.title(f"Pós-formatação {VERSAO}")
        raiz.geometry("940x680")
        raiz.minsize(760, 560)
        self._estilo()

        raiz.columnconfigure(0, weight=1)
        raiz.rowconfigure(1, weight=3)
        raiz.rowconfigure(3, weight=2)

        # Cabeçalho
        topo = ttk.Frame(raiz, padding=(16, 14, 16, 4))
        topo.grid(row=0, column=0, sticky="ew")
        ttk.Label(topo, text="Pós-formatação", style="Titulo.TLabel").pack(anchor="w")
        ttk.Label(
            topo, text="Marque o que você quer e clique em Começar. Dá pra testar antes no modo teste."
        ).pack(anchor="w")
        ttk.Label(topo, text=f"Lista de programas: {caminho_config}", foreground=CINZA).pack(anchor="w")

        # As duas listas
        meio = ttk.Frame(raiz, padding=(16, 8))
        meio.grid(row=1, column=0, sticky="nsew")
        meio.columnconfigure(0, weight=1, uniform="colunas")
        meio.columnconfigure(1, weight=1, uniform="colunas")
        meio.rowconfigure(0, weight=1)
        fundo = ttk.Style().lookup("TFrame", "background")

        quadro_prog = ttk.LabelFrame(meio, text=" Programas ", padding=(6, 0, 0, 6))
        quadro_prog.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        self.lista_prog = ListaRolavel(quadro_prog, fundo)
        self.lista_prog.pack(fill="both", expand=True)

        quadro_otim = ttk.LabelFrame(meio, text=" Otimizações ", padding=(6, 0, 0, 6))
        quadro_otim.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        self.lista_otim = ListaRolavel(quadro_otim, fundo)
        self.lista_otim.pack(fill="both", expand=True)

        self.vars_prog = [self._linha_programa(p) for p in programas]
        if not programas:
            ttk.Label(self.lista_prog.conteudo, text="Nenhum programa no apps.json.", foreground=CINZA).pack(
                anchor="w", pady=8
            )
        self.vars_otim = [self._linha_otimizacao(o) for o in otm.OTIMIZACOES]

        # Botão, modo teste e progresso
        controles = ttk.Frame(raiz, padding=(16, 4))
        controles.grid(row=2, column=0, sticky="ew")
        controles.columnconfigure(1, weight=1)
        self.var_teste = tk.BooleanVar(value=simular)
        self.caixa_teste = ttk.Checkbutton(
            controles, text="Modo teste (só mostra o que faria, não muda nada)", variable=self.var_teste
        )
        self.caixa_teste.grid(row=0, column=0, columnspan=2, sticky="w")
        if so_teste:
            self.caixa_teste.state(["disabled"])
        self.botao = ttk.Button(controles, text="Começar", style="Grande.TButton", command=self.comecar)
        self.botao.grid(row=1, column=0, rowspan=2, sticky="w", pady=(8, 0), padx=(0, 14))
        self.barra = ttk.Progressbar(controles, mode="determinate")
        self.barra.grid(row=1, column=1, sticky="ew", pady=(10, 0))
        self.status = ttk.Label(controles, text="Pronto para começar.", foreground=CINZA)
        self.status.grid(row=2, column=1, sticky="w")

        # Registro do que está acontecendo
        baixo = ttk.Frame(raiz, padding=(16, 8, 16, 14))
        baixo.grid(row=3, column=0, sticky="nsew")
        self.log_texto = ScrolledText(baixo, height=8, state="disabled", wrap="word", relief="solid", borderwidth=1)
        self.log_texto.pack(fill="both", expand=True)
        self.log_texto.tag_configure("ok", foreground=VERDE)
        self.log_texto.tag_configure("erro", foreground=VERMELHO)
        self.log_texto.tag_configure("titulo", font=self.fonte_negrito)

        raiz.bind_all("<MouseWheel>", self._roda_do_mouse)
        raiz.bind_all("<Button-4>", lambda e: self._rolar_em(e, -1))  # Linux
        raiz.bind_all("<Button-5>", lambda e: self._rolar_em(e, 1))
        raiz.protocol("WM_DELETE_WINDOW", self._fechar)
        raiz.after(100, self._ler_fila)

        for aviso in avisos or []:
            self._log(aviso, "erro")

    # ---------- montagem da tela ----------

    def _estilo(self) -> None:
        estilo = ttk.Style()
        if not EH_WINDOWS:
            estilo.theme_use("clam")
        padrao = tkfont.nametofont("TkDefaultFont")
        padrao.configure(size=10)
        tkfont.nametofont("TkTextFont").configure(size=10)
        familia = padrao.actual("family")
        self.fonte_negrito = tkfont.Font(family=familia, size=10, weight="bold")
        estilo.configure("Titulo.TLabel", font=(familia, 16, "bold"))
        estilo.configure("Grande.TButton", font=(familia, 11, "bold"), padding=(22, 8))

    def _linha_programa(self, programa: prg.Programa):
        fonte = prg.fonte_preferida(programa, self.pasta_base)
        variavel = tk.BooleanVar(value=programa.marcado and fonte is not None)
        descricao = programa.descricao
        if fonte is None:
            faltando = [f.valor for f in programa.fontes if f.tipo == "arquivo"]
            descricao = (descricao + "\n" if descricao else "") + f"Coloque o instalador em: {faltando[0]}"
            etiqueta, cor = "falta o arquivo", VERMELHO
        else:
            etiqueta, cor = prg.ROTULOS[fonte.tipo], CORES_FONTE[fonte.tipo]
        caixa = self.lista_prog.adicionar(
            programa.nome, variavel, descricao, etiqueta, cor, habilitado=fonte is not None
        )
        if fonte is not None:
            self.caixas.append(caixa)
        return programa, variavel

    def _linha_otimizacao(self, otimizacao: otm.Otimizacao):
        variavel = tk.BooleanVar(value=otimizacao.marcado)
        self.caixas.append(self.lista_otim.adicionar(otimizacao.nome, variavel, otimizacao.descricao))
        return otimizacao, variavel

    # ---------- ações ----------

    def comecar(self) -> None:
        programas = [p for p, v in self.vars_prog if v.get()]
        otimizacoes = [o for o, v in self.vars_otim if v.get()]
        simular = self.var_teste.get()
        if not programas and not otimizacoes:
            messagebox.showinfo("Nada marcado", "Marque pelo menos um programa ou uma otimização.")
            return
        if not simular and not self.automatico:
            pergunta = (
                f"Vou instalar {len(programas)} programa(s) e aplicar {len(otimizacoes)} otimização(ões).\n\n"
                "Instaladores sem modo silencioso vão abrir a janela deles: é só clicar em Avançar.\n\n"
                "Posso começar?"
            )
            if not messagebox.askyesno("Começar?", pergunta):
                return

        self._travar(True)
        self.log_texto.configure(state="normal")
        self.log_texto.delete("1.0", "end")
        self.log_texto.configure(state="disabled")
        if simular:
            self._log("MODO TESTE: nada vai ser alterado no computador.", "titulo")
        threading.Thread(target=self._trabalhar, args=(programas, otimizacoes, simular), daemon=True).start()

    def _trabalhar(self, programas, otimizacoes, simular: bool) -> None:
        """Roda numa thread separada para a janela não travar."""

        def log(texto: str) -> None:
            self.fila.put(("log", texto))

        executor = Executor(log, simular=simular)
        instalador = prg.Instalador(self.pasta_base, executor, log)
        etapas = montar_etapas(programas, otimizacoes, instalador, executor)
        resumo = executar(etapas, log, lambda feito, total, titulo: self.fila.put(("progresso", feito, total, titulo)))
        self.fila.put(("fim", resumo, simular))

    def _ler_fila(self) -> None:
        try:
            while True:
                mensagem = self.fila.get_nowait()
                if mensagem[0] == "log":
                    self._log(mensagem[1])
                elif mensagem[0] == "progresso":
                    _, feito, total, titulo = mensagem
                    self.barra.configure(maximum=max(total, 1), value=feito)
                    self.status.configure(text=f"{feito}/{total}  {titulo}", foreground=CINZA)
                elif mensagem[0] == "fim":
                    self._terminou(mensagem[1], mensagem[2])
        except queue.Empty:
            pass
        self.raiz.after(100, self._ler_fila)

    def _terminou(self, resumo: Resumo, simular: bool) -> None:
        self._travar(False)
        if resumo.falhas:
            texto = f"Terminou com {len(resumo.falhas)} problema(s): " + ", ".join(resumo.falhas)
            self.status.configure(text=texto, foreground=VERMELHO)
        else:
            texto = f"Tudo certo! {resumo.certas} de {resumo.total} etapas concluídas."
            self.status.configure(text=texto, foreground=VERDE)

        if self.automatico:
            self.codigo_saida = 1 if resumo.falhas else 0
            self.raiz.after(500, self.raiz.destroy)
        elif simular:
            messagebox.showinfo("Teste concluído", texto + "\n\nNada foi alterado. Desmarque o modo teste para valer.")
        elif messagebox.askyesno("Pronto", texto + "\n\nReiniciar o PC agora para aplicar tudo?"):
            sistema.reiniciar_pc()

    def _travar(self, travar: bool) -> None:
        self.rodando = travar
        estado = ["disabled"] if travar else ["!disabled"]
        for caixa in self.caixas:
            caixa.state(estado)
        self.botao.state(estado)
        self.caixa_teste.state(["disabled"] if travar or self.so_teste else ["!disabled"])

    def _log(self, texto: str, tag: str | None = None) -> None:
        if tag is None:
            limpo = texto.strip()
            if limpo == "OK":
                tag = "ok"
            elif limpo == "FALHOU" or limpo.startswith("Erro"):
                tag = "erro"
            elif re.match(r"\[\d+/\d+\]", limpo):
                tag = "titulo"
        self.log_texto.configure(state="normal")
        self.log_texto.insert("end", texto + "\n", tag or ())
        self.log_texto.see("end")
        self.log_texto.configure(state="disabled")

    def _roda_do_mouse(self, evento: tk.Event) -> None:
        self._rolar_em(evento, int(-evento.delta / 120) or (-1 if evento.delta > 0 else 1))

    def _rolar_em(self, evento: tk.Event, passos: int) -> None:
        """Rola a lista que está embaixo do mouse."""
        widget = self.raiz.winfo_containing(evento.x_root, evento.y_root)
        while widget is not None:
            if isinstance(widget, ListaRolavel):
                widget.rolar(passos)
                return
            widget = widget.master

    def _fechar(self) -> None:
        if self.rodando and not self.automatico:
            if not messagebox.askyesno("Ainda rodando", "Ainda tem coisa rodando. Fechar mesmo assim?"):
                return
        self.raiz.destroy()


def main(args: list[str]) -> int:
    automatico = "--autoteste" in args
    simular = automatico or "--simular" in args
    so_teste = False
    avisos = []

    if not EH_WINDOWS:
        simular = so_teste = True
        avisos.append("Fora do Windows só dá pra usar o modo teste.")
    elif not sistema.eh_admin():
        if not simular and sistema.reabrir_como_admin(args):
            return 0  # abriu de novo como administrador; esta janela sai
        simular = so_teste = True
        avisos.append("Sem permissão de administrador: só dá pra usar o modo teste.")

    sistema.nitidez_em_tela_grande()
    base = sistema.pasta_base()
    config = sistema.caminho_config(base)
    try:
        programas = prg.carregar(config)
        erro_config = None
    except prg.ConfigInvalida as erro:
        programas, erro_config = [], str(erro)
        avisos.append(f"Problema no apps.json: {erro_config}")

    raiz = tk.Tk()
    app = App(raiz, programas, base, config, simular, so_teste, automatico, avisos)
    if erro_config and not automatico:
        raiz.after(200, lambda: messagebox.showerror("Problema no apps.json", erro_config))
    if automatico:
        if erro_config:
            app.codigo_saida = 2
            raiz.after(100, raiz.destroy)
        else:
            raiz.after(300, app.comecar)

            def tempo_esgotado() -> None:
                app.codigo_saida = 3
                raiz.destroy()

            raiz.after(60_000, tempo_esgotado)
    raiz.mainloop()
    return app.codigo_saida
