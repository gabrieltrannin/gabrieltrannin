/* Prancheta FC — base de dados do protótipo
 * Clubes: Séries A, B e C de 2026 (nomes, cidades e estádios reais).
 * Elencos da Série A: jogadores reais, montados de memória a partir das
 * temporadas 2025/26. Podem estar desatualizados; na versão completa a
 * base vem de uma importação de dados.
 * Séries B e C: nomes gerados (marcados no jogo) até a importação da base real.
 * Mercado internacional: jogadores reais das principais ligas do mundo.
 */

// id|Nome|Sigla|Cidade|UF|Estádio|Capacidade|Divisão|Reputação|Caixa (R$ mi)|uniforme
// uniforme = padrão:camisa:detalhe:calção[:cor extra]
const CLUBES_RAW = `
cap|Athletico-PR|CAP|Curitiba|PR|Ligga Arena|42372|A|76|70|hoops:#D7172F:#161616:#161616
cam|Atlético-MG|CAM|Belo Horizonte|MG|Arena MRV|46000|A|85|110|stripes:#161616:#F4F4F4:#161616
bah|Bahia|BAH|Salvador|BA|Arena Fonte Nova|47907|A|78|90|solid:#F4F4F4:#1F4E9A:#1F4E9A
bot|Botafogo|BOT|Rio de Janeiro|RJ|Nilton Santos|44661|A|85|120|stripes:#161616:#F4F4F4:#161616
cha|Chapecoense|CHA|Chapecó|SC|Arena Condá|20089|A|60|30|solid:#0A8A3E:#F4F4F4:#F4F4F4
cor|Corinthians|COR|São Paulo|SP|Neo Química Arena|47605|A|86|60|solid:#F4F4F4:#161616:#161616
cfc|Coritiba|CFC|Curitiba|PR|Couto Pereira|40502|A|68|40|band:#F4F4F4:#0A6B3A:#161616
cru|Cruzeiro|CRU|Belo Horizonte|MG|Mineirão|61846|A|85|110|solid:#0038A8:#F4F4F4:#F4F4F4
fla|Flamengo|FLA|Rio de Janeiro|RJ|Maracanã|78838|A|95|220|hoops:#C8102E:#161616:#F4F4F4
flu|Fluminense|FLU|Rio de Janeiro|RJ|Maracanã|78838|A|84|80|stripes3:#7A1E2C:#0B6B3A:#F4F4F4:#F4F4F4
gre|Grêmio|GRE|Porto Alegre|RS|Arena do Grêmio|55662|A|83|85|stripes3:#0D80BF:#161616:#161616:#F4F4F4
int|Internacional|INT|Porto Alegre|RS|Beira-Rio|50128|A|83|80|solid:#E30613:#F4F4F4:#F4F4F4
mir|Mirassol|MIR|Mirassol|SP|Maião|15000|A|64|35|solid:#FFD200:#0A8A3E:#0A8A3E
pal|Palmeiras|PAL|São Paulo|SP|Allianz Parque|43713|A|93|200|solid:#006437:#F4F4F4:#F4F4F4
rbb|RB Bragantino|RBB|Bragança Paulista|SP|Nabi Abi Chedid|17022|A|72|75|solid:#F4F4F4:#D6001C:#F4F4F4
rem|Remo|REM|Belém|PA|Mangueirão|53635|A|62|30|solid:#0A1F44:#F4F4F4:#F4F4F4
san|Santos|SAN|Santos|SP|Vila Belmiro|16068|A|82|50|solid:#F4F4F4:#161616:#F4F4F4
sao|São Paulo|SAO|São Paulo|SP|MorumBIS|66795|A|86|70|band:#F4F4F4:#E30613:#F4F4F4:#161616
vas|Vasco|VAS|Rio de Janeiro|RJ|São Januário|21880|A|82|70|sash:#161616:#F4F4F4:#161616
vit|Vitória|VIT|Salvador|BA|Barradão|30618|A|68|35|hoops:#E30613:#161616:#F4F4F4
ame|América-MG|AME|Belo Horizonte|MG|Independência|23018|B|57|18|solid:#0A8A3E:#161616:#161616
atc|Athletic|ATC|São João del-Rei|MG|Joaquim Portugal|6000|B|42|8|stripes:#161616:#F4F4F4:#161616
acg|Atlético-GO|ACG|Goiânia|GO|Antônio Accioly|12500|B|56|16|stripes:#E30613:#161616:#161616
ava|Avaí|AVA|Florianópolis|SC|Ressacada|17800|B|55|14|stripes:#0059A8:#F4F4F4:#F4F4F4
bfs|Botafogo-SP|BFS|Ribeirão Preto|SP|Santa Cruz|29292|B|46|9|stripes3:#E30613:#161616:#F4F4F4:#F4F4F4
cea|Ceará|CEA|Fortaleza|CE|Castelão|63903|B|64|25|stripes:#161616:#F4F4F4:#161616
crb|CRB|CRB|Maceió|AL|Rei Pelé|17126|B|50|10|hoops:#E30613:#F4F4F4:#F4F4F4
cri|Criciúma|CRI|Criciúma|SC|Heriberto Hülse|19225|B|55|13|stripes3:#FFD100:#161616:#161616:#F4F4F4
cui|Cuiabá|CUI|Cuiabá|MT|Arena Pantanal|44000|B|56|18|solid:#FFD700:#0A8A3E:#0A8A3E
for|Fortaleza|FOR|Fortaleza|CE|Castelão|63903|B|66|28|hoops3:#003DA5:#E30613:#003DA5:#F4F4F4
goi|Goiás|GOI|Goiânia|GO|Serrinha|14450|B|58|16|solid:#0A8A3E:#F4F4F4:#F4F4F4
juv|Juventude|JUV|Caxias do Sul|RS|Alfredo Jaconi|19924|B|56|15|stripes:#0A8A3E:#F4F4F4:#F4F4F4
lec|Londrina|LEC|Londrina|PR|Estádio do Café|31000|B|46|9|solid:#4FA3DF:#F4F4F4:#F4F4F4
nau|Náutico|NAU|Recife|PE|Aflitos|22856|B|52|11|stripes:#E30613:#F4F4F4:#F4F4F4
nov|Novorizontino|NOV|Novo Horizonte|SP|Jorge Ismael de Biasi|16000|B|50|12|solid:#FFD200:#161616:#161616
ope|Operário-PR|OPE|Ponta Grossa|PR|Germano Krüger|10632|B|47|9|stripes:#161616:#F4F4F4:#161616
pon|Ponte Preta|PON|Campinas|SP|Moisés Lucarelli|19728|B|55|12|sash:#F4F4F4:#161616:#161616
sbe|São Bernardo|SBE|São Bernardo do Campo|SP|1º de Maio|15159|B|42|8|solid:#FFD100:#161616:#161616
spt|Sport|SPT|Recife|PE|Ilha do Retiro|26418|B|64|22|hoops:#E30613:#161616:#161616
vil|Vila Nova|VIL|Goiânia|GO|OBA|11788|B|50|10|solid:#E30613:#F4F4F4:#F4F4F4
ama|Amazonas|AMA|Manaus|AM|Arena da Amazônia|44000|C|40|4|stripes:#FFD100:#161616:#161616
anp|Anápolis|ANP|Anápolis|GO|Jonas Duarte|15000|C|30|2|solid:#E30613:#F4F4F4:#F4F4F4
bar|Barra|BAR|Balneário Camboriú|SC|Arena Barra FC|5500|C|28|3|solid:#123E7C:#F4F4F4:#F4F4F4
bpb|Botafogo-PB|BPB|João Pessoa|PB|Almeidão|25770|C|37|3|stripes:#161616:#F4F4F4:#161616
bru|Brusque|BRU|Brusque|SC|Augusto Bauer|5000|C|35|3|solid:#FFD100:#E30613:#0A8A3E
cax|Caxias|CAX|Caxias do Sul|RS|Centenário|22132|C|36|3|solid:#7A1E2C:#F4F4F4:#F4F4F4
con|Confiança|CON|Aracaju|SE|Batistão|15575|C|35|3|stripes:#2F6FD6:#F4F4F4:#F4F4F4
fer|Ferroviária|FER|Araraquara|SP|Fonte Luminosa|20000|C|40|4|solid:#7A1E2C:#F4F4F4:#F4F4F4
fig|Figueirense|FIG|Florianópolis|SC|Orlando Scarpelli|19584|C|45|5|stripes:#161616:#F4F4F4:#161616
flo|Floresta|FLO|Fortaleza|CE|Presidente Vargas|20268|C|32|2|stripes:#0A8A3E:#F4F4F4:#F4F4F4
gua|Guarani|GUA|Campinas|SP|Brinco de Ouro|29130|C|45|5|solid:#0A8A3E:#F4F4F4:#F4F4F4
inl|Inter de Limeira|INL|Limeira|SP|Limeirão|18000|C|32|2|stripes:#161616:#F4F4F4:#161616
ita|Itabaiana|ITA|Itabaiana|SE|Etelvino Mendonça|10000|C|30|2|solid:#1F4E9A:#F4F4F4:#F4F4F4
itu|Ituano|ITU|Itu|SP|Novelli Júnior|18560|C|38|4|hoops:#E30613:#161616:#161616
mar|Maranhão|MAR|São Luís|MA|Castelão (MA)|40149|C|28|2|hoops3:#1F4E9A:#E30613:#1F4E9A:#F4F4F4
mga|Maringá|MGA|Maringá|PR|Willie Davids|21600|C|34|3|solid:#1F3A93:#F4F4F4:#F4F4F4
pay|Paysandu|PAY|Belém|PA|Curuzu|16200|C|48|5|stripes:#3FA9F5:#F4F4F4:#F4F4F4
sta|Santa Cruz|STA|Recife|PE|Arruda|60044|C|46|4|hoops3:#161616:#E30613:#161616:#F4F4F4
vre|Volta Redonda|VRE|Volta Redonda|RJ|Raulino de Oliveira|18230|C|38|4|solid:#FFD100:#161616:#161616
ypi|Ypiranga|YPI|Erechim|RS|Colosso da Lagoa|22000|C|33|2|solid:#FFD100:#0A8A3E:#0A8A3E
`;

