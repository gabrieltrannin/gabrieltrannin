// Ponto de entrada: conecta no WhatsApp e repassa as mensagens para o bot.
// Rode com:  npm start

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { createMessageHandler } from './bot.js';
import { config } from './config.js';

const logger = pino({ level: config.logLevel });

let retryDelay = 2_000;
let currentSocket;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  // Usa a versão mais recente do WhatsApp Web; se não der para consultar, usa a padrão da biblioteca.
  const { version } = await fetchLatestBaileysVersion().catch(() => ({}));

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  currentSocket = sock;

  sock.ev.on('creds.update', saveCreds);

  let pairingCodeRequested = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (config.phoneNumber) {
        if (!pairingCodeRequested && !sock.authState.creds.registered) {
          pairingCodeRequested = true;
          try {
            const code = await sock.requestPairingCode(config.phoneNumber);
            console.log('\n🔑 Código de pareamento:', code.match(/.{1,4}/g).join('-'));
            console.log('   No celular: WhatsApp > Aparelhos conectados > Conectar um aparelho >');
            console.log('   "Conectar com número de telefone" e digite o código acima.\n');
          } catch (error) {
            console.error('Não consegui pedir o código de pareamento:', error.message);
          }
        }
      } else {
        console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp do número que vai ser o bot:');
        console.log('   WhatsApp > Aparelhos conectados > Conectar um aparelho\n');
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'open') {
      retryDelay = 2_000;
      const number = sock.user?.id?.split(':')[0]?.split('@')[0];
      console.log(`\n✅ Bot conectado${number ? ` como ${number}` : ''}! Mande "${config.prefix}menu" para ver os comandos.\n`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(
          `\n🚪 A sessão foi desconectada pelo celular. Apague a pasta "${config.authDir}" e rode "npm start" de novo para conectar outra vez.`,
        );
        process.exit(1);
      }
      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log('\n⚠️ O bot foi aberto em outro lugar com a mesma sessão. Encerrando este aqui.');
        process.exit(1);
      }
      if (statusCode === DisconnectReason.forbidden) {
        console.log('\n⛔ O WhatsApp recusou a conexão deste número (403).');
        process.exit(1);
      }

      // Reinício pedido pelo WhatsApp (normal logo depois de escanear o QR): reconecta na hora.
      const delay = statusCode === DisconnectReason.restartRequired ? 0 : retryDelay;
      if (delay) console.log(`🔄 Conexão caiu (${statusCode ?? 'sem código'}). Tentando de novo em ${delay / 1000}s...`);
      retryDelay = Math.min(retryDelay * 2, 60_000);
      setTimeout(() => start().catch(fatal), delay);
    }
  });

  const handleMessage = createMessageHandler(sock, { config, logger });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return; // ignora histórico antigo
    for (const msg of messages) {
      handleMessage(msg).catch((error) => console.error('[erro ao processar mensagem]', error));
    }
  });
}

function fatal(error) {
  console.error('Erro fatal:', error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n👋 Desligando o bot...');
    currentSocket?.end(undefined);
    process.exit(0);
  });
}

console.log('🚀 Iniciando o bot de figurinhas...');
start().catch(fatal);
