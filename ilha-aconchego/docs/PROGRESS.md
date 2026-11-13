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
- [ ] **Etapa 1**: mundo e visual
- [ ] **Etapa 2**: personagem, controle e interface
- [ ] **Etapa 3**: fazenda e atividades
- [ ] **Etapa 4**: vila e moradores
- [ ] **Etapa 5**: casa, decoração, ofícios e progressão
- [ ] **Etapa 6**: exploração e eventos
- [ ] **Etapa 7**: multijogador
- [ ] **Etapa 8**: opções, som, acessibilidade e publicação
- [ ] **Etapa 9**: expansão

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

### Próximo passo

Etapa 1: mundo e visual, seguindo as seções Direção de arte, Mapa inicial e Tempo e calendário.
