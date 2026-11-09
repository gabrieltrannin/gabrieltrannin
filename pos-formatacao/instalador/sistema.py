"""Coisas do Windows: pasta do app, permissão de administrador e tela."""

from __future__ import annotations

import ctypes
import subprocess
import sys
from pathlib import Path

from .executor import EH_WINDOWS


def pasta_base() -> Path:
    """Pasta onde está o .exe (ou o código-fonte). É ali que ficam o apps.json
    e a pasta instaladores/."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def caminho_config(base: Path) -> Path:
    """Usa o apps.json ao lado do .exe. Se não tiver, usa o que vem dentro dele."""
    ao_lado = base / "apps.json"
    if ao_lado.is_file():
        return ao_lado
    return Path(getattr(sys, "_MEIPASS", base)) / "apps.json"


def eh_admin() -> bool:
    if not EH_WINDOWS:
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except OSError:
        return False


def reabrir_como_admin(args: list[str]) -> bool:
    """Abre o app de novo pedindo permissão de administrador (a tela do UAC).
    Devolve True se a nova janela abriu."""
    if getattr(sys, "frozen", False):
        parametros = subprocess.list2cmdline(args)
    else:
        parametros = subprocess.list2cmdline([str(Path(sys.argv[0]).resolve()), *args])
    codigo = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, parametros, None, 1)
    return codigo > 32


def nitidez_em_tela_grande() -> None:
    """Sem isso, a janela fica borrada em telas com zoom de 125%, 150%..."""
    if EH_WINDOWS:
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except (AttributeError, OSError):
            pass


def reiniciar_pc() -> None:
    subprocess.run(["shutdown", "/r", "/t", "10"], check=False)
