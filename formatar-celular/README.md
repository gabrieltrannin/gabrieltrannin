# 📱 Formatar Celular pelo PC

Programa com janela (Python + Tkinter) para **formatar (restaurar de fábrica) um celular Android pelo computador**, usando as ferramentas oficiais do Google: **ADB** e **Fastboot**.

Antes de formatar, ele também faz **backup das fotos, vídeos e arquivos** do celular para o PC.

> [!WARNING]
> Formatar apaga **tudo** do celular e não dá para desfazer. Faça o backup antes e confira os arquivos.

## O que o programa faz

1. **Conecta** no celular pelo cabo USB e mostra marca, modelo, versão do Android, bateria e as contas Google que estão nele.
2. **Faz backup** de fotos e vídeos da câmera, imagens, vídeos, músicas, downloads, documentos e mídia do WhatsApp (as datas originais dos arquivos são mantidas).
3. **Formata** o celular de um destes jeitos:

| Método | Como funciona | Quando usar |
| --- | --- | --- |
| **Recovery** (recomendado) | O PC reinicia o celular no modo Recovery e mostra o passo a passo. Você confirma a formatação nos botões do celular. | Funciona na maioria dos Android, inclusive Samsung. |
| **Fastboot** (automático) | O PC reinicia o celular no bootloader, apaga os dados (`fastboot -w`) e reinicia. | Só com o **bootloader desbloqueado** (Pixel, Motorola, Xiaomi...). Samsung não tem Fastboot. |

Por segurança, a formatação só começa depois que você **digita `FORMATAR`** para confirmar. No Fastboot, se o bootloader estiver bloqueado, o programa avisa e **não apaga nada**.

## Como usar

### 1. Instale o Python

Baixe em [python.org](https://www.python.org/downloads/) (versão 3.9 ou mais nova). No Windows, marque **"Add Python to PATH"** na instalação. O Tkinter já vem junto.

> No Linux, se aparecer erro de `tkinter`, instale com `sudo apt install python3-tk`.

### 2. Abra o programa

Dentro da pasta `formatar-celular`:

```bash
python app.py
```

Na primeira vez, clique em **"Baixar ferramentas (ADB)"**. O programa baixa o [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools) direto do site do Google (cerca de 10 MB) e salva na pasta `platform-tools`. Se você já tiver o ADB instalado, ele é encontrado automaticamente.

### 3. Ative a Depuração USB no celular

1. **Configurações > Sobre o telefone**.
2. Toque **7 vezes** em **"Número da versão"** (ou "Versão do MIUI" / "Número de compilação") até aparecer *"Você agora é um desenvolvedor"*.
3. **Configurações > Sistema > Opções do desenvolvedor** → ative **"Depuração USB"**.
4. Conecte o cabo, desbloqueie a tela e toque em **"Permitir"** na mensagem *"Permitir depuração USB?"*.
5. No programa, clique em **"Procurar celular"**.

### 4. Backup → Formatar

Clique em **"Fazer backup..."**, escolha uma pasta e espere terminar. Depois escolha o método e clique em **"FORMATAR CELULAR"**.

## ⚠️ Antes de formatar

- **Conta Google:** depois de formatar, o celular vai pedir a conta Google que estava nele e a senha (é a *proteção contra roubo* do Android). Tenha a senha em mãos ou remova a conta em *Configurações > Contas*. O programa mostra quais contas estão no aparelho.
- **Bateria:** deixe com pelo menos 30%.
- **Contatos, conversas e apps** não entram no backup de arquivos: sincronize com a conta Google (*Configurações > Google > Backup*) e faça o backup do WhatsApp pelo próprio app.

## Problemas comuns

| Problema | Solução |
| --- | --- |
| Celular não aparece | Use um cabo que transmita dados, troque a porta USB e confira se a Depuração USB está ativa. No Windows, instale o driver USB do fabricante (ex.: *Samsung USB Driver*). |
| "Aguardando autorização" | Desbloqueie a tela e toque em **Permitir**. Se não aparecer, em *Opções do desenvolvedor* toque em *Revogar autorizações de depuração USB* e reconecte. |
| "Sem permissão de acesso ao USB" (Linux) | Instale as regras udev: `sudo apt install android-sdk-platform-tools-common` e reconecte o cabo. |
| Robô deitado escrito "Nenhum comando" | Segure **LIGA/DESLIGA** e aperte **VOLUME PARA CIMA** uma vez. |
| Fastboot não encontra o celular | Use o método Recovery. Para sair da tela do bootloader, segure **LIGA/DESLIGA** por uns 10 segundos. |

## E iPhone?

O iPhone não tem ADB. Para formatar pelo PC, use o app oficial da Apple: **Finder** (Mac) ou **Dispositivos Apple / iTunes** (Windows) → conecte o iPhone → **Restaurar iPhone**. Antes, desative o *Buscar iPhone* (ou tenha a senha do ID Apple).

## Gerar um `.exe` (opcional)

Para usar em um PC sem Python:

```bash
pip install pyinstaller
```

```bash
pyinstaller --onefile --windowed --name FormatarCelular app.py
```

O executável fica em `dist/FormatarCelular.exe`. As ferramentas ADB são baixadas na mesma pasta do `.exe` quando você clicar em "Baixar ferramentas".

## Estrutura do código

```
formatar-celular/
├── app.py          # janela (Tkinter): botões, avisos e registro
├── adb_tools.py    # comandos do ADB/Fastboot e leitura das respostas
└── tests/
    └── test_adb_tools.py
```

Rodar os testes:

```bash
python -m unittest discover -s tests
```

## Tecnologias

Python · Tkinter · ADB · Fastboot · `subprocess` · `threading` · `unittest`. Só usa a biblioteca padrão do Python, nada para instalar com `pip`.
