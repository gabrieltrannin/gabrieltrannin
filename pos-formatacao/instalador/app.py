"""A janela do app, no visual "vidro noturno".

Tudo é desenhado num Canvas: o fundo (céu noturno com cartões de vidro fosco)
é uma imagem gerada em tema.py, e os textos, caixas de marcar e botões ficam
por cima dela. Assim nenhum pedaço aparece com fundo sólido quebrando o vidro.
"""

from __future__ import annotations

import queue
import re
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox
from typing import Callable

from PIL import ImageTk

from . import VERSAO, sistema, tema
from . import otimizacoes as otm
from . import programas as prg
from .execucao import Resumo, executar, montar_etapas
from .executor import EH_WINDOWS, Executor

# Tamanhos em pixels "normais"; o tema aumenta tudo se o Windows estiver com zoom.
LARGURA, ALTURA = 960, 660
CARTAO_PROG = (24, 100, 474, 420)
CARTAO_OTIM = (486, 100, 936, 420)
CARTAO_CONTROLES = (24, 432, 936, 508)
CARTAO_LOG = (24, 520, 936, 636)
RAIO = 18

CORES_FONTE = {"arquivo": tema.VERDE, "url": tema.AZUL, "winget": tema.CIANO}


def _cursor_de_mao(canvas: tk.Canvas, tag: str, quando: Callable[[], bool] = lambda: True) -> None:
    canvas.tag_bind(tag, "<Enter>", lambda e: canvas.configure(cursor="hand2" if quando() else ""))
    canvas.tag_bind(tag, "<Leave>", lambda e: canvas.configure(cursor=""))


class ListaVidro(tk.Canvas):
    """Lista com rolagem que fica dentro de um cartão de vidro."""

    def __init__(self, pai: tk.Misc, t: tema.Tema, fundo):
        largura, altura = fundo.size
        super().__init__(
            pai, width=largura, height=altura, highlightthickness=0, borderwidth=0,
            background=tema.hex_(tema.cor_media(fundo)), yscrollincrement=t.s(24),
        )  # fmt: skip
        self.t = t
        self.largura, self.altura = largura, altura
        self.travada = False
        self.proxima_y = t.s(6)
        # O pedaço do fundo que fica atrás da lista. Ele não rola junto.
        self._fundo = ImageTk.PhotoImage(fundo)
        self.create_image(0, 0, anchor="nw", image=self._fundo, tags="fundo")
        self.indicador = self.create_line(
            0, 0, 0, 0, fill=tema.INDICADOR, width=t.s(4), capstyle="round", state="hidden"
        )

    def terminar(self) -> None:
        """Chamar depois de adicionar as linhas, para ajustar a rolagem."""
        self.configure(scrollregion=(0, 0, self.largura, max(self.proxima_y, self.altura)))
        self._atualizar()

    def rolar(self, passos: int) -> None:
        if self.proxima_y > self.altura:
            self.yview_scroll(passos, "units")
            self._atualizar()

    def _atualizar(self) -> None:
        topo = self.canvasy(0)
        self.coords("fundo", 0, topo)
        if self.proxima_y <= self.altura:
            self.itemconfigure(self.indicador, state="hidden")
            return
        inicio, fim = self.yview()
        x, margem = self.largura - self.t.s(4), self.t.s(6)
        self.coords(self.indicador, x, topo + inicio * self.altura + margem, x, topo + fim * self.altura - margem)
        self.itemconfigure(self.indicador, state="normal")
        self.tag_raise(self.indicador)


