# Diário Secreto

Um diário com tema de agente secreto, feito para dois agentes.

- **Login com cofre:** cada agente escolhe o codinome e digita a senha. Depois da senha certa, o segredo gira, as travas recolhem, o volante gira e a porta do cofre abre para o esconderijo. Há um botão para pular a animação e um botão para ligar ou desligar o som.
- **Diário:** escreva relatórios com título, texto, data, classificação (confidencial, secreto, ultrassecreto) e etiquetas. As etiquetas aparecem embaixo de cada registro e levam direto para a gaveta. Os registros podem ser editados ou incinerados.
- **Gaveta de arquivos confidenciais:** procure por etiqueta ou por dia. Mostra um índice com todas as etiquetas, a lista de dias com registros e as pastas separadas por data. Clique numa pasta para abrir o dossiê completo.
- **Painel:** contagem de registros, calendário do mês com os dias que têm registro (clique no dia para abrir os arquivos dele) e as etiquetas mais usadas.

## Como abrir

É um site estático (HTML, CSS e JavaScript, sem build). Dá para:

- abrir o `index.html` direto no navegador; ou
- servir a pasta localmente: `python3 -m http.server` dentro de `diario-secreto/` e acessar `http://localhost:8000`; ou
- publicar no GitHub Pages ou na Vercel apontando para esta pasta.

## Agentes e senhas

| Codinome | Senha inicial |
|---|---|
| Noir | `sombra` |
| Blanc | `neblina` |

**Troque as senhas antes de usar de verdade.** Elas ficam em `js/config.js` como hash SHA-256 de `diario-secreto|<id>|<senha>`. Para gerar um hash novo, abra o site, aperte F12 e rode no console:

```js
gerarHash("noir", "minha-senha-nova")
```

Copie o resultado para o campo `hash` do agente. Em `config.js` também dá para mudar codinome, lema, número de tentativas antes do bloqueio e a duração do bloqueio.

## Onde os registros ficam

Os registros ficam no `localStorage` do navegador. Isso quer dizer:

- cada aparelho e cada navegador tem o seu próprio diário;
- para levar os registros de um aparelho para outro, use **Exportar dossiê** e **Importar dossiê** no painel (arquivo `.json`);
- limpar os dados do navegador apaga o diário.

Na primeira vez aparecem três registros de exemplo. O botão **Incinerar exemplos** apaga todos de uma vez.

Para os dois agentes verem os mesmos registros em aparelhos diferentes, é preciso um banco de dados online (por exemplo Supabase ou Firebase). O código já separa o armazenamento em `js/armazem.js`, então basta trocar esse arquivo.

## Segurança

O login é parte da brincadeira, não proteção real. Num site estático qualquer pessoa pode ler o código, e os registros ficam sem criptografia no navegador. Não guarde aqui senhas, documentos ou qualquer coisa que não possa vazar.

## Estrutura

```
diario-secreto/
├── index.html        telas de login, diário, gaveta e dossiê
├── css/estilo.css    visual do bunker, papel datilografado e gaveta de aço
└── js/
    ├── config.js     agentes, hashes das senhas e bloqueio
    ├── sha256.js     hash SHA-256 em JavaScript puro
    ├── armazem.js    salvar, editar, apagar, exportar e importar registros
    ├── cofre.js      desenho do cofre, sons e animação de abertura
    └── app.js        diário, painel, calendário, gaveta e dossiê
```
