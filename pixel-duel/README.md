# Pixel Duel

Protótipo de jogo de cartas no navegador, em 3D low-poly, inspirado nos jogos de duelo de cartas da era PlayStation 1 e na dinâmica do Pokémon Showdown: você monta seu deck, escolhe um formato e desafia a CPU ou um amigo por link.

Todas as cartas, nomes, modelos e personagens são originais. Os monstros são modelos 3D gerados por código (um corpo por tipo, com variações por carta), e a arte das cartas é uma foto desses modelos tirada na hora, então não há imagens externas.

A mesa de duelo é uma cena 3D ([Three.js](https://threejs.org/) r128): as cartas ficam sobre a mesa, os monstros com a face para cima aparecem em pé sobre a carta, e ataques, destruições e ativações são animados. O botão **PS1** no topo reduz a resolução da cena para um visual de console antigo. Sem WebGL, o jogo volta para a mesa 2D em pixel art.

## Como jogar

Abra `index.html` direto no navegador. Não precisa instalar nada.

Para o duelo online (e para testar com duas abas), sirva a pasta por HTTP:

```bash
cd pixel-duel
python3 -m http.server 8000
# abra http://localhost:8000
```

### Regras resumidas

- 8000 PV e 5 cartas na mão. Vence quem zerar os PV do oponente ou deixá-lo sem cartas para comprar.
- Fases: Principal 1 → Batalha → Principal 2 → fim do turno. Quem começa não ataca no primeiro turno.
- Uma Invocação por turno. Nível 5–6 pede 1 sacrifício; nível 7 ou mais, 2.
- Ataque contra Ataque: o mais fraco é destruído e o dono sofre a diferença. Contra Defesa: destrói sem dano, ou o atacante sofre a diferença se a DEF for maior.
- Armadilhas são baixadas e disparam no turno do oponente (quando ele ataca ou invoca). O jogo pergunta se você quer ativá-las.
- Magias de Campo são compartilhadas e mudam a cor da mesa.

### Gerações e formatos

| Geração | Set | Destaques |
|---|---|---|
| Gen I | Alvorada | monstros clássicos, magias e armadilhas básicas |
| Gen II | Ruínas Esquecidas | efeitos de VIRAR, maldições, Magias de Campo |
| Gen III | Engrenagens de Ferro | Aura, PERFURANTE, ATAQUE DIRETO |
| Gen IV | Céus em Chamas | dragões, ATAQUE DUPLO, destruição em massa |

Os formatos são cumulativos, como no Showdown: `[Gen II]` aceita cartas das Gen I e II, e `[Gen IV] Livre` aceita todas. Decks têm de 20 a 40 cartas, no máximo 3 cópias de cada (algumas cartas têm limite 1 ou 2).

## Duelo online

1. No lobby, escolha o formato e clique em **Criar desafio**.
2. Envie o link (`...#sala-CÓDIGO`) para o oponente, ou passe só o código.
3. O oponente abre o link, escolhe um deck válido no formato e aceita.

A conexão é direta entre os navegadores (WebRTC via [PeerJS](https://peerjs.com/), que usa o servidor público gratuito deles só para apresentar os dois lados). O anfitrião roda o motor de regras, valida as ações do convidado e envia a cada jogador apenas o que ele pode ver (a mão e as cartas baixadas do oponente ficam ocultas). Há chat no registro do duelo.

Para jogar com alguém fora da sua rede, o jogo precisa estar hospedado. Uma opção simples é o GitHub Pages deste repositório: **Settings → Pages → Deploy from a branch → `main` / `(root)`**, e o jogo fica em `https://<usuário>.github.io/<repositório>/pixel-duel/`.

A opção **Teste local** cria uma sala entre duas abas do mesmo navegador, sem internet.

Limitações do protótipo: em algumas redes corporativas ou móveis a conexão direta falha (não há servidor TURN), e o anfitrião é a autoridade da partida, então não há proteção contra trapaça.

## Estrutura

```
pixel-duel/
  index.html          página principal
  css/style.css       visual (mesa, cartas, janelas)
  js/cards.js         banco de cartas, gerações, formatos, decks iniciais, validação
  js/engine.js        motor de regras (estado JSON puro, determinístico)
  js/ai.js            oponente CPU
  js/art3d.js         modelos 3D dos monstros, ícones de magias/armadilhas, retratos e arte das cartas
  js/scene3d.js       mesa de duelo 3D (cartas, monstros, câmera, animações, clique)
  js/sprites.js       pixel art (reserva para navegadores sem WebGL)
  js/audio.js         efeitos sonoros e música chiptune (WebAudio)
  js/net.js           partidas: CPU, anfitrião e convidado (PeerJS / BroadcastChannel)
  js/app.js           lobby, armazenamento, menus e desafios
  js/builder.js       construtor de deck (filtros, importar/exportar)
  js/battle.js        tela de duelo e animações
  tools/build.mjs     gera uma versão de arquivo único em dist/
```

### Criando cartas

As cartas ficam em `js/cards.js`. O texto de cada carta é gerado a partir das regras, então basta descrever o efeito:

```js
gen(2);
M('B99', 'Nome do Monstro', 'trevas', 'demonio', 4, 1600, 1200, {
  fx: { on: 'summon', ops: [{ op: 'damage', n: 400 }] },   // ao ser invocado: 400 de dano
});
S('B98', 'Nome da Magia', 'normal', [{ op: 'draw', n: 1 }, { op: 'heal', n: 500 }]);
T('B97', 'Nome da Armadilha', 'attack', [{ op: 'destroy', t: 'attacker' }]);
```

Efeitos disponíveis: `damage`, `heal`, `draw`, `destroy`, `buff`, `debuff`, `revive`, `negate`, `endBattle`, `reflect`, `stun`, além das palavras-chave de monstro `pierce`, `direct`, `double` e `aura`.

### Versão de arquivo único

```bash
node tools/build.mjs        # gera dist/pixel-duel.html com tudo embutido
```
