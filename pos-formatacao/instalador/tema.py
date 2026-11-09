"""Visual "vidro noturno": céu escuro com brilhos e cartões de vidro fosco.

O tkinter não sabe fazer transparência nem desfoque, então as imagens são
geradas aqui com o Pillow: o fundo inteiro (já com os cartões de vidro), as
caixas de marcar, o botão, o interruptor e a barra de progresso.
"""

from __future__ import annotations

import ctypes
import random
import tkinter as tk
from tkinter import font as tkfont

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageTk

from .executor import EH_WINDOWS

# ---------- cores ----------

FUNDO_TOPO = (9, 12, 32)
FUNDO_BASE = (24, 16, 56)

# (cor, posição x e y relativas, raio relativo à largura, força)
BRILHOS = [
    ((124, 58, 237), (0.92, 0.00), 0.34, 0.75),  # violeta
    ((6, 182, 212), (0.00, 0.80), 0.30, 0.55),  # ciano
    ((217, 70, 239), (0.62, 1.05), 0.24, 0.45),  # magenta
    ((37, 99, 235), (0.30, 0.10), 0.20, 0.35),  # azul
]

ACENTO_1 = (139, 92, 246)  # violeta
ACENTO_2 = (56, 189, 248)  # azul-céu

TEXTO = "#EEF0FF"
TEXTO_SUAVE = "#A6ACD4"
TEXTO_APAGADO = "#5C6290"
VERDE = "#4ADE80"
VERMELHO = "#FB7185"
CIANO = "#67E8F9"
AZUL = "#93C5FD"
INDICADOR = "#7C82B8"

# Desenha tudo 4x maior e depois reduz, para as bordas ficarem suaves.
_SS = 4


def hex_(cor: tuple[int, ...]) -> str:
    return "#%02x%02x%02x" % tuple(cor[:3])


def _mistura(a, b, t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b, strict=True))


def cor_media(imagem: Image.Image) -> tuple[int, int, int]:
    return imagem.convert("RGB").resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))


# ---------- formas básicas ----------


def _gradiente(largura: int, altura: int, c1, c2, vertical: bool = False) -> Image.Image:
    faixa = Image.new("RGB", (1, 256) if vertical else (256, 1))
    for i in range(256):
        faixa.putpixel((0, i) if vertical else (i, 0), _mistura(c1, c2, i / 255))
    return faixa.resize((largura, altura), Image.Resampling.BILINEAR)


def _mascara(largura: int, altura: int, raio: float) -> Image.Image:
    grande = Image.new("L", (largura * _SS, altura * _SS), 0)
    ImageDraw.Draw(grande).rounded_rectangle(
        (0, 0, largura * _SS - 1, altura * _SS - 1), radius=raio * _SS, fill=255
    )
    return grande.resize((largura, altura), Image.Resampling.LANCZOS)


