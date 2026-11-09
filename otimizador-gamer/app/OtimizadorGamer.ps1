<#
    OTIMIZADOR GAMER
    -----------------------------------------------------------------------
    Ferramenta portátil (roda do pendrive, sem instalar nada) para deixar o
    Windows mais leve e estável para jogos como Fortnite, CS2 e LoL.

    Regras que este programa segue:
      * Nenhum arquivo pessoal é apagado.
      * Tudo que ele muda no registro/plano de energia é salvo em backup
        (pasta Dados\Backups) e pode ser desfeito pelo menu "Desfazer".
      * Nada de "tweak milagroso": só ajustes conhecidos, seguros e reversíveis.
      * Sempre mostra o que vai fazer e pede confirmação antes.

    Como abrir: dê dois cliques em INICIAR.bat (na pasta acima desta).
#>

#Requires -Version 5.1

$ErrorActionPreference = 'Continue'
$Script:Versao = '1.0'

# =====================================================================
#  INÍCIO: precisa ser Windows e rodar como administrador
# =====================================================================
if ($env:OS -ne 'Windows_NT') {
    Write-Host 'Este programa só funciona no Windows.' -ForegroundColor Red
    exit 1
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host 'Pedindo permissão de administrador...' -ForegroundColor Yellow
    try {
        $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $PSCommandPath))
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argumentos -ErrorAction Stop
    } catch {
        Write-Host ''
        Write-Host 'Sem permissão de administrador o otimizador não consegue aplicar as mudanças.' -ForegroundColor Red
        Write-Host 'Abra de novo e clique em "Sim" na janela do Windows.' -ForegroundColor Red
        Read-Host 'Pressione ENTER para sair' | Out-Null
    }
    exit 0
}

# =====================================================================
#  PASTAS (relatórios, backups e logs ficam junto do programa no pendrive)
# =====================================================================
$Script:AppDir  = $PSScriptRoot
$Script:RootDir = Split-Path -Parent $PSScriptRoot
$Script:DataDir = Join-Path $Script:RootDir 'Dados'
try {
    $null = New-Item -ItemType Directory -Path $Script:DataDir -Force -ErrorAction Stop
    $teste = Join-Path $Script:DataDir '.teste_gravacao'
    [IO.File]::WriteAllText($teste, 'ok')
    Remove-Item -LiteralPath $teste -Force
} catch {
    # Pendrive protegido contra gravação: usa a pasta Documentos
    $Script:DataDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'OtimizadorGamer'
    $null = New-Item -ItemType Directory -Path $Script:DataDir -Force
}
$Script:ReportDir = Join-Path $Script:DataDir 'Relatorios'
$Script:BackupDir = Join-Path $Script:DataDir 'Backups'
$Script:LogDir    = Join-Path $Script:DataDir 'Logs'
foreach ($d in @($Script:ReportDir, $Script:BackupDir, $Script:LogDir)) {
    $null = New-Item -ItemType Directory -Path $d -Force -ErrorAction SilentlyContinue
}

# Arquivos baixados da internet ficam "bloqueados"; libera os do próprio programa
Get-ChildItem -LiteralPath $Script:AppDir -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

$Script:Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
try {
    $logArq = Join-Path $Script:LogDir ('log_{0}_{1}.txt' -f $env:COMPUTERNAME, $Script:Stamp)
    Start-Transcript -Path $logArq -ErrorAction Stop | Out-Null
} catch {}

try { $Host.UI.RawUI.WindowTitle = ('Otimizador Gamer v{0}' -f $Script:Versao) } catch {}

# =====================================================================
#  CONSTANTES
# =====================================================================
$Script:GuidRx           = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
$Script:PlanoAlto        = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
$Script:PlanoEquilibrado = '381b4222-f694-41f0-9685-ff5bb260df2e'
$Script:PlanoEconomia    = 'a1841308-3541-4fab-bc81-f71556f20b4a'

# Só pastas com estes nomes no final podem ser esvaziadas (trava de segurança)
$Script:PastasPermitidas = '\\(Temp|Download|DXCache|DxcCache|GLCache|VkCache|D3DSCache|NV_Cache|ReportArchive|ReportQueue)$'

$Script:RxOtimizadores = 'Advanced SystemCare|IObit|Driver Booster|Smart Defrag|Wise Care|Wise Game Booster|Wise Registry|Razer Cortex|CCleaner|Glary|Auslogics|WinOptimizer|Avast Cleanup|AVG TuneUp|PC Optimizer|Driver Easy|DriverPack|Driver Support|Outbyte|Systweak|Advanced PC Cleanup|System Mechanic|Game Fire|Game Booster|Reimage|Restoro|Fortect'
$Script:RxIndesejados  = 'OneLaunch|Wave Browser|Shift Browser|WebNavigator|Web Companion|ByteFence|Segurazo|SAntivirus|Search Protect|MyWebSearch|Hola VPN|Baidu|KMSpico|KMSAuto|PC App Store|Driver Updater'
$Script:RxAntivirus    = 'McAfee|Norton|Avast|AVG |Kaspersky|Bitdefender|ESET|Avira|Panda Dome|TotalAV|Total AV|PC Matic|Webroot|360 Total Security'
$Script:RxSegundoPlano = 'chrome|msedge|firefox|opera|brave|iCUE|ArmouryCrate|LightingService|MSI.?Center|NZXT|SignalRgb|OpenRGB|wallpaper32|wallpaper64|Lively|Razer|OneDrive|Teams|Spotify|Discord|steamwebhelper|EpicWebHelper|qbittorrent|uTorrent|Overwolf|Medal'

# Programas de inicialização: o que manter e o que pode ser desligado
$Script:RxInicioManter     = 'SecurityHealth|Windows Defender|RtkAud|Realtek|Nahimic|Waves|vgtray|Vanguard|IAStor|igfx|ctfmon|SynTP|Elan|Wacom|Bluetooth'
$Script:RxInicioDesligavel = 'Spotify|Steam|EpicGamesLauncher|Epic Games|Discord|OneDrive|Teams|Skype|Opera|Chrome|GoogleUpdate|MicrosoftEdgeAutoLaunch|msedge|Brave|Firefox|uTorrent|BitTorrent|qBittorrent|Adobe|CCleaner|Cortana|Zoom|WhatsApp|Telegram|Battle\.net|EADesktop|EA Desktop|Origin|Ubisoft|upc\.exe|GOG Galaxy|RiotClient|Riot Client|Wallpaper|Lively|iTunes|Dropbox|Google Drive|GoogleDriveFS|Lightshot|Overwolf|CurseForge|Medal|Outplayed|Razer Cortex|Advanced SystemCare|IObit|Driver Booster'

# Apps de fábrica que quase ninguém usa. Todos podem ser reinstalados pela Microsoft Store.
# (Xbox, Loja, Fotos, Calculadora, Media Player, Bloco de Notas etc. NÃO estão na lista.)
$Script:ListaBloat = @(
    @{ Id = 'Microsoft.BingNews';                       Nome = 'Notícias (Microsoft Start)' },
    @{ Id = 'Microsoft.BingWeather';                    Nome = 'Clima' },
    @{ Id = 'Microsoft.BingSearch';                     Nome = 'Pesquisa do Bing' },
    @{ Id = 'Microsoft.GetHelp';                        Nome = 'Obter Ajuda' },
    @{ Id = 'Microsoft.Getstarted';                     Nome = 'Dicas' },
    @{ Id = 'Microsoft.MicrosoftSolitaireCollection';   Nome = 'Microsoft Solitaire Collection' },
    @{ Id = 'Microsoft.People';                         Nome = 'Pessoas' },
    @{ Id = 'Microsoft.WindowsFeedbackHub';             Nome = 'Hub de Comentários' },
    @{ Id = 'Microsoft.ZuneVideo';                      Nome = 'Filmes e TV' },
    @{ Id = 'Microsoft.MicrosoftOfficeHub';             Nome = 'Microsoft 365 / Office (atalho com propaganda)' },
    @{ Id = 'Microsoft.SkypeApp';                       Nome = 'Skype' },
    @{ Id = 'Microsoft.WindowsMaps';                    Nome = 'Mapas' },
    @{ Id = 'Clipchamp.Clipchamp';                      Nome = 'Clipchamp (editor de vídeo)' },
    @{ Id = 'Microsoft.549981C3F5F10';                  Nome = 'Cortana' },
    @{ Id = 'Microsoft.MixedReality.Portal';            Nome = 'Portal de Realidade Misturada' },
    @{ Id = 'Microsoft.Microsoft3DViewer';              Nome = 'Visualizador 3D' },
    @{ Id = 'Microsoft.Print3D';                        Nome = 'Print 3D' },
    @{ Id = 'Microsoft.3DBuilder';                      Nome = '3D Builder' },
    @{ Id = 'Microsoft.OneConnect';                     Nome = 'Planos Móveis' },
    @{ Id = 'Microsoft.Messaging';                      Nome = 'Mensagens' },
    @{ Id = 'Microsoft.Wallet';                         Nome = 'Carteira' },
    @{ Id = 'MicrosoftTeams';                           Nome = 'Microsoft Teams (versão pessoal)' },
    @{ Id = 'MicrosoftCorporationII.MicrosoftFamily';   Nome = 'Microsoft Family' },
    @{ Id = 'Microsoft.PowerAutomateDesktop';           Nome = 'Power Automate' },
    @{ Id = 'Microsoft.Windows.DevHome';                Nome = 'Dev Home' },
    @{ Id = 'king.com.*';                               Nome = 'Jogos da King (Candy Crush etc.)' }
)

# Código C# usado para ler a taxa de atualização (Hz) do monitor
$Script:CodigoTela = @'
using System;
using System.Runtime.InteropServices;
namespace OtimizadorGamer
{
    public static class Tela
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct DEVMODE
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
            public short dmSpecVersion;
            public short dmDriverVersion;
            public short dmSize;
            public short dmDriverExtra;
            public int dmFields;
            public int dmPositionX;
            public int dmPositionY;
            public int dmDisplayOrientation;
            public int dmDisplayFixedOutput;
            public short dmColor;
            public short dmDuplex;
            public short dmYResolution;
            public short dmTTOption;
            public short dmCollate;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
            public short dmLogPixels;
            public int dmBitsPerPel;
            public int dmPelsWidth;
            public int dmPelsHeight;
            public int dmDisplayFlags;
            public int dmDisplayFrequency;
            public int dmICMMethod;
            public int dmICMIntent;
            public int dmMediaType;
            public int dmDitherType;
            public int dmReserved1;
            public int dmReserved2;
            public int dmPanningWidth;
            public int dmPanningHeight;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);

        private static DEVMODE Novo()
        {
            DEVMODE d = new DEVMODE();
            d.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
            return d;
        }

        public static int[] Atual()
        {
            DEVMODE d = Novo();
            if (!EnumDisplaySettings(null, -1, ref d)) { return null; }
            return new int[] { d.dmPelsWidth, d.dmPelsHeight, d.dmDisplayFrequency };
        }

        public static int MaxHz(int largura, int altura)
        {
            int max = 0;
            DEVMODE d = Novo();
            for (int i = 0; EnumDisplaySettings(null, i, ref d); i++)
            {
                if (d.dmPelsWidth == largura && d.dmPelsHeight == altura && d.dmDisplayFrequency > max) { max = d.dmDisplayFrequency; }
            }
            return max;
        }
    }
}
'@

# Código C# usado para aplicar a mudança do mouse na hora (sem reiniciar)
$Script:CodigoMouse = @'
using System;
using System.Runtime.InteropServices;
namespace OtimizadorGamer
{
    public static class Mouse
    {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, int[] pvParam, uint fWinIni);
    }
}
'@

# =====================================================================
#  TELA / INTERFACE
# =====================================================================
function Write-Banner {
    param([string]$Subtitulo = '')
    Clear-Host
    Write-Host ''
    Write-Host '  ==========================================================' -ForegroundColor Cyan
    Write-Host ('    OTIMIZADOR GAMER  v{0}' -f $Script:Versao) -ForegroundColor White
    if ($Subtitulo) { Write-Host ('    {0}' -f $Subtitulo) -ForegroundColor Cyan }
    Write-Host '  ==========================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Step { param([string]$Texto) Write-Host ('  > {0}' -f $Texto) -ForegroundColor White }
function Write-Ok   { param([string]$Texto) Write-Host ('    [OK] {0}' -f $Texto) -ForegroundColor Green }
function Write-Warn { param([string]$Texto) Write-Host ('    [!] {0}' -f $Texto) -ForegroundColor Yellow }
function Write-Fail { param([string]$Texto) Write-Host ('    [ERRO] {0}' -f $Texto) -ForegroundColor Red }
function Write-Info { param([string]$Texto) Write-Host ('    {0}' -f $Texto) -ForegroundColor Gray }

function Wait-Enter {
    Write-Host ''
    Read-Host '  Pressione ENTER para continuar' | Out-Null
}

function Confirm-Choice {
    param([string]$Pergunta, [bool]$PadraoSim = $true)
    $sufixo = '[s/N]'
    if ($PadraoSim) { $sufixo = '[S/n]' }
    while ($true) {
        $r = "$(Read-Host ('  {0} {1}' -f $Pergunta, $sufixo))".Trim().ToLower()
        if ($r -eq '') { return $PadraoSim }
        if ($r -in @('s', 'sim', 'y', 'yes')) { return $true }
        if ($r -in @('n', 'nao', 'não', 'no')) { return $false }
    }
}

# Lista com caixinhas [X]. Os itens são hashtables com: Nome, Desc, Nota, Selecionado.
# Retorna $true se a pessoa escolheu Aplicar, $false se escolheu Voltar.
function Show-Checklist {
    param([string]$Titulo, [string]$Intro, $Itens)
    while ($true) {
        Write-Banner $Titulo
        if ($Intro) {
            foreach ($linha in ($Intro -split "`n")) { Write-Host ('  ' + $linha) -ForegroundColor Gray }
            Write-Host ''
        }
        for ($i = 0; $i -lt $Itens.Count; $i++) {
            $it = $Itens[$i]
            if ($it.Selecionado) {
                Write-Host ('  [X] {0,2}. ' -f ($i + 1)) -ForegroundColor Green -NoNewline
                Write-Host $it.Nome -ForegroundColor White -NoNewline
            } else {
                Write-Host ('  [ ] {0,2}. ' -f ($i + 1)) -ForegroundColor DarkGray -NoNewline
                Write-Host $it.Nome -ForegroundColor Gray -NoNewline
            }
            if ($it.Nota) { Write-Host ('  ({0})' -f $it.Nota) -ForegroundColor Yellow } else { Write-Host '' }
            if ($it.Desc) { Write-Host ('           {0}' -f $it.Desc) -ForegroundColor DarkGray }
        }
        Write-Host ''
        Write-Host '  Digite os números para marcar/desmarcar (ex: 1 3).' -ForegroundColor White
        Write-Host '  [A] Aplicar os marcados   [T] Marcar todos   [N] Desmarcar todos   [V] Voltar sem fazer nada' -ForegroundColor White
        $resp = "$(Read-Host '  Opção')".Trim().ToUpper()
        switch -Regex ($resp) {
            '^A$' { return $true }
            '^V$' { return $false }
            '^T$' { foreach ($x in $Itens) { $x.Selecionado = $true } }
            '^N$' { foreach ($x in $Itens) { $x.Selecionado = $false } }
            default {
                foreach ($tok in ($resp -split '[\s,;]+')) {
                    $n = 0
                    if ([int]::TryParse($tok, [ref]$n) -and $n -ge 1 -and $n -le $Itens.Count) {
                        $Itens[$n - 1].Selecionado = -not $Itens[$n - 1].Selecionado
                    }
                }
            }
        }
    }
}

# =====================================================================
#  UTILITÁRIOS
# =====================================================================
function Format-Bytes {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N1} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N0} MB' -f ($Bytes / 1MB)) }
    return ('{0:N0} KB' -f ($Bytes / 1KB))
}