class Caixa:
    """Uma linha da lista: caixa de marcar, nome, etiqueta e descrição."""

    _contador = 0

    def __init__(
        self,
        lista: ListaVidro,
        nome: str,
        descricao: str = "",
        etiqueta: str = "",
        cor_etiqueta: str = tema.TEXTO_SUAVE,
        marcada: bool = True,
        habilitada: bool = True,
        ao_mudar: Callable[[], None] = lambda: None,
    ):
        Caixa._contador += 1
        self.lista, self.ao_mudar = lista, ao_mudar
        self.marcada, self.habilitada = marcada and habilitada, habilitada
        t, s, y = lista.t, lista.t.s, lista.proxima_y
        tag = f"caixa{Caixa._contador}"

        self.icone = lista.create_image(s(10), y + s(1), anchor="nw", tags=tag)
        cor_nome = tema.TEXTO if habilitada else tema.TEXTO_APAGADO
        nome_id = lista.create_text(s(42), y, anchor="nw", text=nome, font=t.f_item, fill=cor_nome, tags=tag)
        if etiqueta:
            lista.create_text(
                lista.largura - s(16), y + s(2), anchor="ne", text=etiqueta, font=t.f_desc, fill=cor_etiqueta
            )
        fim = lista.bbox(nome_id)[3]
        if descricao:
            desc_id = lista.create_text(
                s(42), fim + s(2), anchor="nw", text=descricao, width=lista.largura - s(42) - s(18),
                font=t.f_desc, fill=tema.TEXTO_SUAVE if habilitada else tema.TEXTO_APAGADO, tags=tag,
            )  # fmt: skip
            fim = lista.bbox(desc_id)[3]
        lista.proxima_y = fim + s(14)

        lista.tag_bind(tag, "<Button-1>", lambda e: self.alternar())
        _cursor_de_mao(lista, tag, lambda: self.habilitada and not lista.travada)
        self._desenhar()

    def alternar(self) -> None:
        if self.habilitada and not self.lista.travada:
            self.marcada = not self.marcada
            self._desenhar()
            self.ao_mudar()

    def _desenhar(self) -> None:
        imagem = self.lista.t.caixa[(self.marcada, not self.habilitada)]
        self.lista.itemconfigure(self.icone, image=imagem)


class Interruptor:
    """O botão deslizante do modo teste."""

    def __init__(self, canvas: tk.Canvas, t: tema.Tema, direita: int, y: int, ligado: bool, travado: bool):
        self.canvas, self.t = canvas, t
        self.ligado, self.travado, self.ocupado = ligado, travado, False
        s = t.s
        self.img = canvas.create_image(direita, y, anchor="ne", tags="interruptor")
        largura = t.interruptor[(True, False)].width()
        altura = t.interruptor[(True, False)].height()
        canvas.create_text(
            direita - largura - s(10), y + altura / 2, anchor="e", text="Modo teste",
            font=t.f_item, fill=tema.TEXTO, tags="interruptor",
        )  # fmt: skip
        dica = "sem administrador, só o modo teste" if travado else "só mostra o que faria"
        canvas.create_text(direita, y + altura + s(6), anchor="ne", text=dica, font=t.f_desc, fill=tema.TEXTO_SUAVE)
        canvas.tag_bind("interruptor", "<Button-1>", lambda e: self.alternar())
        _cursor_de_mao(canvas, "interruptor", self._pode_mudar)
        self._desenhar()

    def _pode_mudar(self) -> bool:
        return not self.travado and not self.ocupado

    def alternar(self) -> None:
        if self._pode_mudar():
            self.ligado = not self.ligado
            self._desenhar()

    def definir_ocupado(self, ocupado: bool) -> None:
        self.ocupado = ocupado
        self._desenhar()

    def _desenhar(self) -> None:
        self.canvas.itemconfigure(self.img, image=self.t.interruptor[(self.ligado, not self._pode_mudar())])


