# Fuzuê

Party game 3D medieval para jogar **online com os amigos, direto no navegador**, no PC, celular ou tablet. Sem instalar nada e sem criar conta.

Seis bichinhos vestidos para a corte disputam a coroa: **Bolota** o cavaleiro (urso), **Pipoca** a bruxa (coelha), **Tufo** o arqueiro (gato), **Brisa** a boba da corte (axolote), **Pingo** o viking (pinguim) e **Nuvem** o frade (ovelha).

Tabuleiro com coroas, moedas, itens e loja; 6 minijogos com física caótica; bots que completam a mesa ou assumem quem cair da internet.

## Como se joga

1. Alguém abre o site, escolhe apelido e personagem e toca em **Criar sala**.
2. Manda o link (ou o código de 4 letras, como `K7QX`) no grupo.
3. Quem abrir o link escolhe apelido e personagem e aperta **Pronto**.
4. O anfitrião escolhe o número de rodadas e se as vagas vazias viram bots, e toca em **Começar partida**.

Cada rodada: todo mundo joga um turno no tabuleiro e depois vem um minijogo. Quem tiver mais **coroas** no fim vence (desempate: moedas).

### O tabuleiro (Vale da Coroa)

| Casa | O que faz |
| --- | --- |
| Azul | +3 moedas |
| Vermelha | −3 moedas |
| Evento do reino (?) | surpresa: tributo dos aldeões, ladrões da floresta, presente do rei, coroa muda de lugar, feitiço de teletransporte, banquete no castelo |
| Mercador | compra itens |
| Armadilha de caçador (!) | −5 moedas |
| Duelo (VS) | dados contra alguém: quem tirar mais leva até 5 moedas |

- **Coroa:** custa 20 moedas. Passou pela casa da coroa com dinheiro, compra na hora, e ela muda de lugar.
- **Bifurcações:** em duas casas você escolhe entre o caminho normal e o atalho.
- **Itens** (até 3 na bolsa): 🎲 dados viciados (dado duplo), 🤛 manopla (rouba 5 moedas de quem tem mais), 💣 armadilha de pólvora, 🛡️ escudo, 💰 bolsa do mercador (ímã de moedas), 📜 pergaminho de troca (troca de lugar).
- **Final:** dois prêmios surpresa, cada um valendo +1 coroa (campeão dos torneios, andarilho do reino, alquimista ou azarado do reino).

### Minijogos

| Minijogo | Objetivo |
| --- | --- |
| Lago Congelado | o gelo racha e encolhe: empurre todos para a água |
| Torre em Ruínas | três andares de pedras que desabam depois de pisadas, com lava embaixo |
| Ponte do Castelo | pule buracos, vença a correnteza e desvie das toras giratórias até o portão |
| Tesouro do Dragão | pegue moedas que caem e fuja das bolas de fogo |
| Barril de Pólvora | passe o barril aceso encostando nos outros antes de explodir |
| Torneio da Bola | 2 contra 2, Casa do Leão contra Casa do Lobo (times equilibrados pela colocação) |

Prêmios: 1º +10, 2º +6, 3º +3 moedas. No Torneio da Bola, cada jogador do time vencedor ganha +8.

### Controles

| | Andar | Pular | Empurrar |
| --- | --- | --- | --- |
| PC | WASD ou setas | Espaço | J, E, Shift ou clique |
| Controle (gamepad) | analógico ou direcional | A | X ou B |
| Celular / tablet | joystick na tela | botão Pular | botão Empurrar |

No tabuleiro, arraste a tela para girar a câmera. Os botões 💬 mandam emotes e frases rápidas, que aparecem em balão sobre o personagem.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd fuzue
npm install
npm run dev
```

| O quê | Endereço |
| --- | --- |
| Jogo (site) | http://localhost:5173 |
| Servidor do jogo | ws://localhost:2567 |

Para jogar sozinho contra bots, crie a sala e toque em **Começar partida**. Os bots ocupam as vagas.

**Testar com outra pessoa no mesmo Wi-Fi:** o terminal mostra um endereço `Network` (ex.: `http://192.168.0.10:5173`). Abra no celular. Para testar sozinho com dois jogadores, abra o link da sala numa **segunda janela** lado a lado; em duas abas da mesma janela, o navegador pausa a aba escondida.

### Variáveis úteis do servidor

| Variável | Para quê |
| --- | --- |
| `GAME_SPEED=3` | acelera todas as esperas (testes) |
| `MINIGAME_ORDER=corrida,futebol` | força a ordem dos minijogos |
| `SIMULATE_LATENCY=150` | simula 150 ms de atraso de internet |
| `PORT` | porta do servidor (padrão 2567) |

