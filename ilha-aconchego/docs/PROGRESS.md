# Progresso da Ilha Aconchego

Atualizado ao fim de cada etapa: o que foi feito, como testar e o que falta. O design está em [GAME_DESIGN.md](GAME_DESIGN.md).

## Como rodar

```bash
npm install        # uma vez
npm run dev        # abre em http://localhost:5173
npm run dev:host   # o mesmo, visível para o celular na mesma rede Wi-Fi
npm test           # testes de lógica (Vitest)
npm run typecheck  # checagem de tipos
npm run build      # checagem de tipos + versão de produção em dist/
```

## Plano das etapas

- [x] **Etapa 0**: base do projeto, documento de design, cena de teste, comandos e relógio
- [x] **Etapa 1**: mundo e visual
- [x] **Etapa 2**: personagem, controle e interface
- [ ] **Etapa 3**: fazenda e atividades
- [ ] **Etapa 4**: vila e moradores
- [ ] **Etapa 5**: casa, decoração, ofícios e progressão
- [ ] **Etapa 6**: exploração e eventos
- [ ] **Etapa 7**: multijogador
- [ ] **Etapa 8**: opções, som, acessibilidade e publicação
- [ ] **Etapa 9**: expansão

---

## Etapa 2: personagem, controle e interface (concluída)

### O que foi feito

- **Criador de personagem** (`src/ui/creator.ts`, `src/render/avatar.ts`, `src/data/appearance.ts`): é a primeira tela quando não há jogo salvo e começa com a Ana. A prévia 3D tem renderizador próprio, gira sozinha e ao arrastar. Abas: Corpo (humano, elfo, povo-gato, povo-coelho; 6 tons de pele), Rosto (5 olhos, cor dos olhos, 4 bocas, bochechas coradas ou não), Cabelo (6 estilos e cor), Roupa (camiseta, vestido, jardineira, moletom; cores de cima, de baixo e dos sapatos), Acessório (chapéu de palha, gorro, laço, coroa de flores, broto) e Ilha (seu nome, nome da ilha e fruta nativa). Botões "Sortear visual", "Voltar ao padrão" e "Começar a jogar". O rosto é uma textura de canvas redesenhada a cada mudança.
- **Controle** (`src/input/input.ts`, `src/game/playerController.ts`, `src/ui/touchControls.ts`): uma só entrada para os três jeitos de jogar.
  - Teclado: WASD ou setas andam, Shift corre, E faz a ação, 1 a 8 escolhem o item, Tab abre a mochila, M mostra a ilha toda, Q e R giram a câmera, Esc fecha.
  - Toque: direcional virtual, botão Ação, Correr (liga e desliga) e Mochila; tocar no minimapa mostra a ilha toda. Aparecem em telas de toque ou no primeiro toque.
  - Controle de videogame: analógico esquerdo anda, o direito gira a câmera, A faz a ação, B corre, Y abre a mochila, X ou Back mostra a ilha toda, LB e RB trocam o item.
  - O movimento é relativo à câmera, com giro suave e animações de parada (respiração), andar e correr.
- **Colisão** (`src/world/collision.ts`, `src/data/footprints.ts`): círculos e caixas montados a partir dos dados do mapa e da pegada de cada objeto (casa, cercas, árvores, barracas, cercas vivas, postes, móveis, pedras, barris). A personagem desliza ao encostar. Os níveis só se ligam pela rampa e pela escada (degrau máximo de 0,36); ela guarda distância da beira, do mar e dos paredões e anda no píer. Boneco de neve e abóboras de enfeite só bloqueiam na estação em que aparecem.
- **Câmera**: segue a personagem. O minimapa (ou M) alterna para a ilha toda.
- **Bichinho** (`src/game/pet.ts`): a coelhinha Bolinha segue a jogadora aos pulinhos, um pouco atrás e de lado. Se ficar muito longe, reaparece perto. Recebe carinho e pula de alegria.
- **Interface** (`src/ui/hud.ts`, `minimap.ts`, `bubbles.ts`, `inventoryPanel.ts`):
  - cartão de data, hora e clima;
  - moedas e barra de energia;
  - pedido ativo: "Passeio pela ilha" (conhecer a praia, o pomar e a feira; vale 100 moedas, contado sozinho ao chegar em cada lugar);
  - minimapa redondo com a jogadora (seta), o bichinho e estrelas nos lugares que faltam;
  - barra de 8 itens (clique, 1 a 8 ou LB/RB);
  - aviso de interação ("E · Sacudir a árvore"; "Ação · …" no toque);
  - mensagens rápidas, balões de fala presos a objetos do mundo e aviso das 2h.
  - Mochila (Tab): 24 espaços em 8×3, com a primeira linha sendo a barra de itens. Arraste para organizar (itens iguais se juntam) ou toque num espaço e depois em outro.
