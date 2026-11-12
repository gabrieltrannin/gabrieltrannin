// Conversão de mídia em figurinha (e de volta).
//  - Imagem (jpg, png, webp...) -> figurinha estática 512x512
//  - Vídeo / GIF               -> figurinha animada 512x512
//  - Figurinha                 -> imagem (png) ou vídeo em loop (mp4)

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { setStickerMetadata } from './exif.js';

const SIZE = 512;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Qualidades testadas para figurinha estática, da melhor para a menor.
const STATIC_QUALITIES = [90, 80, 70, 60, 50, 40, 30];

// Tentativas para figurinha animada: se ficar grande demais, reduz
// qualidade, fps e duração até caber no limite.
const ANIMATED_ATTEMPTS = [
  { fps: 15, quality: 60, maxSeconds: Infinity },
  { fps: 15, quality: 45, maxSeconds: Infinity },
  { fps: 12, quality: 35, maxSeconds: Infinity },
  { fps: 10, quality: 30, maxSeconds: 8 },
  { fps: 10, quality: 20, maxSeconds: 6 },
  { fps: 8, quality: 15, maxSeconds: 5 },
  { fps: 6, quality: 10, maxSeconds: 4 },
];

export class StickerError extends Error {}

/**
 * Transforma qualquer mídia (imagem, GIF ou vídeo) em figurinha.
 * @param {Buffer} input
 * @param {object} options
 * @param {'image'|'video'} options.kind tipo de mídia recebida
 * @param {boolean} [options.crop] true = corta no centro para ficar quadrada;
 *                                 false = mantém a imagem inteira com fundo transparente
 * @param {string} options.packName
 * @param {string} options.packAuthor
 * @param {number} [options.maxVideoSeconds]
 * @param {number} [options.maxStaticKB]
 * @param {number} [options.maxAnimatedKB]
 * @returns {Promise<{ buffer: Buffer, animated: boolean }>}
 */
export async function createSticker(input, options) {
  const { kind, packName, packAuthor } = options;

  let result;
  if (kind === 'video') {
    result = { buffer: await videoToAnimatedWebp(input, options), animated: true };
  } else {
    const meta = await sharp(input, { animated: true })
      .metadata()
      .catch(() => {
        throw new StickerError('Não consegui ler essa imagem. Tenta mandar em outro formato (JPG ou PNG).');
      });
    const isAnimated = (meta.pages ?? 1) > 1;

    if (isAnimated && meta.format === 'gif') {
      // GIF animado enviado como arquivo: o ffmpeg cuida melhor (controla fps e duração).
      result = { buffer: await videoToAnimatedWebp(input, options), animated: true };
    } else if (isAnimated) {
      result = { buffer: await animatedImageToWebp(input, options), animated: true };
    } else {
      result = { buffer: await imageToStaticWebp(input, options), animated: false };
    }
  }

  result.buffer = await setStickerMetadata(result.buffer, { packName, packAuthor });
  return result;
}

/** Imagem -> WebP 512x512 estático. */
export async function imageToStaticWebp(input, { crop = false, maxStaticKB = 100 } = {}) {
  const maxBytes = maxStaticKB * 1024;
  // Redimensiona uma vez só (corrigindo a rotação de fotos do celular) e
  // depois testa as qualidades em cima da imagem já pronta.
  const resized = await sharp(input)
    .rotate()
    .resize(SIZE, SIZE, { fit: crop ? 'cover' : 'contain', background: TRANSPARENT })
    .ensureAlpha()
    .png()
    .toBuffer();

  let best;
  for (const quality of STATIC_QUALITIES) {
    best = await sharp(resized).webp({ quality, effort: 4 }).toBuffer();
    if (best.length <= maxBytes) break;
  }
  return best;
}

/** WebP/PNG animado -> WebP animado 512x512 (feito pelo sharp). */
async function animatedImageToWebp(input, { crop = false, maxAnimatedKB = 500 } = {}) {
  const maxBytes = maxAnimatedKB * 1024;
  let best;
  for (const quality of [60, 45, 30, 20, 10]) {
    best = await sharp(input, { animated: true })
      .resize(SIZE, SIZE, { fit: crop ? 'cover' : 'contain', background: TRANSPARENT })
      .webp({ quality, effort: 4, loop: 0 })
      .toBuffer();
    if (best.length <= maxBytes) break;
  }
  return best;
}

/** Vídeo ou GIF -> WebP animado 512x512 (feito pelo ffmpeg). */
export async function videoToAnimatedWebp(
  input,
  { crop = false, maxVideoSeconds = 10, maxAnimatedKB = 500 } = {},
) {
  const maxBytes = maxAnimatedKB * 1024;

  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, 'input');
    const outputPath = path.join(dir, 'output.webp');
    await writeFile(inputPath, input);

    const resize = crop
      ? `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SIZE}:${SIZE},format=rgba`
      : `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,` +
        `pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=#00000000`;

    let best;
    for (const attempt of ANIMATED_ATTEMPTS) {
      const seconds = Math.min(maxVideoSeconds, attempt.maxSeconds);
      try {
        await runFfmpeg([
          '-i', inputPath,
          '-t', String(seconds),
          '-an',
          '-vf', `fps=${attempt.fps},${resize}`,
          '-c:v', 'libwebp_anim',
          '-lossless', '0',
          '-quality', String(attempt.quality),
          '-compression_level', '4',
          '-loop', '0',
          outputPath,
        ]);
      } catch (error) {
        throw new StickerError('Não consegui converter esse vídeo. Ele pode estar corrompido ou num formato estranho.', {
          cause: error,
        });
      }
      best = await readFile(outputPath);
      if (best.length <= maxBytes) break;
    }
    if (!best?.length) throw new StickerError('O vídeo parece estar vazio.');
    return best;
  });
}

/**
 * Figurinha -> mídia normal.
 * Estática vira PNG; animada vira MP4 (que o WhatsApp mostra como GIF).
 * @returns {Promise<{ buffer: Buffer, type: 'image'|'video' }>}
 */
export async function stickerToMedia(webpBuffer) {
  const meta = await sharp(webpBuffer, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;

  if (!animated) {
    const png = await sharp(webpBuffer).png().toBuffer();
    return { buffer: png, type: 'image' };
  }

  // O ffmpeg não lê WebP animado, então passamos por GIF antes.
  // Fundo branco no lugar da transparência (vídeo não tem transparência).
  const gif = await sharp(webpBuffer, { animated: true })
    .flatten({ background: '#ffffff' })
    .gif()
    .toBuffer();

  return withTempDir(async (dir) => {
    const gifPath = path.join(dir, 'input.gif');
    const mp4Path = path.join(dir, 'output.mp4');
    await writeFile(gifPath, gif);
    await runFfmpeg([
      '-i', gifPath,
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264',
      '-crf', '23',
      '-an',
      mp4Path,
    ]);
    return { buffer: await readFile(mp4Path), type: 'video' };
  });
}

export async function isAnimatedWebp(buffer) {
  const meta = await sharp(buffer, { animated: true }).metadata();
  return (meta.pages ?? 1) > 1;
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sticker-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args, timeoutMs = 120_000) {
  if (!ffmpegPath) {
    return Promise.reject(new Error('ffmpeg não encontrado. Rode "npm install" de novo.'));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg falhou (${signal ?? code}): ${stderr.trim()}`));
    });
  });
}