Exemplo: `GAME_SPEED=3 MINIGAME_ORDER=futebol npm run dev`.

### Testes

```bash
npm test -w @fuzue/server                                  # partida completa: lobby → 10 rodadas → pódio
npx tsx test/simular.ts corrida 10 1   # (dentro de server/) simula um minijogo só com bots
npm run typecheck                                          # confere os tipos dos três pacotes
```

## Como o código está organizado

```
fuzue/
├── shared/src/        Regras usadas pelo servidor E pelo navegador
│   ├── physics.ts     Física dos bonecos (andar, pular, empurrar), determinística
│   ├── board.ts       Casas e caminhos do tabuleiro
│   ├── minigames.ts   Textos e "mundo" (chão, buracos, esteiras) de cada minijogo
│   ├── constants.ts   Personagens, itens, prêmios, rodadas, versão do protocolo
│   └── messages.ts    Mensagens trocadas entre navegador e servidor
├── server/src/        Node.js + Colyseus
│   ├── rooms/GameRoom.ts         Sala: lobby, fases da partida, bots, reconexão
│   ├── board/BoardController.ts  Turnos, dados, itens, loja, eventos, coroa, duelos
│   └── minigames/                Os 6 minijogos (cada um com seu bot)
└── client/src/        TypeScript + Vite + Three.js
    ├── views/         Telas 3D: menu, lobby, tabuleiro, minijogos, pódio
    ├── engine/        Renderizador, bonecos, cenário, controles
    ├── net/           Conexão, reconexão e tipos do estado
    ├── ui/            Menu, conversa, avisos
    └── audio/         Sons e música sintetizados (sem arquivos)
```

**Rede, em resumo:** o servidor manda em tudo (dados, moedas, física dos minijogos), então ninguém trapaceia pelo navegador. No minijogo, o seu boneco anda na hora porque o navegador roda a mesma física (`shared/physics.ts`) e só se corrige quando chega a resposta do servidor. Os outros jogadores aparecem suavizados (interpolação). Se a internet cair, um bot joga por você e o link da sala te devolve à partida por até 3 minutos.

## Publicar e lançar atualizações

| Parte | Onde fica | Endereço |
| --- | --- | --- |
| Site (`client/`) | Vercel, projeto `fuzue` | https://fuzue-delta.vercel.app |
| Servidor (`server/`) | Render, serviço `fuzue-servidor` (plano grátis) | https://fuzue-servidor.onrender.com |

O servidor fica no Render porque precisa manter conexões abertas, e a Vercel não faz isso. O endereço do servidor que o site usa está em `client/.env.production`.

### Primeira publicação do servidor

1. Crie uma conta grátis em [render.com](https://render.com) (pode entrar com o GitHub).
2. Abra o link **Deploy to Render** abaixo. Ele lê o `render.yaml` da raiz do repositório e cria o serviço `fuzue-servidor`:
   https://render.com/deploy?repo=https://github.com/gabrieltrannin/gabrieltrannin/tree/ccr-7338054c-9tuvm0
3. Espere o primeiro deploy (~3 minutos). Teste em https://fuzue-servidor.onrender.com/health: tem que aparecer `{"ok":true,...}`.

Quando o código for para o branch `main`, troque o final do link por `/tree/main` (ou só o endereço do repositório).

### Lançar uma atualização

1. Mude o código e teste com `npm run dev`.
2. Rode `npm test -w @fuzue/server` e `npm run typecheck`.
3. Se mudou **mensagens ou estado** entre site e servidor, suba `PROTOCOL_VERSION` em `shared/src/constants.ts`. Quem estiver com a página antiga aberta é avisado para recarregar.
4. **Servidor:** faça push no GitHub. Com o serviço criado pelo `render.yaml`, o Render publica sozinho (`autoDeploy`). Também dá para clicar em *Manual Deploy* no painel do Render.
5. **Site:** `npm run deploy:site -w @fuzue/client`. Precisa do Vercel CLI logado (`npx vercel login`) ou de `VERCEL_TOKEN`. Quem estiver com o jogo aberto vê o aviso **"Saiu uma atualização!"**.

Também dá para pedir ao Claude: "publica o site" / "publica o servidor".

Partidas em andamento não caem com uma atualização do site. Uma atualização do servidor reinicia as salas abertas, então publique o servidor quando ninguém estiver jogando.

### Plano grátis do Render

O servidor gratuito "dorme" depois de 15 minutos sem ninguém jogando. A primeira pessoa do dia vê "Acordando o servidor…" por até um minuto; depois disso, tudo normal.
