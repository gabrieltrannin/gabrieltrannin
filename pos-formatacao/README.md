# Pós-formatação

Um app para rodar logo depois de formatar o Windows. Ele abre uma janela,
você marca o que quer e clica em **Começar**:

- instala os programas da lista (as **minhas versões** quando o instalador
  está na pasta, ou a versão oficial pelo winget ou por um link);
- aplica otimizações seguras no Windows, começando por um ponto de restauração.

Tem um **modo teste** que só mostra o que faria, sem mudar nada.

## Como usar

1. Baixe o kit em **Actions → Pós-formatação (gerar .exe) → última execução → Artifacts → PosFormatacao**.
2. Copie a pasta para o pendrive ou para o Drive. Ela fica assim:

   ```
   PosFormatacao.exe
   apps.json              ← lista de programas (dá pra editar no Bloco de Notas)
   instaladores/
       spotify-leve.exe   ← suas versões ficam aqui
       discord-leve.exe
       brave-leve.exe
   ```

3. Depois de formatar, abra o `PosFormatacao.exe` e aceite o pedido de
   administrador. Se quiser, teste primeiro com o modo teste ligado.

> Se o Windows mostrar "O Windows protegeu o computador", clique em
> **Mais informações → Executar assim mesmo**. Isso aparece com qualquer
> `.exe` que não tem assinatura digital paga.

## A lista de programas (`apps.json`)

Cada programa tem uma lista de **fontes**. O app usa a primeira que estiver
disponível e, se ela falhar, tenta a próxima.

| Fonte | Para que serve | Exemplo |
|---|---|---|
| `arquivo` | Instalador que está na pasta do app | `{ "arquivo": "instaladores/discord-leve.exe" }` |
| `url` | Link para baixar o instalador | `{ "url": "https://github.com/gabrieltrannin/discord-leve/releases/latest/download/discord-leve.exe" }` |
| `winget` | Versão oficial, pelo gerenciador de pacotes do Windows | `{ "winget": "Valve.Steam" }` |

Em qualquer fonte dá para colocar `"args"` com as opções do instalador,
por exemplo `["/S"]` para instalar sem perguntar nada. Sem `args`, a janela
do instalador abre normalmente e o app espera você terminar.

Exemplo de programa novo:

```json
{
  "nome": "VLC",
  "descricao": "Player de vídeo.",
  "marcado": false,
  "fontes": [
    { "winget": "VideoLAN.VLC" }
  ]
}
```

- Para achar o id de um programa no winget: abra o terminal e rode `winget search nome`.
- `"marcado": false` faz o programa aparecer desmarcado.
- Se você publicar seus clientes no **GitHub Releases**, o link
  `.../releases/latest/download/NOME-DO-ARQUIVO.exe` sempre baixa a versão
  mais nova. Assim o pendrive nunca fica desatualizado.
- O instalador oficial do Spotify se recusa a rodar como administrador, por
  isso o Spotify da lista só usa o seu cliente.

## Otimizações

| Otimização | O que faz |
|---|---|
| Ponto de restauração | Salva as configurações antes de mexer. Sempre roda primeiro. |
| Alto desempenho | Plano de energia que não segura o processador. |
| Ajustes para jogos | Liga o Modo de Jogo e desliga a gravação em segundo plano do Game Bar. |
| Aceleração do mouse | Desliga o "Aumentar precisão do ponteiro". |
| Anúncios e sugestões | Tira propagandas e apps que o Windows instala sozinho. |
| Bing no Iniciar | A pesquisa do Iniciar procura só no PC. |
| Telemetria | Desliga o serviço DiagTrack. |
| Extensões de arquivos | Mostra `.exe`, `.pdf` etc. no nome dos arquivos. |
| Arquivos temporários | Limpa o que sobrou dos instaladores. Roda por último. |

Ficaram de fora de propósito: desligar o Windows Defender, o Windows Update
ou o UAC, "limpadores de registro" e remover apps do sistema à força. Essas
coisas costumam quebrar o Windows ou deixar o PC desprotegido.

Para desfazer tudo: **Painel de Controle → Recuperação → Abrir a Restauração
do Sistema** e escolha o ponto "Antes da pos-formatacao".

## Rodando pelo código

Precisa do Python 3.10 ou mais novo.

```bash
python main.py --simular            # abre no modo teste
python -m unittest discover -s tests -v
```

O `.exe` é gerado pelo GitHub Actions num Windows de verdade
(`.github/workflows/pos-formatacao.yml`), que também testa o app e aplica as
otimizações numa máquina virtual para conferir que funcionam.

| Arquivo | O que tem |
|---|---|
| `instalador/app.py` | A janela |
| `instalador/programas.py` | Lê o `apps.json` e instala os programas |
| `instalador/otimizacoes.py` | As otimizações (scripts do PowerShell) |
| `instalador/execucao.py` | A ordem das etapas |
| `instalador/executor.py` | Roda os comandos, ou só mostra no modo teste |
