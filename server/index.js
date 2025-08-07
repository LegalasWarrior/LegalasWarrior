import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// In-memory storage for demo
const sessions = new Map(); // token -> { playerId, name }
const presence = new Map(); // playerId -> { name, lastSeen }
const chatHistory = []; // { id, ts, from, text }

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post('/api/auth/login', (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.length < 2) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  const token = uuidv4();
  const playerId = uuidv4();
  sessions.set(token, { playerId, name });
  presence.set(playerId, { name, lastSeen: Date.now() });
  res.json({ token, playerId, name });
});

app.get('/api/presence', (_req, res) => {
  const list = Array.from(presence.entries()).map(([playerId, p]) => ({ playerId, ...p }));
  res.json({ list });
});

// Serve static client and content
const clientDir = path.resolve(__dirname, '../client');
const contentDir = path.resolve(__dirname, '../content');
app.use('/', express.static(clientDir));
app.use('/content', express.static(contentDir));

const port = process.env.PORT || 3000;
const server = createServer(app);

// WebSocket setup
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    try { client.send(data); } catch {}
  });
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url?.split('?')[1]);
  const token = params.get('token');
  const session = token ? sessions.get(token) : null;
  const playerName = session?.name || 'Гость';
  const playerId = session?.playerId || `guest-${uuidv4()}`;

  ws.send(JSON.stringify({ type: 'hello', now: Date.now(), playerId, playerName, chatHistory }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'chat' && typeof data.text === 'string') {
        const entry = { id: uuidv4(), ts: Date.now(), from: { playerId, name: playerName }, text: data.text.slice(0, 500) };
        chatHistory.push(entry);
        if (chatHistory.length > 200) chatHistory.shift();
        broadcast({ type: 'chat', entry });
        presence.set(playerId, { name: playerName, lastSeen: Date.now() });
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    presence.set(playerId, { name: playerName, lastSeen: Date.now() });
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});