function Format-Duracao {
    param([TimeSpan]$T)
    if ($T.TotalDays -ge 1) { return ('{0} dia(s) e {1} hora(s)' -f [int][math]::Floor($T.TotalDays), $T.Hours) }
    return ('{0} hora(s) e {1} minuto(s)' -f $T.Hours, $T.Minutes)
}

function Get-Resumido {
    param([string]$Texto, [int]$Max = 60)
    if ($null -eq $Texto) { return '' }
    $t = $Texto.Trim()
    if ($t.Length -le $Max) { return $t }
    return $t.Substring(0, $Max - 3) + '...'
}

function Get-HtmlSeguro {
    param([string]$Texto)
    return [System.Net.WebUtility]::HtmlEncode($Texto)
}

function ConvertTo-Numero {
    param([string]$Texto)
    $v = 0.0
    $limpo = $Texto -replace '[^\d\.\-]', ''
    if ([double]::TryParse($limpo, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$v)) { return $v }
    return $null
}

# Soma o tamanho de uma pasta sem seguir atalhos/junções
function Get-TamanhoPasta {
    param([string]$Caminho)
    $total = [int64]0
    if (-not $Caminho -or -not (Test-Path -LiteralPath $Caminho)) { return $total }
    $pilha = New-Object System.Collections.Stack
    $pilha.Push($Caminho)
    while ($pilha.Count -gt 0) {
        $dir = New-Object IO.DirectoryInfo([string]$pilha.Pop())
        try { $filhos = $dir.GetFileSystemInfos() } catch { continue }
        foreach ($c in $filhos) {
            if (($c.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            if ($c -is [IO.DirectoryInfo]) { $pilha.Push($c.FullName) } else { $total += $c.Length }
        }
    }
    return $total
}

# Apaga o CONTEÚDO de uma pasta (não a pasta). Arquivos em uso são pulados.
function Remove-ConteudoPasta {
    param([string]$Dir)
    $info = New-Object IO.DirectoryInfo($Dir)
    try { $filhos = $info.GetFileSystemInfos() } catch { return }
    foreach ($c in $filhos) {
        $ehLink = (($c.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
        if ($c -is [IO.DirectoryInfo]) {
            # Nunca entra em junções/links: remove só o link
            if (-not $ehLink) { Remove-ConteudoPasta $c.FullName }
            try { [IO.Directory]::Delete($c.FullName, $false) } catch {}
        } else {
            try { $c.Attributes = [IO.FileAttributes]::Normal; $c.Delete() } catch {}
        }
    }
}

function Clear-PastaSegura {
    param([string]$Caminho)
    if ([string]::IsNullOrWhiteSpace($Caminho)) { return }
    try { $cheio = [IO.Path]::GetFullPath($Caminho).TrimEnd('\') } catch { return }
    if ($cheio.Length -lt 10 -or $cheio -notmatch $Script:PastasPermitidas) {
        Write-Warn ('Pasta fora da lista segura, ignorada: {0}' -f $cheio)
        return
    }
    if (-not (Test-Path -LiteralPath $cheio)) { return }
    Remove-ConteudoPasta $cheio
}

function Get-EspacoLivre {
    try {
        $ld = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='{0}'" -f $env:SystemDrive) -ErrorAction Stop
        return [double]$ld.FreeSpace
    } catch { return 0 }
}

# =====================================================================
#  REGISTRO + BACKUP (tudo que muda pode ser desfeito)
# =====================================================================
$Script:BackupFile    = $null
$Script:BackupEntries = New-Object System.Collections.ArrayList
$Script:BackupSeen    = @{}

function Get-RegValue {
    param([string]$Path, [string]$Name)
    try {
        $key = Get-Item -LiteralPath $Path -ErrorAction Stop
        $valor = $key.GetValue($Name, $null)
        # A vírgula impede o PowerShell de "desmontar" valores binários (byte[])
        return ,$valor
    } catch { return $null }
}

function Save-BackupFile {
    if (-not $Script:BackupFile) {
        $Script:BackupFile = Join-Path $Script:BackupDir ('backup_{0}_{1}.json' -f $env:COMPUTERNAME, $Script:Stamp)
    }
    $doc = [ordered]@{
        Programa   = 'Otimizador Gamer'
        Versao     = $Script:Versao
        Computador = $env:COMPUTERNAME
        Usuario    = $env:USERNAME
        Criado     = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss')
        Entradas   = @($Script:BackupEntries)
    }
    $json = ConvertTo-Json -InputObject $doc -Depth 6
    [IO.File]::WriteAllText($Script:BackupFile, $json, (New-Object Text.UTF8Encoding($false)))
}

function Backup-RegValue {
    param([string]$Path, [string]$Name)
    $chave = ('REG|{0}|{1}' -f $Path, $Name).ToLower()
    if ($Script:BackupSeen.ContainsKey($chave)) { return }
    $Script:BackupSeen[$chave] = $true
    $entrada = [ordered]@{ Tipo = 'Registro'; Caminho = $Path; Nome = $Name; Existia = $false; Valor = $null; TipoValor = $null }
    if (Test-Path -LiteralPath $Path) {
        $key = Get-Item -LiteralPath $Path
        if (@($key.GetValueNames()) -contains $Name) {
            $entrada.Existia = $true
            $entrada.TipoValor = $key.GetValueKind($Name).ToString()
            $v = $key.GetValue($Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            if ($v -is [byte[]]) { $entrada.Valor = @($v | ForEach-Object { [int]$_ }) }
            elseif ($v -is [string[]]) { $entrada.Valor = @($v) }
            else { $entrada.Valor = $v }
        }
    }
    [void]$Script:BackupEntries.Add($entrada)
    Save-BackupFile
}

function Set-RegValue {
    param([string]$Path, [string]$Name, $Value, [string]$Type = 'DWord')
    Backup-RegValue -Path $Path -Name $Name
    if (-not (Test-Path -LiteralPath $Path)) { $null = New-Item -Path $Path -Force -ErrorAction Stop }
    $null = New-ItemProperty -LiteralPath $Path -Name $Name -Value $Value -PropertyType $Type -Force -ErrorAction Stop
}

function Backup-PlanoEnergia {
    if ($Script:BackupSeen.ContainsKey('plano')) { return }
    $Script:BackupSeen['plano'] = $true
    [void]$Script:BackupEntries.Add([ordered]@{ Tipo = 'PlanoEnergia'; Guid = (Get-PlanoAtivo).Guid })
    Save-BackupFile
}

function Reset-SessaoBackup {
    $Script:BackupFile = $null
    $Script:BackupEntries = New-Object System.Collections.ArrayList
    $Script:BackupSeen = @{}
    $Script:Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
}

# =====================================================================
#  PONTO DE RESTAURAÇÃO DO WINDOWS
# =====================================================================
$Script:PontoCriado = $false
$Script:PontoPerguntado = $false

function New-PontoRestauracao {
    Write-Step 'Criando ponto de restauração do Windows (pode levar 1 ou 2 minutos)...'
    $srKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
    $srNome = 'SystemRestorePointCreationFrequency'
    $antigo = Get-RegValue $srKey $srNome
    try {
        Enable-ComputerRestore -Drive ('{0}\' -f $env:SystemDrive) -ErrorAction Stop
        # O Windows só deixa criar 1 ponto a cada 24 h; libera temporariamente
        $null = New-ItemProperty -LiteralPath $srKey -Name $srNome -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
        Checkpoint-Computer -Description 'Otimizador Gamer - antes das mudancas' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
        $Script:PontoCriado = $true
        Write-Ok 'Ponto de restauração criado.'
        Write-Info 'Se algo der muito errado: Iniciar > digite "Criar um ponto de restauração" > Restauração do Sistema.'
    } catch {
        Write-Warn ('Não deu para criar o ponto de restauração: {0}' -f $_.Exception.Message)
        Write-Info 'Tudo bem: as mudanças deste programa têm backup próprio (menu D - Desfazer).'
    } finally {
        if ($null -eq $antigo) { Remove-ItemProperty -LiteralPath $srKey -Name $srNome -ErrorAction SilentlyContinue }
        else { $null = New-ItemProperty -LiteralPath $srKey -Name $srNome -Value $antigo -PropertyType DWord -Force -ErrorAction SilentlyContinue }
    }
}

function Request-PontoRestauracao {
    if ($Script:PontoCriado -or $Script:PontoPerguntado) { return }
    $Script:PontoPerguntado = $true
    Write-Host ''
    if (Confirm-Choice 'Criar um ponto de restauração do Windows antes? (recomendado)' $true) { New-PontoRestauracao }
}

# =====================================================================
#  PLANO DE ENERGIA
# =====================================================================
function Get-PlanoAtivo {
    $saida = (& powercfg.exe /getactivescheme 2>$null) | Out-String
    $guid = $null
    $nome = ''
    if ($saida -match $Script:GuidRx) { $guid = $Matches[0].ToLower() }
    if ($saida -match '\(([^)]+)\)') { $nome = $Matches[1].Trim() }
    return [pscustomobject]@{ Guid = $guid; Nome = $nome }
}

function Test-PlanoAlto {
    $g = (Get-PlanoAtivo).Guid
    return ($g -and $g -ne $Script:PlanoEquilibrado -and $g -ne $Script:PlanoEconomia)
}

function Set-PlanoAlto {
    Backup-PlanoEnergia
    & powercfg.exe /setactive $Script:PlanoAlto 2>$null | Out-Null
    if ((Get-PlanoAtivo).Guid -eq $Script:PlanoAlto) { return }
    # O plano pode estar escondido: procura uma cópia existente ou cria uma
    $guid = $null
    $copia = (& powercfg.exe /list 2>$null) | Where-Object { $_ -match 'Alto desempenho|High performance' } | Select-Object -First 1
    if ($copia -and ($copia -match $Script:GuidRx)) { $guid = $Matches[0] }
    else {
        $saida = (& powercfg.exe -duplicatescheme $Script:PlanoAlto 2>$null) | Out-String
        if ($saida -match $Script:GuidRx) { $guid = $Matches[0] }
    }
    if (-not $guid) { throw 'Não foi possível ativar o plano Alto desempenho.' }
    & powercfg.exe /setactive $guid 2>$null | Out-Null
}

# =====================================================================
#  OTIMIZAÇÕES (cada uma tem um teste "já está aplicado?" e a aplicação)
# =====================================================================
function Test-ModoJogo {
    $v = Get-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
    return ($null -eq $v -or $v -ne 0)
}
function Set-ModoJogo {
    Set-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled' 1
    Set-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AllowAutoGameMode' 1
}

function Test-SemGravacao {
    $a = Get-RegValue 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
    $b = Get-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled'
    return ($a -eq 0 -and $b -eq 0)
}
function Set-SemGravacao {
    Set-RegValue 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled' 0
    Set-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled' 0
    Set-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'HistoricalCaptureEnabled' 0
}

function Test-JanelaOtimizada {
    $v = [string](Get-RegValue 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' 'DirectXUserGlobalSettings')
    return ($v -match 'SwapEffectUpgradeEnable=1')
}
function Set-JanelaOtimizada {
    $k = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
    $n = 'DirectXUserGlobalSettings'
    $atual = [string](Get-RegValue $k $n)
    $pares = [ordered]@{}
    foreach ($parte in $atual.Split(';')) {
        if ($parte -match '^\s*([^=]+?)\s*=\s*(.*?)\s*$') { $pares[$Matches[1]] = $Matches[2] }
    }
    $pares['SwapEffectUpgradeEnable'] = '1'
    $novo = (($pares.Keys | ForEach-Object { '{0}={1}' -f $_, $pares[$_] }) -join ';') + ';'
    Set-RegValue $k $n $novo 'String'
}

function Test-MouseSemAceleracao {
    return ([string](Get-RegValue 'HKCU:\Control Panel\Mouse' 'MouseSpeed') -eq '0')
}
function Set-MouseSemAceleracao {
    $k = 'HKCU:\Control Panel\Mouse'
    Set-RegValue $k 'MouseSpeed' '0' 'String'
    Set-RegValue $k 'MouseThreshold1' '0' 'String'
    Set-RegValue $k 'MouseThreshold2' '0' 'String'
    try {
        if (-not ('OtimizadorGamer.Mouse' -as [type])) { Add-Type -TypeDefinition $Script:CodigoMouse -ErrorAction Stop }
        $t = 'OtimizadorGamer.Mouse' -as [type]
        # SPI_SETMOUSE = 4 ; SPIF_UPDATEINIFILE | SPIF_SENDCHANGE = 3
        [void]$t::SystemParametersInfo(4, 0, [int[]]@(0, 0, 0), 3)
    } catch {}
}

function Test-SemTeclasAderentes {
    return ([string](Get-RegValue 'HKCU:\Control Panel\Accessibility\StickyKeys' 'Flags') -eq '506')
}
function Set-SemTeclasAderentes {
    Set-RegValue 'HKCU:\Control Panel\Accessibility\StickyKeys' 'Flags' '506' 'String'
    Set-RegValue 'HKCU:\Control Panel\Accessibility\Keyboard Response' 'Flags' '122' 'String'
    Set-RegValue 'HKCU:\Control Panel\Accessibility\ToggleKeys' 'Flags' '58' 'String'
}

function Test-SemInicioRapido {
    return ((Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled') -eq 0)
}
function Set-SemInicioRapido {
    Set-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled' 0
}

function Test-SemAppsPatrocinados {
    return ((Get-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' 'SilentInstalledAppsEnabled') -eq 0)
}
function Set-SemAppsPatrocinados {
    $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
    foreach ($n in @('SilentInstalledAppsEnabled', 'PreInstalledAppsEnabled', 'OemPreInstalledAppsEnabled', 'SystemPaneSuggestionsEnabled', 'SoftLandingEnabled', 'SubscribedContent-338388Enabled', 'SubscribedContent-338389Enabled', 'SubscribedContent-310093Enabled')) {
        Set-RegValue $k $n 0
    }
}

function Test-Hags {
    return ((Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode') -eq 2)
}
function Set-Hags {
    Set-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2
}

function Get-ListaOtimizacoes {
    $build = 0
    try { $build = [int](Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).BuildNumber } catch {}

    $lista = New-Object System.Collections.ArrayList
    [void]$lista.Add(@{
        Nome = 'Plano de energia "Alto desempenho"'
        Desc = 'O processador para de economizar energia no meio do jogo (menos quedas rápidas de FPS). Gasta um pouco mais de luz.'
        Recomendado = $true; Testar = { Test-PlanoAlto }; Aplicar = { Set-PlanoAlto }
    })
    [void]$lista.Add(@{
        Nome = 'Modo de Jogo do Windows ligado'
        Desc = 'O Windows dá prioridade ao jogo e evita instalar atualizações/drivers enquanto você joga.'
        Recomendado = $true; Testar = { Test-ModoJogo }; Aplicar = { Set-ModoJogo }
    })
    [void]$lista.Add(@{
        Nome = 'Desligar a gravação automática da Xbox Game Bar'
        Desc = 'Gravar a tela em segundo plano custa FPS. A Game Bar continua abrindo (Win+G). Desmarque se você grava clipes por ela.'
        Recomendado = $true; Testar = { Test-SemGravacao }; Aplicar = { Set-SemGravacao }
    })
    if ($build -ge 22621) {
        [void]$lista.Add(@{
            Nome = 'Otimizações para jogos em janela (Windows 11)'
            Desc = 'Menos atraso e mais estabilidade em jogos no modo "tela cheia em janela" (comum no Fortnite e LoL).'
            Recomendado = $true; Testar = { Test-JanelaOtimizada }; Aplicar = { Set-JanelaOtimizada }
        })
    }
    [void]$lista.Add(@{
        Nome = 'Desligar a aceleração do mouse ("Aumentar precisão do ponteiro")'
        Desc = 'A mira passa a andar sempre igual ao movimento da mão (1:1). Padrão de quem joga CS e Fortnite.'
        Recomendado = $true; Testar = { Test-MouseSemAceleracao }; Aplicar = { Set-MouseSemAceleracao }
    })
    [void]$lista.Add(@{
        Nome = 'Desligar o atalho de "Teclas de Aderência" (Shift 5 vezes)'
        Desc = 'Evita aquela janela que aparece no meio da partida quando você aperta Shift várias vezes.'
        Recomendado = $true; Testar = { Test-SemTeclasAderentes }; Aplicar = { Set-SemTeclasAderentes }
    })
    [void]$lista.Add(@{
        Nome = 'Desligar a "Inicialização rápida"'
        Desc = 'Faz o "Desligar" zerar o Windows de verdade (limpa memória e drivers travados). O PC pode ligar alguns segundos mais devagar.'
        Recomendado = $true; Testar = { Test-SemInicioRapido }; Aplicar = { Set-SemInicioRapido }
    })
    [void]$lista.Add(@{
        Nome = 'Impedir que o Windows instale apps patrocinados e mostre sugestões'
        Desc = 'Evita que Candy Crush e companhia voltem sozinhos e tira propagandas do menu Iniciar.'
        Recomendado = $true; Testar = { Test-SemAppsPatrocinados }; Aplicar = { Set-SemAppsPatrocinados }
    })
    if ($build -ge 19041) {
        [void]$lista.Add(@{
            Nome = 'Ligar o "Agendamento de GPU acelerado por hardware" (opcional)'
            Desc = 'Em alguns PCs melhora, em outros piora. Teste: se o jogo ficar pior, use o menu Desfazer. Precisa reiniciar.'
            Recomendado = $false; Testar = { Test-Hags }; Aplicar = { Set-Hags }
        })
    }

    foreach ($it in $lista) {
        $ja = $false
        try { $ja = [bool](& $it.Testar) } catch {}
        $it.Nota = ''
        if ($ja) { $it.Nota = 'já está aplicado' }
        $it.Selecionado = ($it.Recomendado -and -not $ja)
        $it
    }
}

function Invoke-Otimizacoes {
    $lista = @(Get-ListaOtimizacoes)
    $intro = "Estes ajustes são seguros e podem ser desfeitos (menu D).`nOs recomendados já vêm marcados. Os que já estão certos no seu PC aparecem como `"já está aplicado`"."
    if (-not (Show-Checklist -Titulo 'Otimizações para jogos' -Intro $intro -Itens $lista)) { return }
    $sel = @($lista | Where-Object { $_.Selecionado })
    if ($sel.Count -eq 0) { Write-Info 'Nada marcado.'; Wait-Enter; return }
    Request-PontoRestauracao
    Write-Host ''
    foreach ($it in $sel) {
        Write-Step $it.Nome
        try { & $it.Aplicar; Write-Ok 'Feito' } catch { Write-Fail $_.Exception.Message }
    }
    Write-Host ''
    Write-Warn 'Algumas mudanças só valem depois de reiniciar o PC.'
    if ($Script:BackupFile) { Write-Info ('Backup das configurações antigas: {0}' -f $Script:BackupFile) }
    Wait-Enter
}

# =====================================================================
#  LIMPEZA
# =====================================================================
function Invoke-Limpeza {
    Write-Banner 'Limpeza de arquivos inúteis'
    Write-Step 'Calculando o tamanho de cada item...'

    $tempUser = $env:TEMP
    $tempWin  = Join-Path $env:SystemRoot 'Temp'
    $wuCache  = Join-Path $env:SystemRoot 'SoftwareDistribution\Download'
    $wer = @(
        (Join-Path $env:ProgramData 'Microsoft\Windows\WER\ReportArchive'),
        (Join-Path $env:ProgramData 'Microsoft\Windows\WER\ReportQueue')
    )
    $shader = @(
        (Join-Path $env:LOCALAPPDATA 'NVIDIA\DXCache'),
        (Join-Path $env:LOCALAPPDATA 'NVIDIA\GLCache'),
        (Join-Path $env:LOCALAPPDATA 'D3DSCache'),
        (Join-Path $env:USERPROFILE 'AppData\LocalLow\NVIDIA\PerDriverVersion\DXCache'),
        (Join-Path $env:USERPROFILE 'AppData\LocalLow\NVIDIA\PerDriverVersion\GLCache'),
        (Join-Path $env:LOCALAPPDATA 'AMD\DxCache'),
        (Join-Path $env:LOCALAPPDATA 'AMD\DxcCache'),
        (Join-Path $env:LOCALAPPDATA 'AMD\GLCache'),
        (Join-Path $env:LOCALAPPDATA 'AMD\VkCache')
    )
    $tamShader = [int64]0
    foreach ($p in $shader) { $tamShader += Get-TamanhoPasta $p }
    $tamWer = [int64]0
    foreach ($p in $wer) { $tamWer += Get-TamanhoPasta $p }
    $lixeira = '{0}\$Recycle.Bin' -f $env:SystemDrive

    $itens = New-Object System.Collections.ArrayList
    [void]$itens.Add(@{ Nome = 'Arquivos temporários do seu usuário'; Desc = 'Sobras de instaladores e programas. Arquivos em uso são pulados.'; Nota = (Format-Bytes (Get-TamanhoPasta $tempUser)); Selecionado = $true; Tipo = 'pasta'; Pastas = @($tempUser) })
    [void]$itens.Add(@{ Nome = 'Arquivos temporários do Windows'; Desc = 'Pasta Windows\Temp.'; Nota = (Format-Bytes (Get-TamanhoPasta $tempWin)); Selecionado = $true; Tipo = 'pasta'; Pastas = @($tempWin) })
    [void]$itens.Add(@{ Nome = 'Relatórios de erro antigos do Windows'; Desc = 'Registros de travamentos que já foram enviados/arquivados.'; Nota = (Format-Bytes $tamWer); Selecionado = $true; Tipo = 'pasta'; Pastas = $wer })
    [void]$itens.Add(@{ Nome = 'Cache de downloads do Windows Update'; Desc = 'Instaladores de atualizações que já foram aplicadas.'; Nota = (Format-Bytes (Get-TamanhoPasta $wuCache)); Selecionado = $true; Tipo = 'wu'; Pastas = @($wuCache) })
    if (Get-Command 'Delete-DeliveryOptimizationCache' -ErrorAction SilentlyContinue) {
        [void]$itens.Add(@{ Nome = 'Cache da Otimização de Entrega'; Desc = 'Cópias de atualizações guardadas para compartilhar com outros PCs.'; Nota = ''; Selecionado = $true; Tipo = 'do' })
    }
    [void]$itens.Add(@{ Nome = 'Limpeza profunda de componentes do Windows (DISM)'; Desc = 'Remove versões antigas de atualizações do sistema. Demora de 5 a 15 minutos.'; Nota = 'demorado'; Selecionado = $false; Tipo = 'dism' })
    [void]$itens.Add(@{ Nome = 'Esvaziar a Lixeira'; Desc = 'Apaga DE VEZ o que está na Lixeira. Só marque se tiver certeza.'; Nota = ('aprox. {0}' -f (Format-Bytes (Get-TamanhoPasta $lixeira))); Selecionado = $false; Tipo = 'lixeira' })
    [void]$itens.Add(@{ Nome = 'Cache de shaders da placa de vídeo (avançado)'; Desc = 'Use só depois de atualizar o driver ou se suspeitar de cache corrompido. As primeiras partidas depois disso TRAVAM MAIS enquanto o cache é refeito.'; Nota = (Format-Bytes $tamShader); Selecionado = $false; Tipo = 'pasta'; Pastas = $shader })

    $intro = "Nada aqui mexe nos seus documentos, fotos, jogos ou saves.`nItens marcados são seguros. Os desmarcados são opcionais (leia a descrição)."
    if (-not (Show-Checklist -Titulo 'Limpeza de arquivos inúteis' -Intro $intro -Itens $itens)) { return }
    $sel = @($itens | Where-Object { $_.Selecionado })
    if ($sel.Count -eq 0) { Write-Info 'Nada marcado.'; Wait-Enter; return }

    Write-Host ''
    $antes = Get-EspacoLivre
    foreach ($it in $sel) {
        Write-Step $it.Nome
        try {
            switch ($it.Tipo) {
                'pasta' {
                    foreach ($p in $it.Pastas) { Clear-PastaSegura $p }
                }
                'wu' {
                    foreach ($s in @('wuauserv', 'bits')) { Stop-Service -Name $s -Force -ErrorAction SilentlyContinue }
                    foreach ($p in $it.Pastas) { Clear-PastaSegura $p }
                    foreach ($s in @('bits', 'wuauserv')) { Start-Service -Name $s -ErrorAction SilentlyContinue }
                }
                'do' {
                    Delete-DeliveryOptimizationCache -Force -ErrorAction Stop | Out-Null
                }
                'dism' {
                    $dism = Join-Path $env:SystemRoot 'System32\Dism.exe'
                    $pr = Start-Process -FilePath $dism -ArgumentList '/Online /Cleanup-Image /StartComponentCleanup' -NoNewWindow -Wait -PassThru
                    if ($pr.ExitCode -ne 0) { throw ('O DISM terminou com o código {0}.' -f $pr.ExitCode) }
                }
                'lixeira' {
                    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
                }
            }
            Write-Ok 'Feito'
        } catch { Write-Fail $_.Exception.Message }
    }
    $ganho = (Get-EspacoLivre) - $antes
    Write-Host ''
    if ($ganho -gt 0) { Write-Ok ('Espaço liberado no {0}: {1}' -f $env:SystemDrive, (Format-Bytes $ganho)) }
    else { Write-Ok 'Limpeza concluída.' }
    Wait-Enter
}

# =====================================================================
#  PROGRAMAS QUE INICIAM COM O WINDOWS
# =====================================================================
function Get-SugestaoInicio {
    param([string]$Texto)
    if ($Texto -match $Script:RxInicioManter) { return 'Manter' }
    if ($Texto -match $Script:RxInicioDesligavel) { return 'Pode desativar' }
    return 'Você decide'
}

function New-ItemInicio {
    param([string]$Nome, [string]$Comando, [string]$Aprov, [string]$Escopo)
    $v = Get-RegValue $Aprov $Nome
    $ativo = $true
    # Mesmo formato do Gerenciador de Tarefas: 1º byte par = ligado, ímpar = desligado
    if ($v -is [byte[]] -and $v.Length -gt 0) { $ativo = (($v[0] -band 1) -eq 0) }
    return [pscustomobject]@{
        Nome = $Nome; Comando = $Comando; Aprov = $Aprov; Escopo = $Escopo; Ativo = $ativo
        Sugestao = (Get-SugestaoInicio ('{0} {1}' -f $Nome, $Comando))
    }
}

function Get-ItensInicio {
    $base = 'Software\Microsoft\Windows\CurrentVersion'
    $fontes = @(
        @{ Run = "HKCU:\$base\Run"; Aprov = "HKCU:\$base\Explorer\StartupApproved\Run"; Escopo = 'Seu usuário' },
        @{ Run = "HKLM:\$base\Run"; Aprov = "HKLM:\$base\Explorer\StartupApproved\Run"; Escopo = 'Todos os usuários' },
        @{ Run = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"; Aprov = "HKLM:\$base\Explorer\StartupApproved\Run32"; Escopo = 'Todos os usuários' }
    )
    foreach ($f in $fontes) {
        if (-not (Test-Path -LiteralPath $f.Run)) { continue }
        $k = Get-Item -LiteralPath $f.Run
        foreach ($n in $k.GetValueNames()) {
            if ([string]::IsNullOrEmpty($n)) { continue }
            New-ItemInicio -Nome $n -Comando ([string]$k.GetValue($n)) -Aprov $f.Aprov -Escopo $f.Escopo
        }
    }
    $pastas = @(
        @{ Dir = [Environment]::GetFolderPath('Startup'); Aprov = "HKCU:\$base\Explorer\StartupApproved\StartupFolder"; Escopo = 'Seu usuário' },
        @{ Dir = [Environment]::GetFolderPath('CommonStartup'); Aprov = "HKLM:\$base\Explorer\StartupApproved\StartupFolder"; Escopo = 'Todos os usuários' }
    )
    foreach ($p in $pastas) {
        if (-not $p.Dir -or -not (Test-Path -LiteralPath $p.Dir)) { continue }
        foreach ($arq in @(Get-ChildItem -LiteralPath $p.Dir -File -Force -ErrorAction SilentlyContinue)) {
            if ($arq.Name -ieq 'desktop.ini') { continue }
            New-ItemInicio -Nome $arq.Name -Comando $arq.FullName -Aprov $p.Aprov -Escopo $p.Escopo
        }
    }
}

function Set-EstadoInicio {
    param($Item, [bool]$Ativo)
    if ($Ativo) {
        $bytes = [byte[]](2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    } else {
        $quando = [BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc())
        $bytes = [byte[]](@(3, 0, 0, 0) + @($quando))
    }
    Set-RegValue -Path $Item.Aprov -Name $Item.Nome -Value $bytes -Type 'Binary'
}

function Invoke-Inicializacao {
    while ($true) {
        Write-Banner 'Programas que iniciam com o Windows'
        Write-Info 'Desligar aqui NÃO desinstala nada: o programa só deixa de abrir sozinho quando o PC liga.'
        Write-Info 'Você continua podendo abrir quando quiser. (É o mesmo que o Gerenciador de Tarefas faz.)'
        Write-Host ''
        $itens = @(Get-ItensInicio | Sort-Object -Property @{ Expression = { $_.Sugestao -ne 'Pode desativar' } }, Nome)
        if ($itens.Count -eq 0) { Write-Info 'Nenhum programa configurado para abrir sozinho.'; Wait-Enter; return }
        for ($i = 0; $i -lt $itens.Count; $i++) {
            $it = $itens[$i]
            Write-Host ('  {0,2}. ' -f ($i + 1)) -NoNewline
            if ($it.Ativo) { Write-Host 'LIGADO    ' -ForegroundColor Green -NoNewline }
            else { Write-Host 'desligado ' -ForegroundColor DarkGray -NoNewline }
            $corNome = 'White'
            if (-not $it.Ativo) { $corNome = 'DarkGray' }
            Write-Host (Get-Resumido $it.Nome 40) -ForegroundColor $corNome -NoNewline
            $corSug = 'Gray'
            if ($it.Sugestao -eq 'Pode desativar') { $corSug = 'Yellow' } elseif ($it.Sugestao -eq 'Manter') { $corSug = 'Cyan' }
            Write-Host ('  [{0}]' -f $it.Sugestao) -ForegroundColor $corSug
            Write-Host ('               {0}' -f (Get-Resumido $it.Comando 90)) -ForegroundColor DarkGray
        }
        Write-Host ''
        Write-Host '  Digite os números para LIGAR/DESLIGAR (ex: 2 5 7)' -ForegroundColor White
        Write-Host '  [R] Desligar todos os "Pode desativar"   [ENTER] Voltar' -ForegroundColor White
        $resp = "$(Read-Host '  Opção')".Trim().ToUpper()
        if ($resp -eq '' -or $resp -eq 'V') { return }
        $alvos = @()
        if ($resp -eq 'R') {
            $alvos = @($itens | Where-Object { $_.Ativo -and $_.Sugestao -eq 'Pode desativar' })
        } else {
            foreach ($tok in ($resp -split '[\s,;]+')) {
                $n = 0
                if ([int]::TryParse($tok, [ref]$n) -and $n -ge 1 -and $n -le $itens.Count) { $alvos += $itens[$n - 1] }
            }
        }
        foreach ($a in $alvos) {
            try {
                Set-EstadoInicio -Item $a -Ativo (-not $a.Ativo)
                $novo = 'ligado'
                if ($a.Ativo) { $novo = 'desligado' }
                Write-Ok ('{0}: {1}' -f $a.Nome, $novo)
            } catch { Write-Fail ('{0}: {1}' -f $a.Nome, $_.Exception.Message) }
        }
        if ($alvos.Count -gt 0) { Start-Sleep -Milliseconds 1200 }
    }
}

# =====================================================================
#  APPS INÚTEIS (BLOATWARE)
# =====================================================================
function Invoke-Bloatware {
    Write-Banner 'Remover apps inúteis que vêm com o Windows'
    Write-Step 'Procurando apps de fábrica...'
    $itens = New-Object System.Collections.ArrayList
    foreach ($b in $Script:ListaBloat) {
        $pk = @(Get-AppxPackage -Name $b.Id -ErrorAction SilentlyContinue)
        if ($pk.Count -gt 0) {
            $nomesPk = (($pk | ForEach-Object { $_.Name } | Select-Object -Unique) -join ', ')
            [void]$itens.Add(@{ Nome = $b.Nome; Desc = $nomesPk; Nota = ''; Selecionado = $true; Pacotes = $pk })
        }
    }
    if ($itens.Count -eq 0) {
        Write-Ok 'Nenhum app inútil da lista foi encontrado. Seu Windows já está limpo nesse ponto.'
        Wait-Enter
        return
    }
    $intro = "Apps que vêm de fábrica e quase ninguém usa. Remover não afeta jogos, Xbox, Loja, Fotos, Calculadora etc.`nSe se arrepender, qualquer um pode ser reinstalado pela Microsoft Store."
    if (-not (Show-Checklist -Titulo 'Remover apps inúteis' -Intro $intro -Itens $itens)) { return }
    $sel = @($itens | Where-Object { $_.Selecionado })
    if ($sel.Count -eq 0) { Write-Info 'Nada marcado.'; Wait-Enter; return }
    Request-PontoRestauracao
    Write-Host ''
    foreach ($it in $sel) {
        Write-Step $it.Nome
        try { $it.Pacotes | Remove-AppxPackage -ErrorAction Stop; Write-Ok 'Removido' } catch { Write-Fail $_.Exception.Message }
    }
    Write-Host ''
    Write-Info 'Dica: a otimização "Impedir que o Windows instale apps patrocinados" (menu 3) evita que eles voltem.'
    Wait-Enter
}

# =====================================================================
#  DIAGNÓSTICO
# =====================================================================
$Script:Achados = New-Object System.Collections.ArrayList
$Script:Secoes  = [ordered]@{}

function Add-Achado {
    param(
        [ValidateSet('Alto', 'Medio', 'Info', 'OK')][string]$Nivel,
        [string]$Titulo,
        [string]$Detalhe = '',
        [string]$Solucao = '',
        [switch]$Manual
    )
    [void]$Script:Achados.Add([pscustomobject]@{
        Nivel = $Nivel; Titulo = $Titulo; Detalhe = $Detalhe; Solucao = $Solucao
        Manual = [bool]$Manual; Ordem = $Script:Achados.Count
    })
}

function Add-Info {
    param([string]$Secao, [string]$Rotulo, $Valor)
    if (-not $Script:Secoes.Contains($Secao)) { $Script:Secoes[$Secao] = New-Object System.Collections.ArrayList }
    [void]$Script:Secoes[$Secao].Add([pscustomobject]@{ Rotulo = $Rotulo; Valor = [string]$Valor })
}

function Get-InfoTela {
    try {
        if (-not ('OtimizadorGamer.Tela' -as [type])) { Add-Type -TypeDefinition $Script:CodigoTela -ErrorAction Stop }
        $t = 'OtimizadorGamer.Tela' -as [type]
        $atual = $t::Atual()
        if ($null -eq $atual -or $atual[2] -le 1) { return $null }
        $max = $t::MaxHz($atual[0], $atual[1])
        return [pscustomobject]@{ Largura = $atual[0]; Altura = $atual[1]; Hz = $atual[2]; MaxHz = [math]::Max($max, $atual[2]) }
    } catch { return $null }
}

function Convert-VersaoNvidia {
    param([string]$Versao)
    $digitos = $Versao -replace '\D', ''
    if ($digitos.Length -ge 5) {
        $f = $digitos.Substring($digitos.Length - 5)
        return ('{0}.{1}' -f $f.Substring(0, 3), $f.Substring(3, 2))
    }
    return $Versao
}

function Get-CanalMemoria {
    param([string]$Texto)
    if ($Texto -match 'Channel\s*([A-D])') { return $Matches[1].ToUpper() }
    if ($Texto -match 'DIMM[_\s-]?([A-D])\d') { return $Matches[1].ToUpper() }
    if ($Texto -match '(?:^|[\s_])([A-D])[12](?:[\s_]|$)') { return $Matches[1].ToUpper() }
    return $null
}

# Tenta descobrir a velocidade anunciada do pente pelo código da peça
function Get-VelocidadePelaPeca {
    param([string]$Peca)
    $p = ([string]$Peca).Trim().ToUpper()
    $mapa = @{ '24' = 2400; '26' = 2666; '28' = 2800; '29' = 2933; '30' = 3000; '32' = 3200; '33' = 3333; '34' = 3466; '36' = 3600; '37' = 3733; '38' = 3866; '40' = 4000; '41' = 4133; '42' = 4266; '44' = 4400; '46' = 4600; '48' = 4800 }
    if ($p -match '^(KF|HX)4(\d{2})C') { if ($mapa.ContainsKey($Matches[2])) { return $mapa[$Matches[2]] } }
    if ($p -match '^KVR(\d{2})') { if ($mapa.ContainsKey($Matches[1])) { return $mapa[$Matches[1]] } }
    if ($p -match '^BL\d+G(\d{2})C') { if ($mapa.ContainsKey($Matches[1])) { return $mapa[$Matches[1]] } }
    if ($p -match '(?<!\d)(2400|2666|2933|3000|3200|3600|4000)(?!\d)') { return [int]$Matches[1] }
    return 0
}

function Test-Ping {
    param([string]$Destino, [int]$Vezes = 20)
    $ping = New-Object System.Net.NetworkInformation.Ping
    $tempos = New-Object System.Collections.Generic.List[double]
    $perdidos = 0
    for ($i = 0; $i -lt $Vezes; $i++) {
        try {
            $r = $ping.Send($Destino, 1000)
            if ($r.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) { $tempos.Add([double]$r.RoundtripTime) } else { $perdidos++ }
        } catch { $perdidos++ }
        Start-Sleep -Milliseconds 150
    }
    $ping.Dispose()
    $perda = [math]::Round(100 * $perdidos / $Vezes)
    if ($tempos.Count -eq 0) { return [pscustomobject]@{ Destino = $Destino; Media = $null; Min = $null; Max = $null; Variacao = $null; Perda = $perda } }
    $media = ($tempos | Measure-Object -Average).Average
    $variacao = 0.0
    for ($i = 1; $i -lt $tempos.Count; $i++) { $variacao += [math]::Abs($tempos[$i] - $tempos[$i - 1]) }
    if ($tempos.Count -gt 1) { $variacao = $variacao / ($tempos.Count - 1) }
    return [pscustomobject]@{
        Destino  = $Destino
        Media    = [math]::Round($media, 1)
        Min      = ($tempos | Measure-Object -Minimum).Minimum
        Max      = ($tempos | Measure-Object -Maximum).Maximum
        Variacao = [math]::Round($variacao, 1)
        Perda    = $perda
    }
}

function Get-ProgramasInstalados {
    $chaves = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    Get-ItemProperty -Path $chaves -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -and $_.SystemComponent -ne 1 } |
        ForEach-Object { ([string]$_.DisplayName).Trim() } |
        Sort-Object -Unique
}

function Invoke-Diagnostico {
    Write-Banner 'Diagnóstico completo (não muda nada no PC)'
    $Script:Achados = New-Object System.Collections.ArrayList
    $Script:Secoes = [ordered]@{}
    $resumo = [ordered]@{ 'Processador' = '?'; 'Placa de vídeo' = '?'; 'Memória' = '?'; 'Windows' = '?' }
    $chipset = ''
    $os = $null
    $cs = $null
    $ligado = $null

    # ---------------- Sistema ----------------
    Write-Step 'Sistema e Windows...'
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
    } catch {}
    if ($os) {
        $build = [int]$os.BuildNumber
        $ver = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'DisplayVersion'
        $ubr = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'UBR'
        $nomeWin = ([string]$os.Caption) -replace '^Microsoft\s+', ''
        $resumo['Windows'] = ('{0} {1}' -f $nomeWin, $ver).Trim()
        Add-Info 'Sistema' 'Windows' ('{0} {1} (build {2}.{3})' -f $nomeWin, $ver, $build, $ubr)
        Add-Info 'Sistema' 'Nome do PC' $env:COMPUTERNAME
        $ligado = (Get-Date) - $os.LastBootUpTime
        Add-Info 'Sistema' 'Tempo desde o último reinício' (Format-Duracao $ligado)
        if ($build -lt 22000) {
            Add-Achado 'Medio' 'Windows 10 não recebe mais atualizações' 'O suporte do Windows 10 terminou em outubro de 2025. Sem atualizações, drivers e jogos novos tendem a dar mais problemas, além do risco de segurança.' 'Processadores Intel de 8ª geração ou mais novos normalmente aceitam o Windows 11: Configurações > Windows Update. Faça backup antes.' -Manual
        }
    }
    try {
        $bb = Get-CimInstance Win32_BaseBoard -ErrorAction Stop
        $bios = Get-CimInstance Win32_BIOS -ErrorAction Stop
        Add-Info 'Sistema' 'Placa-mãe' ('{0} {1}' -f $bb.Manufacturer, $bb.Product)
        $dataBios = ''
        if ($bios.ReleaseDate) { $dataBios = $bios.ReleaseDate.ToString('dd/MM/yyyy') }
        Add-Info 'Sistema' 'BIOS' ('{0} {1}' -f $bios.SMBIOSBIOSVersion, $dataBios)
        if ([string]$bb.Product -match '(?<![A-Za-z0-9])([HBZQhbzq]\d{3})') { $chipset = $Matches[1].ToUpper() }
    } catch {}

    # ---------------- Processador ----------------
    Write-Step 'Processador...'
    try {
        $cpu = @(Get-CimInstance Win32_Processor -ErrorAction Stop)[0]
        $nomeCpu = (([string]$cpu.Name) -replace '\s+', ' ').Trim()
        $resumo['Processador'] = $nomeCpu
        Add-Info 'Processador' 'Modelo' $nomeCpu
        Add-Info 'Processador' 'Núcleos / threads' ('{0} / {1}' -f $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors)
        Add-Info 'Processador' 'Uso no momento (sem jogo)' ('{0}%' -f $cpu.LoadPercentage)
        if ($cpu.LoadPercentage -ge 50) {
            Add-Achado 'Medio' ('Processador com {0}% de uso sem nenhum jogo aberto' -f $cpu.LoadPercentage) 'Algo está rodando em segundo plano e vai disputar o processador com o jogo.' 'Abra o Gerenciador de Tarefas (Ctrl+Shift+Esc) e veja quem está usando a CPU. Rode também a verificação de vírus (menu 8).'
        }
    } catch {}

    # ---------------- Placa de vídeo / monitor ----------------
    Write-Step 'Placa de vídeo e monitor...'
    try {
        $vcs = @(Get-CimInstance Win32_VideoController -ErrorAction Stop)
        if (@($vcs | Where-Object { $_.Name -match 'Microsoft Basic' }).Count -gt 0) {
            Add-Achado 'Alto' 'Driver de vídeo não instalado' 'O Windows está usando o "Adaptador de Vídeo Básico da Microsoft". Os jogos rodam muito mal assim.' 'Instale o driver da placa: nvidia.com/drivers (NVIDIA) ou amd.com/support (AMD).' -Manual
        }
        $gpus = @($vcs | Where-Object { $_.Name -notmatch 'Microsoft Basic|Remote|Virtual|Parsec|Citrix|DisplayLink|Mirror|Hyper-V|Spacedesk|IddSample|Sunshine' })
        $nomes = @()
        foreach ($g in $gpus) {
            $nomes += $g.Name
            $versao = [string]$g.DriverVersion
            if ($g.Name -match 'NVIDIA') { $versao = '{0} (no Windows: {1})' -f (Convert-VersaoNvidia $g.DriverVersion), $g.DriverVersion }
            $dataDrv = '?'
            $idade = $null
            if ($g.DriverDate) { $dataDrv = $g.DriverDate.ToString('dd/MM/yyyy'); $idade = ((Get-Date) - $g.DriverDate).TotalDays }
            Add-Info 'Placa de vídeo' $g.Name ('driver {0}, de {1}' -f $versao, $dataDrv)
            if ($g.Name -match 'NVIDIA|AMD|Radeon|Arc' -and $null -ne $idade) {
                if ($idade -gt 180) {
                    Add-Achado 'Medio' ('Driver de vídeo antigo (cerca de {0} meses)' -f [int]($idade / 30)) ('{0}: driver de {1}. Drivers novos trazem correções de travadas e desempenho para Fortnite, CS2 e outros.' -f $g.Name, $dataDrv) 'Atualize pelo NVIDIA App (ou nvidia.com/drivers) marcando "instalação limpa". Veja o guia, seção Driver NVIDIA.' -Manual
                } else {
                    Add-Achado 'OK' ('Driver de vídeo recente ({0})' -f $dataDrv)
                }
            }
        }
        if ($nomes.Count -gt 0) { $resumo['Placa de vídeo'] = ($nomes -join ' + ') }
    } catch {}
    $tela = Get-InfoTela
    if ($tela) {
        Add-Info 'Placa de vídeo' 'Tela principal' ('{0}x{1} a {2} Hz (máximo disponível nessa resolução: {3} Hz)' -f $tela.Largura, $tela.Altura, $tela.Hz, $tela.MaxHz)
        if ($tela.MaxHz -gt ($tela.Hz + 1)) {
            Add-Achado 'Alto' ('Monitor configurado em {0} Hz, mas ele aceita {1} Hz' -f $tela.Hz, $tela.MaxHz) 'Você está vendo menos quadros do que o monitor consegue mostrar. O jogo parece menos fluido mesmo com FPS alto.' ('Configurações > Sistema > Tela > Tela avançada > "Escolher uma taxa de atualização" > {0} Hz. Use cabo DisplayPort (ou HDMI 2.0 ou mais novo) ligado na placa de vídeo.' -f $tela.MaxHz) -Manual
        } elseif ($tela.MaxHz -le 61) {
            Add-Achado 'Info' 'Monitor de 60 Hz' 'Seu monitor mostra no máximo 60 quadros por segundo. FPS acima disso ainda diminui o atraso, mas você não vê mais quadros.' 'Para jogos competitivos, um monitor de 144 Hz ou mais é o upgrade que mais se sente na fluidez.'
        } else {
            Add-Achado 'OK' ('Monitor na taxa máxima ({0} Hz)' -f $tela.Hz)
        }
    }

    # ---------------- Memória RAM ----------------
    Write-Step 'Memória RAM...'
    try {
        $pentes = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop)
        $totalGB = [math]::Round($cs.TotalPhysicalMemory / 1GB)
        $resumo['Memória'] = ('{0} GB ({1} pente(s))' -f $totalGB, $pentes.Count)
        $canais = @()
        $velCfg = @()
        $velNom = @()
        $dica = 0
        $i = 0
        foreach ($p in $pentes) {
            $i++
            $gb = [math]::Round($p.Capacity / 1GB)
            $cfg = [int]$p.ConfiguredClockSpeed
            $nom = [int]$p.Speed
            if ($cfg -gt 0) { $velCfg += $cfg }
            if ($nom -gt 0) { $velNom += $nom }
            $local = ('{0} {1}' -f $p.BankLabel, $p.DeviceLocator).Trim()
            Add-Info 'Memória RAM' ('Pente {0}' -f $i) ('{0} GB · rodando a {1} MHz (nominal {2}) · {3} {4} · {5}' -f $gb, $cfg, $nom, ([string]$p.Manufacturer).Trim(), ([string]$p.PartNumber).Trim(), $local)
            $c = Get-CanalMemoria $local
            if ($c) { $canais += $c }
            $d = Get-VelocidadePelaPeca ([string]$p.PartNumber)
            if ($d -gt $dica) { $dica = $d }
        }

        if ($pentes.Count -eq 1) {
            Add-Achado 'Alto' 'Memória RAM em canal único (só 1 pente)' ('Com um pente só ({0} GB), a memória trabalha em "single channel", com metade da velocidade de transferência. Em CS2 e Fortnite isso derruba principalmente o FPS mínimo e causa travadinhas.' -f $totalGB) 'Coloque um segundo pente IGUAL (mesma capacidade e velocidade) no slot certo (normalmente A2 e B2; veja o manual da placa). Costuma ser o upgrade mais barato com mais efeito.' -Manual
        } elseif ($pentes.Count -ge 2 -and $canais.Count -eq $pentes.Count -and @($canais | Select-Object -Unique).Count -eq 1) {
            Add-Achado 'Alto' 'Os pentes de RAM parecem estar no mesmo canal' ('Os {0} pentes aparecem no canal {1}. Assim eles podem não estar trabalhando em "dual channel".' -f $pentes.Count, $canais[0]) 'Confira no manual da placa-mãe quais slots usar para dual channel (normalmente A2 e B2, o 2º e o 4º a partir do processador).' -Manual
        } elseif ($pentes.Count -ge 2) {
            Add-Achado 'OK' ('{0} pentes de RAM (dual channel)' -f $pentes.Count)
        }

        $cfgMin = 0
        if ($velCfg.Count -gt 0) { $cfgMin = [int]($velCfg | Measure-Object -Minimum).Minimum }
        $nomMax = 0
        if ($velNom.Count -gt 0) { $nomMax = [int]($velNom | Measure-Object -Maximum).Maximum }
        $alvo = [math]::Max($dica, $nomMax)
        # Algumas placas informam a metade (MHz real em vez de MT/s)
        if ($cfgMin -gt 0 -and $cfgMin -lt 2000 -and $alvo -gt 0 -and [math]::Abs(($cfgMin * 2) - $alvo) -le 100) { $cfgMin = $cfgMin * 2 }
        $notaChipset = ''
        if ($chipset -in @('H410', 'H510', 'H610', 'B460')) { $notaChipset = (' Atenção: placas {0} limitam a velocidade da memória e algumas nem têm a opção XMP.' -f $chipset) }
        if ($cfgMin -gt 0) {
            if ($alvo -gt ($cfgMin + 150)) {
                Add-Achado 'Alto' ('RAM rodando a {0} MHz, mas o pente é de {1} MHz' -f $cfgMin, $alvo) 'O perfil XMP (que libera a velocidade anunciada da memória) está desligado. Isso tira FPS e aumenta as travadinhas, principalmente em jogos que dependem do processador, como CS2 e Fortnite.' ('Entre na BIOS (tecla Delete ou F2 ao ligar) e ative "XMP" / "X.M.P." / "A-XMP" (Perfil 1). Passo a passo no guia.' + $notaChipset) -Manual
            } elseif ($cfgMin -le 2666) {
                Add-Achado 'Medio' ('RAM rodando a {0} MHz' -f $cfgMin) 'Pode ser a velocidade normal do seu pente, ou o XMP pode estar desligado.' ('Veja a etiqueta do pente: se disser 3000/3200 MHz ou mais, ative o XMP na BIOS (passo a passo no guia).' + $notaChipset) -Manual
            } else {
                Add-Achado 'OK' ('RAM rodando a {0} MHz' -f $cfgMin)
            }
        }

        if ($os -and $cs) {
            $livre = [double]$os.FreePhysicalMemory * 1KB
            $usoPct = [int](100 - (100 * $livre / [double]$cs.TotalPhysicalMemory))
            Add-Info 'Memória RAM' 'Em uso agora (sem jogo)' ('{0}% ({1} livres)' -f $usoPct, (Format-Bytes $livre))
            if ($usoPct -ge 70) {
                Add-Achado 'Medio' ('{0}% da RAM em uso sem nenhum jogo aberto' -f $usoPct) 'Sobra pouca memória para o jogo, o que causa travadas quando ele precisa carregar coisas novas.' 'Feche navegador e programas em segundo plano antes de jogar e desligue os que abrem sozinhos (menu 5).'
            }
        }
        if ($totalGB -gt 0 -and $totalGB -lt 15) {
            Add-Achado 'Info' ('{0} GB de RAM' -f $totalGB) 'Para Fortnite e CS2 com Discord e navegador abertos, 16 GB é o recomendado hoje.' ''
        }
        $pfs = @(Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue)
        if ($cs -and -not $cs.AutomaticManagedPagefile -and $pfs.Count -eq 0) {
            Add-Achado 'Alto' 'Memória virtual (arquivo de paginação) desligada' 'Alguns "otimizadores" desligam isso. Sem ela, jogos podem fechar sozinhos ou travar quando a RAM enche.' 'Painel de Controle > Sistema > Configurações avançadas do sistema > Desempenho > Configurações > Avançado > Memória virtual > Alterar > marque "Gerenciar automaticamente".' -Manual
        }
    } catch {}

    # ---------------- Armazenamento ----------------
    Write-Step 'Armazenamento...'
    try {
        foreach ($ld in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop)) {
            if (-not $ld.Size) { continue }
            $pct = [int](100 * [double]$ld.FreeSpace / [double]$ld.Size)
            Add-Info 'Armazenamento' ('Unidade {0}' -f $ld.DeviceID) ('{0} livres de {1} ({2}% livre)' -f (Format-Bytes $ld.FreeSpace), (Format-Bytes $ld.Size), $pct)
            if ($ld.DeviceID -eq $env:SystemDrive) {
                if ($pct -lt 10) {
                    Add-Achado 'Alto' ('Disco do Windows ({0}) quase cheio: {1}% livre' -f $ld.DeviceID, $pct) 'SSD muito cheio fica mais lento, e o Windows e os jogos ficam sem espaço para arquivos temporários e atualizações.' 'Rode a Limpeza (menu 4) e desinstale jogos e programas que não usa. O ideal é manter de 15% a 20% livre.' -Manual
                } elseif ($pct -lt 20) {
                    Add-Achado 'Medio' ('Disco do Windows ({0}) com {1}% livre' -f $ld.DeviceID, $pct) 'Está chegando perto do limite recomendado.' 'Rode a Limpeza (menu 4). O ideal é manter de 15% a 20% livre.'
                } else {
                    Add-Achado 'OK' ('Espaço livre no disco do Windows: {0}%' -f $pct)
                }
            }
        }
    } catch {}
    try {
        foreach ($pd in @(Get-PhysicalDisk -ErrorAction Stop)) {
            $tipo = [string]$pd.MediaType
            if ($tipo -eq '4') { $tipo = 'SSD' } elseif ($tipo -eq '3') { $tipo = 'HDD' }
            $saude = [string]$pd.HealthStatus
            if ($saude -eq '0') { $saude = 'Healthy' }
            $extra = ''
            try {
                $rc = $pd | Get-StorageReliabilityCounter -ErrorAction Stop
                if ($null -ne $rc.Wear) { $extra += (' · desgaste {0}%' -f $rc.Wear) }
                if ($rc.Temperature) { $extra += (' · {0} °C' -f $rc.Temperature) }
                if ($null -ne $rc.Wear -and $rc.Wear -ge 80) {
                    Add-Achado 'Medio' ('{0}: SSD com {1}% de desgaste' -f $pd.FriendlyName, $rc.Wear) 'O SSD está perto do fim da vida útil estimada.' 'Faça backup dos seus arquivos e planeje a troca.' -Manual
                }
            } catch {}
            Add-Info 'Armazenamento' $pd.FriendlyName ('{0} · {1} · {2} · saúde: {3}{4}' -f $tipo, [string]$pd.BusType, (Format-Bytes $pd.Size), $saude, $extra)
            if ($saude -notin @('Healthy', '')) {
                Add-Achado 'Alto' ('Disco com problema: {0} ({1})' -f $pd.FriendlyName, $saude) 'O Windows indica que este disco não está saudável. Disco com defeito causa travadas e pode perder dados.' 'Faça backup dos seus arquivos o quanto antes e verifique com o programa do fabricante do disco.' -Manual
            } elseif ($tipo -eq 'HDD') {
                Add-Achado 'Info' ('{0} é um HD mecânico' -f $pd.FriendlyName) 'HD é bem mais lento que SSD e causa travadas ao carregar mapas e texturas.' 'Deixe Fortnite, CS2 e LoL instalados no SSD.'
            }
        }
    } catch {}
    if (Test-Path -LiteralPath ('{0}\Windows.old' -f $env:SystemDrive)) {
        Add-Achado 'Info' 'Existe a pasta Windows.old' 'É uma cópia do Windows antigo que sobra depois de atualizações grandes e pode ocupar dezenas de GB.' 'Se não pretende voltar para a versão anterior: Iniciar > "Limpeza de Disco" > "Limpar arquivos do sistema" > marque "Instalações anteriores do Windows".'
    }
    $tmp = (Get-TamanhoPasta $env:TEMP) + (Get-TamanhoPasta (Join-Path $env:SystemRoot 'Temp'))
    Add-Info 'Armazenamento' 'Arquivos temporários' (Format-Bytes $tmp)
    if ($tmp -ge 1GB) {
        Add-Achado 'Info' ('{0} em arquivos temporários' -f (Format-Bytes $tmp)) 'Não deixa o PC lento por si só, mas ocupa espaço à toa.' 'Rode a Limpeza (menu 4).'
    }

    # ---------------- Configurações de jogo do Windows ----------------
    Write-Step 'Configurações do Windows para jogos...'
    $plano = Get-PlanoAtivo
    Add-Info 'Configurações de jogo' 'Plano de energia' $plano.Nome
    if ($plano.Guid -and ($plano.Guid -in @($Script:PlanoEquilibrado, $Script:PlanoEconomia))) {
        Add-Achado 'Medio' ('Plano de energia "{0}"' -f $plano.Nome) 'O processador economiza energia e demora a subir o clock nos picos de uso, o que pode causar quedas rápidas de FPS.' 'O otimizador pode trocar para "Alto desempenho" (menu 3).'
    } elseif ($plano.Guid) {
        Add-Achado 'OK' ('Plano de energia: {0}' -f $plano.Nome)
    }
    $gm = Get-RegValue 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled'
    $txtGm = 'Ligado'
    if ($gm -eq 0) {
        $txtGm = 'Desligado'
        Add-Achado 'Medio' 'Modo de Jogo do Windows desligado' 'Com ele ligado, o Windows prioriza o jogo e segura atualizações durante a partida.' 'O otimizador pode ligar (menu 3).'
    }
    Add-Info 'Configurações de jogo' 'Modo de Jogo' $txtGm
    $dvr = Get-RegValue 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
    $hist = Get-RegValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'HistoricalCaptureEnabled'
    if ($hist -eq 1) {
        Add-Achado 'Medio' 'A Xbox Game Bar está gravando a tela em segundo plano' 'O Windows fica gravando os últimos minutos do jogo o tempo todo, o que custa FPS.' 'O otimizador pode desligar (menu 3). A Game Bar continua funcionando.'
    } elseif ($dvr -ne 0) {
        Add-Achado 'Info' 'Captura de jogos da Xbox Game Bar ativada' 'Impacto pequeno, mas desligar ajuda se você não grava clipes pela Game Bar.' 'O otimizador pode desligar (menu 3).'
    }
    $hags = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode'
    $txtHags = 'Padrão do Windows'
    if ($hags -eq 2) { $txtHags = 'Ligado' } elseif ($hags -eq 1) { $txtHags = 'Desligado' }
    Add-Info 'Configurações de jogo' 'Agendamento de GPU acelerado (HAGS)' $txtHags
    $ms = [string](Get-RegValue 'HKCU:\Control Panel\Mouse' 'MouseSpeed')
    Add-Info 'Configurações de jogo' 'Aceleração do mouse' $(if ($ms -eq '0') { 'Desligada' } else { 'Ligada' })
    if ($ms -ne '0') {
        Add-Achado 'Info' 'Aceleração do mouse ligada ("Aumentar precisão do ponteiro")' 'A mira se move diferente dependendo da velocidade da mão, o que atrapalha a memória muscular no CS e no Fortnite.' 'O otimizador pode desligar (menu 3).'
    }
    $fs = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled'
    Add-Info 'Configurações de jogo' 'Inicialização rápida' $(if ($fs -eq 0) { 'Desligada' } else { 'Ligada' })
    if ($ligado -and $ligado.TotalDays -ge 3) {
        $extraFs = ''
        if ($fs -ne 0) { $extraFs = ' Com a "Inicialização rápida" ligada, desligar o PC pelo menu NÃO zera o Windows; só o Reiniciar zera.' }
        Add-Achado 'Medio' ('O Windows não é reiniciado há {0}' -f (Format-Duracao $ligado)) ('Com o tempo, memória e drivers vão acumulando lixo e isso aparece como travadas.' + $extraFs) 'Use "Reiniciar" antes de jogar. O otimizador pode desligar a Inicialização rápida (menu 3).'
    }
    try {
        $dg = Get-CimInstance -Namespace 'root\Microsoft\Windows\DeviceGuard' -ClassName Win32_DeviceGuard -ErrorAction Stop
        $hvci = (@($dg.SecurityServicesRunning) -contains 2)
        Add-Info 'Configurações de jogo' 'Integridade de memória (HVCI)' $(if ($hvci) { 'Ligada' } else { 'Desligada' })
        if ($hvci) {
            Add-Achado 'Info' 'Integridade de memória (Isolamento de núcleo) ligada' 'É uma proteção de segurança que pode custar alguns % de FPS. O otimizador NÃO mexe nisso.' 'Recomendação: deixe ligada. Se quiser testar sem ela, leia antes a seção "Integridade de memória" do guia.'
        }
    } catch {}

    # ---------------- Inicialização ----------------
    Write-Step 'Programas que abrem sozinhos...'
    $ini = @(Get-ItensInicio)
    $ativos = @($ini | Where-Object { $_.Ativo })
    foreach ($s in $ativos) { Add-Info 'Programas que abrem com o Windows' $s.Nome ('{0} · {1}' -f $s.Sugestao, (Get-Resumido $s.Comando 90)) }
    $desnec = @($ativos | Where-Object { $_.Sugestao -eq 'Pode desativar' })
    if ($desnec.Count -gt 0) {
        Add-Achado 'Medio' ('{0} programa(s) abrindo sozinhos sem necessidade' -f $desnec.Count) (($desnec | ForEach-Object { $_.Nome }) -join ', ') 'Desligue em "Programas que iniciam com o Windows" (menu 5). Eles não são desinstalados.'
    }

    # ---------------- Programas instalados ----------------
    Write-Step 'Programas instalados...'
    $progs = @(Get-ProgramasInstalados)
    Add-Info 'Sistema' 'Programas instalados' $progs.Count
    $otim = @($progs | Where-Object { $_ -match $Script:RxOtimizadores })
    if ($otim.Count -gt 0) {
        Add-Achado 'Medio' 'Otimizadores/limpadores de terceiros instalados' ($otim -join ', ') 'Esses programas costumam ficar rodando escondidos e mexer em configurações do Windows; muitos pioram a estabilidade. Desinstale em Configurações > Aplicativos.' -Manual
    }
    $pup = @($progs | Where-Object { $_ -match $Script:RxIndesejados })
    if ($pup.Count -gt 0) {
        Add-Achado 'Alto' 'Programas indesejados ou suspeitos instalados' ($pup -join ', ') 'Geralmente vêm escondidos em instaladores e deixam o PC lento (ou coisa pior). Desinstale em Configurações > Aplicativos e rode a verificação de vírus (menu 8).' -Manual
    }
    $avs = @($progs | Where-Object { $_ -match $Script:RxAntivirus })
    if ($avs.Count -gt 0) {
        Add-Achado 'Info' 'Antivírus de terceiros instalado' ($avs -join ', ') 'Ter mais de um antivírus deixa o PC bem mais lento. O Microsoft Defender, que já vem no Windows, protege bem a maioria das pessoas.'
    }

    # ---------------- Processos ----------------
    Write-Step 'Programas abertos agora...'
    try {
        $top = @(Get-Process -ErrorAction Stop | Group-Object ProcessName | ForEach-Object {
            [pscustomobject]@{ Nome = $_.Name; MB = [math]::Round((($_.Group | Measure-Object WorkingSet64 -Sum).Sum) / 1MB); Qtd = $_.Count }
        } | Sort-Object MB -Descending | Select-Object -First 12)
        foreach ($t in $top) {
            $qtd = ''
            if ($t.Qtd -gt 1) { $qtd = (' ({0} processos)' -f $t.Qtd) }
            Add-Info 'Programas abertos que mais usam memória' $t.Nome ('{0} MB{1}' -f $t.MB, $qtd)
        }
        $pesados = @($top | Where-Object { $_.Nome -match $Script:RxSegundoPlano -and $_.MB -ge 150 })
        if ($pesados.Count -gt 0) {
            Add-Achado 'Info' 'Programas pesados abertos em segundo plano' (($pesados | ForEach-Object { '{0} ({1} MB)' -f $_.Nome, $_.MB }) -join ', ') 'Feche o que não precisa antes de jogar, principalmente navegador com muitas abas e programas de RGB ou papel de parede animado.'
        }
    } catch {}

    # ---------------- Rede ----------------
    Write-Step 'Rede e ping (leva uns 10 segundos)...'
    try {
        $ads = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object { $_.Status -eq 'Up' })
        $temCabo = $false
        $temWifi = $false
        foreach ($a in $ads) {
            $wifi = (([string]$a.PhysicalMediaType -match '802\.11|Wireless') -or ([string]$a.InterfaceDescription -match 'Wi-?Fi|Wireless|WLAN|802\.11'))
            if ($wifi) { $temWifi = $true } else { $temCabo = $true }
            $tipoRede = 'Cabo'
            if ($wifi) { $tipoRede = 'Wi-Fi' }
            Add-Info 'Rede' $a.Name ('{0} · {1} · {2}' -f $tipoRede, $a.LinkSpeed, $a.InterfaceDescription)
        }
        if ($temWifi -and -not $temCabo) {
            Add-Achado 'Medio' 'Internet pelo Wi-Fi' 'Wi-Fi tem variação de ping e perda de pacotes, que aparecem como "travadas" e "teleportes" nos jogos online.' 'Se der, use cabo de rede. No Wi-Fi, use a rede 5 GHz e fique perto do roteador.' -Manual
        } elseif ($temCabo) {
            Add-Achado 'OK' 'Internet por cabo'
        }
    } catch {}
    $gw = $null
    try { $gw = [string](Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | Sort-Object RouteMetric | Select-Object -First 1).NextHop } catch {}
    $rGw = $null
    if ($gw -and $gw -ne '0.0.0.0') { $rGw = Test-Ping $gw 20 }
    $rNet = Test-Ping '1.1.1.1' 25
    foreach ($par in @(@('Ping até o roteador', $rGw), @('Ping até a internet (1.1.1.1)', $rNet))) {
        $r = $par[1]
        if ($null -eq $r) { continue }
        if ($null -eq $r.Media) { Add-Info 'Rede' $par[0] 'sem resposta'; continue }
        Add-Info 'Rede' $par[0] ('média {0} ms · mín {1} · máx {2} · variação {3} ms · perda {4}%' -f $r.Media, $r.Min, $r.Max, $r.Variacao, $r.Perda)
    }
    if ($rGw -and $null -ne $rGw.Media -and (($rGw.Perda -gt 0 -and $rGw.Perda -lt 100) -or $rGw.Media -gt 10)) {
        Add-Achado 'Alto' 'Conexão instável entre o PC e o roteador' ('Perda {0}% · média {1} ms · variação {2} ms. O problema está dentro de casa (Wi-Fi ou cabo), não na operadora.' -f $rGw.Perda, $rGw.Media, $rGw.Variacao) 'Use cabo; se já usa, troque o cabo ou a porta do roteador. No Wi-Fi, aproxime o PC do roteador e use 5 GHz.' -Manual
    }
    if ($rNet) {
        if ($null -eq $rNet.Media) {
            Add-Achado 'Info' 'Não consegui medir o ping da internet' 'Pode ser bloqueio de ping no roteador/firewall ou falta de internet.' ''
        } elseif ($rNet.Perda -ge 4) {
            Add-Achado 'Alto' ('Perda de pacotes na internet ({0}%)' -f $rNet.Perda) 'Perda de pacotes causa travadas, "teleportes" e tiros que não registram, mesmo com FPS alto.' 'Teste com cabo, reinicie o roteador e feche downloads (Steam, Epic, torrent, Windows Update). Se continuar, reclame com a operadora mostrando este relatório.' -Manual
        } elseif ($rNet.Variacao -gt 15) {
            Add-Achado 'Medio' ('Ping instável (variação média de {0} ms)' -f $rNet.Variacao) 'O ping fica subindo e descendo, o que dá sensação de travada nos jogos online.' 'Use cabo e feche downloads durante as partidas.' -Manual
        } else {
            Add-Achado 'OK' ('Internet estável ({0} ms até 1.1.1.1, sem perda)' -f $rNet.Media)
        }
    }

    # ---------------- Resultado ----------------
    $ordem = @{ 'Alto' = 0; 'Medio' = 1; 'Info' = 2; 'OK' = 3 }
    $Script:Achados = [System.Collections.ArrayList]@($Script:Achados | Sort-Object -Property @{ Expression = { $ordem[$_.Nivel] } }, @{ Expression = { $_.Ordem } })

    Write-Host ''
    Write-Host '  RESULTADO' -ForegroundColor White
    Write-Host '  ---------' -ForegroundColor White
    foreach ($a in $Script:Achados) {
        $cor = 'Green'
        $tag = '[OK]         '
        if ($a.Nivel -eq 'Alto') { $cor = 'Red'; $tag = '[IMPORTANTE] ' }
        elseif ($a.Nivel -eq 'Medio') { $cor = 'Yellow'; $tag = '[ATENÇÃO]    ' }
        elseif ($a.Nivel -eq 'Info') { $cor = 'Cyan'; $tag = '[DICA]       ' }
        Write-Host ('  {0}{1}' -f $tag, $a.Titulo) -ForegroundColor $cor
    }
    $arq = Export-RelatorioHtml -Resumo $resumo
    Write-Host ''
    if ($arq) {
        Write-Ok ('Relatório completo salvo em: {0}' -f $arq)
        if (Confirm-Choice 'Abrir o relatório completo (com explicação e solução de cada item) no navegador?' $true) { Start-Process $arq }
    }
    Wait-Enter
}

function Export-RelatorioHtml {
    param($Resumo)
    try {
        $arq = Join-Path $Script:ReportDir ('diagnostico_{0}_{1}.html' -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd_HHmmss'))
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.Append(@'
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnóstico do PC</title>
<style>
:root { --bg:#f6f7f9; --card:#ffffff; --txt:#1c1f24; --sub:#5d6470; --borda:#e1e4e8;
        --alto:#c62828; --alto-bg:#fdecec; --medio:#a15c00; --medio-bg:#fff4e0;
        --info:#0b6bcb; --info-bg:#e8f1fc; --ok:#1e7d3a; --ok-bg:#e7f5ec; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#14161a; --card:#1d2026; --txt:#e8eaed; --sub:#a0a7b1; --borda:#2e333b;
          --alto:#ff8a80; --alto-bg:#3a1f1f; --medio:#ffc266; --medio-bg:#3a2d17;
          --info:#7db8ff; --info-bg:#182a40; --ok:#7ad69a; --ok-bg:#183323; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--txt); font:16px/1.55 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; }
main { max-width:920px; margin:0 auto; padding:28px 16px 60px; }
h1 { font-size:28px; margin:0 0 4px; }
h2 { font-size:20px; margin:36px 0 12px; }
h3 { font-size:17px; margin:0 0 6px; }
.sub { color:var(--sub); margin:0; }
.specs { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-top:20px; }
.spec { background:var(--card); border:1px solid var(--borda); border-radius:10px; padding:12px 14px; }
.spec small { color:var(--sub); display:block; font-size:13px; }
.spec b { font-weight:600; }
.contagem { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0 16px; }
.pill { border-radius:999px; padding:3px 12px; font-size:14px; font-weight:600; }
.card { background:var(--card); border:1px solid var(--borda); border-left:5px solid var(--borda); border-radius:10px; padding:14px 16px; margin:10px 0; }
.card p { margin:6px 0 0; }
.card .fix { color:var(--txt); }
.tag { display:inline-block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-radius:6px; padding:2px 8px; margin-bottom:6px; }
.alto { border-left-color:var(--alto); } .alto .tag, .pill.alto { background:var(--alto-bg); color:var(--alto); }
.medio { border-left-color:var(--medio); } .medio .tag, .pill.medio { background:var(--medio-bg); color:var(--medio); }
.info { border-left-color:var(--info); } .info .tag, .pill.info { background:var(--info-bg); color:var(--info); }
.pill.ok { background:var(--ok-bg); color:var(--ok); }
ul.oks { background:var(--card); border:1px solid var(--borda); border-radius:10px; padding:12px 16px 12px 36px; }
ul.oks li { margin:3px 0; }
ul.oks li::marker { color:var(--ok); }
table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--borda); border-radius:10px; overflow:hidden; margin-bottom:14px; }
td { padding:8px 12px; border-top:1px solid var(--borda); vertical-align:top; overflow-wrap:anywhere; }
tr:first-child td { border-top:0; }
td:first-child { color:var(--sub); width:34%; }
.nota { color:var(--sub); font-size:14px; margin-top:40px; }
</style>
</head>
<body>
<main>
'@)
        [void]$sb.Append('<h1>Diagnóstico do PC</h1>')
        [void]$sb.Append('<p class="sub">' + (Get-HtmlSeguro $env:COMPUTERNAME) + ' · ' + (Get-Date).ToString('dd/MM/yyyy HH:mm') + ' · Otimizador Gamer v' + $Script:Versao + '</p>')
        [void]$sb.Append('<div class="specs">')
        foreach ($k in $Resumo.Keys) {
            [void]$sb.Append('<div class="spec"><small>' + (Get-HtmlSeguro $k) + '</small><b>' + (Get-HtmlSeguro ([string]$Resumo[$k])) + '</b></div>')
        }
        [void]$sb.Append('</div>')

        $nAlto = @($Script:Achados | Where-Object { $_.Nivel -eq 'Alto' }).Count
        $nMedio = @($Script:Achados | Where-Object { $_.Nivel -eq 'Medio' }).Count
        $nInfo = @($Script:Achados | Where-Object { $_.Nivel -eq 'Info' }).Count
        $nOk = @($Script:Achados | Where-Object { $_.Nivel -eq 'OK' }).Count
        [void]$sb.Append('<h2>O que encontrei</h2><div class="contagem">')
        [void]$sb.Append('<span class="pill alto">' + $nAlto + ' importante(s)</span>')
        [void]$sb.Append('<span class="pill medio">' + $nMedio + ' de atenção</span>')
        [void]$sb.Append('<span class="pill info">' + $nInfo + ' dica(s)</span>')
        [void]$sb.Append('<span class="pill ok">' + $nOk + ' ok</span></div>')
        if (($nAlto + $nMedio + $nInfo) -eq 0) { [void]$sb.Append('<p>Nenhum problema encontrado. Seu PC está bem configurado.</p>') }

        foreach ($a in $Script:Achados) {
            if ($a.Nivel -eq 'OK') { continue }
            $cls = 'info'
            $rot = 'Dica'
            if ($a.Nivel -eq 'Alto') { $cls = 'alto'; $rot = 'Importante' } elseif ($a.Nivel -eq 'Medio') { $cls = 'medio'; $rot = 'Atenção' }
            [void]$sb.Append('<article class="card ' + $cls + '"><span class="tag">' + $rot + '</span><h3>' + (Get-HtmlSeguro $a.Titulo) + '</h3>')
            if ($a.Detalhe) { [void]$sb.Append('<p>' + (Get-HtmlSeguro $a.Detalhe) + '</p>') }
            if ($a.Solucao) { [void]$sb.Append('<p class="fix"><b>Como resolver:</b> ' + (Get-HtmlSeguro $a.Solucao) + '</p>') }
            [void]$sb.Append('</article>')
        }
        if ($nOk -gt 0) {
            [void]$sb.Append('<h2>O que já está certo</h2><ul class="oks">')
            foreach ($a in @($Script:Achados | Where-Object { $_.Nivel -eq 'OK' })) { [void]$sb.Append('<li>' + (Get-HtmlSeguro $a.Titulo) + '</li>') }
            [void]$sb.Append('</ul>')
        }

        [void]$sb.Append('<h2>Detalhes do PC</h2>')
        foreach ($secao in $Script:Secoes.Keys) {
            [void]$sb.Append('<h3>' + (Get-HtmlSeguro $secao) + '</h3><table>')
            foreach ($l in $Script:Secoes[$secao]) {
                [void]$sb.Append('<tr><td>' + (Get-HtmlSeguro $l.Rotulo) + '</td><td>' + (Get-HtmlSeguro $l.Valor) + '</td></tr>')
            }
            [void]$sb.Append('</table>')
        }
        [void]$sb.Append('<p class="nota">O diagnóstico só lê informações; nada foi alterado no PC. O passo a passo de BIOS, driver NVIDIA e configurações de cada jogo está no arquivo app\Guia.html do Otimizador Gamer.</p>')
        [void]$sb.Append('</main></body></html>')
        [IO.File]::WriteAllText($arq, $sb.ToString(), (New-Object Text.UTF8Encoding($true)))
        return $arq
    } catch {
        Write-Fail ('Não consegui salvar o relatório: {0}' -f $_.Exception.Message)
        return $null
    }
}

# =====================================================================
#  MONITOR DE DESEMPENHO (enquanto você joga)
# =====================================================================
function Get-CaminhoNvidiaSmi {
    $c = Get-Command 'nvidia-smi.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.Path }
    $alt = Join-Path $env:ProgramFiles 'NVIDIA Corporation\NVSMI\nvidia-smi.exe'
    if (Test-Path -LiteralPath $alt) { return $alt }
    return $null
}

function Get-AmostraDesempenho {
    param([string]$NvSmi)
    $tot = $null
    $nucleoMax = $null
    try {
        $cpus = @(Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ProcessorInformation -ErrorAction Stop)
        $tot = $cpus | Where-Object { $_.Name -eq '_Total' } | Select-Object -First 1
        $nucleos = @($cpus | Where-Object { $_.Name -notmatch '_Total' })
        if ($nucleos.Count -gt 0) { $nucleoMax = ($nucleos | Measure-Object -Property PercentProcessorTime -Maximum).Maximum }
    } catch {}
    $mem = $null
    try { $mem = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop } catch {}

    $gpu = $null; $gpuTemp = $null; $gpuClock = $null; $gpuWatts = $null
    if ($NvSmi) {
        try {
            $linha = & $NvSmi '--query-gpu=utilization.gpu,temperature.gpu,clocks.gr,power.draw' '--format=csv,noheader,nounits' 2>$null | Select-Object -First 1
            if ($linha) {
                $partes = ([string]$linha) -split ','
                if ($partes.Count -ge 4) {
                    $gpu = ConvertTo-Numero $partes[0]
                    $gpuTemp = ConvertTo-Numero $partes[1]
                    $gpuClock = ConvertTo-Numero $partes[2]
                    $gpuWatts = ConvertTo-Numero $partes[3]
                }
            }
        } catch {}
    }
    if ($null -eq $gpu) {
        try {
            $eng = @(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop | Where-Object { $_.Name -match 'engtype_3D' })
            if ($eng.Count -gt 0) { $gpu = [math]::Min(100, ($eng | Measure-Object -Property UtilizationPercentage -Sum).Sum) }
        } catch {}
    }

    $cpuLimite = $null
    $cpuPct = $null
    if ($tot) {
        $cpuPct = [int]$tot.PercentProcessorTime
        if ($null -ne $tot.PercentPerformanceLimit) { $cpuLimite = [int]$tot.PercentPerformanceLimit }
    }
    $ramLivre = $null
    $commit = $null
    if ($mem) { $ramLivre = [int]$mem.AvailableMBytes; $commit = [int]$mem.PercentCommittedBytesInUse }
    return [pscustomobject]@{
        Hora             = (Get-Date).ToString('HH:mm:ss')
        CPU              = $cpuPct
        NucleoMaisUsado  = $(if ($null -ne $nucleoMax) { [int]$nucleoMax } else { $null })
        CPULimite        = $cpuLimite
        GPU              = $gpu
        GPUTemp          = $gpuTemp
        GPUClockMHz      = $gpuClock
        GPUWatts         = $gpuWatts
        RAMLivreMB       = $ramLivre
        RAMCompromissada = $commit
    }
}

function Invoke-Monitor {
    Write-Banner 'Monitor de desempenho enquanto você joga'
    Write-Info 'Mede o uso de processador, placa de vídeo, temperatura da GPU e memória enquanto você joga.'
    Write-Info 'No fim, explica onde está o gargalo (o que está segurando o seu FPS).'
    Write-Host ''
    Write-Info 'Como usar: deixe esta janela aberta, abra o jogo e jogue uma partida normal.'
    Write-Info 'Para parar antes do tempo, volte para esta janela e aperte Q.'
    Write-Host ''
    $minutos = 10
    $r = "$(Read-Host '  Quantos minutos monitorar? (ENTER = 10)')".Trim()
    $n = 0
    if ([int]::TryParse($r, [ref]$n) -and $n -ge 1 -and $n -le 180) { $minutos = $n }
    $nvsmi = Get-CaminhoNvidiaSmi
    if (-not $nvsmi) { Write-Warn 'nvidia-smi não encontrado: a temperatura da placa de vídeo não será medida.' }
    if (-not (Confirm-Choice ('Começar a monitorar por {0} minuto(s)?' -f $minutos) $true)) { return }

    $amostras = New-Object System.Collections.ArrayList
    $fim = (Get-Date).AddMinutes($minutos)
    $parar = $false
    Write-Host ''
    Write-Host '  Monitorando... (Q para parar)' -ForegroundColor Green
    while ((Get-Date) -lt $fim -and -not $parar) {
        $s = Get-AmostraDesempenho -NvSmi $nvsmi
        [void]$amostras.Add($s)
        $gpuTxt = ' --'
        if ($null -ne $s.GPU) { $gpuTxt = ('{0,3}%' -f [int]$s.GPU) }
        $tTxt = ''
        if ($null -ne $s.GPUTemp) { $tTxt = (' {0}°C' -f [int]$s.GPUTemp) }
        $linha = ('  {0}  CPU {1,3}%  núcleo mais usado {2,3}%  GPU {3}{4}  RAM livre {5,6} MB   ' -f $s.Hora, $s.CPU, $s.NucleoMaisUsado, $gpuTxt, $tTxt, $s.RAMLivreMB)
        Write-Host ("`r" + $linha) -NoNewline
        $ate = (Get-Date).AddSeconds(2)
        while ((Get-Date) -lt $ate) {
            try {
                if ([Console]::KeyAvailable) {
                    $tecla = [Console]::ReadKey($true)
                    if ($tecla.Key -eq [ConsoleKey]::Q) { $parar = $true; break }
                }
            } catch {}
            Start-Sleep -Milliseconds 100
        }
    }
    Write-Host ''
    Write-Host ''

    $am = @($amostras | Select-Object -Skip 1)
    if ($am.Count -lt 5) { Write-Warn 'Poucas amostras para analisar. Monitore por mais tempo (com o jogo aberto).'; Wait-Enter; return }

    $base = Join-Path $Script:ReportDir ('monitor_{0}_{1}' -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd_HHmmss'))
    try { $am | Export-Csv -LiteralPath ($base + '.csv') -NoTypeInformation -Encoding UTF8 -Delimiter ';' } catch {}

    $comCpu = @($am | Where-Object { $null -ne $_.CPU })
    $cpuMed = $null
    if ($comCpu.Count -gt 0) { $cpuMed = [math]::Round(($comCpu | Measure-Object CPU -Average).Average) }
    $comNuc = @($am | Where-Object { $null -ne $_.NucleoMaisUsado })
    $pctNucleo = 0
    if ($comNuc.Count -gt 0) { $pctNucleo = [math]::Round(100 * @($comNuc | Where-Object { $_.NucleoMaisUsado -ge 95 }).Count / $comNuc.Count) }
    $comGpu = @($am | Where-Object { $null -ne $_.GPU })
    $gpuMed = $null
    if ($comGpu.Count -gt 0) { $gpuMed = [math]::Round(($comGpu | Measure-Object GPU -Average).Average) }
    $comLim = @($am | Where-Object { $null -ne $_.CPULimite })
    $pctLim = $null
    if ($comLim.Count -gt 0) { $pctLim = [math]::Round(100 * @($comLim | Where-Object { $_.CPULimite -lt 90 }).Count / $comLim.Count) }
    $comTemp = @($am | Where-Object { $null -ne $_.GPUTemp })
    $tempMax = $null
    if ($comTemp.Count -gt 0) { $tempMax = ($comTemp | Measure-Object GPUTemp -Maximum).Maximum }
    $comRam = @($am | Where-Object { $null -ne $_.RAMLivreMB })
    $ramMin = $null
    if ($comRam.Count -gt 0) { $ramMin = ($comRam | Measure-Object RAMLivreMB -Minimum).Minimum }
    $comCommit = @($am | Where-Object { $null -ne $_.RAMCompromissada })
    $commitMax = $null
    if ($comCommit.Count -gt 0) { $commitMax = ($comCommit | Measure-Object RAMCompromissada -Maximum).Maximum }

    $linhas = New-Object System.Collections.ArrayList
    [void]$linhas.Add(('Amostras: {0} (a cada ~2 s)' -f $am.Count))
    if ($null -ne $cpuMed) { [void]$linhas.Add(('Processador: uso médio {0}%; algum núcleo ficou em 95%+ em {1}% do tempo' -f $cpuMed, $pctNucleo)) }
    if ($null -ne $gpuMed) { [void]$linhas.Add(('Placa de vídeo: uso médio {0}%' -f $gpuMed)) }
    if ($null -ne $tempMax) { [void]$linhas.Add(('Temperatura máxima da placa de vídeo: {0} °C' -f $tempMax)) }
    if ($null -ne $ramMin) { [void]$linhas.Add(('Menor quantidade de RAM livre: {0} MB' -f $ramMin)) }

    $conclusoes = New-Object System.Collections.ArrayList
    if ($null -ne $pctLim -and $pctLim -ge 10) {
        [void]$conclusoes.Add(('[IMPORTANTE] O Windows indicou que o processador foi limitado (calor ou energia) em {0}% do tempo. Isso causa quedas de FPS e travadas. Meça a temperatura com o HWiNFO, limpe a poeira, troque a pasta térmica e, se preciso, use um cooler melhor (guia, seção Temperatura).' -f $pctLim))
    }
    if ($null -ne $tempMax -and $tempMax -ge 83) {
        [void]$conclusoes.Add(('[ATENÇÃO] A placa de vídeo chegou a {0} °C. Limpe a poeira e melhore a ventilação do gabinete.' -f $tempMax))
    }
    if ($null -ne $ramMin -and $ramMin -lt 1500) {
        [void]$conclusoes.Add(('[ATENÇÃO] A RAM quase acabou (mínimo de {0} MB livres). Feche navegador, Discord com vídeo e outros programas antes de jogar.' -f $ramMin))
    } elseif ($null -ne $commitMax -and $commitMax -ge 90) {
        [void]$conclusoes.Add(('[ATENÇÃO] A memória comprometida chegou a {0}%. Feche programas em segundo plano.' -f $commitMax))
    }
    if ($null -ne $gpuMed) {
        if ($gpuMed -ge 90) {
            [void]$conclusoes.Add('[GARGALO: PLACA DE VÍDEO] A placa de vídeo ficou no limite. Para mais FPS, baixe gráficos/resolução 3D. Para FPS estável, limite o FPS um pouco abaixo do que ele alcança e ligue o NVIDIA Reflex.')
        } elseif ($gpuMed -lt 75 -and $pctNucleo -ge 30) {
            [void]$conclusoes.Add('[GARGALO: PROCESSADOR] A placa de vídeo sobrou e o processador segurou o FPS. É normal em CS2, LoL e Fortnite no modo Desempenho com FPS muito alto. Limitar o FPS deixa tudo mais estável. RAM em dual channel com XMP e menos programas em segundo plano ajudam muito.')
        } elseif ($gpuMed -lt 60) {
            [void]$conclusoes.Add('[SEM GARGALO CLARO] Nem processador nem placa de vídeo estavam no limite. Ou o FPS estava limitado (limite de FPS/V-Sync, o que é bom), ou você ficou muito tempo em menus. Se mesmo assim travou, olhe a rede (diagnóstico) e a temperatura.')
        } else {
            [void]$conclusoes.Add('[EQUILIBRADO] Processador e placa de vídeo trabalharam de forma equilibrada.')
        }
    }
    if ($conclusoes.Count -eq 0) { [void]$conclusoes.Add('Nenhum problema claro encontrado nas medições.') }

    Write-Host '  RESULTADO DO MONITOR' -ForegroundColor White
    foreach ($l in $linhas) { Write-Info $l }
    Write-Host ''
    foreach ($c in $conclusoes) {
        $cor = 'Cyan'
        if ($c.StartsWith('[IMPORTANTE')) { $cor = 'Red' } elseif ($c.StartsWith('[ATEN')) { $cor = 'Yellow' }
        Write-Host ('  ' + $c) -ForegroundColor $cor
        Write-Host ''
    }
    try {
        $txt = @('Monitor de desempenho - Otimizador Gamer', ('PC: {0} - {1}' -f $env:COMPUTERNAME, (Get-Date).ToString('dd/MM/yyyy HH:mm')), '') + @($linhas) + @('') + @($conclusoes)
        [IO.File]::WriteAllLines($base + '.txt', [string[]]$txt, (New-Object Text.UTF8Encoding($true)))
        Write-Ok ('Resultado salvo em: {0}.txt (e os dados em .csv)' -f $base)
    } catch {}
    Write-Info 'Obs.: o Windows não informa o FPS. Para ver FPS e "1% low", use o contador do próprio jogo ou o overlay do NVIDIA App (Alt+R).'
    Wait-Enter
}

# =====================================================================
#  VERIFICAR E REPARAR
# =====================================================================
function Invoke-Reparo {
    $itens = New-Object System.Collections.ArrayList
    [void]$itens.Add(@{ Nome = 'Verificação rápida de vírus (Microsoft Defender)'; Desc = 'Procura malware e mineradores escondidos que roubam desempenho. Uns 5 minutos.'; Nota = ''; Selecionado = $true; Acao = 'av' })
    [void]$itens.Add(@{ Nome = 'Reparar arquivos do Windows (DISM + SFC)'; Desc = 'Corrige arquivos do sistema corrompidos. Leva de 15 a 40 minutos e precisa de internet.'; Nota = 'demorado'; Selecionado = $true; Acao = 'sfc' })
    [void]$itens.Add(@{ Nome = 'Verificar erros no disco do Windows'; Desc = 'Verificação com o PC ligado, sem reiniciar. De 1 a 5 minutos.'; Nota = ''; Selecionado = $false; Acao = 'disco' })
    $intro = 'Recomendado para um PC que está há anos sem formatar. Nada aqui apaga seus arquivos.'
    if (-not (Show-Checklist -Titulo 'Verificar vírus e reparar o Windows' -Intro $intro -Itens $itens)) { return }
    $sel = @($itens | Where-Object { $_.Selecionado })
    if ($sel.Count -eq 0) { Write-Info 'Nada marcado.'; Wait-Enter; return }
    Write-Host ''
    foreach ($it in $sel) {
        Write-Step $it.Nome
        try {
            switch ($it.Acao) {
                'av' {
                    $st = Get-MpComputerStatus -ErrorAction Stop
                    if (-not $st.AntivirusEnabled) {
                        Write-Warn 'O Microsoft Defender não é o antivírus ativo (há outro antivírus instalado). Faça a verificação pelo seu antivírus.'
                    } else {
                        Write-Info 'Atualizando as definições de vírus...'
                        Update-MpSignature -ErrorAction SilentlyContinue
                        $inicio = Get-Date
                        Write-Info 'Verificando (aguarde)...'
                        Start-MpScan -ScanType QuickScan -ErrorAction Stop
                        $ameacas = @(Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.InitialDetectionTime -ge $inicio })
                        if ($ameacas.Count -gt 0) { Write-Warn ('{0} ameaça(s) encontrada(s). Abra "Segurança do Windows" > "Proteção contra vírus e ameaças" para ver e remover.' -f $ameacas.Count) }
                        else { Write-Ok 'Nenhuma ameaça encontrada.' }
                    }
                }
                'sfc' {
                    Write-Info 'Etapa 1 de 2: DISM (repara a imagem do Windows)...'
                    $p1 = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\Dism.exe') -ArgumentList '/Online /Cleanup-Image /RestoreHealth' -NoNewWindow -Wait -PassThru
                    if ($p1.ExitCode -ne 0) { Write-Warn ('O DISM terminou com o código {0} (pode ser falta de internet).' -f $p1.ExitCode) }
                    Write-Info 'Etapa 2 de 2: SFC (verifica os arquivos do sistema)...'
                    $p2 = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\sfc.exe') -ArgumentList '/scannow' -NoNewWindow -Wait -PassThru
                    if ($p2.ExitCode -eq 0) { Write-Ok 'Arquivos do Windows verificados.' } else { Write-Warn 'O SFC encontrou e corrigiu (ou tentou corrigir) problemas. Reinicie o PC.' }
                }
                'disco' {
                    $letra = $env:SystemDrive.TrimEnd(':')
                    $res = Repair-Volume -DriveLetter $letra -Scan -ErrorAction Stop
                    Write-Ok ('Resultado: {0}' -f $res)
                }
            }
        } catch { Write-Fail $_.Exception.Message }
    }
    Wait-Enter
}

# =====================================================================
#  DESFAZER (restaurar backup)
# =====================================================================
function Restore-Backup {
    Write-Banner 'Desfazer mudanças'
    $arquivos = @(Get-ChildItem -LiteralPath $Script:BackupDir -Filter ('backup_{0}_*.json' -f $env:COMPUTERNAME) -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    if ($arquivos.Count -eq 0) {
        Write-Info 'Nenhum backup deste computador foi encontrado (nada foi mudado por este programa aqui).'
        Wait-Enter
        return
    }
    Write-Host '  Backups deste computador (o mais recente primeiro):' -ForegroundColor White
    Write-Host ''
    $docs = @()
    for ($i = 0; $i -lt $arquivos.Count; $i++) {
        $doc = $null
        try { $doc = Get-Content -LiteralPath $arquivos[$i].FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
        $docs += ,$doc
        $qtd = 0
        $quando = $arquivos[$i].LastWriteTime.ToString('dd/MM/yyyy HH:mm')
        if ($doc) { $qtd = @($doc.Entradas).Count; if ($doc.Criado) { $quando = $doc.Criado } }
        Write-Host ('  {0,2}. {1}  ({2} configuração(ões) alterada(s))' -f ($i + 1), $quando, $qtd)
    }
    Write-Host ''
    Write-Info 'Desfazer volta as configurações (registro, plano de energia, programas de inicialização) como estavam.'
    Write-Info 'Apps removidos podem ser reinstalados pela Microsoft Store. Arquivos limpos eram lixo e não voltam.'
    Write-Host ''
    $r = "$(Read-Host '  Número do backup para desfazer (ENTER = voltar)')".Trim()
    $n = 0
    if (-not ([int]::TryParse($r, [ref]$n)) -or $n -lt 1 -or $n -gt $arquivos.Count) { return }
    $doc = $docs[$n - 1]
    if (-not $doc) { Write-Fail 'Não consegui ler esse backup.'; Wait-Enter; return }
    if (-not (Confirm-Choice 'Desfazer as mudanças desse backup?' $true)) { return }

    $entradas = @($doc.Entradas)
    [array]::Reverse($entradas)
    $ok = 0
    $falhas = 0
    foreach ($e in $entradas) {
        try {
            if ($e.Tipo -eq 'Registro') {
                if ($e.Existia) {
                    $tipo = [string]$e.TipoValor
                    $valor = $e.Valor
                    switch ($tipo) {
                        'Binary'      { $valor = [byte[]]@($e.Valor) }
                        'DWord'       { $valor = [int]$e.Valor }
                        'QWord'       { $valor = [long]$e.Valor }
                        'MultiString' { $valor = [string[]]@($e.Valor) }
                        default       { $valor = [string]$e.Valor }
                    }
                    if (-not (Test-Path -LiteralPath $e.Caminho)) { $null = New-Item -Path $e.Caminho -Force -ErrorAction Stop }
                    $null = New-ItemProperty -LiteralPath $e.Caminho -Name $e.Nome -Value $valor -PropertyType $tipo -Force -ErrorAction Stop
                } else {
                    if (Test-Path -LiteralPath $e.Caminho) { Remove-ItemProperty -LiteralPath $e.Caminho -Name $e.Nome -ErrorAction SilentlyContinue }
                }
                $ok++
            } elseif ($e.Tipo -eq 'PlanoEnergia') {
                if ($e.Guid) { & powercfg.exe /setactive $e.Guid 2>$null | Out-Null }
                $ok++
            }
        } catch {
            $falhas++
            Write-Fail ('{0}\{1}: {2}' -f $e.Caminho, $e.Nome, $_.Exception.Message)
        }
    }
    try {
        $arq = $arquivos[$n - 1]
        Rename-Item -LiteralPath $arq.FullName -NewName ('desfeito_' + $arq.Name) -ErrorAction Stop
    } catch {}
    Reset-SessaoBackup
    Write-Host ''
    Write-Ok ('{0} configuração(ões) restaurada(s).' -f $ok)
    if ($falhas -gt 0) { Write-Warn ('{0} não puderam ser restauradas (veja acima).' -f $falhas) }
    Write-Warn 'Reinicie o PC para tudo voltar ao normal.'
    Wait-Enter
}

# =====================================================================
#  GUIA, REINÍCIO, MODO GUIADO E MENU
# =====================================================================
function Open-Guia {
    $guia = Join-Path $Script:AppDir 'Guia.html'
    if (Test-Path -LiteralPath $guia) { Start-Process $guia; Write-Ok 'Guia aberto no navegador.' }
    else { Write-Fail ('Guia não encontrado em: {0}' -f $guia) }
    Start-Sleep -Seconds 1
}

function Invoke-Reiniciar {
    Write-Host ''
    if (Confirm-Choice 'Reiniciar o PC agora? Salve o que estiver aberto antes.' $false) {
        & shutdown.exe /r /t 10 /c 'Otimizador Gamer: reiniciando para aplicar as mudanças.'
        Write-Ok 'O PC vai reiniciar em 10 segundos.'
        Start-Sleep -Seconds 3
    }
}

function Show-Conclusao {
    Write-Banner 'Pronto! Resumo final'
    Write-Ok 'O que dava para fazer pelo Windows foi feito.'
    $manuais = @($Script:Achados | Where-Object { $_.Manual -and ($_.Nivel -eq 'Alto' -or $_.Nivel -eq 'Medio') })
    if ($manuais.Count -gt 0) {
        Write-Host ''
        Write-Host '  O que só você pode fazer (fora do Windows), em ordem de importância:' -ForegroundColor White
        Write-Host ''
        $i = 0
        foreach ($a in $manuais) {
            $i++
            $cor = 'Yellow'
            if ($a.Nivel -eq 'Alto') { $cor = 'Red' }
            Write-Host ('  {0}. {1}' -f $i, $a.Titulo) -ForegroundColor $cor
            if ($a.Solucao) { Write-Host ('     {0}' -f $a.Solucao) -ForegroundColor Gray }
            Write-Host ''
        }
    }
    Write-Host ''
    Write-Info 'Próximos passos recomendados:'
    Write-Info '  1. Reinicie o PC (algumas mudanças só valem depois disso).'
    Write-Info '  2. Abra o guia (opção G) e faça as configurações da NVIDIA e de cada jogo.'
    Write-Info '  3. Jogue uma partida com o Monitor de desempenho (opção 7) para achar o gargalo.'
    Write-Host ''
    if (Confirm-Choice 'Abrir o guia agora?' $true) { Open-Guia }
    Invoke-Reiniciar
}

function Invoke-ModoGuiado {
    Write-Banner 'Modo guiado'
    $texto = @(
        'Vou passar por todas as etapas, uma de cada vez:',
        '',
        '  1. Ponto de restauração (segurança)',
        '  2. Diagnóstico completo do PC',
        '  3. Otimizações para jogos',
        '  4. Limpeza de arquivos inúteis',
        '  5. Programas que abrem sozinhos com o Windows',
        '  6. Apps inúteis que vêm com o Windows',
        '',
        'Em cada etapa você vê tudo antes e pode pular. Nenhum arquivo pessoal é apagado.',
        'Tempo estimado: 5 a 15 minutos.'
    )
    foreach ($l in $texto) { Write-Host ('  ' + $l) -ForegroundColor Gray }
    Write-Host ''
    if (-not (Confirm-Choice 'Começar?' $true)) { return }
    Request-PontoRestauracao
    Invoke-Diagnostico
    Invoke-Otimizacoes
    Invoke-Limpeza
    Invoke-Inicializacao
    Invoke-Bloatware
    Show-Conclusao
}

function Show-Menu {
    while ($true) {
        Write-Banner 'Deixe o PC mais leve e estável para jogar'
        Write-Host '   1. MODO GUIADO: faz tudo passo a passo (recomendado)' -ForegroundColor Green
        Write-Host ''
        Write-Host '   2. Diagnóstico completo (só lê, não muda nada)'
        Write-Host '   3. Otimizações para jogos'
        Write-Host '   4. Limpeza de arquivos inúteis'
        Write-Host '   5. Programas que iniciam com o Windows'
        Write-Host '   6. Remover apps inúteis do Windows'
        Write-Host '   7. Monitor de desempenho enquanto você joga'
        Write-Host '   8. Verificar vírus e reparar o Windows'
        Write-Host '   9. Criar ponto de restauração'
        Write-Host ''
        Write-Host '   D. Desfazer mudanças (restaurar backup)'
        Write-Host '   G. Abrir o guia (BIOS, NVIDIA, Fortnite, CS2, LoL)'
        Write-Host '   R. Reiniciar o PC'
        Write-Host '   0. Sair'
        Write-Host ''
        Write-Host ('   Relatórios e backups ficam em: {0}' -f $Script:DataDir) -ForegroundColor DarkGray
        Write-Host ''
        $op = "$(Read-Host '  Escolha uma opção')".Trim().ToUpper()
        if ($op -eq '0' -or $op -eq 'S') { return }
        try {
            switch ($op) {
                '1' { Invoke-ModoGuiado }
                '2' { Invoke-Diagnostico }
                '3' { Invoke-Otimizacoes }
                '4' { Invoke-Limpeza }
                '5' { Invoke-Inicializacao }
                '6' { Invoke-Bloatware }
                '7' { Invoke-Monitor }
                '8' { Invoke-Reparo }
                '9' { Write-Banner 'Ponto de restauração'; New-PontoRestauracao; Wait-Enter }
                'D' { Restore-Backup }
                'G' { Open-Guia }
                'R' { Invoke-Reiniciar }
            }
        } catch {
            Write-Host ''
            Write-Fail ('Algo deu errado: {0}' -f $_.Exception.Message)
            Write-Info ('Linha {0}. O log completo fica em: {1}' -f $_.InvocationInfo.ScriptLineNumber, $Script:LogDir)
            Wait-Enter
        }
    }
}

# =====================================================================
#  EXECUÇÃO
# =====================================================================
try {
    Show-Menu
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}
