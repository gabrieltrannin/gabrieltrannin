"""Gera o executável do programa com o PyInstaller.

Como usar (dentro da pasta formatar-celular):
    pip install pyinstaller
    python gerar_exe.py

O resultado fica na pasta dist/ (FormatarCelular.exe no Windows).
O PyInstaller gera o executável para o sistema em que ele roda: para ter
um .exe, rode este script no Windows.
"""

import os
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent


def main() -> None:
    try:
        import PyInstaller.__main__
    except ImportError:
        sys.exit("O PyInstaller não está instalado. Rode: pip install pyinstaller")

    os.chdir(PASTA)
    argumentos = [
        "app.py",
        "--name", "FormatarCelular",
        "--onefile",       # um arquivo só
        "--windowed",      # sem a janela preta do console
        "--noconfirm",
        "--clean",
        "--add-data", f"icone.png{os.pathsep}.",  # ícone da janela
    ]
    if sys.platform == "win32":
        argumentos += ["--icon", "icone.ico"]  # ícone do arquivo .exe
    PyInstaller.__main__.run(argumentos)

    nome = "FormatarCelular.exe" if sys.platform == "win32" else "FormatarCelular"
    print(f"\nPronto! Executável gerado em: {PASTA / 'dist' / nome}")


if __name__ == "__main__":
    main()
