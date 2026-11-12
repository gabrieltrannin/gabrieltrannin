// Grava o nome do pacote e o autor dentro da figurinha (metadados EXIF do WebP).
// É isso que aparece no WhatsApp quando alguém toca na figurinha.

import { randomUUID } from 'node:crypto';
import webpmux from 'node-webpmux';

const { Image } = webpmux;

// Cabeçalho TIFF com uma única tag (0x5741) que guarda o JSON da figurinha.
const EXIF_HEADER = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
  0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
]);

export function buildExif({ packName, packAuthor, emojis = [] }) {
  const json = Buffer.from(
    JSON.stringify({
      'sticker-pack-id': randomUUID(),
      'sticker-pack-name': packName,
      'sticker-pack-publisher': packAuthor,
      emojis,
    }),
    'utf8',
  );
  const exif = Buffer.concat([EXIF_HEADER, json]);
  exif.writeUInt32LE(json.length, 14);
  return exif;
}

export async function setStickerMetadata(webpBuffer, metadata) {
  const img = new Image();
  await img.load(webpBuffer);
  img.exif = buildExif(metadata);
  return img.save(null);
}

export async function readStickerMetadata(webpBuffer) {
  const img = new Image();
  await img.load(webpBuffer);
  if (!img.exif) return null;
  const start = img.exif.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(img.exif.subarray(start).toString('utf8'));
  } catch {
    return null;
  }
}