def pilula(largura, altura, cor=(255, 255, 255), alfa=255, gradiente=None, raio=None) -> Image.Image:
    """Retângulo de cantos redondos, com cor sólida ou gradiente."""
    largura, altura = max(1, int(largura)), max(1, int(altura))
    raio = altura / 2 if raio is None else raio
    if gradiente:
        imagem = _gradiente(largura, altura, *gradiente).convert("RGBA")
    else:
        imagem = Image.new("RGBA", (largura, altura), tuple(cor[:3]) + (255,))
    mascara = _mascara(largura, altura, raio)
    if alfa < 255:
        mascara = mascara.point(lambda v: v * alfa // 255)
    imagem.putalpha(mascara)
    return imagem


def _contorno(largura, altura, raio, alfa_topo, alfa_base, espessura) -> Image.Image:
    """Borda fina de vidro: mais clara em cima, como se a luz viesse de cima."""
    grande = Image.new("RGBA", (largura * _SS, altura * _SS), (255, 255, 255, 0))
    ImageDraw.Draw(grande).rounded_rectangle(
        (0, 0, largura * _SS - 1, altura * _SS - 1),
        radius=raio * _SS,
        outline=(255, 255, 255, 255),
        width=max(1, round(espessura * _SS)),
    )
    borda = grande.resize((largura, altura), Image.Resampling.LANCZOS)
    luz = _gradiente(1, altura, (alfa_topo,) * 3, (alfa_base,) * 3, vertical=True).convert("L")
    alfa = ImageChops.multiply(borda.getchannel("A"), luz.resize((largura, altura)))
    borda.putalpha(alfa)
    return borda


# ---------- fundo ----------


def compor_fundo(largura: int, altura: int, cartoes: list[tuple[int, int, int, int]], raio: int, escala: float):
    """Céu noturno com os cartões de vidro fosco já desenhados por cima."""
    ceu = _gradiente(largura, altura, FUNDO_TOPO, FUNDO_BASE, vertical=True)

    # Brilhos coloridos: desenha pequeno, desfoca e amplia (é bem mais rápido).
    reducao = 8
    pequeno = Image.new("RGB", (largura // reducao + 1, altura // reducao + 1))
    for cor, (rx, ry), rr, forca in BRILHOS:
        camada = Image.new("RGB", pequeno.size)
        cx, cy, r = rx * pequeno.width, ry * pequeno.height, rr * pequeno.width
        ImageDraw.Draw(camada).ellipse((cx - r, cy - r, cx + r, cy + r), fill=tuple(int(c * forca) for c in cor))
        pequeno = ImageChops.add(pequeno, camada.filter(ImageFilter.GaussianBlur(r * 0.6)))
    brilhos = pequeno.resize((largura, altura), Image.Resampling.BICUBIC)
    ceu = ImageChops.screen(ceu, brilhos)

    # Estrelas (sempre nos mesmos lugares)
    sorteio = random.Random(42)
    desenho = ImageDraw.Draw(ceu)
    for _ in range(largura * altura // 6000):
        x, y = sorteio.randrange(largura), sorteio.randrange(altura)
        luz = sorteio.randint(70, 230)
        tamanho = escala * (1.6 if sorteio.random() < 0.12 else 0.9)
        meio = tamanho / 2
        desenho.ellipse((x - meio, y - meio, x + meio, y + meio), fill=(luz, luz, min(255, luz + 25)))

    # O que aparece "atrás do vidro" é o céu desfocado.
    desfocados = [ceu.crop(c).filter(ImageFilter.GaussianBlur(18 * escala)) for c in cartoes]

    fundo = ceu.convert("RGBA")

    # Sombra suave embaixo dos cartões
    sombra = Image.new("L", fundo.size, 0)
    for x1, y1, x2, y2 in cartoes:
        ImageDraw.Draw(sombra).rounded_rectangle(
            (x1, y1 + 6 * escala, x2, y2 + 6 * escala), radius=raio, fill=120
        )
    sombra = sombra.filter(ImageFilter.GaussianBlur(14 * escala))
    fundo = Image.composite(Image.new("RGBA", fundo.size, (2, 3, 12, 255)), fundo, sombra)

    for (x1, y1, x2, y2), atras in zip(cartoes, desfocados, strict=True):
        w, h = x2 - x1, y2 - y1
        vidro = Image.blend(atras, Image.new("RGB", atras.size, (255, 255, 255)), 0.06).convert("RGBA")
        # Reflexo: um pouco mais claro na parte de cima do cartão
        reflexo = _gradiente(1, h, (12,) * 3, (0,) * 3, vertical=True).convert("L").resize((w, h))
        vidro = Image.composite(Image.new("RGBA", (w, h), (255, 255, 255, 255)), vidro, reflexo)
        fundo.paste(vidro, (x1, y1), _mascara(w, h, raio))
        fundo.alpha_composite(_contorno(w, h, raio, 70, 22, escala), dest=(x1, y1))

    return fundo


def desenhar_painel(fundo: Image.Image, caixa: tuple[int, int, int, int], raio: int) -> tuple[int, int, int]:
    """Painel escuro e liso dentro de um cartão (onde fica o registro).
    Devolve a cor do painel, para o fundo do texto ficar igual."""
    x1, y1, x2, y2 = caixa
    cor = _mistura(cor_media(fundo.crop(caixa)), (4, 5, 18), 0.45)
    fundo.alpha_composite(pilula(x2 - x1, y2 - y1, cor=cor, raio=raio), dest=(x1, y1))
    fundo.alpha_composite(_contorno(x2 - x1, y2 - y1, raio, 18, 30, 1), dest=(x1, y1))
    return cor


# ---------- peças da interface ----------


def _caixa_de_marcar(lado: int, marcada: bool, apagada: bool) -> Image.Image:
    raio = lado * 0.3
    if marcada:
        imagem = pilula(lado, lado, gradiente=(ACENTO_1, ACENTO_2), raio=raio, alfa=110 if apagada else 255)
        grande = imagem.resize((lado * _SS, lado * _SS), Image.Resampling.LANCZOS)
        pontos = [(0.27, 0.52), (0.43, 0.68), (0.74, 0.34)]
        ImageDraw.Draw(grande).line(
            [(x * lado * _SS, y * lado * _SS) for x, y in pontos],
            fill=(255, 255, 255, 140 if apagada else 255),
            width=round(lado * _SS * 0.12),
            joint="curve",
        )
        return grande.resize((lado, lado), Image.Resampling.LANCZOS)
    imagem = pilula(lado, lado, alfa=8 if apagada else 18, raio=raio)
    imagem.alpha_composite(_contorno(lado, lado, raio, 60 if apagada else 150, 40 if apagada else 110, lado / 14))
    return imagem


def _interruptor(largura: int, altura: int, ligado: bool, apagado: bool) -> Image.Image:
    if ligado:
        imagem = pilula(largura, altura, gradiente=(ACENTO_1, ACENTO_2))
    else:
        imagem = pilula(largura, altura, alfa=34)
        imagem.alpha_composite(_contorno(largura, altura, altura / 2, 90, 60, altura / 16))
    margem = altura * 0.16
    d = altura - 2 * margem
    x = largura - margem - d if ligado else margem
    imagem.alpha_composite(pilula(d, d, cor=(255, 255, 255)), dest=(round(x), round(margem)))
    if apagado:
        imagem.putalpha(imagem.getchannel("A").point(lambda v: v * 45 // 100))
    return imagem


def icone(tamanho: int = 256) -> Image.Image:
    """Uma lua crescente com gradiente, para a janela e o .exe."""
    g = tamanho * _SS
    horizontal = _gradiente(g, g, ACENTO_1, ACENTO_2)
    lua = Image.new("L", (g, g), 0)
    d = ImageDraw.Draw(lua)
    d.ellipse((g * 0.08, g * 0.08, g * 0.92, g * 0.92), fill=255)
    d.ellipse((g * 0.34, g * -0.04, g * 1.06, g * 0.66), fill=0)
    imagem = horizontal.convert("RGBA")
    imagem.putalpha(lua)
    estrela = ImageDraw.Draw(imagem)
    cx, cy, r = g * 0.74, g * 0.70, g * 0.07
    estrela.polygon(
        [(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy), (cx + r * 0.28, cy + r * 0.28),
         (cx, cy + r), (cx - r * 0.28, cy + r * 0.28), (cx - r, cy), (cx - r * 0.28, cy - r * 0.28)],
        fill=(255, 255, 255, 255),
    )  # fmt: skip
    return imagem.resize((tamanho, tamanho), Image.Resampling.LANCZOS)


def salvar_icone(caminho: str) -> None:
    tamanhos = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icone(256).save(caminho, sizes=tamanhos)


# ---------- tema pronto para o tkinter ----------


class Tema:
    def __init__(self, raiz: tk.Tk):
        # 1.0 numa tela normal, 1.25 / 1.5 com o zoom do Windows ligado
        self.escala = min(3.0, max(1.0, raiz.winfo_fpixels("1i") / 96))
        familias = set(tkfont.families(raiz))
        comum = next(
            (f for f in ("Segoe UI", "Inter", "Cantarell", "DejaVu Sans") if f in familias),
            tkfont.nametofont("TkDefaultFont").actual("family"),
        )
        mono = next((f for f in ("Cascadia Mono", "Consolas", "DejaVu Sans Mono") if f in familias), "Courier")

        def forte(px: float):
            if "Segoe UI Semibold" in familias:
                return ("Segoe UI Semibold", -self.s(px))
            return (comum, -self.s(px), "bold")

        self.f_titulo = forte(28)
        self.f_cabecalho = forte(16)
        self.f_botao = forte(15)
        self.f_item = (comum, -self.s(14))
        self.f_desc = (comum, -self.s(12.5))
        self.f_mono = (mono, -self.s(12))
        self.f_mono_forte = (mono, -self.s(12), "bold")

        s = self.s
        foto = ImageTk.PhotoImage
        self.caixa = {
            (marcada, apagada): foto(_caixa_de_marcar(s(20), marcada, apagada))
            for marcada in (True, False)
            for apagada in (True, False)
        }
        self.interruptor = {
            (ligado, apagado): foto(_interruptor(s(46), s(24), ligado, apagado))
            for ligado in (True, False)
            for apagado in (True, False)
        }
        self.botao = foto(pilula(s(160), s(44), gradiente=(ACENTO_1, ACENTO_2)))
        claro = (_mistura(ACENTO_1, (255, 255, 255), 0.18), _mistura(ACENTO_2, (255, 255, 255), 0.18))
        self.botao_foco = foto(pilula(s(160), s(44), gradiente=claro))
        apagado = pilula(s(160), s(44), alfa=30)
        apagado.alpha_composite(_contorno(s(160), s(44), s(22), 60, 40, self.escala))
        self.botao_apagado = foto(apagado)

    def s(self, valor: float) -> int:
        """Converte um tamanho "normal" para o tamanho na tela (com zoom)."""
        return int(round(valor * self.escala))


def barra_de_titulo_escura(raiz: tk.Tk) -> None:
    """Deixa a barra de título escura, da mesma cor do topo do fundo."""
    if not EH_WINDOWS:
        return
    try:
        raiz.update_idletasks()
        janela = ctypes.windll.user32.GetParent(raiz.winfo_id())
        dwm = ctypes.windll.dwmapi

        def definir(atributo: int, valor: int) -> None:
            dado = ctypes.c_int(valor)
            dwm.DwmSetWindowAttribute(janela, atributo, ctypes.byref(dado), ctypes.sizeof(dado))

        def colorref(cor) -> int:
            return cor[0] | cor[1] << 8 | cor[2] << 16

        definir(20, 1)  # modo escuro (Windows 10 e 11)
        definir(35, colorref(FUNDO_TOPO))  # cor da barra (Windows 11)
        definir(36, colorref((238, 240, 255)))  # cor do texto da barra (Windows 11)
        definir(34, colorref((48, 42, 96)))  # cor da borda (Windows 11)
    except (AttributeError, OSError):
        pass