- **Itens** (`src/data/items.ts`, `src/core/inventory.ts`): enxada, regador, machado, picareta, vara de pesca, rede, 12 sementes de morango e as cinco frutas. Começa com 500 moedas.
- **Interações** (`src/game/interactions.ts`): cada objeto se registra com posição, raio e texto da ação; o mais próximo, na frente da personagem, recebe o aviso. Por enquanto: porta da casa (dormir), caixa de correio (carta de boas-vindas), placas dos canteiros, as cinco árvores do pomar (sacudir dá de 1 a 3 frutas nativas, uma vez por dia por árvore, menos no inverno), banco, barracas e o bichinho.
- **Comandos novos**: `player.move`, `inventory.select`, `inventory.move`, `tree.shake` e `place.visit`. `sleep` agora exige estar perto da porta da casa (o painel de testes dorme como sistema).
- **Salvamento** (`src/core/save.ts`, `src/platform/saveStore.ts`): IndexedDB, um espaço. Guarda personagem, posição, inventário, moedas, energia, dia, hora, clima, pedido e árvores sacudidas. Salva ao dormir (aviso "Jogo salvo."), a cada 10 s quando algo mudou e ao esconder ou fechar a aba. Ao carregar, o arquivo inteiro é conferido; se a versão for outra ou algo estiver estranho, começa uma ilha nova. O painel de testes ganhou "Nova ilha", que apaga o jogo salvo.
- **Desempenho**: as peças da personagem são fundidas por parte que se mexe (corpo, cabeça, braços, pernas), com as cores nos vértices: 7 chamadas de desenho em vez de cerca de 45. O bichinho é uma só malha.

### Como testar

1. `npm test`: 87 testes passam (relógio, inventário, colisão, comandos e permissões, salvamento, interações, terreno, clima e textos).
2. `npm run dev`: o criador aparece. Mude o visual, dê um nome e toque em "Começar a jogar". A personagem aparece na frente da cabana com a Bolinha.
3. Ande com WASD ou setas (Shift corre). Suba a rampa de terra (ao norte da praça) até o pomar e desça a escada de madeira (ao sul, perto do píer) até a praia. Tente atravessar a casa, cercas, árvores ou entrar no mar: não dá. Ande até a ponta do píer.
4. Aperte E perto da caixa de correio, das placas dos canteiros, das árvores do pomar, do bichinho, do banco e das barracas.
5. Tab abre a mochila; arraste um item para outro espaço.
6. Na porta da cabana, "E · Dormir" passa o dia e salva. Ande um pouco, espere uns segundos e recarregue a página: o jogo continua do mesmo ponto, sem passar pelo criador.
7. No celular (`npm run dev:host`): direcional virtual à esquerda, Ação à direita.

Verificado nesta etapa: testes, checagem de tipos e build passando; o painel de testes e os atalhos de depuração não entram na versão de produção. Num navegador automático em 1280×800: criador → ilha; andar pelo teclado; subir a rampa (chegou ao pomar, altura 2,8); paredão sem rampa (parou a um raio da parede); escada até a praia e píer até a ponta; mar (parou na areia); parede da casa; correr; avisos e balões; sacudir árvore (+3 pêssegos); escolher item com 1 a 8; mochila (arrastar a enxada do espaço 1 para o 13); passeio (praia e pomar contados); dormir (dia 1 → 2, chuva sorteada, "Jogo salvo."); recarregar: mesmo nome, posição, dia, hora e itens. Em 390×844 com toque: criador sem rolagem lateral, direcional virtual anda, Ação abre a carta, Mochila abre. Sem erros no console.

