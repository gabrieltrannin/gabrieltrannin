// Gera fotos, vídeos e GIFs de teste na hora (assim não precisamos guardar arquivos no repositório).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

/** Foto colorida com um pouco de ruído (parecida com uma foto real). */
export async function makePhoto(width = 1200, height = 800) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const noise = Math.floor(Math.random() * 30);
      raw[i] = (x / width) * 220 + noise;
      raw[i + 1] = (y / height) * 220 + noise;
      raw[i + 2] = 120 + noise;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

function ffmpegToBuffer(args, ext) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sticker-test-'));
  const out = path.join(dir, `out.${ext}`);
  try {
    const result = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args, out]);
    if (result.status !== 0) throw new Error(result.stderr.toString());
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Vídeo MP4 em pé (como os de celular), com áudio. */
export function makeVideo({ width = 720, height = 1280, seconds = 3, fps = 30 } = {}) {
  return ffmpegToBuffer(
    [
      '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    ],
    'mp4',
  );
}

/** GIF animado de verdade (como quando alguém manda um .gif como documento). */
export function makeGif({ seconds = 2 } = {}) {
  return ffmpegToBuffer(['-f', 'lavfi', '-i', `testsrc=size=320x240:rate=10:duration=${seconds}`], 'gif');
}

export async function webpInfo(buffer) {
  const meta = await sharp(buffer, { animated: true }).metadata();
  return {
    format: meta.format,
    width: meta.width,
    height: meta.pageHeight ?? meta.height,
    frames: meta.pages ?? 1,
  };
}
