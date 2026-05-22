/**
 * whatsappManager.js — Fixed infinite loop + group filter
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const path = require("path");
const fs = require("fs");
const { handleIncomingMessage } = require("./replyEngine");

const logger = pino({ level: "silent" });
const sessions = new Map();
const retryCounts = new Map(); // Track reconnect attempts
const MAX_RETRIES = 3;         // Max 3 reconnect attempts

function authPath(shopId) {
  const dir = path.resolve(__dirname, "sessions", shopId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function createSession(shopId, clientSocket) {
  await destroySession(shopId);

  const { state, saveCreds } = await useMultiFileAuthState(authPath(shopId));
  const { version } = await fetchLatestBaileysVersion();

  const waSocket = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: false,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    browser: ["WhatsApp Bot Platform", "Chrome", "1.0.0"],
  });

  waSocket.ev.on("creds.update", saveCreds);

  waSocket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Reset retry count when QR is shown (user is actively connecting)
      retryCounts.set(shopId, 0);
      clientSocket.emit("qr", { qr });
      clientSocket.emit("status", { status: "connecting" });
    }

    if (connection === "open") {
      // Connected! Reset retry count
      retryCounts.set(shopId, 0);
      console.log(`[${shopId}] WhatsApp connected ✓`);
      clientSocket.emit("status", { status: "connected" });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      clientSocket.emit("status", { status: "disconnected" });

      if (isLoggedOut) {
        // User logged out - clear session, don't reconnect
        console.log(`[${shopId}] Logged out — clearing session`);
        sessions.delete(shopId);
        retryCounts.delete(shopId);
        fs.rmSync(authPath(shopId), { recursive: true, force: true });
        return;
      }

      // Check retry count
      const retries = retryCounts.get(shopId) || 0;

      if (retries >= MAX_RETRIES) {
        // Too many retries - stop reconnecting, wait for user to click "Start Session"
        console.log(`[${shopId}] Max retries reached (${MAX_RETRIES}). Waiting for manual reconnect.`);
        retryCounts.set(shopId, 0);
        sessions.delete(shopId);
        clientSocket.emit("status", { status: "disconnected" });
        clientSocket.emit("error", { message: "Connection lost. Please scan QR code again." });
        return;
      }

      // Reconnect with backoff
      retryCounts.set(shopId, retries + 1);
      const delay = Math.min(5000 * (retries + 1), 30000); // 5s, 10s, 15s max 30s
      console.log(`[${shopId}] Reconnecting in ${delay/1000}s... (attempt ${retries + 1}/${MAX_RETRIES})`);
      setTimeout(() => createSession(shopId, clientSocket), delay);
    }
  });

  // ── Incoming messages ─────────────────────────────────────────────────────
  waSocket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const senderJid = msg.key.remoteJid;

      // 🛑 Ignore group messages
      if (senderJid.endsWith("@g.us")) {
        console.log(`[${shopId}] Ignoring group message`);
        continue;
      }

      // 🛑 Ignore broadcast/newsletter
      if (senderJid.includes("@newsletter") || senderJid.includes("@broadcast")) {
        console.log(`[${shopId}] Ignoring broadcast`);
        continue;
      }

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

      if (!text) continue;

      console.log(`[${shopId}] ← Message from ${senderJid}: ${text}`);
      await handleIncomingMessage(shopId, senderJid, text, waSocket);
    }
  });

  sessions.set(shopId, {
    socket: waSocket,
    cleanup: () => {
      waSocket.ev.removeAllListeners();
      waSocket.end();
    },
  });

  console.log(`[${shopId}] Session initialised`);
}

async function destroySession(shopId) {
  if (!sessions.has(shopId)) return;
  const { cleanup } = sessions.get(shopId);
  try { cleanup(); } catch (_) {}
  sessions.delete(shopId);
  console.log(`[${shopId}] Session destroyed`);
}

function hasSession(shopId) {
  return sessions.has(shopId);
}

module.exports = { createSession, destroySession, hasSession };