Não verificado: controle de videogame de verdade (não há aparelho aqui; o mapeamento segue o padrão "standard" dos navegadores) e a meta de 60 qps. A máquina de teste desta etapa é mais lenta que a da anterior: cerca de 1 qps aqui, enquanto a versão da etapa 1 mede cerca de 0,5 qps na mesma máquina, então não houve perda.

### Decisões técnicas

- O movimento é calculado no aparelho a cada quadro; a posição entra no estado por `player.move` a cada 0,5 s e antes de qualquer ação, pronta para o servidor da etapa 7 conferir.
- A colisão é pura (sem Three.js), para o servidor usar as mesmas funções. Só o ponto à frente do corpo conta como parede, então dá para se afastar ou andar ao longo de um paredão sem travar.
- A casa ainda não tem interior (etapa 5): "Dormir" fica na porta da cabana e a personagem acorda na frente dela.
- O minimapa é um canvas 2D desenhado 10 vezes por segundo a partir dos dados do mapa.
- O jogo salvo é a cópia inteira do `GameState` com número de versão (`SAVE_VERSION` = 2).

### Pendências e notas

- A energia ainda não é gasta (as ferramentas funcionam na etapa 3) e o item escolhido ainda não aparece na mão (o ponto `AvatarParts.hand` já existe).
- Placas, banco e barracas só mostram balões; colher, vender e comprar chegam nas etapas 3 e 4.
- Não há tela de título: com jogo salvo, abre direto na ilha; sem, no criador. "Nova ilha" está só no painel de testes até o menu da etapa 8.
- Mudar o visual depois de criada fica para o guarda-roupa da casa (etapa 5).
- Um só espaço de jogo salvo; jogos na nuvem na etapa 7.
- Os ícones de itens são emoji e dependem do aparelho; trocar por ícones desenhados quando houver arte.

### Próximo passo

Etapa 3: fazenda e atividades.

---

## Etapa 1: mundo e visual (concluída)

### O que foi feito

- **Mapa inicial** (`src/data/map.ts`): todas as posições da ilha em dados, em tiles. Nível de cima (pomar com cinco árvores da fruta nativa, silo, moinho e colmeias), rampa, nível principal (cabana, fazenda com quatro canteiros em cruz, praça com três barracas, gramado com banco, grama alta), escada para a praia, praia e píer com barco.
- **Terreno** (`src/world/island.ts`, `terrain.ts`): níveis extrudados com penhascos em faixas laranja e marrom, borda de grama arredondada, rampa de terra com bordas de madeira, escada e píer. `groundHeight(x, z)` dá a altura do chão em qualquer ponto (a colisão da etapa 2 vai usar).
- **Chão pintado** (`src/world/groundPainter.ts`): uma textura de canvas com grama de folhinhas, caminhos de terra com borda escura macia, canteiros arados, piso de pedra na praça e pedras de passagem. Repintada a cada estação.
- **Mar** (`src/world/sea.ts`): turquesa perto da costa, azul longe, ondulações que deslizam e espuma pulsando na beira.
- **Todos os elementos da lista** do design, registrados por nome (`src/assets/procedural/`): canteiros com moldura e toras, placas com o desenho do cultivo, varal de luzinhas, caminhos, pedras de passagem, barracas com toldo listrado e franja recortada, piso de pedra, postes com globo, cercas vivas, mesinhas com cadeiras, grama alta, pinheiros com raiz, árvores frutíferas, coqueiros, moinho (com pás girando), silo, colmeias, espantalho, carrinho de mão, bomba de água, caixa de correio, barris e a cabana com telhado de palha. Um teste confere que nenhum item da lista falta.
- **Desempenho**: objetos repetidos são desenhados em lote (InstancedMesh) e as peças de cada objeto são mescladas numa geometria com cores por vértice. Medido: cerca de 37 chamadas de desenho por passada para 824 cópias em 31 lotes.
- **Câmera de maquete** (`src/render/camera.ts`): 52° de inclinação e 30° de campo de visão, modos "seguir" e "ilha toda" com troca suave, e arrastar para girar.
- **Pós-processamento** (`src/render/postfx.ts`): faixa central nítida com desfoque suave no alto e embaixo (efeito maquete) e vinheta.
- **Hora do dia** (`src/data/timeOfDay.ts`, `src/render/atmosphere.ts`): manhã dourada, tarde clara, pôr do sol alaranjado e noite azul, misturados entre horários de referência. À noite acendem janelas, luzinhas, postes e lanternas, com luz quente no chão.
- **Estações** (`src/data/seasonPalettes.ts`): cor da grama, das folhas, das cercas vivas e dos cultivos; cerejeira rosa na primavera; folhas laranja no outono; no inverno neve no chão, nos telhados e nos pinheiros, boneco de neve e canteiros em descanso.
- **Clima** (`src/render/weatherFx.ts`): sol, chuva, tempestade com relâmpagos, neve e arco-íris, mais pétalas na primavera, folhas no outono, nuvens, estrelas e vaga-lumes. O clima faz parte do estado do jogo e é sorteado ao dormir, de forma determinística, com chances por estação (`src/data/weather.ts`; neve só no inverno).
- **Comandos novos**: `time.setDate` e `weather.set` (só o sistema); `sleep` agora sorteia o clima do dia seguinte.
- **Painel de testes** (`src/ui/devPanel.ts`, só no modo de desenvolvimento): hora (manhã, tarde, pôr do sol, noite), estação, clima, câmera, pausar o relógio, +1 hora e dormir. No celular ele começa fechado no botão "Testes".
- **Cartão de data** agora mostra o clima ("Céu limpo" à noite).

