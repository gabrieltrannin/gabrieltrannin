# Documento de design: Ilha Aconchego

> Fonte única do jogo. Todas as etapas seguem este documento. Nome provisório.

## VISÃO

Jogo de vida numa ilha, sozinho ou com até 4 amigos. A jogadora cria sua personagem, cuida da fazenda, faz amizade com os moradores, explora regiões novas, cria coisas com as próprias mãos e decora tudo do seu jeito, sem pressa e sem jeito errado de jogar. Referências de gênero e sensação: Stardew Valley, Animal Crossing, Hello Kitty Island Adventure, Sun Haven e Bandle Tale.

## PLATAFORMA E CONTROLE

- Roda no navegador, no computador e no celular, sem instalar nada.
- Teclado: WASD ou setas andam (relativo à câmera), Shift corre, E interage (colher, regar, conversar, pegar), 1 a 8 trocam o item da barra, Tab abre a mochila, M o mapa, F os emotes, Esc o menu.
- Celular: direcional virtual na tela e botão Ação.
- Controle de videogame pela Gamepad API.
- Quando a jogadora chega perto de algo, aparece o aviso da ação, por exemplo "E · Colher morango".

## DIREÇÃO DE ARTE

- Visual de maquete fofa. Câmera alta e inclinada (cerca de 52 graus, campo de visão de 30 graus), que segue a personagem com suavidade e tem um modo de ver a ilha toda. Arrastar gira a câmera.
- Formas arredondadas, texturas pintadas à mão, luz suave e quente, sombras macias, leve desfoque no alto e embaixo da tela (efeito maquete) e vinheta suave.
- Ilha em degraus: penhascos com faixas em tons de laranja e marrom, borda de grama arredondada, praia de areia, mar turquesa perto da costa e azul mais escuro longe, espuma na beira e ondulações.
- Elementos que precisam existir: canteiros com moldura de madeira cercados por toras, placa com o desenho de cada cultivo, varal de luzinhas sobre os caminhos da fazenda, caminhos de terra com bordas macias, pedras de passagem, feira com barracas de toldo listrado verde e creme e franja recortada, piso de pedra na praça, postes com globo de luz, cercas vivas, mesinhas de café com cadeiras, grama alta, pinheiros em camadas com raiz aparente, árvores frutíferas redondas, coqueiros, moinho, silo, colmeias, espantalho, carrinho de mão, bomba de água, caixa de correio e barris.
- As estações mudam a cor da grama, das folhas e dos cultivos; no inverno há neve no chão, nos telhados e nos pinheiros, e um boneco de neve. A hora do dia muda a luz: manhã dourada, tarde clara, pôr do sol alaranjado, noite azul com janelas, postes e luzinhas acesos e vaga-lumes. Clima: sol, chuva, tempestade, neve e arco-íris, com partículas. Pétalas na primavera e folhas no outono.
- Personagens com cabeça grande (cerca de duas cabeças de altura). O rosto é uma textura desenhada, com olhos, boca e bochechas trocáveis.
- Interface em papel creme com bordas grossas arredondadas e sombra embaixo, com fontes arredondadas (por exemplo Fredoka nos títulos e Nunito nos textos).

## MAPA INICIAL (1 unidade = 1 tile)

- Nível de cima, no fundo: pomar com cinco árvores da fruta nativa, silo, moinho e colmeias.
- Rampa de terra ligando o nível de cima ao principal.
- Nível principal: casa da jogadora (cabana redonda com telhado de palha) encostada no penhasco, fazenda com quatro canteiros em cruz cortados por caminhos, praça da feira com três barracas (pães, mel e flores), gramado com banco, trecho de grama alta e caminhos ligando tudo.
- Escada de madeira descendo para a praia; píer com barco. O barco leva às outras regiões e às ilhas dos amigos.
- Plantio e móveis usam uma grade de tiles.

## TEMPO E CALENDÁRIO

- Um dia dura 20 minutos reais, das 06:00 às 02:00, avançando de 10 em 10 minutos. Opção de seguir o horário real do aparelho.
- Quatro estações de 28 dias. Festivais: Festival das Flores (Primavera, dia 13), Noite das Lanternas (Verão), Feira da Colheita (Outono) e Baile da Neve (Inverno). Aniversários dos moradores no calendário.
- Dormir salva o jogo e faz as plantas crescerem.

## PERSONAGEM

