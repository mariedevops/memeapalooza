const tmi    = require('tmi.js');
const WebSocket = require('ws');
const express   = require('express');
const cors      = require('cors');

// ── CONFIG (Railway will inject these as env vars) ──
const TWITCH_USERNAME = process.env.TWITCH_USERNAME || 'Foundamilliononthestreet';
const TWITCH_OAUTH    = process.env.TWITCH_OAUTH    || 'oauth:ja61z1ii58201xhgkengs8xmumac68';
const TWITCH_CHANNEL  = process.env.TWITCH_CHANNEL  || 'Foundamilliononthestreet';
const PORT            = process.env.PORT            || 3000;

// ── EXPRESS (health check so Railway knows server is alive) ──
const app = express();
app.use(cors());
app.get('/', (req, res) => res.json({ status: 'Meme-A-Palooza bot is running 🎰' }));
const server = app.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

// ── WEBSOCKET SERVER (browser connects here to get chat events) ──
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Browser connected. Total clients: ${clients.size}`);
  ws.send(JSON.stringify({ type: 'connected', message: 'Bot is live!' }));
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Browser disconnected. Total clients: ${clients.size}`);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── TWITCH CHAT CLIENT ──
const twitchClient = new tmi.Client({
  options: { debug: true },
  identity: {
    username: TWITCH_USERNAME,
    password: TWITCH_OAUTH,
  },
  channels: [TWITCH_CHANNEL],
});

twitchClient.connect().catch(console.error);

twitchClient.on('connected', (addr, port) => {
  console.log(`✅ Connected to Twitch chat at ${addr}:${port}`);
  broadcast({ type: 'bot_status', status: 'connected' });
});

// ── COMMAND PARSER ──
// Supported commands:
//   !spin              → spin with default bet (10)
//   !bet 50            → spin with bet of 50
//   !bet 50 doge       → spin with bet of 50, hoping for doge (cosmetic only)
//   !stonks            → trigger stonks animation (if meter is full)
//   !balance           → check your coin balance

twitchClient.on('message', (channel, tags, message, self) => {
  if (self) return; // ignore messages from the bot itself

  const username = tags['display-name'] || tags.username;
  const msg      = message.trim().toLowerCase();
  const parts    = msg.split(/\s+/);
  const command  = parts[0];

  console.log(`[${username}]: ${message}`);

  if (command === '!spin') {
    broadcast({
      type:     'command',
      command:  'spin',
      username,
      bet:      10,
      raw:      message,
    });
  }

  else if (command === '!bet') {
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount < 1) {
      broadcast({ type: 'chat_error', username, message: `@${username} use !bet <amount> e.g. !bet 50` });
      return;
    }
    const target = parts[2] || null; // optional symbol hint e.g. "doge"
    broadcast({
      type:     'command',
      command:  'spin',
      username,
      bet:      Math.min(amount, 500), // cap at 500 per spin
      target,
      raw:      message,
    });
  }

  else if (command === '!stonks') {
    broadcast({
      type:    'command',
      command: 'stonks',
      username,
      raw:     message,
    });
  }

  else if (command === '!honk') {
    broadcast({
      type:    'command',
      command: 'honk',
      username,
      raw:     message,
    });
  }

  else if (command === '!balance') {
    broadcast({
      type:    'command',
      command: 'balance',
      username,
      raw:     message,
    });
  }

  // Pass ALL chat messages through so the game can show a live chat feed
  broadcast({
    type:     'chat',
    username,
    message,
    color:    tags['color'] || '#ffffff',
  });
});

twitchClient.on('disconnected', (reason) => {
  console.log(`Disconnected: ${reason}`);
  broadcast({ type: 'bot_status', status: 'disconnected', reason });
});