### Como testar

1. `npm test`: 53 testes passam (incluindo altura do terreno, clima, mistura da luz do dia e a lista de elementos obrigatórios).
2. `npm run dev`: a ilha aparece inteira, de manhã, na primavera.
3. No painel de testes, troque hora, estação e clima: o visual muda na hora, com transição suave. "Seguir" aproxima a câmera de uma figura de teste que anda pelos caminhos; arraste a tela para girar.
4. No celular (`npm run dev:host`), toque em "Testes" para abrir o painel.

Verificado nesta etapa: testes, checagem de tipos e build passando; o painel de testes não entra na versão de produção; ilha conferida num navegador automático em 1280×800 e 390×844, em tarde, noite, inverno, outono com chuva ao pôr do sol, tempestade à noite, arco-íris e câmera seguindo, sem erros no console e sem rolagem lateral.

### Pendências e notas

- **Meta de 60 qps ainda não medida em aparelho real.** O navegador de teste daqui não tem placa de vídeo e desenha tudo no processador (5 a 7 qps). O contador "qps" do painel de testes mostra o valor no seu computador e no seu celular. No celular o jogo já usa resolução e sombras menores e menos amostras de suavização.
- As opções do menu (sombras, desfoque nas bordas, partículas, campo de visão, qualidade) já têm os interruptores no código (`PostFx.setTiltShift`, `Atmosphere.setShadows`, `CameraRig.setFov`), mas o menu só chega na etapa 8.
- A troca de câmera fica no painel de testes por enquanto; o botão no jogo entra com a interface completa na etapa 2.
- A figura que a câmera segue é provisória (`debug.walker`); a personagem da jogadora a substitui na etapa 2.
- Como a câmera olha de cima, o arco-íris é desenhado ao fundo da vista, sobre o mar, e não fixo no céu.
- As placas usam emoji para os desenhos dos cultivos; a aparência depende das fontes de emoji do aparelho. Quando houver arte, trocar por ícones desenhados.
- No inverno a praia continua com areia; só o nível de grama recebe neve.
- Regras para modelos glTF substituírem os objetos de formas simples estão no topo de `src/assets/procedural/index.ts` (nomes como `only:winter`, `fruit`, `sign_face`, `blades`).

### Próximo passo

Etapa 2: personagem, controle e interface.

---

## Etapa 0: base do projeto (concluída)

### O que foi feito

