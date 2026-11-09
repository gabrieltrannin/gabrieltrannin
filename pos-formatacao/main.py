"""Abre o app.

    python main.py              abre normalmente (pede administrador)
    python main.py --simular    abre já no modo teste
"""

import sys

from instalador.app import main

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