class Botao:
    def __init__(self, canvas: tk.Canvas, t: tema.Tema, x: int, y: int, texto: str, comando: Callable[[], None]):
        self.canvas, self.t, self.comando = canvas, t, comando
        self.habilitado = True
        self.img = canvas.create_image(x, y, anchor="nw", image=t.botao, tags="botao")
        meio_x, meio_y = x + t.botao.width() / 2, y + t.botao.height() / 2
        self.texto = canvas.create_text(meio_x, meio_y, text=texto, font=t.f_botao, fill="white", tags="botao")
        canvas.tag_bind("botao", "<Enter>", lambda e: self._foco(True))
        canvas.tag_bind("botao", "<Leave>", lambda e: self._foco(False))
        canvas.tag_bind("botao", "<Button-1>", lambda e: self.habilitado and self.comando())

    def _foco(self, dentro: bool) -> None:
        if self.habilitado:
            self.canvas.itemconfigure(self.img, image=self.t.botao_foco if dentro else self.t.botao)
            self.canvas.configure(cursor="hand2" if dentro else "")

    def habilitar(self, sim: bool, texto: str) -> None:
        self.habilitado = sim
        self.canvas.itemconfigure(self.img, image=self.t.botao if sim else self.t.botao_apagado)
        self.canvas.itemconfigure(self.texto, text=texto, fill="white" if sim else tema.TEXTO_SUAVE)
        if not sim:
            self.canvas.configure(cursor="")