- Criador de personagem na primeira vez que o jogo abre, com prévia 3D girando. Opções: espécie (humano, elfo, povo-gato com orelhas e cauda, povo-coelho com orelhas longas); tom de pele (6 opções); olhos (pontinho, redondos, brilhantes, sonolentos, alegres) e cor dos olhos (6); boca (sorriso, risada, gatinho, calma); bochechas rosadas (com ou sem); penteado (curto, coque, rabo de cavalo, longo, chanel, espetado) e cor do cabelo (9); roupa (camiseta, vestido, jardineira, moletom) com cor principal, cor da calça ou macacão e cor dos sapatos; acessório (nenhum, chapéu de palha, gorro, laço, coroa de flores, broto); nome; nome da ilha; fruta nativa (maçã, pera, pêssego, laranja, cereja). Botões "Sortear visual" e "Voltar ao padrão".
- Personagem padrão e de teste: Ana, humana, penteado coque na cor #E8708F, olhos brilhantes, sorriso, vestido #7C4DA6, sem acessório. Ilha Aconchego, fruta nativa pêssego.
- Bichinho companheiro (coelhinho branco) que segue a jogadora.

## MORADORES

- 12 moradores originais: animais com roupas, personalidade, rotina diária e casa própria. Os quatro primeiros: Lumi (raposa padeira, cuida da barraca de pães, adora torta de amora), Pipo (lontra pescadora, fica no píer, adora peixe-lua), Celeste (coruja que cuida do museu, adora fósseis) e Bento (texugo ferreiro, adora cristais). Crie os outros oito com nomes e espécies originais.
- Falas curtas e carinhosas, que mudam com a hora, o clima, a estação e a amizade. No lugar de voz, um balbucio fofo.

## FUNCIONALIDADES POR FASE

Essencial = primeira versão jogável. Lançamento = versão 1.0. Expansão = depois do lançamento.

### Personagem e companheiro

- Criador de personagem: espécie, tom de pele, rosto, cabelo, roupa e acessórios (Essencial)
- Nome da ilha e fruta nativa escolhidos na criação (Essencial)
- Espelho em casa e salão na vila para mudar o visual depois (Lançamento)
- Guarda-roupa com roupas que você mesmo costura e tinge (Lançamento)
- Bichinho companheiro que encontra itens escondidos e ganha acessórios (Lançamento)
- Emotes para reagir com moradores e amigos (Lançamento)

### Multijogador

- Ilha compartilhada: até 4 amigos morando na mesma ilha, cada um com sua casa (Lançamento)
- Cada um na sua ilha, com visitas de barco entre amigos (Lançamento)
- Convite por código e lista de amigos (Lançamento)
- Permissões para visitantes e moradores: colher, decorar, usar ferramentas (Lançamento)
- Chat com frases prontas e emotes, seguro para crianças (Lançamento)
- Visitar uma cópia da ilha quando o dono está offline (Expansão)
- Tela dividida no mesmo computador ou console (Expansão)

### Fazenda e natureza

- Plantar, regar e colher, com cultivos diferentes em cada estação (Essencial)
- Animais da fazenda: galinhas, vacas e ovelhas que dão ovos, leite e lã (Essencial)
- Qualidade da colheita (comum, prata e ouro) e adubos (Lançamento)
- Pomar, colmeias de mel e estufa para plantar o ano todo (Lançamento)
- Irrigadores automáticos e máquinas como barril de suco, prensa e roca de fiar (Lançamento)
- Cultivos mágicos que só nascem com feitiço, como a flor de gelo do inverno (Expansão)

### Ilha e decoração

- Colocar móveis e enfeites em qualquer lugar, dentro e fora de casa (Essencial)
- Casa que cresce: cômodos novos, segundo andar e porão (Lançamento)
- Catálogo de móveis com coleções temáticas (praia, fazenda, feira) (Lançamento)
- Nota da ilha: quanto mais bonita, mais visitantes e moradores novos (Lançamento)
- Modo foto com filtros, poses e molduras (Lançamento)
- Terraformar: abrir rios, criar penhascos, pontes e caminhos (Expansão)

### Vila e amizades

- 12 moradores com rotina diária, casa própria e personalidade (Essencial)
- Amizade em corações: conversar, dar presentes e atender pedidos (Essencial)
- Quadro de pedidos e projetos da vila, como consertar a ponte ou abrir o museu (Essencial)
- Presentes favoritos, aniversários e cartas pelo correio (Lançamento)
- Cenas especiais quando a amizade sobe de nível (Lançamento)
- Namoro e casamento opcionais, com moradores de qualquer gênero (Expansão)

### Exploração e aventura

- Regiões que se abrem com amizades e ferramentas novas: praia, floresta, vulcão e ilha nas nuvens (Essencial)
- Minas com andares, minérios e cristais (Essencial)
- Grama alta onde aparecem bichinhos e itens escondidos (Lançamento)
- Quebra-cabeças no mapa com blocos, interruptores e correntes de vento (Lançamento)
- Combate leve contra criaturas fofas, com opção de desligar (Lançamento)
- Coleções de peixes, insetos, fósseis e conchas para doar ao museu (Lançamento)

