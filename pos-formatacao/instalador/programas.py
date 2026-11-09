"""Lê a lista de programas do apps.json e instala cada um.

Cada programa tem uma lista de "fontes", tentadas em ordem:

- arquivo: um instalador que está na pasta do app (ex.: no pendrive)
- url:     um link para baixar o instalador (ex.: GitHub Releases)
- winget:  o id do pacote no winget, o gerenciador de pacotes do Windows

A primeira fonte disponível é usada. Se ela falhar, tenta a próxima.
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
from urllib.parse import unquote, urlparse

from .executor import EH_WINDOWS, Executor

TIPOS = ("arquivo", "url", "winget")

ROTULOS = {"arquivo": "local", "url": "download", "winget": "winget"}

# Códigos de saída de instaladores .exe/.msi que significam "deu certo".
# 3010 e 1641 = deu certo, mas precisa reiniciar.
_SUCESSO_INSTALADOR = {0, 3010, 1641}

# Códigos do winget que significam "deu certo" ou "já está instalado".
_WINGET_OK = {0, 0x8A15002B, 0x8A150061}


class ConfigInvalida(Exception):
    pass


@dataclass
class Fonte:
    tipo: str
    valor: str
    args: list[str] = field(default_factory=list)


@dataclass
class Programa:
    nome: str
    fontes: list[Fonte]
    descricao: str = ""
    marcado: bool = True


def carregar(caminho: Path) -> list[Programa]:
    try:
        # utf-8-sig aceita arquivos salvos pelo Bloco de Notas (com BOM).
        dados = json.loads(caminho.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        raise ConfigInvalida(f"Não achei o arquivo {caminho}") from None
    except json.JSONDecodeError as erro:
        raise ConfigInvalida(
            f"O {caminho.name} tem um erro na linha {erro.lineno}, coluna {erro.colno}: {erro.msg}"
        ) from None

    if not isinstance(dados, dict) or not isinstance(dados.get("programas"), list):
        raise ConfigInvalida(f'O {caminho.name} precisa ter uma lista "programas".')

    return [_ler_programa(item, numero) for numero, item in enumerate(dados["programas"], 1)]


def _ler_programa(item: object, numero: int) -> Programa:
    onde = f"Programa nº {numero}"
    if not isinstance(item, dict):
        raise ConfigInvalida(f"{onde}: deveria ser um objeto {{ ... }}.")
    nome = item.get("nome")
    if not isinstance(nome, str) or not nome.strip():
        raise ConfigInvalida(f'{onde}: falta o "nome".')
    onde = f'Programa "{nome}"'

    fontes_brutas = item.get("fontes")
    if not isinstance(fontes_brutas, list) or not fontes_brutas:
        raise ConfigInvalida(f'{onde}: precisa de pelo menos uma fonte em "fontes".')

    fontes = []
    for fonte in fontes_brutas:
        tipos = [tipo for tipo in TIPOS if isinstance(fonte, dict) and tipo in fonte]
        if len(tipos) != 1:
            raise ConfigInvalida(
                f'{onde}: cada fonte precisa ter exatamente um destes: "arquivo", "url" ou "winget".'
            )
        tipo = tipos[0]
        valor = fonte[tipo]
        args = fonte.get("args", [])
        if not isinstance(valor, str) or not valor.strip():
            raise ConfigInvalida(f'{onde}: o "{tipo}" está vazio.')
        if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
            raise ConfigInvalida(f'{onde}: "args" precisa ser uma lista de textos, ex.: ["/S"].')
        fontes.append(Fonte(tipo, valor.strip(), args))

    return Programa(
        nome=nome.strip(),
        fontes=fontes,
        descricao=str(item.get("descricao", "")),
        marcado=bool(item.get("marcado", True)),
    )


def caminho_do_arquivo(fonte: Fonte, pasta_base: Path) -> Path:
    caminho = Path(fonte.valor)
    return caminho if caminho.is_absolute() else pasta_base / caminho


def disponivel(fonte: Fonte, pasta_base: Path) -> bool:
    """Arquivos dá pra conferir agora. Links e winget só na hora de instalar."""
    if fonte.tipo == "arquivo":
        return caminho_do_arquivo(fonte, pasta_base).is_file()
    return True


def fonte_preferida(programa: Programa, pasta_base: Path) -> Fonte | None:
    return next((f for f in programa.fontes if disponivel(f, pasta_base)), None)


def comando_do_instalador(caminho: Path, args: list[str]) -> list[str]:
    if caminho.suffix.lower() == ".msi":
        return ["msiexec", "/i", str(caminho), *args]
    return [str(caminho), *args]


def comando_winget(pacote: str, args: list[str]) -> list[str]:
    return [
        "winget", "install",
        "--id", pacote, "--exact",
        "--source", "winget",
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements",
        *args,
    ]  # fmt: skip


def nome_do_download(url: str, nome_programa: str) -> str:
    nome = Path(unquote(urlparse(url).path)).name
    if Path(nome).suffix.lower() in (".exe", ".msi"):
        return nome
    seguro = re.sub(r"[^A-Za-z0-9._-]+", "-", nome_programa).strip("-") or "instalador"
    return seguro + ".exe"


class Instalador:
    def __init__(self, pasta_base: Path, executor: Executor, log: Callable[[str], None]):
        self.pasta_base = pasta_base
        self.executor = executor
        self.log = log
        self.pasta_downloads = Path(tempfile.gettempdir()) / "pos-formatacao"
        self._winget: bool | None = None

    def instalar(self, programa: Programa) -> bool:
        for fonte in programa.fontes:
            if not disponivel(fonte, self.pasta_base):
                continue
            self.log(f"  Usando {ROTULOS[fonte.tipo]}: {fonte.valor}")
            if self._instalar_por(fonte, programa):
                return True
            self.log("  Não deu certo por esse caminho.")
        self.log("  Nenhuma das fontes funcionou.")
        return False

    def _instalar_por(self, fonte: Fonte, programa: Programa) -> bool:
        if fonte.tipo == "arquivo":
            return self._rodar_instalador(caminho_do_arquivo(fonte, self.pasta_base), fonte.args)
        if fonte.tipo == "url":
            destino = self.pasta_downloads / nome_do_download(fonte.valor, programa.nome)
            if not self._baixar(fonte.valor, destino):
                return False
            return self._rodar_instalador(destino, fonte.args)
        return self._instalar_winget(fonte)

    def _rodar_instalador(self, caminho: Path, args: list[str]) -> bool:
        if not args:
            self.log("  Abrindo o instalador. Termine a instalação na janela dele.")
        resultado = self.executor.rodar(comando_do_instalador(caminho, args))
        if resultado.codigo in _SUCESSO_INSTALADOR:
            if resultado.codigo != 0:
                self.log("  Instalado. Ele pediu para reiniciar o PC no final.")
            return True
        self.log(f"  O instalador terminou com erro (código {resultado.codigo}).")
        return False

    def _baixar(self, url: str, destino: Path) -> bool:
        self.log("  Baixando...")
        if not self.executor.simular:
            destino.parent.mkdir(parents=True, exist_ok=True)
        # O curl.exe já vem no Windows 10 e 11.
        comando = ["curl.exe", "--location", "--fail", "--silent", "--show-error",
                   "--retry", "2", "--output", str(destino), url]  # fmt: skip
        resultado = self.executor.rodar(comando, resumo=f"baixaria {url}")
        if not resultado.ok:
            self.log(f"  Falha no download: {resultado.ultimas_linhas(2) or resultado.codigo}")
            return False
        if not self.executor.simular:
            self.log(f"  Baixado ({destino.stat().st_size / 1_048_576:.1f} MB).")
        return True

    def _instalar_winget(self, fonte: Fonte) -> bool:
        if not self._winget_pronto():
            self.log("  O winget não está disponível neste Windows.")
            return False
        resultado = self.executor.rodar(comando_winget(fonte.valor, fonte.args))
        codigo = resultado.codigo & 0xFFFFFFFF
        if codigo in _WINGET_OK:
            if codigo != 0:
                self.log("  Já estava instalado e atualizado.")
            return True
        self.log(f"  O winget deu erro (código {hex(codigo)}).")
        if resultado.saida:
            self.log("  " + resultado.ultimas_linhas(3).replace("\n", "\n  "))
        return False

    def _winget_pronto(self) -> bool:
        """Confere se o winget existe. Num Windows recém-formatado ele às vezes
        ainda não foi ativado, então pede para o Windows ativar e confere de novo."""
        if self._winget is None:
            if self.executor.simular or shutil.which("winget"):
                self._winget = True
            elif EH_WINDOWS:
                self.log("  Ativando o winget (primeira vez neste Windows)...")
                self.executor.powershell(
                    "Add-AppxPackage -RegisterByFamilyName -MainPackage "
                    "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe"
                )
                self._winget = shutil.which("winget") is not None
            else:
                self._winget = False
        return self._winget
