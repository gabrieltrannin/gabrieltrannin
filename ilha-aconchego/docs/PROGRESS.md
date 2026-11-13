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
- [ ] **Etapa 2**: personagem, controle e interface
- [ ] **Etapa 3**: fazenda e atividades
- [ ] **Etapa 4**: vila e moradores
- [ ] **Etapa 5**: casa, decoração, ofícios e progressão
- [ ] **Etapa 6**: exploração e eventos
- [ ] **Etapa 7**: multijogador
- [ ] **Etapa 8**: opções, som, acessibilidade e publicação
- [ ] **Etapa 9**: expansão

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