// Nome,POS,idade,overall[,nacionalidade]  (nacionalidade padrão: BRA)
// POS: GOL LD ZAG LE VOL MC MEI PE PD ATA
const ELENCOS_A = {
  fla: `Rossi,GOL,30,80,ARG;Matheus Cunha,GOL,24,70;Varela,LD,33,77,URU;Emerson Royal,LD,27,76;Léo Ortiz,ZAG,30,81;Léo Pereira,ZAG,30,80;Danilo,ZAG,35,78;Alex Sandro,LE,35,77;Ayrton Lucas,LE,28,76;Jorginho,VOL,34,81,ITA;Pulgar,VOL,32,78,CHI;Allan,VOL,35,74;Saúl,MC,31,78,ESP;De la Cruz,MC,29,80,URU;Arrascaeta,MEI,32,84,URU;Lucas Paquetá,MEI,28,83;Carrascal,MEI,28,79,COL;Plata,PD,25,78,ECU;Luiz Araújo,PD,30,77;Samuel Lino,PE,26,79;Bruno Henrique,PE,35,78;Pedro,ATA,29,82`,
  pal: `Weverton,GOL,38,79;Carlos Miguel,GOL,27,76;Giay,LD,22,75,ARG;Khellven,LD,25,74;Gustavo Gómez,ZAG,33,81,PAR;Murilo,ZAG,29,79;Bruno Fuchs,ZAG,28,76;Micael,ZAG,26,75;Piquerez,LE,28,79,URU;Aníbal Moreno,VOL,27,79,ARG;Emiliano Martínez,VOL,27,77,URU;Lucas Evangelista,MC,31,77;Andreas Pereira,MC,30,79;Raphael Veiga,MEI,31,79;Mauricio,MEI,25,77;Facundo Torres,PD,26,79,URU;Felipe Anderson,PD,33,77;Ramón Sosa,PE,26,77,PAR;Paulinho,PE,25,77;Vitor Roque,ATA,21,80;Flaco López,ATA,25,79,ARG`,
  cru: `Cássio,GOL,39,77;Léo Aragão,GOL,27,70;William,LD,31,76;Fagner,LD,37,74;Fabrício Bruno,ZAG,30,80;Jonathan Jesus,ZAG,26,76;Villalba,ZAG,31,75,ARG;Kaiki Bruno,LE,22,75;Lucas Romero,VOL,32,78,ARG;Walace,VOL,31,77;Lucas Silva,VOL,33,75;Gerson,MC,29,82;Christian,MC,25,77;Matheus Henrique,MC,28,77;Matheus Pereira,MEI,30,82;Eduardo,MEI,36,74;Wanderson,PD,31,76;Arroyo,PE,24,76,ECU;Kaio Jorge,ATA,24,81;Sinisterra,ATA,27,76,COL`,
  bot: `John,GOL,30,79;Léo Linck,GOL,25,72;Vitinho,LD,26,76;Mateo Ponte,LD,22,74,URU;Barboza,ZAG,31,78,ARG;Jair,ZAG,21,75;David Ricardo,ZAG,23,74;Alex Telles,LE,33,77;Cuiabano,LE,23,75;Marlon Freitas,VOL,31,80;Danilo Barbosa,VOL,30,76;Newton,MC,25,74;Montoro,MEI,22,77,ARG;Santiago Rodríguez,MEI,26,78,URU;Savarino,PD,29,80,VEN;Artur,PD,28,77;Matheus Martins,PE,22,76;Arthur Cabral,ATA,28,76;Joaquín Correa,ATA,32,77,ARG;Chris Ramos,ATA,29,74,ESP`,
  flu: `Fábio,GOL,45,76;Vitor Eudes,GOL,26,71;Samuel Xavier,LD,35,74;Guga,LD,27,75;Thiago Silva,ZAG,41,79;Freytes,ZAG,26,77,ARG;Ignácio,ZAG,28,76;Thiago Santos,ZAG,36,74;Renê,LE,33,74;Fuentes,LE,28,74,COL;Martinelli,VOL,24,79;Hércules,VOL,25,77;Bernal,VOL,22,75,URU;Nonato,MC,27,76;Lima,MC,29,75;Lucho Acosta,MEI,31,80,ARG;Ganso,MEI,36,76;Canobbio,PD,27,77,URU;Serna,PD,28,77,COL;Soteldo,PE,28,76,VEN;Keno,PE,36,73;Germán Cano,ATA,38,77,ARG;Everaldo,ATA,35,74;John Kennedy,ATA,24,75`,
  sao: `Rafael,GOL,36,78;Cédric,LD,34,74,POR;Ferraresi,ZAG,27,77,VEN;Arboleda,ZAG,34,77,ECU;Alan Franco,ZAG,29,77,ARG;Sabino,ZAG,29,75;Enzo Díaz,LE,30,76,ARG;Wendell,LE,32,75;Bobadilla,VOL,24,77,PAR;Pablo Maia,VOL,24,77;Marcos Antônio,MC,25,77;Alisson,MC,32,75;Oscar,MEI,34,79;Lucas Moura,PD,33,80;Tapia,PD,24,75,CHI;Ferreirinha,PE,28,75;Calleri,ATA,32,79,ARG;André Silva,ATA,28,75;Luciano,ATA,33,75;Ryan Francisco,ATA,19,70`,
  cor: `Hugo Souza,GOL,27,79;Felipe Longo,GOL,21,66;Matheuzinho,LD,25,77;Félix Torres,ZAG,29,77,ECU;Gustavo Henrique,ZAG,33,76;André Ramalho,ZAG,34,76;Cacá,ZAG,27,74;Angileri,LE,32,75,ARG;Raniele,VOL,29,77;José Martínez,VOL,32,77,VEN;Maycon,VOL,28,76;Breno Bidon,MC,21,76;Charles,MC,30,74;Garro,MEI,28,80,ARG;Memphis,MEI,32,82,NED;Carrillo,PD,35,75,PER;Romero,PE,34,75,PAR;Talles Magno,PE,24,72;Yuri Alberto,ATA,25,79;Gui Negão,ATA,20,70`,
  cam: `Everson,GOL,36,79;Gabriel Delfim,GOL,24,70;Natanael,LD,24,75;Saravia,LD,33,74,ARG;Lyanco,ZAG,29,77;Junior Alonso,ZAG,33,78,PAR;Iván Román,ZAG,23,75,CHI;Vitor Hugo,ZAG,35,74;Guilherme Arana,LE,29,80;Caio Paulista,LE,28,74;Alan Franco,VOL,27,77,ECU;Fausto Vera,VOL,26,76,ARG;Gabriel Menino,MC,25,76;Igor Gomes,MC,27,75;Gustavo Scarpa,MEI,32,79;Bernard,MEI,33,77;Cuello,PD,26,77,ARG;Dudu,PE,34,77;Biel,PE,25,74;Rony,ATA,31,76;Hulk,ATA,40,79`,
  int: `Rochet,GOL,33,79,URU;Anthoni,GOL,24,71;Aguirre,LD,26,75,ARG;Vitão,ZAG,26,78;Mercado,ZAG,39,74,ARG;Juninho,ZAG,30,74;Clayton Sampaio,ZAG,27,73;Bernabei,LE,25,77,ARG;Thiago Maia,VOL,29,77;Fernando,VOL,38,74;Bruno Henrique,VOL,36,75;Alan Patrick,MEI,35,80;Óscar Romero,MEI,33,75,PAR;Vitinho,PD,26,74;Carbonero,PD,26,75,COL;Wesley,PE,26,77;Borré,ATA,30,79,COL;Enner Valencia,ATA,36,77,ECU;Ricardo Mathias,ATA,21,70`,
  gre: `Tiago Volpi,GOL,35,77;Gabriel Grando,GOL,25,70;João Pedro,LD,29,74;Kannemann,ZAG,35,76,ARG;Wagner Leonardo,ZAG,27,76;Jemerson,ZAG,33,75;Gustavo Martins,ZAG,22,73;Marlon,LE,28,74;Villasanti,VOL,29,78,PAR;Dodi,VOL,30,76;Edenílson,MC,36,74;Cristaldo,MEI,29,78,ARG;Monsalve,MEI,21,75,COL;Pavón,PD,30,76,ARG;Aravena,PD,23,75,CHI;Amuzu,PE,26,75,BEL;Alysson,PE,20,72;Braithwaite,ATA,35,77,DEN;Carlos Vinícius,ATA,31,75;Arezo,ATA,23,74,URU;André Henrique,ATA,29,72`,
  bah: `Marcos Felipe,GOL,30,77;Ronaldo,GOL,30,71;Gilberto,LD,33,75;Santiago Arias,LD,34,74,COL;Kanu,ZAG,28,76;David Duarte,ZAG,31,75;Gabriel Xavier,ZAG,24,74;Ramos Mingo,ZAG,24,74,ARG;Luciano Juba,LE,26,77;Caio Alexandre,VOL,27,78;Acevedo,VOL,27,76,URU;Jean Lucas,MC,27,77;Rodrigo Nestor,MC,25,76;Everton Ribeiro,MEI,37,77;Cauly,MEI,30,77;Michel Araújo,MEI,29,75,URU;Erick Pulga,PD,25,76;Kayky,PD,23,72;Ademir,PE,31,75;Willian José,ATA,34,76;Lucho Rodríguez,ATA,23,74,URU`,
  vas: `Léo Jardim,GOL,31,79;Daniel Fuzato,GOL,28,70;Paulo Henrique,LD,29,75;Puma Rodríguez,LD,27,74,URU;Robert Renan,ZAG,22,75;Lucas Freitas,ZAG,21,73;Maurício Lemos,ZAG,30,73,URU;Lucas Piton,LE,25,76;Hugo Moura,VOL,28,76;Thiago Mendes,VOL,34,75;Tchê Tchê,MC,33,74;Philippe Coutinho,MEI,34,79;Matheus França,MEI,22,74;Nuno Moreira,PE,26,76,POR;David,PE,30,75;Andrés Gómez,PD,23,74,COL;Adson,PD,25,73;Vegetti,ATA,37,77,ARG;GB,ATA,20,70`,
  san: `Gabriel Brazão,GOL,26,77;Mayke,LD,33,74;Igor Vinícius,LD,29,74;Zé Ivaldo,ZAG,29,75;Luan Peres,ZAG,32,75;Adonis Frías,ZAG,27,75,ARG;Escobar,LE,28,74,ARG;Souza,LE,21,72;João Schmidt,VOL,33,75;Zé Rafael,VOL,33,76;Willian Arão,VOL,34,75;Tomás Rincón,VOL,38,72,VEN;Gabriel Bontempo,MC,21,72;Rollheiser,MEI,26,76,ARG;Thaciano,MEI,31,74;Neymar,MEI,34,84;Barreal,PE,25,75,ARG;Robinho Jr.,PE,18,71;Guilherme,PD,30,75;Gabigol,ATA,29,77;Tiquinho Soares,ATA,35,74`,
  cap: `Mycael,GOL,22,74;Santos,GOL,36,73;Benavídez,LD,26,72,URU;Arthur Dias,ZAG,25,73;Gamarra,ZAG,26,73,PAR;Esquivel,LE,24,73,ARG;Felipinho,VOL,25,74;Raul,VOL,26,73;Zapelli,MEI,23,75,ARG;Luiz Fernando,MEI,30,72;Mendoza,PE,33,74,COL;Julimar,ATA,30,73;Viveros,ATA,26,74,COL;Renan Peixoto,ATA,25,71`,
  rbb: `Cleiton,GOL,28,76;Lucão,GOL,24,70;Andrés Hurtado,LD,26,74,ECU;Sant'Anna,LD,24,73,URU;Pedro Henrique,ZAG,30,75;Guzmán Rodríguez,ZAG,33,74,URU;Alix Vinicius,ZAG,25,72;Juninho Capixaba,LE,29,75;Matheus Fernandes,VOL,28,74;Eric Ramires,MC,26,75;Fabinho,MC,27,73;Jhon Jhon,MEI,25,76;Gustavinho,MEI,24,73;Vinicinho,PD,21,73;Laquintana,PD,26,73,URU;Lucas Barbosa,PE,25,73;Henry Mosquera,ATA,23,74,COL;Isidro Pitta,ATA,26,75,PAR;Eduardo Sasha,ATA,34,74`,
  vit: `Lucas Arcanjo,GOL,27,75;Thiago Couto,GOL,24,69;Raúl Cáceres,LD,34,72,PAR;Neris,ZAG,30,73;Lucas Halter,ZAG,26,73;Camutanga,ZAG,33,72;Jamerson,LE,29,72;Ramon,LE,25,71;Baralhas,VOL,26,73;Ronald,VOL,28,73;Willian Oliveira,VOL,32,72;Matheuzinho,MEI,25,73;Cantalapiedra,MEI,30,72,ESP;Gustavo Mosquito,PE,29,72;Osvaldo,PD,39,70;Erick,ATA,25,72;Renato Kayzer,ATA,30,75`,
  cfc: `Pedro Morisco,GOL,22,73;Maicon,ZAG,37,72;Jacy,ZAG,30,71;Tiago Cóser,ZAG,30,71;Bruno Melo,LE,32,70;Sebastián Gómez,VOL,23,74,COL;Willian Farias,VOL,36,70;Josué,MC,36,72;Vini Paulista,MEI,26,72;Lucas Ronier,PE,20,72;Clayson,PE,31,71;Gustavo Coutinho,ATA,26,73;Rodrigo Rodrigues,ATA,30,70;Dellatorre,ATA,34,70`,
  mir: `Walter,GOL,38,74;Alex Muralha,GOL,36,70;Lucas Ramon,LD,31,73;Jemmes,ZAG,33,73;João Victor,ZAG,27,73;Reinaldo,LE,36,74;Neto Moura,VOL,29,74;José Aldo,VOL,30,72;Danielzinho,MC,30,74;Chico Kim,MEI,25,73;Shaylon,MEI,28,72;Negueba,PD,33,73;Alesson,PE,26,72;Edson Carioca,ATA,26,73;Iury Castilho,ATA,30,72`,
  rem: `Marcelo Rangel,GOL,37,72;Marcelinho,LD,30,69;Reynaldo,ZAG,36,70;Kayky Almeida,ZAG,23,69;Sávio,LE,24,70;Caio Vinícius,VOL,28,71;Jaderson,VOL,25,70;Pavani,MC,26,70;Diego Hernández,MEI,25,72,URU;Nicolás Ferreira,PD,24,71,URU;Janderson,PE,27,71;Pedro Rocha,ATA,31,72`,
  cha: `Léo Vieira,GOL,28,72;Anderson,GOL,32,68;Eduardo Doma,ZAG,27,69;Bruno Leonardo,ZAG,27,69;Walter Clar,LE,31,69,URU;Rafael Carvalheira,VOL,31,70;Giovanni Augusto,MEI,36,71;Jean Carlos,MEI,32,71;Marcinho,PE,31,70;Ítalo,ATA,23,70;Perotti,ATA,29,71,ARG;Neto Pessoa,ATA,31,69`,
};

