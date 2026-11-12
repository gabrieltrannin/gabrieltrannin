# Fuzuê

Party game 3D para jogar **online com os amigos, direto no navegador**: sem instalar nada e sem criar conta.

> **Fase 1 de 4:** servidor + salas com código e link + arena com física onde até 4 pessoas andam e se empurram. O tabuleiro, os minijogos e os bots chegam nas próximas fases.

## O que já funciona

- **Salas com código e link:** quem cria recebe um código de 4 caracteres (ex.: `K7QX`) e o link `/sala/K7QX`. Quem abre o link escolhe apelido e personagem e entra na sala.
- **Arena com física no servidor:** a física roda no servidor (Rapier, 30 vezes por segundo). Tem pilares, duas bolas gigantes empurráveis e o mar de morango em volta. Quem cai conta uma queda e renasce caindo do céu.
- **Empurrão:** um impulso para a frente; quem é acertado voa longe e fica tonto por um instante ("POW!").
- **Sem lag aparente:** o seu boneco anda na hora (previsão no cliente) e é corrigido em silêncio quando a resposta do servidor chega. Os outros jogadores aparecem suaves (interpolação).
- **6 personagens** feitos com formas simples e toon shading: Bolota, Pipoca, Tufo, Brisa, Pingo e Nuvem.
- **PC e celular:** teclado (WASD/setas + Espaço) ou joystick na tela + botão Empurrar.
- **Ping de cada jogador** na lista da sala.

## Como rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd fuzue
npm install
npm run dev
```

Isso sobe duas coisas ao mesmo tempo:

| O quê | Endereço |
| --- | --- |
| Jogo (cliente, Vite) | http://localhost:5173 |
| Servidor do jogo (Colyseus) | ws://localhost:2567 |

Abra http://localhost:5173, escolha um apelido e clique em **Criar sala**.

## Como testar com duas abas

1. Crie uma sala. A barra de endereço muda para `http://localhost:5173/sala/XXXX`.
2. Clique em **Copiar link** e abra o link numa **segunda janela** do navegador (ou numa janela anônima).
3. Escolha outro apelido e personagem e clique em **Entrar na sala XXXX**.
4. Deixe as duas janelas **lado a lado**.

> Use janelas lado a lado, não duas abas na mesma janela: o navegador pausa a aba que fica escondida, e o boneco dela para de se mexer até você voltar para ela.

### Testar pelo celular (mesma rede Wi-Fi)

O `npm run dev` já deixa o jogo aberto para a rede local. No terminal, o Vite mostra um endereço `Network`, algo como `http://192.168.0.10:5173`. Abra esse endereço no celular. O cliente se conecta sozinho ao servidor no mesmo IP, porta 2567. Se não conectar, libere as portas 5173 e 2567 no firewall do computador.

### Testar com lag de verdade

```bash
SIMULATE_LATENCY=150 npm run dev
```

Cada mensagem do servidor passa a atrasar 150 ms. O seu boneco deve continuar respondendo na hora; os outros continuam suaves, só um pouco atrasados.

## O que testar

- [ ] Criar sala → o link `/sala/XXXX` aparece e **Copiar link** funciona.
- [ ] Abrir o link em outra janela → a tela diz "Te chamaram para a sala XXXX".
- [ ] As duas janelas veem os dois bonecos com os nomes certos, e a lista mostra ping e quedas.
- [ ] Andar numa janela → o boneco anda **na hora** nela e aparece andando na outra.
- [ ] Espaço (ou o botão **Empurrar**) perto do outro → "POW!", ele voa e fica tonto.
- [ ] Empurrar as bolas gigantes e ver as duas janelas concordando onde elas estão.
- [ ] Cair da arena → "Tchibum!", +1 queda na lista e renascer caindo do céu.
- [ ] **Sair** numa janela → a outra mostra "Fulano saiu da sala".
- [ ] Digitar um código que não existe → mensagem "Não achei a sala…".
- [ ] Tentar entrar como 5º jogador → "Essa sala já está cheia".
- [ ] Repetir tudo com `SIMULATE_LATENCY=150`.

## Como o código está organizado

