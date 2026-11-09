"""Otimizações do Windows, cada uma é um script curto do PowerShell.

Só entram ajustes seguros e que dá para desfazer. Ficaram de fora de
propósito coisas que costumam dar problema: desligar o Windows Defender,
o Windows Update ou o UAC, "limpadores de registro" e remoção forçada de
apps do sistema.
"""

from __future__ import annotations

from dataclasses import dataclass

from .executor import Executor


@dataclass
class Otimizacao:
    id: str
    nome: str
    descricao: str
    script: str
    depois_dos_programas: bool = False
    marcado: bool = True


# Funções que todos os scripts podem usar.
_AJUDANTES = r"""
$ErrorActionPreference = 'Stop'
function Set-Reg([string]$Caminho, [string]$Nome, $Valor, [string]$Tipo = 'DWord') {
    if (-not (Test-Path $Caminho)) { New-Item -Path $Caminho -Force | Out-Null }
    Set-ItemProperty -Path $Caminho -Name $Nome -Value $Valor -Type $Tipo -Force
}
"""

OTIMIZACOES = [
    Otimizacao(
        id="ponto_restauracao",
        nome="Criar ponto de restauração",
        descricao="Um 'backup' das configurações do Windows antes de mexer em tudo. Se algo der errado, dá pra voltar.",
        script=r"""
Enable-ComputerRestore -Drive "$env:SystemDrive\"
# Por padrão o Windows só deixa criar um ponto a cada 24 horas.
Set-Reg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore' 'SystemRestorePointCreationFrequency' 0
Checkpoint-Computer -Description 'Antes da pos-formatacao' -RestorePointType 'MODIFY_SETTINGS'
""",
    ),
    Otimizacao(
        id="energia",
        nome="Plano de energia Alto desempenho",
        descricao="O processador não fica economizando energia. Em notebook gasta mais bateria.",
        script=r"""
$alto = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
# Programas de fora (como o powercfg) avisam erro pelo código de saída.
$ErrorActionPreference = 'Continue'
powercfg /setactive $alto *> $null
if ($LASTEXITCODE -ne 0) {
    # Em alguns PCs o plano vem escondido, então cria uma cópia dele.
    $saida = powercfg /duplicatescheme $alto 2>&1
    if ("$saida" -match '([0-9a-fA-F-]{36})') { powercfg /setactive $Matches[1] *> $null }
}
if ($LASTEXITCODE -ne 0) { throw 'Não consegui ativar o plano Alto desempenho.' }
""",
    ),
    Otimizacao(
        id="jogos",
        nome="Ajustes para jogos",
        descricao="Liga o Modo de Jogo e desliga a gravação em segundo plano do Xbox Game Bar, que pesa no FPS.",
        script=r"""
Set-Reg 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled' 1
Set-Reg 'HKCU:\Software\Microsoft\GameBar' 'AllowAutoGameMode' 1
Set-Reg 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled' 0
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled' 0
""",
    ),
    Otimizacao(
        id="mouse",
        nome="Desligar aceleração do mouse",
        descricao="Desmarca 'Aumentar precisão do ponteiro'. A mira fica igual não importa a velocidade do movimento.",
        script=r"""
Set-Reg 'HKCU:\Control Panel\Mouse' 'MouseSpeed' '0' 'String'
Set-Reg 'HKCU:\Control Panel\Mouse' 'MouseThreshold1' '0' 'String'
Set-Reg 'HKCU:\Control Panel\Mouse' 'MouseThreshold2' '0' 'String'
""",
    ),
    Otimizacao(
        id="anuncios",
        nome="Desligar anúncios e sugestões",
        descricao="Tira propagandas do menu Iniciar, dicas e apps que o Windows instala sozinho.",
        script=r"""
$cdm = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
foreach ($nome in 'SilentInstalledAppsEnabled', 'SystemPaneSuggestionsEnabled', 'SoftLandingEnabled',
                  'SubscribedContent-338388Enabled', 'SubscribedContent-338389Enabled',
                  'SubscribedContent-353694Enabled', 'SubscribedContent-353696Enabled') {
    Set-Reg $cdm $nome 0
}
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' 'Enabled' 0
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'Start_IrisRecommendations' 0
""",
    ),
    Otimizacao(
        id="bing",
        nome="Tirar o Bing da pesquisa do Iniciar",
        descricao="A pesquisa do menu Iniciar procura só no seu PC, sem resultados da internet.",
        script=r"""
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' 'BingSearchEnabled' 0
Set-Reg 'HKCU:\Software\Policies\Microsoft\Windows\Explorer' 'DisableSearchBoxSuggestions' 1
""",
    ),
    Otimizacao(
        id="telemetria",
        nome="Reduzir telemetria",
        descricao="Desliga o serviço que envia dados de uso para a Microsoft (DiagTrack).",
        script=r"""
Stop-Service -Name DiagTrack -Force -ErrorAction SilentlyContinue
Set-Service -Name DiagTrack -StartupType Disabled
""",
    ),
    Otimizacao(
        id="extensoes",
        nome="Mostrar extensões de arquivos",
        descricao="Mostra o .exe, .pdf, .jpg no nome dos arquivos. Ajuda a não abrir vírus disfarçado.",
        script=r"""
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'HideFileExt' 0
""",
    ),
    Otimizacao(
        id="limpeza",
        nome="Limpar arquivos temporários",
        descricao="Apaga o que sobrou dos instaladores. Roda no final, depois dos programas.",
        depois_dos_programas=True,
        script=r"""
# As pastas _MEI* são deste próprio app enquanto ele está aberto, então ficam.
foreach ($pasta in $env:TEMP, "$env:windir\Temp") {
    Get-ChildItem -Path $pasta -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike '_MEI*' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
""",
    ),
]


def script_completo(otimizacao: Otimizacao) -> str:
    return (
        _AJUDANTES
        + "try {\n"
        + otimizacao.script.strip()
        + "\n} catch {\n"
        + "    Write-Output ('ERRO: ' + $_.Exception.Message)\n"
        + "    exit 1\n"
        + "}\n"
        + "exit 0\n"
    )


def aplicar(otimizacao: Otimizacao, executor: Executor) -> bool:
    resultado = executor.powershell(
        script_completo(otimizacao), resumo=f"aplicaria: {otimizacao.nome}"
    )
    if not resultado.ok:
        executor.log(f"  Erro: {resultado.ultimas_linhas(2) or resultado.codigo}")
    return resultado.ok
