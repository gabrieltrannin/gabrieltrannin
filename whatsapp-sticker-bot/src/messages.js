// Funções para "ler" as mensagens do WhatsApp: texto, comando e mídia.
// Ficam separadas da conexão para poderem ser testadas sozinhas.

import { getContentType, normalizeMessageContent } from 'baileys';

export const COMMANDS = {
  sticker: ['s', 'f', 'fig', 'figurinha', 'sticker', 'stiker'],
  stickerCrop: ['sc', 'fc', 'quadrada'],
  toImage: ['toimg', 'img', 'imagem', 'foto'],
  rename: ['renomear', 'rename', 'take', 'roubar'],
  help: ['menu', 'ajuda', 'help', 'comandos'],
};

const CROP_WORDS = new Set(['c', 'cortar', 'cortada', 'crop', 'quadrada', 'quadrado']);

/** Pega o texto da mensagem (texto puro ou legenda de foto/vídeo/documento). */
export function getText(content) {
  if (!content) return '';
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ''
  );
}

/**
 * Interpreta um comando.
 *   "!s"                -> { name: 'sticker' }
 *   "!s cortar"         -> { name: 'sticker', crop: true }
 *   "!s Memes | Gabriel" -> { name: 'sticker', packName: 'Memes', packAuthor: 'Gabriel' }
 */
export function parseCommand(text, prefix) {
  const trimmed = (text || '').trim();
  if (!trimmed.startsWith(prefix)) return null;

  const body = trimmed.slice(prefix.length).trim();
  const [word = '', ...rest] = body.split(/\s+/);
  const lower = word.toLowerCase();
  const name = Object.keys(COMMANDS).find((key) => COMMANDS[key].includes(lower));
  if (!name) return null;

  let args = rest.join(' ').trim();
  let crop = name === 'stickerCrop';

  const firstArg = args.split(/\s+/)[0]?.toLowerCase();
  if (CROP_WORDS.has(firstArg)) {
    crop = true;
    args = args.slice(firstArg.length).trim();
  }

  let packName;
  let packAuthor;
  if (args) {
    const [pack, ...author] = args.split('|');
    packName = pack.trim() || undefined;
    packAuthor = author.join('|').trim() || undefined;
  }

  return {
    name: name === 'stickerCrop' ? 'sticker' : name,
    crop,
    packName: packName?.slice(0, 100),
    packAuthor: packAuthor?.slice(0, 100),
  };
}

/** Mensagens de "visualização única" não são convertidas, para respeitar a privacidade de quem enviou. */
export function isViewOnce(rawContent) {
  if (!rawContent) return false;
  if (rawContent.viewOnceMessage || rawContent.viewOnceMessageV2 || rawContent.viewOnceMessageV2Extension) {
    return true;
  }
  const content = normalizeMessageContent(rawContent);
  return Boolean(content?.imageMessage?.viewOnce || content?.videoMessage?.viewOnce);
}

/**
 * Descobre se a mensagem tem mídia que dá para usar.
 * @returns {null | { kind: 'image'|'video'|'sticker', type: string, media: object, content: object }}
 *   kind: 'image' (foto), 'video' (vídeo ou GIF) ou 'sticker' (figurinha)
 */
export function findMedia(rawContent) {
  const content = normalizeMessageContent(rawContent);
  if (!content) return null;
  const type = getContentType(content);
  const media = content[type];
  if (!media || typeof media !== 'object') return null;

  switch (type) {
    case 'imageMessage':
      return { kind: 'image', type, media, content };
    case 'videoMessage':
      return { kind: 'video', type, media, content };
    case 'stickerMessage':
      return { kind: 'sticker', type, media, content };
    case 'documentMessage': {
      // Fotos/vídeos enviados "como documento" (sem compressão).
      const mime = (media.mimetype || '').toLowerCase();
      if (mime === 'image/gif') return { kind: 'video', type, media, content };
      if (mime === 'image/webp') return { kind: 'sticker', type, media, content };
      if (mime.startsWith('image/')) return { kind: 'image', type, media, content };
      if (mime.startsWith('video/')) return { kind: 'video', type, media, content };
      return null;
    }
    default:
      return null;
  }
}

/** Pega a mensagem que foi respondida (citada), se houver. */
export function getQuoted(rawContent) {
  const content = normalizeMessageContent(rawContent);
  if (!content) return null;
  const type = getContentType(content);
  const contextInfo = content[type]?.contextInfo;
  if (!contextInfo?.quotedMessage) return null;
  return { message: contextInfo.quotedMessage, contextInfo };
}

/** Tamanho do arquivo em bytes (o WhatsApp às vezes manda como Long). */
export function mediaSize(media) {
  const value = media?.fileLength;
  if (value == null) return 0;
  return typeof value === 'object' && 'toNumber' in value ? value.toNumber() : Number(value);
}
