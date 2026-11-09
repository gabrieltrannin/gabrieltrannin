"""Testes que não mexem no computador. Rode com:  python -m unittest -v"""

import json
import tempfile
import unittest
from pathlib import Path

from instalador import otimizacoes as otm
from instalador import programas as prg
from instalador.execucao import executar, montar_etapas
from instalador.executor import Executor, Resultado

RAIZ = Path(__file__).resolve().parent.parent


class ExecutorFalso(Executor):
    """Anota os comandos em vez de rodar, e responde o código que a gente quiser."""

    def __init__(self, codigos=None):
        super().__init__(log=self.logs_append, simular=False)
        self.logs = []
        self.comandos = []
        self.codigos = list(codigos or [])

    def logs_append(self, texto):
        self.logs.append(texto)

    def rodar(self, comando, resumo=None):
        self.comandos.append(comando)
        return Resultado(self.codigos.pop(0) if self.codigos else 0, "linha 1\nlinha final")


def salvar_config(pasta: Path, dados) -> Path:
    caminho = pasta / "apps.json"
    texto = dados if isinstance(dados, str) else json.dumps(dados)
    caminho.write_text(texto, encoding="utf-8")
    return caminho


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())

    def test_apps_json_do_projeto_e_valido(self):
        programas = prg.carregar(RAIZ / "apps.json")
        self.assertTrue(programas)
        nomes = [p.nome for p in programas]
        self.assertIn("Steam", nomes)

    def test_aceita_arquivo_salvo_no_bloco_de_notas_com_bom(self):
        caminho = self.pasta / "apps.json"
        caminho.write_text('{"programas": [{"nome": "X", "fontes": [{"winget": "A.B"}]}]}', encoding="utf-8-sig")
        self.assertEqual(prg.carregar(caminho)[0].nome, "X")

    def test_json_quebrado_diz_a_linha(self):
        caminho = salvar_config(self.pasta, '{\n  "programas": [\n    {"nome": "X",}\n  ]\n}')
        with self.assertRaisesRegex(prg.ConfigInvalida, "linha 3"):
            prg.carregar(caminho)

    def test_fonte_com_dois_tipos_e_recusada(self):
        caminho = salvar_config(
            self.pasta, {"programas": [{"nome": "X", "fontes": [{"winget": "A", "url": "http://b"}]}]}
        )
        with self.assertRaisesRegex(prg.ConfigInvalida, "exatamente um"):
            prg.carregar(caminho)

    def test_programa_sem_nome_e_recusado(self):
        caminho = salvar_config(self.pasta, {"programas": [{"fontes": [{"winget": "A"}]}]})
        with self.assertRaisesRegex(prg.ConfigInvalida, "nº 1"):
            prg.carregar(caminho)

    def test_args_precisa_ser_lista(self):
        caminho = salvar_config(
            self.pasta, {"programas": [{"nome": "X", "fontes": [{"winget": "A", "args": "/S"}]}]}
        )
        with self.assertRaisesRegex(prg.ConfigInvalida, "args"):
            prg.carregar(caminho)


class TestFontes(unittest.TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())
        (self.pasta / "instaladores").mkdir()
        self.programa = prg.Programa(
            "Discord",
            [prg.Fonte("arquivo", "instaladores/discord-leve.exe"), prg.Fonte("winget", "Discord.Discord")],
        )

    def test_sem_o_arquivo_usa_o_winget(self):
        self.assertEqual(prg.fonte_preferida(self.programa, self.pasta).tipo, "winget")

    def test_com_o_arquivo_usa_a_minha_versao(self):
        (self.pasta / "instaladores" / "discord-leve.exe").write_bytes(b"MZ")
        self.assertEqual(prg.fonte_preferida(self.programa, self.pasta).tipo, "arquivo")

    def test_so_arquivo_e_ele_falta(self):
        programa = prg.Programa("Spotify", [prg.Fonte("arquivo", "instaladores/spotify-leve.exe")])
        self.assertIsNone(prg.fonte_preferida(programa, self.pasta))

    def test_msi_usa_msiexec(self):
        self.assertEqual(
            prg.comando_do_instalador(Path("C:/x/app.msi"), ["/qn"])[:2], ["msiexec", "/i"]
        )
        self.assertEqual(prg.comando_do_instalador(Path("C:/x/app.exe"), ["/S"])[1:], ["/S"])

    def test_nome_do_download(self):
        url = "https://github.com/eu/discord-leve/releases/latest/download/Discord%20Leve.exe"
        self.assertEqual(prg.nome_do_download(url, "Discord"), "Discord Leve.exe")
        self.assertEqual(prg.nome_do_download("https://site.com/baixar?id=3", "Meu App!"), "Meu-App.exe")


