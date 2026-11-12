// Lógica do bot: decide o que fazer com cada mensagem recebida.

import {
  areJidsSameUser,
  downloadMediaMessage,
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  normalizeMessageContent,
} from 'baileys';
import { setStickerMetadata } from './exif.js';
import { findMedia, getQuoted, getText, isViewOnce, mediaSize, parseCommand } from './messages.js';
import { createQueue } from './queue.js';
import { createSticker, isAnimatedWebp, StickerError, stickerToMedia } from './sticker.js';

// IDs das mensagens que o próprio bot enviou (para nunca responder a si mesmo).
const sentByBot = new Set();
const remember = (id) => {
  if (!id) return;
  sentByBot.add(id);
  if (sentByBot.size > 1000) sentByBot.delete(sentByBot.values().next().value);
};

export function helpText({ prefix: p, maxVideoSeconds, autoStickerPrivate }) {
  return [
    '🤖 *Bot de Figurinhas*',
    '',
    '📸 *Criar figurinha*',
    `Mande uma foto, vídeo ou GIF com a legenda *${p}s*`,
    `ou responda a uma mídia com *${p}s*.`,
    ...(autoStickerPrivate ? ['No privado é só mandar a mídia, sem comando nenhum!'] : []),
    '',
    `✂️ *${p}s cortar* — corta no centro e deixa quadrada`,
    `🏷️ *${p}s Pacote | Autor* — escolhe o nome do pacote e o autor`,
    '',
    `🖼️ *${p}toimg* — responda a uma figurinha para virar imagem (ou vídeo, se for animada)`,
    `✏️ *${p}renomear Pacote | Autor* — responda a uma figurinha para trocar o pacote e o autor`,
    '',
    `🎬 Vídeos e GIFs viram figurinha animada (até ${maxVideoSeconds} segundos).`,
  ].join('\n');
}

/**
 * @param sock conexão do Baileys
 * @param options.config configurações (src/config.js)
 * @param options.logger logger do Baileys
 * @param [options.download] função que baixa a mídia (trocada por uma falsa nos testes)
 */