class Barra:
    """Barra de progresso com gradiente."""

    def __init__(self, canvas: tk.Canvas, t: tema.Tema, x: int, y: int, largura: int):
        self.canvas, self.largura, self.altura = canvas, largura, t.s(8)
        self._trilho = ImageTk.PhotoImage(tema.pilula(largura, self.altura, alfa=26))
        canvas.create_image(x, y, anchor="nw", image=self._trilho)
        self.item = canvas.create_image(x, y, anchor="nw")
        self._cheia = None

    def definir(self, fracao: float) -> None:
        largura = round(self.largura * max(0.0, min(1.0, fracao)))
        if largura < self.altura:
            self.canvas.itemconfigure(self.item, image="")
            return
        imagem = tema.pilula(largura, self.altura, gradiente=(tema.ACENTO_1, tema.ACENTO_2))
        self._cheia = ImageTk.PhotoImage(imagem)
        self.canvas.itemconfigure(self.item, image=self._cheia)


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
        demo: bool = False,
    ):
        self.raiz = raiz
        self.pasta_base = pasta_base
        self.automatico = automatico
        self.demo = demo
        self.codigo_saida = 0
        self.rodando = False
        self.fila: queue.Queue = queue.Queue()

        self.t = t = tema.Tema(raiz)
        s = t.s
        largura, altura = s(LARGURA), s(ALTURA)
        x = max(0, (raiz.winfo_screenwidth() - largura) // 2)
        y = max(0, (raiz.winfo_screenheight() - altura) // 2 - s(30))
        raiz.title(f"Pós-formatação {VERSAO}")
        raiz.geometry(f"{largura}x{altura}+{x}+{y}")
        raiz.resizable(False, False)
        raiz.configure(background=tema.hex_(tema.FUNDO_TOPO))
        self._icone = ImageTk.PhotoImage(tema.icone(64))
        raiz.iconphoto(True, self._icone)

        def escalar(caixa):
            return tuple(s(v) for v in caixa)

        cartoes = [escalar(c) for c in (CARTAO_PROG, CARTAO_OTIM, CARTAO_CONTROLES, CARTAO_LOG)]
        fundo = tema.compor_fundo(largura, altura, cartoes, s(RAIO), t.escala)
        lx1, ly1, lx2, ly2 = CARTAO_LOG
        painel = escalar((lx1 + 12, ly1 + 12, lx2 - 12, ly2 - 12))
        cor_painel = tema.desenhar_painel(fundo, painel, s(10))

        self.canvas = c = tk.Canvas(
            raiz, width=largura, height=altura, highlightthickness=0, borderwidth=0,
            background=tema.hex_(tema.FUNDO_TOPO),
        )  # fmt: skip
        c.pack()
        self._fundo = ImageTk.PhotoImage(fundo)
        c.create_image(0, 0, anchor="nw", image=self._fundo)

        # Cabeçalho
        c.create_text(s(28), s(22), anchor="nw", text="Pós-formatação", font=t.f_titulo, fill=tema.TEXTO)
        c.create_text(
            s(30), s(64), anchor="nw", font=t.f_item, fill=tema.TEXTO_SUAVE,
            text="Marque o que você quer e clique em Começar.",
        )  # fmt: skip
        self.interruptor = Interruptor(c, t, s(936), s(30), ligado=simular, travado=so_teste)

        # As duas listas
        self.itens_prog: list = []
        self.itens_otim: list = []
        self.lista_prog, self.contador_prog = self._cartao_lista(fundo, CARTAO_PROG, "Programas")
        self.lista_otim, self.contador_otim = self._cartao_lista(fundo, CARTAO_OTIM, "Otimizações")
        self.itens_prog = [self._linha_programa(p) for p in programas]
        if not programas:
            self.lista_prog.create_text(
                s(12), s(8), anchor="nw", text="Nenhum programa no apps.json.", font=t.f_item, fill=tema.TEXTO_SUAVE
            )
        self.itens_otim = [
            (o, Caixa(self.lista_otim, o.nome, o.descricao, marcada=o.marcado, ao_mudar=self._contar))
            for o in otm.OTIMIZACOES
        ]
        self.lista_prog.terminar()
        self.lista_otim.terminar()
        self._contar()

        # Botão, progresso e situação
        x1, y1, x2, _ = CARTAO_CONTROLES
        self.botao = Botao(c, t, s(x1 + 18), s(y1 + 16), "Começar", self.comecar)
        inicio_barra = x1 + 18 + 160 + 26
        self.barra = Barra(c, t, s(inicio_barra), s(y1 + 24), s(x2 - 22) - s(inicio_barra))
        self.status = c.create_text(
            s(inicio_barra), s(y1 + 42), anchor="nw", text="Pronto para começar.", font=t.f_desc, fill=tema.TEXTO_SUAVE
        )

        # Registro do que está acontecendo
        px1, py1, px2, py2 = painel
        folga = s(12)
        self.log_texto = tk.Text(
            c, background=tema.hex_(cor_painel), foreground=tema.TEXTO_SUAVE, font=t.f_mono,
            borderwidth=0, highlightthickness=0, wrap="word", state="disabled", cursor="arrow",
            selectbackground=tema.hex_(tema.ACENTO_1), selectforeground="white", insertwidth=0,
            padx=0, pady=0, spacing1=s(1),
        )  # fmt: skip
        c.create_window(
            px1 + folga, py1 + s(8), anchor="nw", window=self.log_texto,
            width=px2 - px1 - 2 * folga, height=py2 - py1 - s(16),
        )  # fmt: skip
        self.log_texto.tag_configure("ok", foreground=tema.VERDE)
        self.log_texto.tag_configure("erro", foreground=tema.VERMELHO)
        self.log_texto.tag_configure("titulo", foreground=tema.TEXTO, font=t.f_mono_forte)

        raiz.bind_all("<MouseWheel>", self._roda_do_mouse)
        raiz.bind_all("<Button-4>", lambda e: self._rolar_em(e, -1))  # Linux
        raiz.bind_all("<Button-5>", lambda e: self._rolar_em(e, 1))
        raiz.protocol("WM_DELETE_WINDOW", self._fechar)
        raiz.after(100, self._ler_fila)
        tema.barra_de_titulo_escura(raiz)

        self._log(f"Lista de programas: {caminho_config}")
        for aviso in avisos or []:
            self._log(aviso, "erro")

    # ---------- montagem da tela ----------

    def _cartao_lista(self, fundo, cartao, titulo: str):
        s, c = self.t.s, self.canvas
        x1, y1, x2, y2 = cartao
        c.create_text(s(x1 + 20), s(y1 + 16), anchor="nw", text=titulo, font=self.t.f_cabecalho, fill=tema.TEXTO)
        contador = c.create_text(s(x2 - 20), s(y1 + 19), anchor="ne", font=self.t.f_desc, fill=tema.TEXTO_SUAVE)
        area = (s(x1 + 8), s(y1 + 48), s(x2 - 8), s(y2 - 10))
        lista = ListaVidro(c, self.t, fundo.crop(area))
        c.create_window(area[0], area[1], anchor="nw", window=lista)
        return lista, contador

    def _linha_programa(self, programa: prg.Programa):
        fonte = prg.fonte_preferida(programa, self.pasta_base)
        descricao = programa.descricao
        if fonte is None:
            faltando = [f.valor for f in programa.fontes if f.tipo == "arquivo"]
            descricao = (descricao + "\n" if descricao else "") + f"Coloque o instalador em: {faltando[0]}"
            etiqueta, cor = "falta o arquivo", tema.VERMELHO
        else:
            etiqueta, cor = prg.ROTULOS[fonte.tipo], CORES_FONTE[fonte.tipo]
        caixa = Caixa(
            self.lista_prog, programa.nome, descricao, etiqueta, cor,
            marcada=programa.marcado, habilitada=fonte is not None, ao_mudar=self._contar,
        )  # fmt: skip
        return programa, caixa

    def _contar(self) -> None:
        for itens, contador in ((self.itens_prog, self.contador_prog), (self.itens_otim, self.contador_otim)):
            marcados = sum(caixa.marcada for _, caixa in itens)
            self.canvas.itemconfigure(contador, text=f"{marcados} de {len(itens)} marcados" if itens else "")

    # ---------- ações ----------

    def comecar(self) -> None:
        programas = [p for p, caixa in self.itens_prog if caixa.marcada]
        otimizacoes = [o for o, caixa in self.itens_otim if caixa.marcada]
        simular = self.interruptor.ligado
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
                    self.barra.definir(feito / max(total, 1))
                    self.canvas.itemconfigure(self.status, text=f"{feito}/{total}  {titulo}", fill=tema.TEXTO_SUAVE)
                elif mensagem[0] == "fim":
                    self._terminou(mensagem[1], mensagem[2])
        except queue.Empty:
            pass
        self.raiz.after(100, self._ler_fila)

    def _terminou(self, resumo: Resumo, simular: bool) -> None:
        self._travar(False)
        if resumo.falhas:
            texto = f"Terminou com {len(resumo.falhas)} problema(s): " + ", ".join(resumo.falhas)
            self.canvas.itemconfigure(self.status, text=texto, fill=tema.VERMELHO)
        else:
            texto = f"Tudo certo! {resumo.certas} de {resumo.total} etapas concluídas."
            self.canvas.itemconfigure(self.status, text=texto, fill=tema.VERDE)

        if self.automatico:
            self.codigo_saida = 1 if resumo.falhas else 0
            self.raiz.after(500, self.raiz.destroy)
        elif self.demo:
            return
        elif simular:
            messagebox.showinfo("Teste concluído", texto + "\n\nNada foi alterado. Desligue o modo teste para valer.")
        elif messagebox.askyesno("Pronto", texto + "\n\nReiniciar o PC agora para aplicar tudo?"):
            sistema.reiniciar_pc()

    def _travar(self, travar: bool) -> None:
        self.rodando = travar
        self.lista_prog.travada = self.lista_otim.travada = travar
        self.interruptor.definir_ocupado(travar)
        self.botao.habilitar(not travar, "Rodando..." if travar else "Começar")

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
            if isinstance(widget, ListaVidro):
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
    demo = "--demo" in args  # roda o modo teste sozinho e deixa a janela aberta (para prints)
    simular = automatico or demo or "--simular" in args
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
    app = App(raiz, programas, base, config, simular, so_teste, automatico, avisos, demo)
    if erro_config and not automatico:
        raiz.after(200, lambda: messagebox.showerror("Problema no apps.json", erro_config))
    if demo:
        raiz.after(800, app.comecar)
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