- Projeto Vite 8 + TypeScript + Three.js r187, com Vitest para testes de lógica.
- Pastas: `src/core` (estado, comandos, relógio), `src/world`, `src/render`, `src/ui`, `src/data`, `src/i18n`, `src/assets` e `docs`.
- `docs/GAME_DESIGN.md` com o documento de design completo.
- **Comandos** (`src/core/commands.ts`): toda mudança passa por `applyCommand(state, command, actor)`, que confere o tipo, o papel de quem mandou (system, host, resident, visitor) e os dados antes de mudar o estado. Se a validação falha, o estado fica intacto. Comandos de agora: `time.advance` e `time.sync` (só o sistema) e `sleep` (anfitrião e moradores; visitantes não).
- **Relógio** (`src/core/clock.ts`): dia das 06:00 às 02:00 em passos de 10 minutos (120 passos), duração de 14, 20 ou 28 minutos reais, 4 estações de 28 dias, semana começando na segunda, virada de estação e de ano, parada às 02:00 até alguém dormir e modo de horário real do aparelho. O `ClockDriver` transforma tempo real em comandos e pausa quando a aba fica escondida.
- **Sorteio determinístico** (`src/core/rng.ts`): o estado do gerador fica dentro do `GameState`, para o servidor e o cliente chegarem ao mesmo resultado.
- **Textos** (`src/i18n`): tudo que aparece na tela vem de `locales/pt-BR.ts` por meio de `t()`. Inglês e espanhol entram na etapa 8 com as mesmas chaves.
- **Registro de assets** (`src/assets/registry.ts`): os objetos são criados por nome (`tree.peach`, `fence.log`). `useGltf(nome, url)` troca o objeto de formas simples por um modelo glTF sem mexer no resto do código. O carregador de glTF só é baixado quando usado.
- **Cena de teste** (`src/world/testScene.ts`): céu em degradê, mar turquesa com ondulações animadas, ilha plana com grama, penhasco listrado e areia (texturas pintadas em canvas), sombras macias, câmera de maquete a 52° com campo de visão de 30°, quatro pessegueiros e uma fileira de toras vindos do registro.
- **Interface mínima** (`src/ui`): cartão de data e hora em papel creme ("Seg, 1 de Primavera · 06:00 · Ano 1 · Ilha Aconchego"), aviso das 2h e, só no modo de desenvolvimento, um painel de testes com "Dormir", "+1 hora" e quadros por segundo.

### Como testar

1. `npm test`: 34 testes passam (relógio, comandos e permissões, sorteio, registro de assets e textos).
2. `npm run dev` e abra a página: a ilha aparece, o relógio avança 10 minutos a cada 10 segundos reais.
3. No painel de testes: "+1 hora" adianta o relógio; "Dormir" passa para o dia seguinte às 06:00 e mostra "Bom dia!".
4. Abra no celular (`npm run dev:host`) ou com a janela estreita: a ilha inteira cabe na tela e os cartões não se sobrepõem.

Verificado nesta etapa: testes, checagem de tipos e build de produção passando; página testada num navegador automático em 1280×800 e em 390×844, sem erros no console e sem rolagem lateral; botões do painel conferidos.

### Decisões técnicas

- `applyCommand` muda o estado no lugar (como o Colyseus faz no servidor), mas só depois de validar. A validação nunca altera nada.
- Regras do jogo nunca usam `Math.random()` nem `Date.now()`: o tempo chega por comandos do sistema e o sorteio vem do gerador guardado no estado.
- Comandos podem vir da rede, então o formato é conferido dentro de `applyCommand`, inclusive tipos estranhos como `"toString"`.
- Cores das texturas em sRGB e mapeamento de tons neutro, para as cores pintadas aparecerem como foram pensadas.

### Pendências e notas para as próximas etapas

- Os dias da Noite das Lanternas, da Feira da Colheita e do Baile da Neve ainda não foram definidos no design (ficam `null` em `src/data/calendar.ts`; decidir na etapa 6).
- No modo de horário real, só a hora do dia segue o aparelho; o calendário ainda avança dormindo. Revisar quando o menu de opções existir (etapa 8).
- No multijogador, `sleep` vai precisar esperar todos os moradores irem dormir (etapa 7).
- Ao trocar modelos animados por glTF, `AssetRegistry.create` vai precisar do `SkeletonUtils.clone` em vez de `clone()`.
- O pacote principal tem cerca de 160 kB compactado, quase tudo do Three.js.

