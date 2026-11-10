"""Comunicação com celulares Android usando ADB e Fastboot.

Este arquivo não tem nada de interface gráfica: ele só executa os comandos
do ADB/Fastboot e transforma as respostas em dados fáceis de usar.
A janela do programa fica em app.py.
"""

from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

Log = Callable[[str], None]


def pasta_do_programa() -> Path:
    """Pasta onde o programa está (funciona também no .exe gerado pelo PyInstaller)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


PASTA_PLATFORM_TOOLS = pasta_do_programa() / "platform-tools"

# Download oficial do Google: https://developer.android.com/tools/releases/platform-tools
URLS_PLATFORM_TOOLS = {
    "Windows": "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
    "Darwin": "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
    "Linux": "https://dl.google.com/android/repository/platform-tools-latest-linux.zip",
}

# (descrição, pasta no celular, nome da pasta no PC)
PASTAS_BACKUP = [
    ("Fotos e vídeos da câmera", "/sdcard/DCIM", "DCIM"),
    ("Imagens e capturas de tela", "/sdcard/Pictures", "Imagens"),
    ("Vídeos", "/sdcard/Movies", "Videos"),
    ("Músicas", "/sdcard/Music", "Musicas"),
    ("Downloads", "/sdcard/Download", "Downloads"),
    ("Documentos", "/sdcard/Documents", "Documentos"),
    ("Mídia do WhatsApp", "/sdcard/Android/media/com.whatsapp/WhatsApp/Media", "WhatsApp"),
    ("Mídia do WhatsApp (versão antiga)", "/sdcard/WhatsApp/Media", "WhatsApp-antigo"),
]

DESCRICAO_ESTADOS = {
    "device": "conectado",
    "unauthorized": "aguardando autorização no celular",
    "offline": "sem resposta (offline)",
    "recovery": "em modo recovery",
    "sideload": "em modo sideload",
    "fastboot": "em modo fastboot",
    "sem-permissao": "sem permissão de acesso ao USB",
}


class ErroADB(Exception):
    """Erro com uma mensagem amigável, pronta para mostrar ao usuário."""


@dataclass
class Aparelho:
    serial: str
    estado: str
    modelo: str = ""

    @property
    def pronto_para_adb(self) -> bool:
        return self.estado == "device"

    @property
    def em_fastboot(self) -> bool:
        return self.estado == "fastboot"

    @property
    def em_recovery(self) -> bool:
        return self.estado in ("recovery", "sideload")

    def descricao(self) -> str:
        estado = DESCRICAO_ESTADOS.get(self.estado, self.estado)
        if self.modelo:
            return f"{self.modelo} ({self.serial}) — {estado}"
        return f"{self.serial} — {estado}"


@dataclass
class InfoAparelho:
    fabricante: str = ""
    modelo: str = ""
    versao_android: str = ""
    bateria: Optional[int] = None
    contas_google: list[str] = field(default_factory=list)

    @property
    def eh_samsung(self) -> bool:
        return self.fabricante.lower() == "samsung"

    def resumo(self) -> str:
        partes = [f"{self.fabricante} {self.modelo}".strip() or "Celular Android"]
        if self.versao_android:
            partes.append(f"Android {self.versao_android}")
        if self.bateria is not None:
            partes.append(f"Bateria {self.bateria}%")
        return " · ".join(partes)


# ---------------------------------------------------------------------------
# Interpretação das respostas dos comandos (funções puras, fáceis de testar)
# ---------------------------------------------------------------------------

def interpretar_adb_devices(saida: str) -> list[Aparelho]:
    """Lê a saída de `adb devices -l`."""
    aparelhos = []
    for linha in saida.splitlines():
        linha = linha.strip()
        if not linha or linha.startswith(("List of devices", "*", "adb ")):
            continue
        partes = linha.split()
        if len(partes) < 2:
            continue
        serial, estado = partes[0], partes[1]
        if estado == "no" and len(partes) > 2 and partes[2].startswith("permissions"):
            estado = "sem-permissao"
        modelo = ""
        for parte in partes[2:]:
            if parte.startswith("model:"):
                modelo = parte[len("model:"):].replace("_", " ")
        aparelhos.append(Aparelho(serial, estado, modelo))
    return aparelhos


def interpretar_fastboot_devices(saida: str) -> list[Aparelho]:
    """Lê a saída de `fastboot devices`."""
    aparelhos = []
    for linha in saida.splitlines():
        partes = linha.split()
        if len(partes) >= 2 and partes[1] in ("fastboot", "fastbootd"):
            aparelhos.append(Aparelho(partes[0], "fastboot"))
    return aparelhos


_RE_GETPROP = re.compile(r"^\[(?P<chave>[^\]]+)\]: \[(?P<valor>.*)\]\s*$")


def interpretar_getprop(saida: str) -> dict[str, str]:
    """Lê a saída de `getprop` (linhas no formato `[chave]: [valor]`)."""
    propriedades = {}
    for linha in saida.splitlines():
        encontrado = _RE_GETPROP.match(linha.strip())
        if encontrado:
            propriedades[encontrado["chave"]] = encontrado["valor"]
    return propriedades


def interpretar_bateria(saida: str) -> Optional[int]:
    """Lê o nível da bateria na saída de `dumpsys battery`."""
    encontrado = re.search(r"^\s*level:\s*(\d+)", saida, re.MULTILINE)
    return int(encontrado.group(1)) if encontrado else None


_RE_CONTA_GOOGLE = re.compile(r"Account \{name=([^,}]+), type=com\.google\}")


def interpretar_contas_google(saida: str) -> list[str]:
    """Lista as contas Google (sem repetir) da saída de `dumpsys account`."""
    contas: list[str] = []
    for nome in _RE_CONTA_GOOGLE.findall(saida):
        if nome not in contas:
            contas.append(nome)
    return contas


def interpretar_bootloader_desbloqueado(saida: str) -> Optional[bool]:
    """Diz se o bootloader está desbloqueado (None = não deu para saber)."""
    encontrado = re.search(r"\bunlocked:\s*(yes|no|true|false)\b", saida, re.IGNORECASE)
    if encontrado:
        return encontrado.group(1).lower() in ("yes", "true")
    encontrado = re.search(r"\bdevice-state:\s*(unlocked|locked)\b", saida, re.IGNORECASE)
    if encontrado:
        return encontrado.group(1).lower() == "unlocked"
    return None


def _primeira_maiuscula(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


def _ultima_linha(texto: str) -> str:
    linhas = [linha.strip() for linha in texto.splitlines() if linha.strip()]
    return linhas[-1] if linhas else ""


# ---------------------------------------------------------------------------
# Execução dos programas adb e fastboot
# ---------------------------------------------------------------------------

def _opcoes_subprocess() -> dict:
    # No Windows, evita que uma janela preta do console pisque a cada comando.
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NO_WINDOW}
    return {}


def _executar(argumentos: list[str], timeout: Optional[float] = 60) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            argumentos,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            **_opcoes_subprocess(),
        )
    except FileNotFoundError as erro:
        raise ErroADB(f"Programa não encontrado: {argumentos[0]}") from erro
    except subprocess.TimeoutExpired as erro:
        raise ErroADB(
            "O celular demorou demais para responder. Verifique o cabo USB e tente de novo."
        ) from erro


def _mensagem_de_erro_adb(resultado: subprocess.CompletedProcess) -> str:
    texto = (resultado.stderr or "").strip() or (resultado.stdout or "").strip()
    minusculo = texto.lower()
    if "unauthorized" in minusculo:
        return ("O celular não autorizou este computador. Desbloqueie a tela e toque em "
                "\"Permitir\" na mensagem \"Permitir depuração USB?\".")
    if "no devices" in minusculo or ("device" in minusculo and "not found" in minusculo):
        return "O celular foi desconectado. Verifique o cabo USB e clique em \"Procurar celular\"."
    if "offline" in minusculo:
        return "O celular está offline. Desconecte e conecte o cabo USB de novo."
    return texto or f"O comando falhou (código {resultado.returncode})."


def localizar_ferramenta(nome: str) -> Optional[str]:
    """Procura adb/fastboot primeiro na pasta do programa e depois no PATH."""
    executavel = nome + (".exe" if os.name == "nt" else "")
    local = PASTA_PLATFORM_TOOLS / executavel
    if local.is_file():
        return str(local)
    return shutil.which(nome)


class Celular:
    """Envia comandos para o(s) celular(es) conectado(s) ao PC."""

    def __init__(self, adb: str, fastboot: Optional[str] = None):
        self.adb_exe = adb
        self.fastboot_exe = fastboot

    @classmethod
    def localizar(cls) -> "Celular":
        adb = localizar_ferramenta("adb")
        if not adb:
            raise ErroADB(
                "O ADB não foi encontrado. Clique em \"Baixar ferramentas\" para "
                "baixar o Android Platform Tools do site do Google."
            )
        return cls(adb, localizar_ferramenta("fastboot"))

    # --- comandos básicos -------------------------------------------------

    def _adb(self, *argumentos: str, serial: Optional[str] = None,
             timeout: Optional[float] = 60, verificar: bool = True) -> subprocess.CompletedProcess:
        comando = [self.adb_exe] + (["-s", serial] if serial else []) + list(argumentos)
        resultado = _executar(comando, timeout)
        if verificar and resultado.returncode != 0:
            raise ErroADB(_mensagem_de_erro_adb(resultado))
        return resultado

    def _fastboot(self, *argumentos: str, serial: Optional[str] = None,
                  timeout: Optional[float] = 60, verificar: bool = True) -> subprocess.CompletedProcess:
        if not self.fastboot_exe:
            raise ErroADB("O fastboot não foi encontrado. Clique em \"Baixar ferramentas\".")
        comando = [self.fastboot_exe] + (["-s", serial] if serial else []) + list(argumentos)
        resultado = _executar(comando, timeout)
        if verificar and resultado.returncode != 0:
            texto = (resultado.stderr or resultado.stdout or "").strip()
            raise ErroADB(f"O fastboot retornou um erro:\n{texto}")
        return resultado

    def iniciar_servidor(self) -> None:
        # O servidor do ADB é iniciado sem capturar a saída: assim o processo que
        # fica rodando em segundo plano não segura a saída dos próximos comandos.
        try:
            subprocess.run([self.adb_exe, "start-server"], stdin=subprocess.DEVNULL,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=30, **_opcoes_subprocess())
        except (OSError, subprocess.TimeoutExpired) as erro:
            raise ErroADB(f"Não foi possível iniciar o ADB: {erro}") from erro

    def parar_servidor(self) -> None:
        try:
            self._adb("kill-server", timeout=15, verificar=False)
        except ErroADB:
            pass

    def shell(self, serial: str, comando: str, timeout: Optional[float] = 60) -> str:
        return self._adb("shell", comando, serial=serial, timeout=timeout).stdout

    # --- informações ------------------------------------------------------

    def listar_aparelhos(self) -> list[Aparelho]:
        self.iniciar_servidor()
        aparelhos = interpretar_adb_devices(self._adb("devices", "-l").stdout)
        if self.fastboot_exe:
            resultado = self._fastboot("devices", timeout=15, verificar=False)
            aparelhos += interpretar_fastboot_devices(resultado.stdout)
        return aparelhos

    def informacoes(self, serial: str) -> InfoAparelho:
        propriedades = interpretar_getprop(self.shell(serial, "getprop"))
        info = InfoAparelho(
            fabricante=_primeira_maiuscula(propriedades.get("ro.product.manufacturer", "")),
            modelo=propriedades.get("ro.product.model", ""),
            versao_android=propriedades.get("ro.build.version.release", ""),
        )
        try:
            info.bateria = interpretar_bateria(self.shell(serial, "dumpsys battery"))
        except ErroADB:
            pass
        try:
            info.contas_google = interpretar_contas_google(self.shell(serial, "dumpsys account"))
        except ErroADB:
            pass
        return info

    def pasta_existe(self, serial: str, caminho: str) -> bool:
        resultado = self._adb("shell", f'test -d "{caminho}" && echo SIM',
                              serial=serial, verificar=False)
        return "SIM" in resultado.stdout

    # --- backup -----------------------------------------------------------

    def fazer_backup(self, serial: str, destino: Path, log: Log) -> tuple[int, list[str]]:
        """Copia as pastas de PASTAS_BACKUP para o PC. Retorna (copiadas, falhas)."""
        destino.mkdir(parents=True, exist_ok=True)
        copiadas, falhas = 0, []
        for descricao, origem, nome_local in PASTAS_BACKUP:
            if not self.pasta_existe(serial, origem):
                continue
            log(f"Copiando {descricao} ({origem})... pode demorar.")
            # -a mantém a data original dos arquivos (importante para fotos).
            resultado = self._adb("pull", "-a", origem, str(destino / nome_local),
                                  serial=serial, timeout=None, verificar=False)
            if resultado.returncode == 0:
                copiadas += 1
                log(f"  ✔ {_ultima_linha(resultado.stdout) or 'copiado'}")
            else:
                falhas.append(descricao)
                log(f"  ⚠ Problema ao copiar {descricao}: {_mensagem_de_erro_adb(resultado)}")
        return copiadas, falhas

    # --- formatação -------------------------------------------------------

    def reiniciar_no_recovery(self, aparelho: Aparelho) -> None:
        if aparelho.em_fastboot:
            self._fastboot("reboot", "recovery", serial=aparelho.serial)
        else:
            self._adb("reboot", "recovery", serial=aparelho.serial)

    def bootloader_desbloqueado(self, serial: str) -> Optional[bool]:
        for variavel in ("unlocked", "device-state"):
            resultado = self._fastboot("getvar", variavel, serial=serial,
                                       timeout=20, verificar=False)
            # O fastboot escreve as respostas do getvar na saída de erro.
            estado = interpretar_bootloader_desbloqueado(resultado.stderr + resultado.stdout)
            if estado is not None:
                return estado
        return None

    def aguardar_fastboot(self, serial: str, limite_segundos: float = 90) -> str:
        """Espera o celular aparecer no modo fastboot e devolve o serial dele."""
        fim = time.monotonic() + limite_segundos
        while time.monotonic() < fim:
            resultado = self._fastboot("devices", timeout=15, verificar=False)
            encontrados = [a.serial for a in interpretar_fastboot_devices(resultado.stdout)]
            if serial in encontrados:
                return serial
            if len(encontrados) == 1:
                return encontrados[0]
            time.sleep(2)
        raise ErroADB(
            "O celular não apareceu no modo fastboot. Nada foi apagado.\n\n"
            "• Samsung não tem fastboot: use o método Recovery.\n"
            "• No Windows, pode faltar o driver USB do fabricante.\n"
            "Para sair dessa tela, segure o botão LIGA/DESLIGA por uns 10 segundos."
        )

    def formatar_via_fastboot(self, aparelho: Aparelho, log: Log) -> None:
        serial = aparelho.serial
        if not aparelho.em_fastboot:
            if not self.fastboot_exe:
                raise ErroADB("O fastboot não foi encontrado. Clique em \"Baixar ferramentas\".")
            log("Reiniciando o celular no modo fastboot (bootloader)...")
            self._adb("reboot", "bootloader", serial=serial)
            serial = self.aguardar_fastboot(serial)
            log(f"Celular em modo fastboot ({serial}).")

        desbloqueado = self.bootloader_desbloqueado(serial)
        if desbloqueado is False:
            log("Bootloader bloqueado. Reiniciando o celular normalmente...")
            self._fastboot("reboot", serial=serial, verificar=False)
            raise ErroADB(
                "O bootloader deste celular está BLOQUEADO, então o fastboot não pode "
                "apagar os dados. Nada foi apagado.\n\nUse o método \"Recovery\"."
            )
        if desbloqueado is None:
            log("Não deu para confirmar se o bootloader está desbloqueado. Tentando mesmo assim...")

        log("Apagando os dados do celular (fastboot -w)...")
        try:
            resultado = self._fastboot("-w", serial=serial, timeout=600)
        except ErroADB:
            self._fastboot("reboot", serial=serial, verificar=False)
            raise
        for linha in (resultado.stderr + resultado.stdout).splitlines():
            if linha.strip():
                log(f"  {linha.strip()}")
        log("Reiniciando o celular...")
        self._fastboot("reboot", serial=serial)


# ---------------------------------------------------------------------------
# Download do Android Platform Tools (adb + fastboot)
# ---------------------------------------------------------------------------

def baixar_platform_tools(progresso: Optional[Callable[[int], None]] = None) -> Path:
    """Baixa e extrai o Platform Tools oficial do Google na pasta do programa."""
    sistema = platform.system()
    url = URLS_PLATFORM_TOOLS.get(sistema)
    if not url:
        raise ErroADB(f"Sistema operacional não suportado: {sistema}")

    destino = PASTA_PLATFORM_TOOLS.parent
    ultimo_percentual = -1

    def ao_receber(blocos: int, tamanho_bloco: int, total: int) -> None:
        nonlocal ultimo_percentual
        if progresso and total > 0:
            percentual = min(100, blocos * tamanho_bloco * 100 // total)
            if percentual != ultimo_percentual:
                ultimo_percentual = percentual
                progresso(percentual)

    try:
        with tempfile.TemporaryDirectory() as pasta_temporaria:
            arquivo = Path(pasta_temporaria) / "platform-tools.zip"
            urllib.request.urlretrieve(url, arquivo, ao_receber)
            with zipfile.ZipFile(arquivo) as zip_baixado:
                zip_baixado.extractall(destino)
                if os.name != "nt":
                    _restaurar_permissoes(zip_baixado, destino)
    except (OSError, zipfile.BadZipFile) as erro:
        raise ErroADB(f"Não foi possível baixar as ferramentas: {erro}") from erro

    if not localizar_ferramenta("adb"):
        raise ErroADB("O download terminou, mas o adb não foi encontrado na pasta platform-tools.")
    return PASTA_PLATFORM_TOOLS


def _restaurar_permissoes(zip_baixado: zipfile.ZipFile, destino: Path) -> None:
    # O zipfile do Python não mantém a permissão de execução (Linux/macOS).
    raiz = destino.resolve()
    for item in zip_baixado.infolist():
        modo = (item.external_attr >> 16) & 0o777
        caminho = (destino / item.filename).resolve()
        if modo and raiz in caminho.parents and caminho.is_file():
            os.chmod(caminho, modo)
