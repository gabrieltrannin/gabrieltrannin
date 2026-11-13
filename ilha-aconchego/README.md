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
  core/      estado do jogo, comandos, relógio, clima, inventário, salvamento e sorteio (sem Three.js)
  data/      conteúdo em dados: mapa, calendário, clima, cultivos, itens, visual da personagem, cores das estações
  i18n/      textos da tela (pt-BR agora; en e es depois)
  assets/    registro de objetos por nome e as versões de formas simples
  render/    renderizador, câmera de maquete, personagem 3D, luz do dia, efeitos de clima e desfoque
  world/     montagem da ilha (terreno, mar, vegetação, construções) e colisão
  game/      jogadora, bichinho e interações (liga a entrada, o mundo e os comandos)
  input/     teclado, toque e controle de videogame numa só entrada
  platform/  coisas do navegador: jogo salvo no IndexedDB
  ui/        criador de personagem, interface, mochila, minimapa, balões, controles de toque e painel de testes
docs/        design e progresso
```

Tecnologia: TypeScript, Vite, Three.js e Vitest. O servidor de multijogador (Node.js + Colyseus) chega na etapa 7.