// Mercado internacional: liga → clubes → jogadores
const MUNDO = [
  { liga: 'Premier League', sigla: 'ING', prest: 100, clubes: {
    'Manchester City': `Erling Haaland,ATA,26,91,NOR;Rodri,VOL,30,88,ESP;Phil Foden,MEI,26,85,ING;Rúben Dias,ZAG,29,87,POR;Joško Gvardiol,ZAG,24,86,CRO;Gianluigi Donnarumma,GOL,27,88,ITA;Tijjani Reijnders,MC,28,84,NED;Rayan Cherki,MEI,23,83,FRA;Omar Marmoush,ATA,27,83,EGY;Jérémy Doku,PE,24,83,BEL;Savinho,PD,22,80;Bernardo Silva,MEI,32,84,POR`,
    'Arsenal': `Bukayo Saka,PD,25,88,ING;Martin Ødegaard,MEI,27,86,NOR;Declan Rice,MC,27,87,ING;William Saliba,ZAG,25,88,FRA;Gabriel Magalhães,ZAG,28,87;David Raya,GOL,30,86,ESP;Viktor Gyökeres,ATA,28,86,SWE;Martín Zubimendi,VOL,27,85,ESP;Eberechi Eze,MEI,28,84,ING;Gabriel Martinelli,PE,25,83;Jurriën Timber,LD,25,84,NED;Riccardo Calafiori,LE,24,82,ITA`,
    'Liverpool': `Mohamed Salah,PD,34,87,EGY;Virgil van Dijk,ZAG,35,87,NED;Alisson,GOL,33,88;Florian Wirtz,MEI,23,87,GER;Alexander Isak,ATA,26,87,SWE;Alexis Mac Allister,MC,27,86,ARG;Dominik Szoboszlai,MC,25,85,HUN;Ryan Gravenberch,VOL,24,85,NED;Hugo Ekitiké,ATA,24,84,FRA;Cody Gakpo,PE,27,84,NED;Milos Kerkez,LE,22,82,HUN;Ibrahima Konaté,ZAG,27,85,FRA`,
    'Chelsea': `Cole Palmer,MEI,24,87,ING;Enzo Fernández,MC,25,85,ARG;Moisés Caicedo,VOL,24,87,ECU;Estêvão,PD,19,82;João Pedro,ATA,24,83;Reece James,LD,26,84,ING;Marc Cucurella,LE,28,84,ESP;Pedro Neto,PE,26,82,POR;Robert Sánchez,GOL,28,81,ESP;Levi Colwill,ZAG,23,83,ING;Andrey Santos,VOL,22,79`,
    'Manchester United': `Bruno Fernandes,MEI,31,86,POR;Bryan Mbeumo,PD,26,83,CMR;Matheus Cunha,ATA,27,83;Benjamin Šeško,ATA,23,81,SVN;Casemiro,VOL,34,79;Lisandro Martínez,ZAG,28,83,ARG;Senne Lammens,GOL,24,79,BEL;Kobbie Mainoo,MC,21,80,ING;Amad Diallo,PD,23,81,CIV;Leny Yoro,ZAG,20,80,FRA`,
    'Tottenham': `Cristian Romero,ZAG,28,85,ARG;Micky van de Ven,ZAG,25,84,NED;Xavi Simons,MEI,23,83,NED;Mohammed Kudus,PD,25,82,GHA;Dominic Solanke,ATA,28,80,ING;Richarlison,ATA,29,78;Guglielmo Vicario,GOL,29,83,ITA;James Maddison,MEI,29,82,ING;João Palhinha,VOL,31,82,POR`,
    'Newcastle': `Bruno Guimarães,MC,28,86;Sandro Tonali,MC,26,85,ITA;Anthony Gordon,PE,25,83,ING;Nick Woltemade,ATA,24,81,GER;Joelinton,MC,29,81;Nick Pope,GOL,34,82,ING;Sven Botman,ZAG,26,82,NED`,
    'Aston Villa': `Ollie Watkins,ATA,30,84,ING;Emiliano Martínez,GOL,33,85,ARG;Morgan Rogers,MEI,23,83,ING;Youri Tielemans,MC,29,82,BEL;Ezri Konsa,ZAG,28,82,ING`,
    'Nottingham Forest': `Murillo,ZAG,23,82;Igor Jesus,ATA,25,78;Morgan Gibbs-White,MEI,26,82,ING`,
    'Brentford': `Igor Thiago,ATA,25,80`,
    'Bournemouth': `Rayan,PD,20,74;Evanilson,ATA,26,78`,
    'Wolverhampton': `João Gomes,VOL,25,80`,
    'Brighton': `Kaoru Mitoma,PE,29,81,JPN`,
    'Crystal Palace': `Ismaïla Sarr,PD,28,80,SEN;Jean-Philippe Mateta,ATA,29,80,FRA`,
  }},
  { liga: 'LaLiga', sigla: 'ESP', prest: 96, clubes: {
    'Real Madrid': `Kylian Mbappé,ATA,27,91,FRA;Vinícius Júnior,PE,26,89;Jude Bellingham,MEI,23,89,ING;Federico Valverde,MC,28,88,URU;Thibaut Courtois,GOL,34,89,BEL;Aurélien Tchouaméni,VOL,26,85,FRA;Éder Militão,ZAG,28,84;Antonio Rüdiger,ZAG,33,85,GER;Dean Huijsen,ZAG,21,84,ESP;Trent Alexander-Arnold,LD,27,86,ING;Rodrygo,PD,25,84;Arda Güler,MEI,21,84,TUR;Endrick,ATA,20,77;Álvaro Carreras,LE,23,82,ESP;Eduardo Camavinga,MC,23,84,FRA;Franco Mastantuono,PD,19,79,ARG`,
    'Barcelona': `Lamine Yamal,PD,19,91,ESP;Pedri,MC,23,89,ESP;Raphinha,PE,29,88;Robert Lewandowski,ATA,37,85,POL;Frenkie de Jong,MC,29,86,NED;Jules Koundé,LD,27,86,FRA;Pau Cubarsí,ZAG,19,85,ESP;Joan García,GOL,25,85,ESP;Gavi,MC,22,83,ESP;Fermín López,MEI,23,83,ESP;Dani Olmo,MEI,28,84,ESP;Alejandro Balde,LE,22,83,ESP;Ronald Araújo,ZAG,27,83,URU;Ferran Torres,ATA,26,81,ESP`,
    'Atlético de Madrid': `Julián Álvarez,ATA,26,87,ARG;Antoine Griezmann,ATA,35,83,FRA;Jan Oblak,GOL,33,87,SVN;Koke,MC,34,80,ESP;Pablo Barrios,MC,23,83,ESP;Álex Baena,MEI,25,84,ESP;Giuliano Simeone,PD,23,80,ARG;Alexander Sørloth,ATA,30,82,NOR;Marcos Llorente,LD,31,82,ESP;Robin Le Normand,ZAG,29,82,ESP`,
    'Athletic Club': `Nico Williams,PE,24,85,ESP;Iñaki Williams,PD,32,80,GHA;Unai Simón,GOL,29,85,ESP;Oihan Sancet,MEI,26,82,ESP`,
    'Real Betis': `Isco,MEI,34,82,ESP;Antony,PD,26,80;Giovani Lo Celso,MC,30,80,ARG`,
    'Real Sociedad': `Mikel Oyarzabal,ATA,29,83,ESP;Takefusa Kubo,PD,25,82,JPN`,
    'Villarreal': `Gerard Moreno,ATA,34,79,ESP`,
  }},
  { liga: 'Serie A (ITA)', sigla: 'ITA', prest: 92, clubes: {
    'Inter': `Lautaro Martínez,ATA,29,88,ARG;Nicolò Barella,MC,29,87,ITA;Hakan Çalhanoğlu,VOL,32,84,TUR;Alessandro Bastoni,ZAG,27,87,ITA;Marcus Thuram,ATA,29,85,FRA;Yann Sommer,GOL,37,83,SUI;Federico Dimarco,LE,28,85,ITA;Denzel Dumfries,LD,30,84,NED;Ange-Yoan Bonny,ATA,22,78,FRA`,
    'Napoli': `Kevin De Bruyne,MEI,35,85,BEL;Scott McTominay,MC,29,86,SCO;Rasmus Højlund,ATA,23,82,DEN;Romelu Lukaku,ATA,33,81,BEL;Stanislav Lobotka,VOL,31,84,SVK;Alessandro Buongiorno,ZAG,27,83,ITA;Giovanni Di Lorenzo,LD,32,83,ITA;David Neres,PD,29,80;Frank Anguissa,MC,30,83,CMR;Alex Meret,GOL,29,82,ITA`,
    'Milan': `Rafael Leão,PE,27,85,POR;Luka Modrić,MC,40,83,CRO;Christian Pulisic,PD,27,84,USA;Mike Maignan,GOL,30,87,FRA;Adrien Rabiot,MC,31,83,FRA;Santiago Giménez,ATA,25,80,MEX;Christopher Nkunku,ATA,28,81,FRA;Youssouf Fofana,VOL,27,81,FRA;Fikayo Tomori,ZAG,28,81,ING`,
    'Juventus': `Dušan Vlahović,ATA,26,83,SRB;Kenan Yıldız,PE,21,85,TUR;Bremer,ZAG,29,85;Jonathan David,ATA,26,83,CAN;Teun Koopmeiners,MC,28,82,NED;Khéphren Thuram,MC,25,82,FRA;Francisco Conceição,PD,23,81,POR;Manuel Locatelli,VOL,28,82,ITA;Michele Di Gregorio,GOL,29,82,ITA`,
    'Atalanta': `Ademola Lookman,PE,28,84,NGA;Charles De Ketelaere,MEI,25,83,BEL;Éderson,MC,27,83;Gianluca Scamacca,ATA,27,79,ITA`,
    'Roma': `Paulo Dybala,ATA,32,82,ARG;Matías Soulé,PD,23,81,ARG;Manu Koné,MC,25,83,FRA;Mile Svilar,GOL,26,85,SRB;Artem Dovbyk,ATA,29,80,UKR;Wesley,LD,22,79`,
    'Como': `Nico Paz,MEI,21,84,ARG`,
    'Fiorentina': `Moise Kean,ATA,26,83,ITA;David de Gea,GOL,35,84,ESP`,
    'Bologna': `Riccardo Orsolini,PD,29,81,ITA`,
  }},
  { liga: 'Bundesliga', sigla: 'ALE', prest: 91, clubes: {
    'Bayern de Munique': `Harry Kane,ATA,33,90,ING;Michael Olise,PD,24,88,FRA;Jamal Musiala,MEI,23,88,GER;Joshua Kimmich,MC,31,87,GER;Manuel Neuer,GOL,40,84,GER;Dayot Upamecano,ZAG,27,85,FRA;Jonathan Tah,ZAG,30,85,GER;Luis Díaz,PE,29,86,COL;Alphonso Davies,LE,25,83,CAN;Serge Gnabry,PD,31,82,GER;Aleksandar Pavlović,VOL,22,84,GER;Konrad Laimer,LD,29,82,AUT`,
    'Borussia Dortmund': `Serhou Guirassy,ATA,30,85,GUI;Gregor Kobel,GOL,28,86,SUI;Karim Adeyemi,PE,24,81,GER;Julian Brandt,MEI,30,82,GER;Nico Schlotterbeck,ZAG,26,85,GER;Felix Nmecha,MC,25,81,GER;Jobe Bellingham,MC,20,78,ING`,
    'Bayer Leverkusen': `Patrik Schick,ATA,30,82,CZE;Alejandro Grimaldo,LE,30,84,ESP;Exequiel Palacios,MC,27,83,ARG;Malik Tillman,MEI,24,80,USA`,
    'RB Leipzig': `David Raum,LE,28,81,GER;Christoph Baumgartner,MEI,27,80,AUT;Xaver Schlager,MC,28,81,AUT`,
    'Stuttgart': `Deniz Undav,ATA,30,81,GER`,
    'Eintracht Frankfurt': `Can Uzun,MEI,20,79,TUR;Jonathan Burkardt,ATA,26,80,GER`,
  }},
  { liga: 'Ligue 1', sigla: 'FRA', prest: 88, clubes: {
    'Paris Saint-Germain': `Ousmane Dembélé,PD,29,90,FRA;Khvicha Kvaratskhelia,PE,25,88,GEO;Vitinha,MC,26,88,POR;João Neves,MC,22,87,POR;Achraf Hakimi,LD,27,88,MAR;Marquinhos,ZAG,32,86;Nuno Mendes,LE,24,87,POR;Willian Pacho,ZAG,24,85,ECU;Désiré Doué,PD,21,86,FRA;Bradley Barcola,PE,24,83,FRA;Fabián Ruiz,MC,30,84,ESP;Gonçalo Ramos,ATA,25,81,POR;Lucas Chevalier,GOL,24,84,FRA;Lucas Beraldo,ZAG,22,79`,
    'Olympique de Marseille': `Mason Greenwood,PD,24,84,ING;Pierre-Emerick Aubameyang,ATA,37,79,GAB;Igor Paixão,PE,26,80;Gerónimo Rulli,GOL,34,83,ARG;Amine Gouiri,ATA,26,80,ALG;Pierre-Emile Højbjerg,VOL,31,81,DEN`,
    'Monaco': `Paul Pogba,MC,33,77,FRA;Ansu Fati,PE,23,77,ESP;Aleksandr Golovin,MEI,30,80,RUS;Takumi Minamino,MEI,31,79,JPN;Folarin Balogun,ATA,25,79,USA`,
    'Lille': `Hákon Haraldsson,MEI,23,80,ISL;Olivier Giroud,ATA,40,74,FRA`,
  }},
  { liga: 'Liga Portugal', sigla: 'POR', prest: 78, clubes: {
    'Benfica': `Vangelis Pavlidis,ATA,27,82,GRE;Anatoliy Trubin,GOL,25,83,UKR;Nicolás Otamendi,ZAG,38,79,ARG;António Silva,ZAG,22,81,POR;Fredrik Aursnes,MC,30,81,NOR;Richard Ríos,MC,26,81,COL;Georgiy Sudakov,MEI,24,81,UKR`,
    'Porto': `Samu Aghehowa,ATA,22,82,ESP;Diogo Costa,GOL,27,86,POR;Rodrigo Mora,MEI,19,79,POR;Alan Varela,VOL,25,82,ARG;Gabri Veiga,MC,24,80,ESP;William Gomes,PD,20,76;Pepê,PE,29,79`,
    'Sporting': `Luis Suárez,ATA,28,82,COL;Francisco Trincão,PD,26,83,POR;Pedro Gonçalves,MEI,28,82,POR;Morten Hjulmand,VOL,27,83,DEN;Gonçalo Inácio,ZAG,25,83,POR;Maxi Araújo,LE,26,80,URU`,
    'Braga': `Ricardo Horta,PE,31,79,POR`,
  }},
  { liga: 'Saudi Pro League', sigla: 'SAU', prest: 74, clubes: {
    'Al-Nassr': `Cristiano Ronaldo,ATA,41,84,POR;Sadio Mané,PE,34,80,SEN;João Félix,ATA,26,81,POR;Kingsley Coman,PD,30,82,FRA;Íñigo Martínez,ZAG,35,81,ESP;Marcelo Brozović,VOL,33,81,CRO;Bento,GOL,27,79;Ângelo,PD,21,74`,
    'Al-Hilal': `Rúben Neves,VOL,29,83,POR;Sergej Milinković-Savić,MC,31,83,SRB;Theo Hernández,LE,28,84,FRA;Kalidou Koulibaly,ZAG,35,80,SEN;Malcom,PD,29,81;Yassine Bounou,GOL,35,84,MAR;Darwin Núñez,ATA,27,82,URU;João Cancelo,LD,32,82,POR;Marcos Leonardo,ATA,23,77`,
    'Al-Ittihad': `Karim Benzema,ATA,38,83,FRA;N'Golo Kanté,MC,35,81,FRA;Fabinho,VOL,32,79;Moussa Diaby,PD,27,80,FRA;Houssem Aouar,MEI,28,79,ALG;Steven Bergwijn,PE,28,78,NED`,
    'Al-Ahli': `Riyad Mahrez,PD,35,82,ALG;Ivan Toney,ATA,30,83,ING;Franck Kessié,MC,29,81,CIV;Édouard Mendy,GOL,34,83,SEN;Roger Ibañez,ZAG,27,79;Galeno,PE,28,80;Enzo Millot,MEI,24,80,FRA`,
    'Al-Qadsiah': `Julián Quiñones,ATA,29,79,MEX;Nahitan Nández,MC,30,78,URU`,
  }},
  { liga: 'Süper Lig', sigla: 'TUR', prest: 72, clubes: {
    'Galatasaray': `Victor Osimhen,ATA,27,86,NGA;Leroy Sané,PD,30,82,GER;İlkay Gündoğan,MC,35,81,GER;Barış Alper Yılmaz,PE,26,80,TUR;Uğurcan Çakır,GOL,30,82,TUR;Mauro Icardi,ATA,33,79,ARG;Davinson Sánchez,ZAG,30,80,COL;Lucas Torreira,VOL,30,81,URU`,
    'Fenerbahçe': `Marco Asensio,MEI,30,81,ESP;Jhon Durán,ATA,22,80,COL;Ederson,GOL,33,85;Milan Škriniar,ZAG,31,82,SVK;Fred,MC,33,78;Kerem Aktürkoğlu,PE,27,80,TUR;Talisca,MEI,32,78`,
  }},
  { liga: 'MLS', sigla: 'EUA', prest: 62, clubes: {
    'Inter Miami': `Lionel Messi,ATA,39,86,ARG;Luis Suárez,ATA,39,77,URU;Rodrigo De Paul,MC,32,82,ARG;Telasco Segovia,MEI,23,76,VEN`,
    'LAFC': `Son Heung-min,PE,34,84,KOR;Denis Bouanga,PE,31,81,GAB;Hugo Lloris,GOL,39,79,FRA`,
    'LA Galaxy': `Riqui Puig,MC,27,78,ESP;Marco Reus,MEI,37,76,GER`,
    'Vancouver Whitecaps': `Thomas Müller,MEI,37,80,GER`,
    'San Diego FC': `Hirving Lozano,PD,31,79,MEX`,
  }},
  { liga: 'Liga Profesional', sigla: 'ARG', prest: 60, clubes: {
    'Boca Juniors': `Edinson Cavani,ATA,39,75,URU;Leandro Paredes,VOL,32,81,ARG;Miguel Merentiel,ATA,30,77,URU;Ander Herrera,MC,37,75,ESP;Agustín Marchesín,GOL,38,76,ARG;Exequiel Zeballos,PE,24,76,ARG`,
    'River Plate': `Franco Armani,GOL,39,77,ARG;Gonzalo Montiel,LD,29,78,ARG;Marcos Acuña,LE,34,78,ARG;Juan Fernando Quintero,MEI,33,77,COL;Maximiliano Salas,ATA,28,77,ARG;Miguel Borja,ATA,33,77,COL;Germán Pezzella,ZAG,35,77,ARG`,
    'Racing Club': `Adrián Martínez,ATA,34,78,ARG;Gabriel Arias,GOL,38,77,CHI`,
  }},
  { liga: 'Liga MX', sigla: 'MEX', prest: 60, clubes: {
    'Monterrey': `Sergio Ramos,ZAG,40,77,ESP;Sergio Canales,MEI,35,79,ESP;Lucas Ocampos,PD,32,78,ARG;Anthony Martial,ATA,30,78,FRA`,
    'Tigres': `Ángel Correa,ATA,31,80,ARG;André-Pierre Gignac,ATA,40,74,FRA;Nahuel Guzmán,GOL,40,75,ARG`,
    'Club América': `Allan Saint-Maximin,PE,29,79,FRA`,
    'León': `James Rodríguez,MEI,35,77,COL`,
  }},
];

