import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import sharp from 'sharp';
import { readStickerMetadata } from '../src/exif.js';
import { createSticker, StickerError, stickerToMedia } from '../src/sticker.js';
import { makeGif, makePhoto, makeVideo, webpInfo } from './fixtures.js';

const base = {
  packName: 'Meu Pacote',
  packAuthor: 'Gabriel',
  maxVideoSeconds: 10,
  maxStaticKB: 100,
  maxAnimatedKB: 500,
};

/** Transparência (alfa) do pixel no canto superior esquerdo. */
async function cornerAlpha(webp) {
  const { data } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[3];
}

describe('figurinha estática', () => {
  let photo;
  before(async () => {
    photo = await makePhoto(1200, 600); // foto "deitada"
  });

  it('vira WebP 512x512 dentro do limite de 100 KB', async () => {
    const sticker = await createSticker(photo, { ...base, kind: 'image' });
    assert.equal(sticker.animated, false);
    assert.deepEqual(await webpInfo(sticker.buffer), { format: 'webp', width: 512, height: 512, frames: 1 });
    assert.ok(sticker.buffer.length <= 100 * 1024, `${sticker.buffer.length} bytes`);
  });

  it('grava nome do pacote e autor', async () => {
    const sticker = await createSticker(photo, { ...base, kind: 'image' });
    const meta = await readStickerMetadata(sticker.buffer);
    assert.equal(meta['sticker-pack-name'], 'Meu Pacote');
    assert.equal(meta['sticker-pack-publisher'], 'Gabriel');
  });

  it('mantém a imagem inteira com borda transparente (padrão)', async () => {
    const sticker = await createSticker(photo, { ...base, kind: 'image' });
    assert.equal(await cornerAlpha(sticker.buffer), 0);
  });

  it('com "cortar" preenche o quadrado todo', async () => {
    const sticker = await createSticker(photo, { ...base, kind: 'image', crop: true });
    assert.equal(await cornerAlpha(sticker.buffer), 255);
  });

  it('aceita PNG com transparência', async () => {
    const png = await sharp({
      create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    const sticker = await createSticker(png, { ...base, kind: 'image' });
    assert.equal((await webpInfo(sticker.buffer)).width, 512);
  });

  it('dá erro amigável para arquivo que não é imagem', async () => {
    await assert.rejects(
      createSticker(Buffer.from('isso não é uma imagem'), { ...base, kind: 'image' }),
      StickerError,
    );
  });
});

describe('figurinha animada', () => {
  it('vídeo vira WebP animado 512x512 dentro do limite de 500 KB', async () => {
    const sticker = await createSticker(makeVideo({ seconds: 3 }), { ...base, kind: 'video' });
    assert.equal(sticker.animated, true);
    const info = await webpInfo(sticker.buffer);
    assert.equal(info.format, 'webp');
    assert.equal(info.width, 512);
    assert.equal(info.height, 512);
    assert.ok(info.frames > 10, `${info.frames} quadros`);
    assert.ok(sticker.buffer.length <= 500 * 1024, `${sticker.buffer.length} bytes`);
    const meta = await readStickerMetadata(sticker.buffer);
    assert.equal(meta['sticker-pack-name'], 'Meu Pacote');
  });

  it('corta vídeos longos no tempo máximo', async () => {
    const sticker = await createSticker(makeVideo({ width: 320, height: 240, seconds: 6 }), {
      ...base,
      kind: 'video',
      maxVideoSeconds: 2,
    });
    const { frames } = await webpInfo(sticker.buffer);
    assert.ok(frames <= 15 * 2, `${frames} quadros para 2 segundos`);
  });

  it('reduz a qualidade quando passa do limite de tamanho', async () => {
    const video = makeVideo({ seconds: 3 });
    const normal = await createSticker(video, { ...base, kind: 'video' });
    const small = await createSticker(video, { ...base, kind: 'video', maxAnimatedKB: 60 });
    assert.ok(small.buffer.length < normal.buffer.length);
  });

  it('GIF enviado como arquivo também vira figurinha animada', async () => {
    const sticker = await createSticker(makeGif(), { ...base, kind: 'image' });
    assert.equal(sticker.animated, true);
    const info = await webpInfo(sticker.buffer);
    assert.ok(info.frames > 1);
    assert.equal(info.width, 512);
  });

  it('dá erro amigável para vídeo corrompido', async () => {
    await assert.rejects(
      createSticker(Buffer.from('não é vídeo'), { ...base, kind: 'video' }),
      StickerError,
    );
  });
});

describe('figurinha -> imagem/vídeo', () => {
  it('figurinha estática vira PNG', async () => {
    const sticker = await createSticker(await makePhoto(400, 400), { ...base, kind: 'image' });
    const media = await stickerToMedia(sticker.buffer);
    assert.equal(media.type, 'image');
    assert.equal((await sharp(media.buffer).metadata()).format, 'png');
  });

  it('figurinha animada vira MP4', async () => {
    const sticker = await createSticker(makeVideo({ width: 320, height: 320, seconds: 2 }), {
      ...base,
      kind: 'video',
    });
    const media = await stickerToMedia(sticker.buffer);
    assert.equal(media.type, 'video');
    assert.equal(media.buffer.subarray(4, 8).toString(), 'ftyp'); // assinatura de arquivo MP4
  });
});
