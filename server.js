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
  icalFeeds:      path.join(DATA_DIR, 'icalFeeds.json'),
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
    [files.icalFeeds, []],
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

const MVC_API_KEY = process.env.MVC_API_KEY || 'mvc-readonly-2024-xk9';

function fetchExternal(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 10000,
      headers: {
        'x-mvc-key': MVC_API_KEY,
        'Accept': 'application/json'
      }
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, data: JSON.parse(body), status: res.statusCode }); }
        catch(e) { resolve({ ok: false, data: null, status: res.statusCode, error: e.message }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, data: null, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: null, status: 0, error: 'timeout' }); });
    req.end();
  });
}

// Proxy endpoint — client sends { url } and we fetch server-side
app.post('/api/proxy', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL' });
  console.log('Proxy fetch:', url);
  const result = await fetchExternal(url);
  console.log('Proxy result:', url, result.status, result.ok);
  res.json(result);
});

// ── ICAL FEEDS ────────────────────────────────────────────────────
arrayRoutes('ical-feeds', 'icalFeeds');

// Fetch and parse a single iCal URL server-side
app.post('/api/ical-fetch', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const fetchUrl = url.replace('webcal://', 'https://').replace('http://', 'https://');

  function doFetch(u, hops) {
    if (hops > 5) return res.status(500).json({ error: 'Too many redirects' });
    const lib = require('https');
    const urlObj = new URL(u);
    const opts = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', timeout: 12000, headers: { 'User-Agent': 'MaryVisionCenter/1.0' } };
    const req2 = lib.request(opts, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        let next = r.headers.location;
        if (next.startsWith('/')) next = urlObj.origin + next;
        return doFetch(next, hops + 1);
      }
      if (r.statusCode !== 200) return res.status(500).json({ error: 'Server returned ' + r.statusCode });
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => {
        try {
          const events = parseIcal(body);
          res.json({ ok: true, count: events.length, events });
        } catch(e) {
          res.status(500).json({ error: 'Could not parse iCal: ' + e.message });
        }
      });
    });
    req2.on('error', e => res.status(500).json({ error: e.message }));
    req2.on('timeout', () => { req2.destroy(); res.status(500).json({ error: 'Timeout' }); });
    req2.end();
  }
  doFetch(fetchUrl, 0);
});

// Refresh all saved iCal feeds and return merged events
app.get('/api/ical-events', auth, async (req, res) => {
  const feeds = await fs.readJson(files.icalFeeds).catch(() => []);
  if (!feeds.length) return res.json([]);

  const allEvents = [];
  await Promise.all(feeds.map(feed => new Promise(resolve => {
    if (!feed.url || feed.disabled) return resolve();
    const fetchUrl = feed.url.replace('webcal://', 'https://').replace('http://', 'https://');

    function doFetch(u, hops) {
      if (hops > 5) return resolve();
      const lib = require('https');
      const urlObj = new URL(u);
      const opts = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', timeout: 12000, headers: { 'User-Agent': 'MaryVisionCenter/1.0' } };
      const req2 = lib.request(opts, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          let next = r.headers.location;
          try { if (next.startsWith('/')) next = new URL(u).origin + next; } catch(e) {}
          return doFetch(next, hops + 1);
        }
        let body = '';
        r.on('data', d => body += d);
        r.on('end', () => {
          try {
            const events = parseIcal(body);
            events.forEach(e => allEvents.push({ ...e, feedName: feed.name, feedColor: feed.color || '#38bdf8', feedId: feed.id }));
          } catch(e) { console.error('iCal parse error for', feed.name, e.message); }
          resolve();
        });
      });
      req2.on('error', () => resolve());
      req2.on('timeout', () => { req2.destroy(); resolve(); });
      req2.end();
    }
    doFetch(fetchUrl, 0);
  })));

  res.json(allEvents);
});

// ── ICAL PARSER ────────────────────────────────────────────────────
function parseIcal(raw) {
  const events = [];
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    // Unfold continuation lines
    .replace(/\n[ \t]/g, '').split('\n');

  let current = null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 60); // 60 days ahead

  for (const raw_line of lines) {
    const line = raw_line.trim();
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current && current.date) {
        const d = new Date(current.date + 'T12:00:00');
        if (d >= today && d <= cutoff) events.push(current);
      }
      current = null; continue;
    }
    if (!current) continue;

    const col = line.indexOf(':');
    if (col === -1) continue;
    const key = line.substring(0, col).split(';')[0].toUpperCase();
    const val = line.substring(col + 1).trim();

    if (key === 'SUMMARY') {
      current.title = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\;/g, ';').trim();
    }
    if (key === 'DTSTART') {
      const dateStr = val.replace(/[TZ]/g, '').substring(0, 8);
      if (dateStr.length === 8) {
        current.date = dateStr.substring(0,4) + '-' + dateStr.substring(4,6) + '-' + dateStr.substring(6,8);
        // Extract time if present
        const timeStr = val.replace('Z','');
        if (timeStr.length >= 13) {
          const h = timeStr.substring(9,11), m = timeStr.substring(11,13);
          current.time = h + ':' + m;
        }
      }
    }
    if (key === 'DTEND') {
      const timeStr = val.replace('Z','');
      if (timeStr.length >= 13) {
        current.endTime = timeStr.substring(9,11) + ':' + timeStr.substring(11,13);
      }
    }
    if (key === 'LOCATION') current.location = val.replace(/\\,/g, ',').trim();
    if (key === 'DESCRIPTION') current.notes = val.replace(/\\n/g, ' ').replace(/\\,/g, ',').trim().substring(0, 200);
    if (key === 'RRULE') current.recurring = true;
    if (key === 'UID') current.uid = val;
  }

  // Sort by date then time
  events.sort((a,b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : (a.time||'').localeCompare(b.time||'');
  });

  return events;
}

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
