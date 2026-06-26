'use strict';

const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;
const HOST = '127.0.0.1';

const DATA_DIR    = '/var/www/darkwebstuff';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE     = path.join(DATA_DIR, 'messages.json');

const EXPIRY_MS   = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_MSGS    = 500;                    // hard cap to prevent unbounded growth
const CLEANUP_MS  = 5 * 60 * 1000;         // cleanup every 5 min

// ── Boot-time directory / db init ────────────────────────────────────────────
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE))      fs.writeFileSync(DB_FILE, '[]', 'utf8');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: false }));          // same-origin via nginx only
app.use(express.json({ limit: '64kb' }));  // limit JSON body size

// Simple in-memory rate limiter (per IP, max 20 req / 10 s)
const ipTimestamps = new Map();
function rateLimiter(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  const win = 10_000;   // 10 seconds
  const max = 20;

  if (!ipTimestamps.has(ip)) ipTimestamps.set(ip, []);
  const hits = ipTimestamps.get(ip).filter(t => now - t < win);
  hits.push(now);
  ipTimestamps.set(ip, hits);

  if (hits.length > max) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }
  next();
}

// Prune the rate-limiter map every 30 s so it doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of ipTimestamps) {
    const fresh = times.filter(t => now - t < 30_000);
    if (fresh.length === 0) ipTimestamps.delete(ip);
    else                    ipTimestamps.set(ip, fresh);
  }
}, 30_000);

app.use('/api', rateLimiter);

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `file-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }  // 10 MB
});

// ── DB helpers (synchronous, file is tiny) ───────────────────────────────────
function getMessages() {
  try   { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}

function saveMessages(msgs) {
  fs.writeFileSync(DB_FILE, JSON.stringify(msgs, null, 2), 'utf8');
}

// ── Routes ────────────────────────────────────────────────────────────────────
// GET /api/messages
app.get('/api/messages', (_req, res) => {
  res.json(getMessages());
});

// POST /api/messages
app.post('/api/messages', (req, res) => {
  const { alias, text, file, avatar } = req.body;

  if (!text && !file) {
    return res.status(400).json({ error: 'Message or file required.' });
  }

  const messages = getMessages();

  // Hard cap — drop oldest if limit reached
  while (messages.length >= MAX_MSGS) {
    const oldest = messages.shift();
    if (oldest?.file?.filename) {
      const fp = path.join(UPLOADS_DIR, oldest.file.filename);
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch {} }
    }
  }

  const newMsg = {
    id:        `${Date.now()}-${Math.round(Math.random() * 1000)}`,
    alias:     (alias && alias.trim()) ? alias.trim().substring(0, 25) : 'Anonymous',
    avatar:    (avatar && typeof avatar === 'string') ? avatar.substring(0, 8) : '👤',
    text:      text ? text.substring(0, 1000) : '',
    file:      file || null,
    timestamp: Date.now()
  };

  messages.push(newMsg);
  saveMessages(messages);
  res.status(201).json(newMsg);
});

// DELETE /api/messages/:id
app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const messages = getMessages();
  const index    = messages.findIndex(m => m.id === id);

  if (index === -1) return res.status(404).json({ error: 'Message not found.' });

  const [msg] = messages.splice(index, 1);

  if (msg.file?.filename) {
    const fp = path.join(UPLOADS_DIR, msg.file.filename);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (e) { console.error('[DELETE] file removal failed:', e.message); } }
  }

  saveMessages(messages);
  res.json({ success: true });
});

// POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  res.json({
    filename:     req.file.filename,
    originalName: req.file.originalname,
    size:         req.file.size
  });
});

// ── Multer error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 10 MB limit.' });
    }
  }
  if (err) return res.status(500).json({ error: err.message });
  next();
});

// ── 24-hour auto-expiration (runs every 5 min) ────────────────────────────────
function runCleanup() {
  const now      = Date.now();
  const messages = getMessages();
  const kept     = [];
  let   deleted  = 0;

  for (const msg of messages) {
    if (now - msg.timestamp > EXPIRY_MS) {
      if (msg.file?.filename) {
        const fp = path.join(UPLOADS_DIR, msg.file.filename);
        if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); console.log(`[CLEANUP] deleted: ${msg.file.filename}`); } catch {} }
      }
      deleted++;
    } else {
      kept.push(msg);
    }
  }

  if (deleted > 0) {
    saveMessages(kept);
    console.log(`[CLEANUP] purged ${deleted} expired messages.`);
  }
}

setInterval(runCleanup, CLEANUP_MS);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`[SERVER] ${signal} received — shutting down gracefully.`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000); // force-kill after 5 s
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[SERVER] Void Onion Backend → http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
