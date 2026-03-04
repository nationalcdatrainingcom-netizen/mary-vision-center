const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

console.log('DATA_DIR:', DATA_DIR);

const files = {
  users:          path.join(DATA_DIR, 'users.json'),
  affirmations:   path.join(DATA_DIR, 'affirmations.json'),
  featured:       path.join(DATA_DIR, 'featured.json'),
  vision:         path.join(DATA_DIR, 'vision.json'),
  tasks:          path.join(DATA_DIR, 'tasks.json'),
  goals:          path.join(DATA_DIR, 'goals.json'),
  actionSteps:    path.join(DATA_DIR, 'actionSteps.json'),
  truthReframes:  path.join(DATA_DIR, 'truthReframes.json'),
  gratitude:      path.join(DATA_DIR, 'gratitude.json'),
  loveLetter:     path.join(DATA_DIR, 'loveLetter.json'),
  blessings:      path.join(DATA_DIR, 'blessings.json'),
  patterns:       path.join(DATA_DIR, 'patterns.json'),
  reminders:      path.join(DATA_DIR, 'reminders.json'),
  media:          path.join(DATA_DIR, 'media.json'),
  energyLog:      path.join(DATA_DIR, 'energyLog.json'),
  prayerList:     path.join(DATA_DIR, 'prayerList.json'),
};

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'mvc-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(PUBLIC_DIR));

function auth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

async function initData() {
  await fs.ensureDir(DATA_DIR);

  if (!await fs.pathExists(files.users)) {
    await fs.writeJson(files.users, [
      { id: 'mary', username: 'mary', name: 'Mary Wardlaw', password: bcrypt.hashSync('vision2024', 10) }
    ], { spaces: 2 });
  }

  const defaults = [
    [files.affirmations, [
      { id: '1', text: 'I am a magnet for abundance and prosperity flows to me effortlessly.' },
      { id: '2', text: 'Money comes to me from expected and unexpected sources every single day.' },
      { id: '3', text: 'I am worthy of everything I desire and more.' },
      { id: '4', text: 'The Lord is my shepherd — I shall not want. All my needs are met before I even know I need them.' },
      { id: '5', text: 'I am grateful for the abundance that is already mine.' },
      { id: '6', text: 'I am healthy, wealthy, joyful, and free.' },
      { id: '7', text: 'Everything I touch turns to gold. I am blessed and highly favored.' },
      { id: '8', text: 'I release all resistance and welcome infinite abundance into my life.' },
      { id: '9', text: "God's timing is perfect and my breakthrough is already done." },
      { id: '10', text: 'I am a powerful creator and I choose joy, abundance, and peace.' },
    ]],
    [files.featured, { text: 'I am grateful for having everything I need before I even need it. God always provides.', updatedAt: new Date().toISOString() }],
    [files.vision, { ideas: '', notes: '' }],
    [files.tasks, []],
    [files.goals, []],
    [files.actionSteps, []],
    [files.truthReframes, []],
    [files.gratitude, []],
    [files.loveLetter, { content: '' }],
    [files.blessings, []],
    [files.patterns, []],
    [files.reminders, []],
    [files.media, { youtube: [], books: [], songs: [], other: [] }],
    [files.energyLog, []],
    [files.prayerList, []],
  ];

  for (const [f, def] of defaults) {
    if (!await fs.pathExists(f)) {
      await fs.writeJson(f, def, { spaces: 2 });
    }
  }
  console.log('Data ready');
}

// ── AUTH ──────────────────────────────────────────────────────────
app.get('/api/me', auth, async (req, res) => {
  const users = await fs.readJson(files.users);
  const u = users.find(u => u.id === req.session.userId);
  if (!u) return res.status(401).json({ error: 'Not found' });
  res.json({ id: u.id, name: u.name, username: u.username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await fs.readJson(files.users);
  const u = users.find(u => u.username === username);
  if (!u || !bcrypt.compareSync(password, u.password)) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = u.id;
  res.json({ id: u.id, name: u.name });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

// ── GENERIC CRUD HELPERS ──────────────────────────────────────────
function arrayRoutes(route, fileKey) {
  app.get(`/api/${route}`, auth, async (req, res) => res.json(await fs.readJson(files[fileKey])));
  app.post(`/api/${route}`, auth, async (req, res) => {
    const data = await fs.readJson(files[fileKey]);
    const item = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    data.push(item);
    await fs.writeJson(files[fileKey], data, { spaces: 2 });
    res.json(item);
  });
  app.put(`/api/${route}/:id`, auth, async (req, res) => {
    const data = await fs.readJson(files[fileKey]);
    const idx = data.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[idx] = { ...data[idx], ...req.body, updatedAt: new Date().toISOString() };
    await fs.writeJson(files[fileKey], data, { spaces: 2 });
    res.json(data[idx]);
  });
  app.delete(`/api/${route}/:id`, auth, async (req, res) => {
    let data = await fs.readJson(files[fileKey]);
    data = data.filter(d => d.id !== req.params.id);
    await fs.writeJson(files[fileKey], data, { spaces: 2 });
    res.json({ success: true });
  });
}

function singleRoutes(route, fileKey) {
  app.get(`/api/${route}`, auth, async (req, res) => res.json(await fs.readJson(files[fileKey])));
  app.put(`/api/${route}`, auth, async (req, res) => {
    const current = await fs.readJson(files[fileKey]);
    const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
    await fs.writeJson(files[fileKey], updated, { spaces: 2 });
    res.json(updated);
  });
}

arrayRoutes('affirmations', 'affirmations');
arrayRoutes('tasks', 'tasks');
arrayRoutes('goals', 'goals');
arrayRoutes('action-steps', 'actionSteps');
arrayRoutes('truth-reframes', 'truthReframes');
arrayRoutes('gratitude', 'gratitude');
arrayRoutes('blessings', 'blessings');
arrayRoutes('patterns', 'patterns');
arrayRoutes('reminders', 'reminders');
arrayRoutes('prayer-list', 'prayerList');
arrayRoutes('energy-log', 'energyLog');
singleRoutes('featured', 'featured');
singleRoutes('vision', 'vision');
singleRoutes('love-letter', 'loveLetter');
singleRoutes('media', 'media');

// ── EXTERNAL DATA PROXY (avoids CORS) ─────────────────────────────
const https = require('https');
const http = require('http');

function fetchExternal(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, data: JSON.parse(body), status: res.statusCode }); }
        catch { resolve({ ok: false, data: null, status: res.statusCode }); }
      });
    }).on('error', () => resolve({ ok: false, data: null, status: 0 }));
  });
}

// Proxy endpoint — client sends { url } and we fetch server-side
app.post('/api/proxy', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL' });
  const result = await fetchExternal(url);
  res.json(result);
});

// ── BACKUP ────────────────────────────────────────────────────────
app.get('/api/backup', auth, async (req, res) => {
  const backup = { _exportedAt: new Date().toISOString() };
  for (const [key, filePath] of Object.entries(files)) {
    if (key === 'users') continue;
    try { backup[key] = await fs.readJson(filePath); } catch { backup[key] = null; }
  }
  res.setHeader('Content-Disposition', `attachment; filename="mvc-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.json(backup);
});

app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

initData().then(() => app.listen(PORT, () => console.log(`Mary's Vision Center on port ${PORT}`)));