class TestInstalacao(unittest.TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())

    def instalador(self, executor):
        instalador = prg.Instalador(self.pasta, executor, executor.log)
        instalador._winget = True  # finge que o winget existe
        return instalador

    def test_winget_ja_instalado_conta_como_sucesso(self):
        # O Windows devolve o código do winget como número sem sinal.
        executor = ExecutorFalso(codigos=[0x8A15002B])
        programa = prg.Programa("Steam", [prg.Fonte("winget", "Valve.Steam")])
        self.assertTrue(self.instalador(executor).instalar(programa))
        comando = executor.comandos[0]
        self.assertEqual(comando[:2], ["winget", "install"])
        self.assertIn("Valve.Steam", comando)
        self.assertIn("--accept-package-agreements", comando)

    def test_winget_ja_instalado_com_codigo_negativo(self):
        executor = ExecutorFalso(codigos=[0x8A150061 - 2**32])
        programa = prg.Programa("Steam", [prg.Fonte("winget", "Valve.Steam")])
        self.assertTrue(self.instalador(executor).instalar(programa))

    def test_se_o_winget_falha_baixa_pelo_link(self):
        executor = ExecutorFalso(codigos=[1, 0, 0])  # winget falha, curl ok, instalador ok
        programa = prg.Programa(
            "Steam",
            [prg.Fonte("winget", "Valve.Steam"), prg.Fonte("url", "https://exemplo.com/SteamSetup.exe", ["/S"])],
        )
        instalador = self.instalador(executor)
        instalador.pasta_downloads = self.pasta / "downloads"
        destino = instalador.pasta_downloads / "SteamSetup.exe"
        destino.parent.mkdir()
        destino.write_bytes(b"MZ" * 10)  # o curl "baixou"

        self.assertTrue(instalador.instalar(programa))
        self.assertEqual(executor.comandos[1][0], "curl.exe")
        self.assertEqual(executor.comandos[2], [str(destino), "/S"])

    def test_reiniciar_depois_conta_como_sucesso(self):
        (self.pasta / "app.msi").write_bytes(b"x")
        executor = ExecutorFalso(codigos=[3010])
        programa = prg.Programa("App", [prg.Fonte("arquivo", "app.msi", ["/qn"])])
        self.assertTrue(self.instalador(executor).instalar(programa))

    def test_tudo_falhando_devolve_falso(self):
        executor = ExecutorFalso(codigos=[5])
        programa = prg.Programa("App", [prg.Fonte("winget", "A.B"), prg.Fonte("arquivo", "nao-existe.exe")])
        self.assertFalse(self.instalador(executor).instalar(programa))
        self.assertEqual(len(executor.comandos), 1)


class TestModoTeste(unittest.TestCase):
    def test_modo_teste_nao_roda_nada(self):
        logs = []
        executor = Executor(logs.append, simular=True)
        self.assertTrue(executor.rodar(["isso-nao-existe.exe"]).ok)
        self.assertTrue(executor.powershell("exit 1").ok)
        self.assertTrue(any("[teste]" in linha for linha in logs))

    def test_rodada_completa_em_modo_teste(self):
        logs = []
        executor = Executor(logs.append, simular=True)
        instalador = prg.Instalador(RAIZ, executor, logs.append)
        programas = prg.carregar(RAIZ / "apps.json")
        programas = [p for p in programas if prg.fonte_preferida(p, RAIZ)]
        etapas = montar_etapas(programas, otm.OTIMIZACOES, instalador, executor)
        resumo = executar(etapas, logs.append, lambda *_: None)
        self.assertEqual(resumo.falhas, [])
        self.assertEqual(resumo.total, len(programas) + len(otm.OTIMIZACOES))


class TestOrdem(unittest.TestCase):
    def test_ponto_de_restauracao_primeiro_e_limpeza_no_final(self):
        executor = Executor(lambda _: None, simular=True)
        instalador = prg.Instalador(RAIZ, executor, lambda _: None)
        programa = prg.Programa("Steam", [prg.Fonte("winget", "Valve.Steam")])
        titulos = [t for t, _ in montar_etapas([programa], otm.OTIMIZACOES, instalador, executor)]
        self.assertEqual(titulos[0], "Criar ponto de restauração")
        self.assertEqual(titulos[-1], "Limpar arquivos temporários")
        self.assertEqual(titulos[-2], "Instalar Steam")


class TestOtimizacoes(unittest.TestCase):
    def test_ids_unicos(self):
        ids = [o.id for o in otm.OTIMIZACOES]
        self.assertEqual(len(ids), len(set(ids)))

    def test_script_tem_tratamento_de_erro(self):
        for otimizacao in otm.OTIMIZACOES:
            script = otm.script_completo(otimizacao)
            self.assertIn("function Set-Reg", script)
            self.assertIn("exit 1", script)

    def test_nada_perigoso(self):
        proibido = ["DisableAntiSpyware", "wuauserv", "EnableLUA", "Remove-AppxPackage", "bcdedit"]
        for otimizacao in otm.OTIMIZACOES:
            for palavra in proibido:
                self.assertNotIn(palavra, otimizacao.script, otimizacao.nome)


if __name__ == "__main__":
    unittest.main()
