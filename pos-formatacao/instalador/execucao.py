"""Junta tudo o que foi marcado numa fila de etapas e roda uma por uma."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from . import otimizacoes as otm
from .executor import Executor
from .programas import Instalador, Programa


@dataclass
class Resumo:
    total: int = 0
    falhas: list[str] = field(default_factory=list)

    @property
    def certas(self) -> int:
        return self.total - len(self.falhas)


def montar_etapas(
    programas: list[Programa],
    otimizacoes: list[otm.Otimizacao],
    instalador: Instalador,
    executor: Executor,
) -> list[tuple[str, Callable[[], bool]]]:
    """Ordem: otimizações (começando pelo ponto de restauração), depois os
    programas e, por último, as otimizações marcadas para o final (limpeza)."""
    antes = [o for o in otimizacoes if not o.depois_dos_programas]
    depois = [o for o in otimizacoes if o.depois_dos_programas]

    def otimizar(o: otm.Otimizacao):
        return (o.nome, lambda: otm.aplicar(o, executor))

    def instalar(p: Programa):
        return (f"Instalar {p.nome}", lambda: instalador.instalar(p))

    return [otimizar(o) for o in antes] + [instalar(p) for p in programas] + [otimizar(o) for o in depois]


def executar(
    etapas: list[tuple[str, Callable[[], bool]]],
    log: Callable[[str], None],
    progresso: Callable[[int, int, str], None],
) -> Resumo:
    resumo = Resumo(total=len(etapas))
    for numero, (titulo, acao) in enumerate(etapas):
        progresso(numero, resumo.total, titulo)
        log(f"\n[{numero + 1}/{resumo.total}] {titulo}")
        try:
            deu_certo = acao()
        except Exception as erro:  # uma etapa com problema não derruba as outras
            log(f"  Erro inesperado: {erro}")
            deu_certo = False
        log("  OK" if deu_certo else "  FALHOU")
        if not deu_certo:
            resumo.falhas.append(titulo)
    progresso(resumo.total, resumo.total, "Pronto")
    return resumo