```
fuzue/
├── shared/            Código usado pelo servidor E pelo cliente
│   └── src/index.ts   Constantes, personagens, mensagens e a regra de movimento (stepMove)
├── server/            Node.js + Colyseus + Rapier
│   └── src/
│       ├── index.ts              Sobe o servidor HTTP/WebSocket
│       ├── rooms/ArenaRoom.ts    A sala: entrada/saída, inputs, tick de 30 Hz, empurrões
│       ├── rooms/ArenaState.ts   O que é sincronizado com os clientes
│       ├── rooms/roomCodes.ts    Gera os códigos de 4 caracteres
│       └── physics/ArenaWorld.ts Mundo de física (plataforma, pilares, bolas, jogadores)
└── client/            TypeScript + Vite + Three.js
    └── src/
        ├── main.ts               Liga menu, cena e partida
        ├── game/Stage.ts         Cena 3D, câmera, nomes e efeitos
        ├── game/Session.ts       Rede: previsão, reconciliação e interpolação
        ├── game/critter.ts       Os bonecos (montados com esferas e cones)
        ├── game/Input.ts         Teclado, joystick e botão de empurrar
        ├── net/connection.ts     Endereço do servidor, criar/entrar na sala
        └── ui/                   Menu, HUD da sala e avisos
```

### Como a rede funciona (resumo)

1. **O servidor manda.** Cada cliente envia só o input ("quero ir para a direita", "empurrei") 30 vezes por segundo, numerado. O servidor aplica a regra de movimento (`stepMove`, em `shared/`), roda a física e manda o estado de volta, dizendo qual foi o último input que processou.
2. **Previsão.** O cliente aplica a mesma `stepMove` no próprio boneco assim que você aperta a tecla, sem esperar o servidor.
3. **Reconciliação.** Quando chega o estado oficial, o cliente parte dele e reaplica os inputs que o servidor ainda não viu. Se sobrar alguma diferença (por exemplo, alguém te empurrou), ela é corrigida aos poucos, sem teleporte.
4. **Interpolação.** Os outros jogadores são desenhados ~100 ms no passado, deslizando entre dois estados recebidos.

Num teste com 150 ms de atraso simulado, a correção mediana da previsão foi 0 cm e 95% das correções ficaram abaixo de 2 cm. As correções maiores acontecem em empurrões, que só o servidor decide.

### Ajustar o jogo

Os números que definem a sensação do jogo ficam em `shared/src/index.ts`:

- `MOVE`: velocidade, aceleração, força e recarga do empurrão, tempo de tontura.
- `ARENA`: tamanho da plataforma, gravidade, posição dos pilares e das bolas.
- `CHARACTERS`: nome e cores dos personagens.

Como servidor e cliente leem o mesmo arquivo, a previsão continua batendo depois da mudança.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe servidor + cliente com recarga automática |
| `npm run typecheck` | Confere os tipos dos três pacotes |
| `npm run build` | Gera o cliente de produção em `client/dist` |
| `npm start` | Sobe só o servidor (modo produção) |

## Publicar (prévia; o deploy completo é a Fase 4)

- **Cliente → Vercel:** crie um projeto apontando para a pasta `client` e defina a variável `VITE_SERVER_URL` com o endereço do servidor (ex.: `wss://fuzue-server.onrender.com`). O `client/vercel.json` já faz os links `/sala/XXXX` funcionarem.
- **Servidor → Render, Railway ou Fly.io:** precisa de um host que mantenha conexões WebSocket abertas, e a Vercel não faz isso. Comando de início: `npm install && npm start` na raiz `fuzue/`. A porta vem da variável `PORT`.

## Problemas comuns

- **"Não consegui falar com o servidor do jogo"**: o servidor não está rodando ou a porta 2567 está bloqueada. Veja o terminal do `npm run dev`.
- **Aviso `using deprecated parameters for the initialization function`** no terminal do servidor: vem de dentro da biblioteca de física e pode ser ignorado.
- **O boneco da outra aba parou**: ela está escondida e o navegador pausou. Use duas janelas lado a lado.

## Próximas fases

- **Fase 2:** lobby completo (pronto/não pronto, anfitrião escolhe rodadas e tabuleiro) e o tabuleiro "Ilha Confeito" sincronizado: turnos, dado, moedas, coroas e loja.
- **Fase 3:** 6 minijogos online, bots (preenchem vagas e substituem quem cair) e reconexão pelo mesmo link.
- **Fase 4:** polimento (sons, partículas, customização, celular) e deploy.
