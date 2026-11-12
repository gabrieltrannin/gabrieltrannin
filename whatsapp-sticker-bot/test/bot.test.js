// Simula conversas inteiras com um "WhatsApp falso" para testar o bot de ponta a ponta.

import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { createMessageHandler } from '../src/bot.js';
import { readStickerMetadata } from '../src/exif.js';
import { createSticker } from '../src/sticker.js';
import { makePhoto, makeVideo, webpInfo } from './fixtures.js';

const PRIVATE = '5541999990000@s.whatsapp.net';
const GROUP = '120363000000000000@g.us';

const config = {
  prefix: '!',
  packName: 'Pacote Padrão',
  packAuthor: 'Bot',
  autoStickerPrivate: true,
  maxVideoSeconds: 10,
  maxMediaMB: 30,
  maxStaticKB: 100,
  maxAnimatedKB: 500,
  maxConcurrent: 2,
};

const files = {};
let sent;
let downloads;
let handle;
let counter = 0;

function fakeSocket() {
  return {
    user: { id: '5541888880000:1@s.whatsapp.net' },
    async sendMessage(jid, content, options) {
      const id = `BOT${++counter}`;
      sent.push({ jid, content, options, id });
      return { key: { remoteJid: jid, id, fromMe: true } };
    },
  };
}

function message(jid, content, { fromMe = false, participant } = {}) {
  return { key: { remoteJid: jid, id: `MSG${++counter}`, fromMe, participant }, message: content };
}

const image = (url, caption) => ({ imageMessage: { url, mimetype: 'image/jpeg', caption, fileLength: 1000 } });
const video = (url, caption) => ({ videoMessage: { url, mimetype: 'video/mp4', caption, fileLength: 1000 } });
const sticker = (url) => ({ stickerMessage: { url, mimetype: 'image/webp', fileLength: 1000 } });
const replyTo = (text, quotedMessage) => ({
  extendedTextMessage: { text, contextInfo: { stanzaId: 'QUOTED1', participant: PRIVATE, quotedMessage } },
});
const text = (t) => ({ conversation: t });

// Só o que o bot enviou de verdade (sem as reações de "carregando").
const replies = () => sent.filter((s) => !s.content.react);

before(async () => {
  files['fake://photo'] = await makePhoto(800, 600);
  files['fake://video'] = makeVideo({ width: 480, height: 270, seconds: 2 });
  files['fake://broken'] = Buffer.from('arquivo quebrado');
  files['fake://sticker'] = (
    await createSticker(files['fake://photo'], { kind: 'image', packName: 'Antigo', packAuthor: 'Alguém' })
  ).buffer;
  files['fake://animated-sticker'] = (
    await createSticker(files['fake://video'], { kind: 'video', packName: 'Antigo', packAuthor: 'Alguém' })
  ).buffer;
});

beforeEach(() => {
  sent = [];
  downloads = [];
  handle = createMessageHandler(fakeSocket(), {
    config,
    logger: undefined,
    download: async (waMessage) => {
      const content = Object.values(waMessage.message)[0];
      downloads.push(waMessage);
      return files[content.url];
    },
  });
});

