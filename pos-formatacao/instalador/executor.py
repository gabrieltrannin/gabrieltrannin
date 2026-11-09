"""Roda comandos no Windows, ou só mostra o que faria quando está no modo teste.

Toda ação que mexe no computador passa por aqui. Assim o modo teste
funciona para tudo de uma vez, e os testes automáticos não mudam nada.
"""

from __future__ import annotations

import base64
import subprocess
import sys
from dataclasses import dataclass
from typing import Callable

EH_WINDOWS = sys.platform == "win32"

# Impede que cada comando abra uma janela preta de terminal.
_SEM_JANELA = 0x08000000 if EH_WINDOWS else 0  # CREATE_NO_WINDOW


@dataclass
class Resultado:
    codigo: int
    saida: str = ""

    @property
    def ok(self) -> bool:
        return self.codigo == 0

    def ultimas_linhas(self, quantas: int = 4) -> str:
        linhas = [linha.strip() for linha in self.saida.splitlines() if linha.strip()]
        return "\n".join(linhas[-quantas:])


def _decodificar(dados: bytes) -> str:
    try:
        return dados.decode("utf-8")
    except UnicodeDecodeError:
        # Programas de terminal do Windows costumam usar a página de código "oem".
        return dados.decode("oem" if EH_WINDOWS else "latin-1", errors="replace")


class Executor:
    def __init__(self, log: Callable[[str], None], simular: bool = False):
        self.log = log
        self.simular = simular

    def rodar(self, comando: list[str], resumo: str | None = None) -> Resultado:
        """Roda um programa e espera ele terminar."""
        if self.simular:
            self.log(f"    [teste] {resumo or subprocess.list2cmdline(comando)}")
            return Resultado(0)
        try:
            processo = subprocess.run(
                comando,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                creationflags=_SEM_JANELA,
            )
        except OSError as erro:
            return Resultado(-1, str(erro))
        return Resultado(processo.returncode, _decodificar(processo.stdout or b""))

    def powershell(self, script: str, resumo: str = "rodaria um script do PowerShell") -> Resultado:
        """Roda um script do PowerShell.

        O script vai codificado em base64 (-EncodedCommand) para que aspas
        e quebras de linha não sejam estragadas no caminho.
        """
        completo = (
            "[Console]::OutputEncoding = [Text.Encoding]::UTF8\n"
            "$ProgressPreference = 'SilentlyContinue'\n" + script
        )
        codificado = base64.b64encode(completo.encode("utf-16-le")).decode("ascii")
        comando = [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            codificado,
        ]
        return self.rodar(comando, resumo=resumo)
