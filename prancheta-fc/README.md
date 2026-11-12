# Prancheta FC — protótipo

Jogo de técnico de futebol no navegador, no estilo Brasfoot / Football Manager. Projeto pessoal, sem fins comerciais.

## Como jogar

Abra `index.html` no navegador (ou rode `python3 -m http.server` nesta pasta e acesse `http://localhost:8000`). Não precisa instalar nada. A carreira fica salva no próprio navegador.

## O que tem

- **60 clubes reais** das Séries A, B e C de 2026, com cidade, estádio e capacidade.
- **Elencos reais da Série A** (cerca de 380 jogadores). Nas Séries B e C os nomes são gerados até a base real ser importada.
- **Mercado com 11 ligas estrangeiras** (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Portugal, Arábia Saudita, Turquia, MLS, Argentina e México) e todos os clubes brasileiros.
- **Negociação em duas etapas**: proposta ao clube (com contraproposta) e contrato com o jogador, respeitando o teto salarial da diretoria. Cada jogador tem um nível de interesse em vir para o seu clube.
- **Tática**: 5 formações, postura, marcação e trocas por toque, com indicador de jogador improvisado.
- **Partida ao vivo**: 22 bonecos animados, narração, estatísticas, intervalo, substituições e mudança de postura durante o jogo. Ou simulação rápida.
- **Tabela, rodadas e artilharia** das três divisões, com acesso e rebaixamento entre temporadas.
- **Finanças**: TV, patrocínio, bilheteria (com preço do ingresso), folha salarial, custos e extrato.
- **Dois visuais**: pixel art e bonecos 3D, trocando a qualquer momento.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `js/dados.js` | Clubes, elencos, ligas estrangeiras, formações e divisões |
| `js/sprites.js` | Bonecos em pixel art e em 3D, escudos e estádio (tudo desenhado em canvas/SVG) |
| `js/motor.js` | Regras: criação do mundo, calendário, simulação, mercado, finanças e temporadas |
| `js/partida.js` | Partida ao vivo: lances, narração e desenho do campo nos dois estilos |
| `js/app.js` | Interface: telas, menus e interações |
| `style.css` | Os dois temas visuais |
| `build-artifact.mjs` | Gera uma versão de arquivo único (`node build-artifact.mjs saida.html`) |

## Sobre os dados

Os elencos foram montados de memória a partir das temporadas 2025/26 e podem ter jogadores que já mudaram de clube. Uniformes e escudos são aproximações com as cores de cada clube, sem logos oficiais. Para uma versão completa, o ideal é importar uma base de dados atualizada.