describe('bot', () => {
  it('no privado, foto sem comando vira figurinha estática', async () => {
    const msg = message(PRIVATE, image('fake://photo'));
    await handle(msg);
    const [reply] = replies();
    assert.ok(reply.content.sticker, 'deveria enviar uma figurinha');
    assert.equal(reply.content.isAnimated, false);
    assert.equal(reply.options.quoted, msg);
    assert.equal((await webpInfo(reply.content.sticker)).width, 512);
    // reage com ⏳ e depois tira a reação
    const reactions = sent.filter((s) => s.content.react).map((s) => s.content.react.text);
    assert.deepEqual(reactions, ['⏳', '']);
  });

  it('no privado, vídeo sem comando vira figurinha animada', async () => {
    await handle(message(PRIVATE, video('fake://video')));
    const [reply] = replies();
    assert.equal(reply.content.isAnimated, true);
    assert.ok((await webpInfo(reply.content.sticker)).frames > 1);
  });

  it('no grupo, mídia sem comando é ignorada', async () => {
    await handle(message(GROUP, image('fake://photo'), { participant: PRIVATE }));
    assert.equal(sent.length, 0);
  });

  it('no grupo, foto com legenda !s vira figurinha', async () => {
    await handle(message(GROUP, image('fake://photo', '!s'), { participant: PRIVATE }));
    assert.ok(replies()[0].content.sticker);
  });

  it('responder um vídeo com !s faz figurinha animada com pacote personalizado', async () => {
    await handle(message(GROUP, replyTo('!s Memes | Gabriel', video('fake://video')), { participant: PRIVATE }));
    const [reply] = replies();
    assert.equal(reply.content.isAnimated, true);
    const meta = await readStickerMetadata(reply.content.sticker);
    assert.equal(meta['sticker-pack-name'], 'Memes');
    assert.equal(meta['sticker-pack-publisher'], 'Gabriel');
    // baixou a mensagem citada, com a chave certa
    assert.equal(downloads[0].key.id, 'QUOTED1');
    assert.equal(downloads[0].key.participant, PRIVATE);
  });

  it('!menu mostra os comandos', async () => {
    await handle(message(GROUP, text('!menu'), { participant: PRIVATE }));
    assert.match(replies()[0].content.text, /Bot de Figurinhas/);
  });

  it('!s sem mídia explica como usar', async () => {
    await handle(message(PRIVATE, text('!s')));
    assert.match(replies()[0].content.text, /legenda/);
    assert.equal(downloads.length, 0);
  });

  it('texto comum no privado é ignorado', async () => {
    await handle(message(PRIVATE, text('oi, tudo bem?')));
    assert.equal(sent.length, 0);
  });

  it('não converte visualização única', async () => {
    const viewOnce = { viewOnceMessageV2: { message: image('fake://photo') } };
    await handle(message(PRIVATE, viewOnce));
    assert.equal(sent.length, 0, 'automático: ignora em silêncio');

    await handle(message(PRIVATE, replyTo('!s', viewOnce)));
    assert.match(replies()[0].content.text, /visualização única/);
    assert.equal(downloads.length, 0);
  });

  it('!toimg transforma figurinha estática em imagem', async () => {
    await handle(message(PRIVATE, replyTo('!toimg', sticker('fake://sticker'))));
    assert.ok(replies()[0].content.image);
  });

  it('!toimg transforma figurinha animada em vídeo (GIF)', async () => {
    await handle(message(PRIVATE, replyTo('!toimg', sticker('fake://animated-sticker'))));
    const [reply] = replies();
    assert.ok(reply.content.video);
    assert.equal(reply.content.gifPlayback, true);
  });

  it('!toimg em algo que não é figurinha avisa', async () => {
    await handle(message(PRIVATE, replyTo('!toimg', image('fake://photo'))));
    assert.match(replies()[0].content.text, /figurinha/);
  });

  it('!renomear troca pacote e autor da figurinha', async () => {
    await handle(message(PRIVATE, replyTo('!renomear Novo Pacote | Novo Autor', sticker('fake://animated-sticker'))));
    const [reply] = replies();
    assert.equal(reply.content.isAnimated, true);
    const meta = await readStickerMetadata(reply.content.sticker);
    assert.equal(meta['sticker-pack-name'], 'Novo Pacote');
    assert.equal(meta['sticker-pack-publisher'], 'Novo Autor');
  });

  it('minhas próprias mídias sem comando são ignoradas', async () => {
    await handle(message(PRIVATE, image('fake://photo'), { fromMe: true }));
    assert.equal(sent.length, 0);
  });

  it('mas meus comandos funcionam (ex.: conversa comigo mesmo)', async () => {
    await handle(message(PRIVATE, image('fake://photo', '!s'), { fromMe: true }));
    assert.ok(replies()[0].content.sticker);
  });

  it('nunca responde às mensagens que ele mesmo enviou', async () => {
    await handle(message(PRIVATE, text('!menu')));
    const botMessageId = replies()[0].id;
    sent = [];
    await handle({ key: { remoteJid: PRIVATE, id: botMessageId, fromMe: true }, message: text('!menu') });
    assert.equal(sent.length, 0);
  });

  it('arquivo grande demais é recusado antes de baixar', async () => {
    const big = image('fake://photo', '!s');
    big.imageMessage.fileLength = 50 * 1024 * 1024;
    await handle(message(PRIVATE, big));
    assert.match(replies()[0].content.text, /grande demais/);
    assert.equal(downloads.length, 0);
  });

  it('arquivo quebrado gera mensagem de erro amigável', async () => {
    await handle(message(PRIVATE, image('fake://broken')));
    assert.match(replies()[0].content.text, /Não consegui ler essa imagem/);
    const reactions = sent.filter((s) => s.content.react).map((s) => s.content.react.text);
    assert.deepEqual(reactions, ['⏳', '❌']);
  });
});
