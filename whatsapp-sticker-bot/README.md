# 🤖 Bot de Figurinhas para WhatsApp

Bot que transforma **fotos, vídeos e GIFs em figurinhas** do WhatsApp:

- 📸 **Foto → figurinha estática**
- 🎬 **Vídeo ou GIF → figurinha animada** (até 10 segundos)
- 🖼️ **Figurinha → imagem/vídeo** de volta
- ✏️ **Renomear figurinha** (trocar nome do pacote e autor)

Feito em **Node.js** com a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys), que conecta no WhatsApp do mesmo jeito que o WhatsApp Web, sem precisar de navegador aberto.

---

## ⚠️ Antes de começar

- Use um **número separado** para o bot (um chip pré-pago serve). Bots desse tipo **não são oficiais** e o WhatsApp pode banir o número, principalmente se ele mandar mensagens para muita gente.
- O bot só funciona enquanto o programa estiver rodando (no seu PC, num servidor, num Raspberry Pi...).
- A pasta `auth/` que aparece depois de conectar é a **sessão do WhatsApp**. Quem tiver essa pasta consegue usar o número, então **não compartilhe e não envie para o GitHub** (o `.gitignore` já impede isso).

---

## 🚀 Como rodar

### 1. Instale o Node.js

Baixe a versão **LTS (22 ou mais nova)** em <https://nodejs.org> e instale.
Para conferir, abra o terminal e digite:

```bash
node --version
```

### 2. Baixe o projeto e instale as dependências

```bash
git clone https://github.com/gabrieltrannin/gabrieltrannin.git
cd gabrieltrannin/whatsapp-sticker-bot
npm install
```

> Não precisa instalar o ffmpeg separado: ele já vem junto pelo `npm install`.

### 3. Ligue o bot

```bash
npm start
```

Vai aparecer um **QR Code** no terminal. No celular com o número do bot:

**WhatsApp → ⋮ (ou Configurações) → Aparelhos conectados → Conectar um aparelho** e escaneie.

Quando aparecer `✅ Bot conectado!` está pronto. Da próxima vez que rodar `npm start` ele conecta sozinho, sem QR Code.

<details>
<summary>📟 Prefere conectar com código em vez de QR Code?</summary>

Crie um arquivo `.env` (copie o `.env.example`) e preencha o número do bot com DDI e DDD, só números:

```env
PHONE_NUMBER=5541999998888
```

Rode `npm start`. Vai aparecer um código de 8 dígitos. No celular: **Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone** e digite o código.

</details>

---

## 💬 Como usar

| O que fazer | Como |
|---|---|
| Figurinha (no privado) | Só mandar a foto, vídeo ou GIF para o bot |
| Figurinha (em grupo) | Mandar a mídia com a legenda `!s`, ou responder uma mídia com `!s` |
| Figurinha quadrada (cortada no centro) | `!s cortar` |
| Escolher pacote e autor | `!s Nome do Pacote \| Autor` |
| Figurinha → imagem/vídeo | Responder a figurinha com `!toimg` |
| Trocar pacote e autor de uma figurinha | Responder a figurinha com `!renomear Pacote \| Autor` |
| Ver os comandos | `!menu` |

Detalhes:

- Por padrão a imagem fica **inteira** dentro da figurinha, com fundo transparente nas sobras. Com `cortar`, ela preenche o quadrado todo.
- Enquanto processa, o bot reage à sua mensagem com ⏳.
- Fotos e vídeos mandados **como documento** (sem compressão) também funcionam.
- Mídias de **visualização única** não são convertidas, por respeito a quem enviou.
- Também dá para usar no seu próprio número, mandando os comandos na conversa com você mesmo.

---

## ⚙️ Configurações

Copie o `.env.example` para `.env` e mude o que quiser:

| Variável | Padrão | O que faz |
|---|---|---|
| `PREFIX` | `!` | Prefixo dos comandos |
| `PACK_NAME` | `Figurinhas` | Nome do pacote padrão |
| `PACK_AUTHOR` | `Sticker Bot` | Autor padrão |
| `AUTO_STICKER_PRIVATE` | `true` | No privado, converter mídia sem precisar de comando |
| `MAX_VIDEO_SECONDS` | `10` | Duração máxima da figurinha animada |
| `MAX_MEDIA_MB` | `30` | Tamanho máximo do arquivo recebido |
| `PHONE_NUMBER` | (vazio) | Conectar por código de pareamento em vez de QR Code |
| `MAX_CONCURRENT` | `2` | Quantas conversões rodam ao mesmo tempo |
| `LOG_LEVEL` | `silent` | Mais detalhes no terminal (`warn`, `info`, `debug`) |

---

## 🛠️ Como funciona por dentro

```
src/
├── index.js     → conecta no WhatsApp (QR Code / código) e reconecta se cair
├── bot.js       → lê cada mensagem e decide o que fazer (comandos)
├── messages.js  → entende o texto, o comando e a mídia da mensagem
├── sticker.js   → converte a mídia em figurinha (e de volta)
├── exif.js      → grava o nome do pacote e o autor dentro da figurinha
├── queue.js     → fila para não converter vídeos demais ao mesmo tempo
└── config.js    → configurações (.env)
```

- **Figurinha estática:** a imagem é redimensionada para 512×512 com o [sharp](https://sharp.pixelplumbing.com/) e salva em WebP. O bot vai baixando a qualidade até ficar com menos de 100 KB, que é o limite recomendado pelo WhatsApp.
- **Figurinha animada:** o [ffmpeg](https://ffmpeg.org/) converte o vídeo em WebP animado 512×512 a 15 quadros por segundo. Se passar de 500 KB, o bot tenta de novo com menos qualidade, menos quadros e menos tempo até caber.
- **Pacote e autor:** ficam gravados nos metadados (EXIF) do arquivo WebP. É isso que aparece quando alguém toca na figurinha.

### Testes

```bash
npm test
```

Os testes geram fotos e vídeos na hora e simulam conversas inteiras com um "WhatsApp falso". Assim dá para testar tudo sem precisar de celular.

---

## ❓ Problemas comuns

- **O QR Code some ou expira:** ele é renovado sozinho a cada ~20 segundos, é só escanear o mais recente.
- **"A sessão foi desconectada pelo celular":** apague a pasta `auth/` e rode `npm start` de novo.
- **Figurinha animada ficou com qualidade ruim:** vídeos longos ou com muito movimento precisam ser comprimidos para caber no limite. Vídeos mais curtos ficam melhores.
- **Quero deixar ligado 24h:** rode num computador que fique sempre ligado ou numa VPS. Com o [pm2](https://pm2.keymetrics.io/) dá para reiniciar sozinho se cair: `npx pm2 start src/index.js --name figurinhas`.
