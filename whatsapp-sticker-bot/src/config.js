// Configurações do bot. Tudo pode ser alterado no arquivo .env
// (copie o .env.example para .env e edite).

try {
  process.loadEnvFile?.();
} catch {
  // Sem arquivo .env: seguimos com os valores padrão.
}

const env = process.env;

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).toLowerCase());
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  // Prefixo dos comandos (ex.: "!s", "/s", ".s").
  prefix: env.PREFIX || '!',

  // Nome do pacote e autor que aparecem ao tocar na figurinha.
  packName: env.PACK_NAME || 'Figurinhas',
  packAuthor: env.PACK_AUTHOR || 'Sticker Bot',

  // No privado, qualquer foto/vídeo/GIF enviado vira figurinha sem precisar de comando.
  autoStickerPrivate: bool(env.AUTO_STICKER_PRIVATE, true),

  // Duração máxima (em segundos) das figurinhas animadas.
  maxVideoSeconds: num(env.MAX_VIDEO_SECONDS, 10),

  // Tamanho máximo do arquivo recebido (em MB).
  maxMediaMB: num(env.MAX_MEDIA_MB, 30),

  // Tamanho alvo das figurinhas (limites recomendados pelo WhatsApp).
  maxStaticKB: num(env.MAX_STATIC_KB, 100),
  maxAnimatedKB: num(env.MAX_ANIMATED_KB, 500),

  // Quantas conversões rodam ao mesmo tempo (vídeo pesa na CPU).
  maxConcurrent: num(env.MAX_CONCURRENT, 2),

  // Se preenchido (só números, com DDI e DDD, ex.: 5541999998888), conecta por
  // código de pareamento em vez de QR Code.
  phoneNumber: (env.PHONE_NUMBER || '').replace(/\D/g, ''),

  // Pasta onde a sessão do WhatsApp fica salva.
  authDir: env.AUTH_DIR || 'auth',

  // Nível de log da biblioteca do WhatsApp (silent, error, warn, info, debug).
  logLevel: env.LOG_LEVEL || 'silent',
};
