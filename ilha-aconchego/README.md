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
  core/      estado do jogo, comandos, relógio, clima e sorteio (sem Three.js)
  data/      conteúdo em dados: mapa da ilha, calendário, clima, cultivos, cores das estações, luz do dia
  i18n/      textos da tela (pt-BR agora; en e es depois)
  assets/    registro de objetos por nome e as versões de formas simples
  render/    renderizador, câmera de maquete, luz do dia, efeitos de clima, desfoque e texturas pintadas
  world/     montagem da ilha: terreno, chão pintado, mar, vegetação, fazenda e construções
  ui/        interface do jogo e painel de testes em HTML/CSS
docs/        design e progresso
```

Tecnologia: TypeScript, Vite, Three.js e Vitest. O servidor de multijogador (Node.js + Colyseus) chega na etapa 7.