// Nomes para gerar elencos das Séries B e C (até a base real ser importada)
const NOMES_PRIMEIROS = 'Lucas Gabriel Matheus Pedro João Rafael Felipe Bruno Gustavo Vinícius Thiago Diego Rodrigo Leonardo Caio Igor Renan Wesley Kauã Ryan Davi Arthur Enzo Kaio Yago Douglas Anderson Alisson Everton Edson Wellington Jefferson Robson Marcos Paulo André Daniel Fabrício Leandro Danilo Henrique Luan Marlon Nathan Samuel Victor Willian Eduardo Fernando Ramon Iago Jean Ítalo Breno Hugo Cauã Murilo Raul Emerson Elias Alex Jonathan Patrick Ronald Kevin Mateus Luiz Otávio Sérgio Fábio Adriano Cristian'.split(' ');
const NOMES_APELIDOS = 'Juninho Dudu Rafinha Léo Gui Neto Biel Lelê Netinho Tinga Kauê Wendel Erick Vitinho Pedrinho Matheusinho Careca Nenê Fabinho Luizinho Tchê Dodô Jajá Pepê Rodriguinho Zé Vitor Zé Marcos Lucão Ruan Dinho Brenner Kelvin Marquinhos Alemão Baiano Paulista Gaúcho Mineiro Bahia Índio Cacá Didi Tiaguinho'.split(' ');
const SOBRENOMES = 'Silva Santos Oliveira Souza Lima Pereira Costa Ferreira Rodrigues Almeida Nascimento Carvalho Araújo Ribeiro Gomes Martins Rocha Barbosa Melo Cardoso Teixeira Moura Correia Pinto Moreira Freitas Batista Dias Castro Campos Vieira Mendes Ramos Nunes Monteiro Cunha Lopes Machado Brito Fonseca Sales Pires Matos Cavalcante Assis Andrade Bezerra Sampaio Tavares Farias Macedo Queiroz Xavier Prado Paiva Siqueira Bastos Amaral Coelho'.split(' ');

