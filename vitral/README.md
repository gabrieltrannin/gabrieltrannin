# Vitral

Cliente de música leve e pessoal, feito em Rust. Toca as músicas da sua conta do Spotify
num app nativo (sem navegador por baixo), com visual escuro e fila sempre à mão.

> App pessoal e não oficial. Usa a biblioteca [librespot](https://github.com/librespot-org/librespot)
> para tocar as músicas, e o Spotify não autoriza oficialmente esse tipo de cliente. Use por sua conta.
> **Precisa de conta Premium.**

## Como usar (Windows)

1. Baixe o `Vitral.exe` e coloque numa pasta sua (ex.: `Documentos\Vitral`).
2. Abra. Na primeira vez o Windows pode mostrar "O Windows protegeu o computador",
   porque o programa não tem assinatura digital. Clique em **Mais informações → Executar assim mesmo**.
3. Clique em **Entrar com o Spotify**. O navegador abre na página de login do Spotify. Depois de entrar, volte pro app.
   O login fica salvo; nas próximas vezes ele entra sozinho.

Pra testar a interface sem conta: `Vitral.exe --demo` (sem áudio, só dados de exemplo).

## O que tem nesta versão (0.1.0)

- Login com a conta do Spotify (pelo navegador) e login salvo.
- Biblioteca: Músicas curtidas, playlists, álbuns salvos e artistas seguidos, com filtro.
- Início: atalhos pras playlists, tocadas recentemente e seus artistas.
- Busca enquanto digita: músicas, artistas, álbuns e playlists.
- Página de playlist/álbum/artista com filtro e ordenação por título, álbum, data e duração.
- Player: tocar/pausar, anterior/próxima, aleatório, repetir (lista ou música), barra de progresso e volume.
- Fila sempre visível à direita.
- Curtir/descurtir músicas.
- Configurações: cor de destaque, qualidade (96/160/320 kbps), normalização de volume, atualizações.
- Atalhos: Espaço (tocar/pausar), Ctrl+→/← (próxima/anterior), Ctrl+K (buscar), Ctrl+L (curtir),
  Ctrl+Q (fila), Ctrl+↑/↓ (volume).

Ainda não tem: tocar em outros aparelhos (Spotify Connect), letra, mini player, ícone na bandeja e teclas de mídia.

## Onde ficam os arquivos

`%APPDATA%\Vitral` guarda o login (`auth.json`), as configurações (`settings.json`), um cache de áudio
de até 400 MB e o registro de erros (`vitral.log`). Pra sair da conta, use **Configurações → Sair da conta**.
O botão **Abrir pasta** em Configurações abre esse lugar.

## Atualizações

O app procura versões novas na aba **Releases** deste repositório (`gabrieltrannin/gabrieltrannin`).
Uma versão nova é uma release com a tag `vitral-vX.Y.Z` (ex.: `vitral-v0.2.0`) e o `.exe` anexado.
Em **Configurações → Atualizações** dá pra escolher entre **Perguntar antes** (sim ou não a cada versão)
e **Instalar sozinho**.

Enquanto nenhuma release `vitral-v…` for publicada, o app simplesmente diz que está atualizado.

## Compilar

Precisa do [Rust](https://rustup.rs) 1.85 ou mais novo.

```sh
# No próprio Windows
cargo build --release
# O programa fica em target\release\vitral.exe

# No Linux, gerando o .exe do Windows
sudo apt install mingw-w64
rustup target add x86_64-pc-windows-gnu
cargo build --release --target x86_64-pc-windows-gnu
```

Estrutura do código (`src/`):

| Arquivo | O que faz |
| --- | --- |
| `main.rs` | Abre a janela. |
| `app.rs` | Toda a interface (telas, player, fila, configurações). |
| `backend.rs` | Motor em segundo plano: login, Spotify, áudio, capas, atualizações. |
| `spotify.rs` | Chamadas à Web API do Spotify. |
| `auth.rs` | Login pelo navegador e renovação do token. |
| `updater.rs` | Procura, baixa e instala versões novas. |
| `theme.rs`, `icons.rs` | Cores, fontes e ícones. |
| `settings.rs`, `logger.rs` | Configurações salvas e registro de erros. |
| `demo.rs` | Dados de exemplo do modo `--demo`. |

Fonte: [Inter](https://rsms.me/inter/) (licença SIL OFL, em `assets/fonts/OFL.txt`).
