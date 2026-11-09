"""Confere as otimizações num Windows de verdade. Feito para o GitHub Actions,
que roda numa máquina virtual descartável: NÃO rode isto no seu PC.

1. Confere a sintaxe de todos os scripts do PowerShell.
2. Aplica de verdade as otimizações que fazem sentido numa máquina virtual
   (o Windows Server do GitHub não tem ponto de restauração, e apagar a
   pasta temporária no meio do build atrapalharia os próximos passos).
"""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from instalador import otimizacoes as otm  # noqa: E402
from instalador.executor import Executor  # noqa: E402

NAO_APLICAR = {"ponto_restauracao", "limpeza"}


def main() -> int:
    if os.environ.get("CI") != "true" or sys.platform != "win32":
        print("Isto só roda no GitHub Actions (Windows).")
        return 2

    executor = Executor(print)
    problemas = []
    pasta = Path(tempfile.mkdtemp())

    for otimizacao in otm.OTIMIZACOES:
        arquivo = pasta / f"{otimizacao.id}.ps1"
        # utf-8 com BOM para o Windows PowerShell 5.1 ler os acentos direito
        arquivo.write_text(otm.script_completo(otimizacao), encoding="utf-8-sig")
        checagem = executor.powershell(
            "$erros = $null\n"
            "[System.Management.Automation.Language.Parser]::ParseFile("
            f"'{arquivo}', [ref]$null, [ref]$erros) | Out-Null\n"
            "if ($erros.Count) { $erros | ForEach-Object { $_.ToString() }; exit 1 }\n"
        )
        if not checagem.ok:
            problemas.append(f"{otimizacao.id}: erro de sintaxe\n{checagem.saida}")
            continue
        print(f"sintaxe ok: {otimizacao.id}")

        if otimizacao.id in NAO_APLICAR:
            continue
        if otm.aplicar(otimizacao, executor):
            print(f"aplicou:    {otimizacao.id}")
        else:
            problemas.append(f"{otimizacao.id}: falhou ao aplicar")

    for problema in problemas:
        print("PROBLEMA:", problema)
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
