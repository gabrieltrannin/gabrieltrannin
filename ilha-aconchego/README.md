# Ilha Aconchego

Jogo 3D aconchegante de vida numa ilha que roda inteiro no navegador, sozinho ou com até 4 amigos. Nome provisório.

- Design completo: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- Andamento, como testar e o que falta: [docs/PROGRESS.md](docs/PROGRESS.md)

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes de lógica
npm run build    # versão de produção em dist/
```

## Estrutura

```
src/
  core/      estado do jogo, comandos, regras, virada do dia, relógio, clima, inventário, pesca, moradores, caminhos, grade de decoração, nota da ilha, talentos, conquistas e salvamento (sem Three.js)
    handlers/  comandos da fazenda, da coleta, dos animais, da economia, da vila, da casa e decoração, das bancadas e do progresso (barraca, talentos, bichinho, emotes)
  data/      conteúdo em dados: mapa, vila, áreas, caminhos, moradores, projetos, móveis, casa, receitas das bancadas, roupas, talentos, conquistas, nota da ilha, emotes, calendário, clima, cultivos, itens, peixes, insetos, receitas, lojas, ferramentas e habilidades
  i18n/      textos da tela e falas dos moradores (pt-BR agora; en e es depois)
  assets/    registro de objetos por nome e as versões de formas simples (incluindo os 40 móveis)
  render/    renderizador, câmera de maquete, personagem e moradores 3D, luz do dia, efeitos de clima e desfoque
  world/     montagem da ilha (terreno, mar, vegetação, construções), interior da casa, enfeites, visitantes, vila, moradores andando, fazenda viva, animais, insetos e colisão
  game/      jogadora, bichinho, pesca, conversas, a vida em casa e a ação do E (liga a entrada, o mundo e os comandos)
  input/     teclado, toque e controle de videogame numa só entrada
  platform/  coisas do navegador: jogo salvo no IndexedDB
  ui/        criador de personagem (também espelho, guarda-roupa e salão), interface, mochila, diálogo, modo decoração, modo foto, emotes, janelas de loja, bancadas, catálogo, nota da ilha, barraca, talentos, perfil, quadro, museu, cartas, amizade e calendário, minimapa, balões, toque e painel de testes
docs/        design e progresso
```

Tecnologia: TypeScript, Vite, Three.js e Vitest. O servidor de multijogador (Node.js + Colyseus) chega na etapa 7.