const POSICOES = {
  GOL: { nome: 'Goleiro', grupo: 'gol', cor: 'gol' },
  LD: { nome: 'Lateral-direito', grupo: 'def', cor: 'def' },
  ZAG: { nome: 'Zagueiro', grupo: 'def', cor: 'def' },
  LE: { nome: 'Lateral-esquerdo', grupo: 'def', cor: 'def' },
  VOL: { nome: 'Volante', grupo: 'mei', cor: 'mei' },
  MC: { nome: 'Meio-campista', grupo: 'mei', cor: 'mei' },
  MEI: { nome: 'Meia-armador', grupo: 'mei', cor: 'mei' },
  PE: { nome: 'Ponta-esquerda', grupo: 'ata', cor: 'ata' },
  PD: { nome: 'Ponta-direita', grupo: 'ata', cor: 'ata' },
  ATA: { nome: 'Centroavante', grupo: 'ata', cor: 'ata' },
};
const ORDEM_POS = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'];

// Formações: [posição, x (0 = própria meta → 1 = meta adversária), y (0 = esquerda → 1 = direita)]
const FORMACOES = {
  '4-3-3': [['GOL', .05, .5], ['LD', .27, .88], ['ZAG', .2, .63], ['ZAG', .2, .37], ['LE', .27, .12], ['VOL', .4, .5], ['MC', .52, .7], ['MC', .52, .3], ['PD', .75, .85], ['ATA', .82, .5], ['PE', .75, .15]],
  '4-4-2': [['GOL', .05, .5], ['LD', .27, .88], ['ZAG', .2, .63], ['ZAG', .2, .37], ['LE', .27, .12], ['PD', .55, .86], ['MC', .47, .62], ['MC', .47, .38], ['PE', .55, .14], ['ATA', .8, .62], ['ATA', .8, .38]],
  '4-2-3-1': [['GOL', .05, .5], ['LD', .27, .88], ['ZAG', .2, .63], ['ZAG', .2, .37], ['LE', .27, .12], ['VOL', .4, .64], ['VOL', .4, .36], ['PD', .66, .84], ['MEI', .64, .5], ['PE', .66, .16], ['ATA', .84, .5]],
  '3-5-2': [['GOL', .05, .5], ['ZAG', .2, .75], ['ZAG', .18, .5], ['ZAG', .2, .25], ['LD', .5, .9], ['VOL', .4, .5], ['MC', .52, .68], ['MC', .52, .32], ['LE', .5, .1], ['ATA', .8, .62], ['ATA', .8, .38]],
  '5-3-2': [['GOL', .05, .5], ['LD', .3, .9], ['ZAG', .19, .7], ['ZAG', .17, .5], ['ZAG', .19, .3], ['LE', .3, .1], ['VOL', .42, .5], ['MC', .52, .7], ['MC', .52, .3], ['ATA', .78, .62], ['ATA', .78, .38]],
};

const DIVISOES = {
  A: { nome: 'Brasileirão Série A', curto: 'Série A', turnos: 2, tv: 2.2, ingresso: 70,
       zonas: [[1, 4, 'lib', 'Libertadores'], [5, 6, 'pre', 'Pré-Libertadores'], [7, 12, 'sul', 'Sul-Americana'], [17, 20, 'reb', 'Rebaixamento']] },
  B: { nome: 'Brasileirão Série B', curto: 'Série B', turnos: 2, tv: 0.55, ingresso: 40,
       zonas: [[1, 2, 'ace', 'Acesso direto'], [3, 6, 'pre', 'Playoff de acesso'], [17, 20, 'reb', 'Rebaixamento']] },
  C: { nome: 'Brasileirão Série C', curto: 'Série C', turnos: 1, tv: 0.12, ingresso: 25,
       zonas: [[1, 8, 'ace', '2ª fase (acesso)'], [19, 20, 'reb', 'Rebaixamento']] },
};
