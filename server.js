const tmi     = require('tmi.js');
const WebSocket = require('ws');
const express   = require('express');
const cors      = require('cors');
const https     = require('https');

// ── CONFIG ──
const TWITCH_USERNAME = process.env.TWITCH_USERNAME || 'Foundamilliononthestreet';
const TWITCH_CHANNEL  = process.env.TWITCH_CHANNEL  || 'Foundamilliononthestreet';
const PORT            = process.env.PORT            || 3000;

// OAuth — loaded fresh each time so rotating the env var takes effect on restart
function getOAuth() {
  return process.env.TWITCH_OAUTH || 'oauth:ja61z1ii58201xhgkengs8xmumac68';
}

// Supabase keep-alive (pings DB every 6 hours to prevent free-tier pausing)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://njhbqkgqrzjekewprrqa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qaGJxa2dxcnpqZWtld3BycnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjcxNjgsImV4cCI6MjA5NTU0MzE2OH0.pQmmemKcVCb1NJya9gvq_z4-ualdDJJS05Oo2MqfNqY';

function keepSupabaseAlive() {
  const url = `${SUPABASE_URL}/rest/v1/leaderboard?select=username&limit=1`;
  const options = {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  };
  https.get(url, options, (res) => {
    console.log(`[keep-alive] Supabase ping: HTTP ${res.statusCode}`);
  }).on('error', (e) => {
    console.warn('[keep-alive] Supabase ping failed:', e.message);
  });
}

// Ping immediately on startup, then every 6 hours
keepSupabaseAlive();
setInterval(keepSupabaseAlive, 6 * 60 * 60 * 1000);

// ── EXPRESS ──
const app = express();
app.use(cors());
app.get('/', (req, res) => res.json({ status: 'Meme-A-Palooza bot is running 🎰' }));
const server = app.listen(PORT, () => console.log(`HTTP server on port ${PORT}`));

// ── WEBSOCKET SERVER ──
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

// ── TWITCH CLIENT with auto-reconnect on token error ──
let twitchClient = null;

function connectTwitch() {
  twitchClient = new tmi.Client({
    options: { debug: true },
    identity: {
      username: TWITCH_USERNAME,
      password: getOAuth(),
    },
    channels: [TWITCH_CHANNEL],
    connection: {
      reconnect: true,      // tmi.js handles reconnection automatically
      maxReconnectAttempts: Infinity,
      reconnectInterval: 5000,
    }
  });

  twitchClient.connect().catch(console.error);

  twitchClient.on('connected', (addr, port) => {
    console.log(`✅ Connected to Twitch chat at ${addr}:${port}`);
    broadcast({ type: 'bot_status', status: 'connected' });
  });

  twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return;
    const username = tags['display-name'] || tags.username;
    const msg      = message.trim().toLowerCase();
    const parts    = msg.split(/\s+/);
    const command  = parts[0];

    console.log(`[${username}]: ${message}`);

    if (command === '!spin') {
      broadcast({ type: 'command', command: 'spin', username, bet: 10, raw: message });
    }
    else if (command === '!bet') {
      const amount = parseInt(parts[1]);
      if (isNaN(amount) || amount < 1) return;
      broadcast({ type: 'command', command: 'spin', username, bet: Math.min(amount, 500), target: parts[2] || null, raw: message });
    }
    else if (command === '!stonks') {
      broadcast({ type: 'command', command: 'stonks', username, raw: message });
    }
    else if (command === '!honk') {
      broadcast({ type: 'command', command: 'honk', username, raw: message });
    }
    else if (command === '!balance') {
      broadcast({ type: 'command', command: 'balance', username, raw: message });
    }

    broadcast({ type: 'chat', username, message, color: tags['color'] || '#ffffff' });
  });

  twitchClient.on('disconnected', (reason) => {
    console.log(`Disconnected: ${reason}`);
    broadcast({ type: 'bot_status', status: 'disconnected', reason });
  });
}

connectTwitch();
