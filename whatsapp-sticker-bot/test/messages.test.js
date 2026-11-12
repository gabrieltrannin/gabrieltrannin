import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findMedia, getQuoted, getText, isViewOnce, mediaSize, parseCommand } from '../src/messages.js';

describe('parseCommand', () => {
  it('reconhece os apelidos do comando de figurinha', () => {
    for (const text of ['!s', '!S', '!fig', '!sticker', '!figurinha', '  !s  ']) {
      assert.equal(parseCommand(text, '!')?.name, 'sticker', text);
    }
  });

  it('ignora texto sem prefixo ou comando desconhecido', () => {
    assert.equal(parseCommand('s', '!'), null);
    assert.equal(parseCommand('oi tudo bem?', '!'), null);
    assert.equal(parseCommand('!xyz', '!'), null);
    assert.equal(parseCommand('', '!'), null);
    assert.equal(parseCommand(undefined, '!'), null);
  });

  it('entende "cortar"', () => {
    assert.equal(parseCommand('!s', '!').crop, false);
    assert.equal(parseCommand('!s cortar', '!').crop, true);
    assert.equal(parseCommand('!sc', '!').crop, true);
    assert.equal(parseCommand('!sc', '!').name, 'sticker');
  });

  it('lê pacote e autor', () => {
    assert.deepEqual(parseCommand('!s Memes | Gabriel', '!'), {
      name: 'sticker',
      crop: false,
      packName: 'Memes',
      packAuthor: 'Gabriel',
    });
    assert.deepEqual(parseCommand('!s cortar Memes da Firma', '!'), {
      name: 'sticker',
      crop: true,
      packName: 'Memes da Firma',
      packAuthor: undefined,
    });
    assert.equal(parseCommand('!renomear | Só autor', '!').packAuthor, 'Só autor');
    assert.equal(parseCommand('!renomear | Só autor', '!').packName, undefined);
  });

  it('funciona com outro prefixo', () => {
    assert.equal(parseCommand('/s', '/')?.name, 'sticker');
    assert.equal(parseCommand('!s', '/'), null);
  });

  it('reconhece os outros comandos', () => {
    assert.equal(parseCommand('!toimg', '!').name, 'toImage');
    assert.equal(parseCommand('!renomear A | B', '!').name, 'rename');
    assert.equal(parseCommand('!menu', '!').name, 'help');
    assert.equal(parseCommand('!ajuda', '!').name, 'help');
  });
});

describe('getText', () => {
  it('pega texto e legendas', () => {
    assert.equal(getText({ conversation: 'oi' }), 'oi');
    assert.equal(getText({ extendedTextMessage: { text: '!s' } }), '!s');
    assert.equal(getText({ imageMessage: { caption: '!s' } }), '!s');
    assert.equal(getText({ videoMessage: { caption: '!sc' } }), '!sc');
    assert.equal(getText({ documentMessage: { caption: '!s' } }), '!s');
    assert.equal(getText(undefined), '');
  });
});

describe('findMedia', () => {
  it('identifica foto, vídeo e figurinha', () => {
    assert.equal(findMedia({ imageMessage: { url: 'x' } }).kind, 'image');
    assert.equal(findMedia({ videoMessage: { url: 'x', gifPlayback: true } }).kind, 'video');
    assert.equal(findMedia({ stickerMessage: { url: 'x' } }).kind, 'sticker');
  });

  it('identifica mídia enviada como documento', () => {
    assert.equal(findMedia({ documentMessage: { mimetype: 'image/png' } }).kind, 'image');
    assert.equal(findMedia({ documentMessage: { mimetype: 'image/gif' } }).kind, 'video');
    assert.equal(findMedia({ documentMessage: { mimetype: 'video/mp4' } }).kind, 'video');
    assert.equal(findMedia({ documentMessage: { mimetype: 'image/webp' } }).kind, 'sticker');
    assert.equal(findMedia({ documentMessage: { mimetype: 'application/pdf' } }), null);
  });

  it('abre mensagens temporárias e documentos com legenda', () => {
    assert.equal(findMedia({ ephemeralMessage: { message: { imageMessage: { url: 'x' } } } }).kind, 'image');
    assert.equal(
      findMedia({
        documentWithCaptionMessage: { message: { documentMessage: { mimetype: 'video/mp4', caption: '!s' } } },
      }).kind,
      'video',
    );
  });

  it('ignora mensagens sem mídia', () => {
    assert.equal(findMedia({ conversation: 'oi' }), null);
    assert.equal(findMedia({ extendedTextMessage: { text: 'oi' } }), null);
    assert.equal(findMedia(undefined), null);
  });
});

describe('isViewOnce', () => {
  it('detecta visualização única', () => {
    assert.equal(isViewOnce({ viewOnceMessageV2: { message: { imageMessage: {} } } }), true);
    assert.equal(isViewOnce({ viewOnceMessage: { message: { videoMessage: {} } } }), true);
    assert.equal(isViewOnce({ imageMessage: { viewOnce: true } }), true);
    assert.equal(isViewOnce({ imageMessage: {} }), false);
  });
});

describe('getQuoted', () => {
  it('pega a mensagem respondida', () => {
    const quoted = getQuoted({
      extendedTextMessage: {
        text: '!s',
        contextInfo: { stanzaId: 'ABC', quotedMessage: { imageMessage: { url: 'x' } } },
      },
    });
    assert.equal(quoted.contextInfo.stanzaId, 'ABC');
    assert.equal(findMedia(quoted.message).kind, 'image');
  });

  it('retorna null quando não é resposta', () => {
    assert.equal(getQuoted({ conversation: '!s' }), null);
  });
});

describe('mediaSize', () => {
  it('lê número e Long', () => {
    assert.equal(mediaSize({ fileLength: 1234 }), 1234);
    assert.equal(mediaSize({ fileLength: { toNumber: () => 99 } }), 99);
    assert.equal(mediaSize({}), 0);
  });
});