### Ofícios e magia

- Bancadas de criação: carpintaria, cozinha, tricô, alquimia e joalheria (Essencial)
- Cadeias de produção: lã vira fio, fio vira tecido, tecido vira roupa (Lançamento)
- Receitas descobertas por experimento, presentes e livros (Lançamento)
- Barraca própria na feira para vender o que você cria (Lançamento)
- Magia para fazer chover, acelerar plantas e iluminar cavernas (Expansão)
- Organizar festas escolhendo tema, comida, decoração e convidados (Expansão)

### Talentos e progressão

- Seis habilidades que sobem com o uso: cultivo, pesca, mineração, cozinha, ofícios e carisma (Essencial)
- Ferramentas que evoluem: cobre, prata, ouro e cristal (Essencial)
- Árvore de talentos com uma escolha a cada nível, como mais sementes por colheita ou plantas que crescem mais rápido (Lançamento)
- Conquistas, coleções e títulos para o perfil (Lançamento)
- Mercado com preços que mudam com a estação e a procura (Expansão)

### Atividades e eventos

- Pesca com minijogo de tensão na linha (Essencial)
- Cozinhar pratos que recuperam energia e dão bônus (Essencial)
- Clima do dia: sol, chuva, tempestade, neve e arco-íris (Essencial)
- Captura de insetos com rede (Lançamento)
- Um festival por estação: Flores, Lanternas, Colheita e Neve (Lançamento)
- Visitantes raros: mercador viajante, artista e noite de chuva de estrelas (Expansão)

## MULTIJOGADOR

- Dois modos no mesmo sistema:
  1. Ilha compartilhada (modo padrão ao criar a ilha): até 4 amigos morando na mesma ilha. Cada um tem casa, mochila, dinheiro e amizades próprios; fazenda comunitária, museu e obras da vila são de todos. O anfitrião cria a ilha e convida.
  2. Cada um na sua ilha: cada jogador tem a sua e visita a dos amigos pelo barco do píer, até 4 visitantes.
- Por dentro, os dois modos são uma sessão online da ilha de alguém. Muda só o papel: morador (tem casa e pode mexer em tudo) ou visitante (permissões limitadas).
- Convite por código (formato AKG-47P-Q2M) e lista de amigos com status (online, na sua ilha, offline).
- Nome acima da cabeça de cada jogador e indicador no canto da tela, por exemplo "Ilha Aconchego · 3 moradores online" ou "Theo chegou de barco".
- Chat seguro para crianças: frases prontas e emotes.
- Saves no IndexedDB do navegador e cópia na nuvem guardada pelo servidor.

## OPÇÕES DO JOGO (menu Esc, com estes valores padrão)

- Gráficos: qualidade gráfica Alta (Baixa, Média, Alta); sombras ligadas; desfoque nas bordas (efeito maquete) ligado; chuva, neve e pétalas ligadas; campo de visão 30 graus (de 22 a 42); limite de 60 quadros por segundo (30, 60, 120).
- Jogo: duração do dia 20 min (14, 20, 28); relógio do jogo (ou horário real); barra de energia ligada; modo pacífico (sem combate) desligado; plantas murcham sem água desligado; economia Normal (Tranquila, Normal, Desafiadora); câmera gira sozinha quando parada desligado.
- Multijogador: modo ao criar a ilha Ilha compartilhada (Sozinho, Ilha compartilhada, Cada um na sua); máximo de 4 jogadores (2, 3, 4); quem pode visitar: Amigos (Amigos, Com convite, Ninguém); visitantes podem colher frutas: ligado; visitantes podem usar ferramentas: desligado; moradores podem mudar a decoração: ligado; permitir visita à cópia quando estiver offline: ligado; chat: Frases prontas (Frases prontas, Texto livre, Desligado).
- Áudio: música 70%; efeitos 80%; sons do ambiente 60%; vozes dos moradores 50%; trilha muda com a estação ligado.
- Acessibilidade: tamanho da interface M (P, M, G); modo daltônico desligado (Protan, Deutan, Tritan); balões de fala maiores desligado; reduzir tremor da câmera ligado; minijogos assistidos desligado; tocar em vez de segurar botões desligado; teclas remapeáveis.
- Controles: dispositivo Teclado e mouse (Controle, Toque).
- Sistema: idioma Português (English, Español); salvar automaticamente ao dormir (ou a cada 10 min); salvar na nuvem ligado.