export function createMessageHandler(sock, { config, logger, download: customDownload }) {
  const queue = createQueue(config.maxConcurrent);

  const send = async (jid, content, options) => {
    const sent = await sock.sendMessage(jid, content, options);
    remember(sent?.key?.id);
    return sent;
  };

  const react = (msg, emoji) =>
    send(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

  const download =
    customDownload ??
    ((waMessage) =>
      downloadMediaMessage(waMessage, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }));

  /** Acha a mídia na própria mensagem ou na mensagem respondida. */
  const resolveTarget = (msg) => {
    const own = findMedia(msg.message);
    if (own) return { found: own, waMessage: msg, viewOnce: isViewOnce(msg.message) };

    const quoted = getQuoted(msg.message);
    if (!quoted) return null;
    const found = findMedia(quoted.message);
    if (!found) return null;

    const { stanzaId, participant } = quoted.contextInfo;
    const isGroup = isJidGroup(msg.key.remoteJid);
    const fromMe =
      Boolean(participant) &&
      (areJidsSameUser(participant, sock.user?.id) || areJidsSameUser(participant, sock.user?.lid));
    return {
      found,
      viewOnce: isViewOnce(quoted.message),
      waMessage: {
        key: {
          remoteJid: msg.key.remoteJid,
          id: stanzaId,
          fromMe,
          participant: isGroup ? participant : undefined,
        },
        message: quoted.message,
      },
    };
  };

  return async function handleMessage(msg) {
    if (!msg?.message || !msg.key?.remoteJid) return;
    const jid = msg.key.remoteJid;
    if (isJidStatusBroadcast(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)) return;
    if (sentByBot.has(msg.key.id)) return;
    if (msg.message.protocolMessage || msg.message.reactionMessage) return;

    const content = normalizeMessageContent(msg.message);
    const contentType = getContentType(content);
    const expiration = content?.[contentType]?.contextInfo?.expiration || undefined;
    const isGroup = isJidGroup(jid);
    const fromMe = Boolean(msg.key.fromMe);

    const reply = (text) => send(jid, { text }, { quoted: msg, ephemeralExpiration: expiration });

    const command = parseCommand(getText(content), config.prefix);

    // Sem comando: no privado, foto/vídeo/GIF vira figurinha automaticamente.
    if (!command) {
      if (isGroup || fromMe || !config.autoStickerPrivate) return;
      const found = findMedia(msg.message);
      if (!found || found.kind === 'sticker' || isViewOnce(msg.message)) return;
      return run(() => makeSticker({ found, waMessage: msg }, {}));
    }

    if (command.name === 'help') {
      return reply(helpText(config));
    }

    const target = resolveTarget(msg);
    if (!target) {
      return reply(
        command.name === 'sticker'
          ? `Mande uma foto, vídeo ou GIF com a legenda *${config.prefix}s*, ou responda a uma mídia com *${config.prefix}s* 😉`
          : `Responda a uma figurinha com *${config.prefix}${command.name === 'toImage' ? 'toimg' : 'renomear'}* 😉`,
      );
    }
    if (target.viewOnce) {
      return reply('🔒 Não converto mídias de visualização única, por respeito a quem enviou.');
    }

    const maxBytes = config.maxMediaMB * 1024 * 1024;
    if (mediaSize(target.found.media) > maxBytes) {
      return reply(`Esse arquivo é grande demais 😅 O limite é ${config.maxMediaMB} MB.`);
    }

    if (command.name === 'sticker') {
      return run(() => makeSticker(target, command));
    }

    if (target.found.kind !== 'sticker') {
      return reply('Isso precisa ser feito respondendo a uma *figurinha* 😉');
    }
    if (command.name === 'toImage') return run(() => stickerToImage(target));
    if (command.name === 'rename') return run(() => renameSticker(target, command));

    // ----------------------------------------------------------------------

    async function run(task) {
      await react(msg, '⏳');
      try {
        await queue.add(task);
        await react(msg, '');
      } catch (error) {
        await react(msg, '❌');
        if (error instanceof StickerError) {
          await reply(error.message);
        } else {
          console.error('[erro]', error);
          await reply('Deu ruim aqui 😕 Tenta de novo, ou manda outra mídia.');
        }
      }
    }

    async function makeSticker({ found, waMessage }, { crop = false, packName, packAuthor }) {
      const input = await download(waMessage);
      const sticker = await createSticker(input, {
        kind: found.kind === 'video' ? 'video' : 'image',
        crop,
        packName: packName || config.packName,
        packAuthor: packAuthor || config.packAuthor,
        maxVideoSeconds: config.maxVideoSeconds,
        maxStaticKB: config.maxStaticKB,
        maxAnimatedKB: config.maxAnimatedKB,
      });
      await send(
        jid,
        { sticker: sticker.buffer, isAnimated: sticker.animated },
        { quoted: msg, ephemeralExpiration: expiration },
      );
      log(`figurinha ${sticker.animated ? 'animada' : 'estática'} (${kb(sticker.buffer)}) enviada`);
    }

    async function stickerToImage({ waMessage }) {
      const input = await download(waMessage);
      const media = await stickerToMedia(input);
      const message =
        media.type === 'image'
          ? { image: media.buffer }
          : { video: media.buffer, gifPlayback: true, mimetype: 'video/mp4' };
      await send(jid, message, { quoted: msg, ephemeralExpiration: expiration });
      log(`figurinha convertida em ${media.type === 'image' ? 'imagem' : 'vídeo'}`);
    }

    async function renameSticker({ waMessage }, { packName, packAuthor }) {
      const input = await download(waMessage);
      const sticker = await setStickerMetadata(input, {
        packName: packName || config.packName,
        packAuthor: packAuthor || config.packAuthor,
      });
      await send(
        jid,
        { sticker, isAnimated: await isAnimatedWebp(sticker) },
        { quoted: msg, ephemeralExpiration: expiration },
      );
      log('figurinha renomeada');
    }

    function log(text) {
      const where = isGroup ? 'grupo' : 'privado';
      console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${text} (${where})`);
    }
  };
}

const kb = (buffer) => `${(buffer.length / 1024).toFixed(0)} KB`;
