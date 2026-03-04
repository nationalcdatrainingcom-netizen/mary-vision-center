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
// ical-feeds gets its own routes — frontend sends the full array on save
app.get('/api/ical-feeds', auth, async (req, res) => {
  const data = await fs.readJson(files.icalFeeds).catch(() => []);
  res.json(Array.isArray(data) ? data : []);
});
app.post('/api/ical-feeds', auth, async (req, res) => {
  // Frontend posts the entire feeds array to replace it wholesale
  const feeds = Array.isArray(req.body) ? req.body : [];
  await fs.writeJson(files.icalFeeds, feeds, { spaces: 2 });
  res.json({ ok: true, count: feeds.length });
});

// ── SHARED ICAL FETCH HELPER ─────────────────────────────────────
// Returns a Promise<{ok, events, error}> — same logic used by both
// the test endpoint and the bulk events endpoint
function fetchAndParseIcal(rawUrl) {
  return new Promise((resolve) => {
    const fetchUrl = rawUrl
      .trim()
      .replace('webcal://', 'https://')
      .replace('webcal://', 'https://')  // double-replace in case it slipped through
      .replace(/^http:\/\//, 'https://');

    function doFetch(u, hops) {
      if (hops > 8) return resolve({ ok: false, error: 'Too many redirects', events: [] });
      let urlObj;
      try { urlObj = new URL(u); } catch(e) { return resolve({ ok: false, error: 'Invalid URL: ' + u, events: [] }); }

      const https = require('https');
      const opts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MaryVisionCenter/1.0)',
          'Accept': 'text/calendar, application/ics, */*',
        }
      };
      const req2 = https.request(opts, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          let next = r.headers.location;
          if (next.startsWith('/')) next = 'https://' + urlObj.hostname + next;
          console.log('iCal: redirect', r.statusCode, '->', next.substring(0,70));
          r.resume();
          return doFetch(next, hops + 1);
        }
        if (r.statusCode !== 200) {
          console.error('iCal: HTTP', r.statusCode, 'for', u.substring(0,70));
          r.resume();
          return resolve({ ok: false, error: 'HTTP ' + r.statusCode, events: [] });
        }
        const chunks = [];
        r.on('data', d => chunks.push(d));
        r.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          console.log('iCal: got', body.length, 'bytes,', (body.match(/BEGIN:VEVENT/g)||[]).length, 'raw VEVENTs');
          try {
            const events = parseIcal(body);
            console.log('iCal: parsed', events.length, 'events in 60-day window');
            resolve({ ok: true, events });
          } catch(e) {
            console.error('iCal: parse error:', e.message);
            resolve({ ok: false, error: e.message, events: [] });
          }
        });
        r.on('error', e => resolve({ ok: false, error: e.message, events: [] }));
      });
      req2.on('error', e => { console.error('iCal request error:', e.message); resolve({ ok: false, error: e.message, events: [] }); });
      req2.on('timeout', () => { console.error('iCal timeout for', u.substring(0,70)); req2.destroy(); resolve({ ok: false, error: 'Timeout', events: [] }); });
      req2.end();
    }
    doFetch(fetchUrl, 0);
  });
}

// Test a single iCal URL (called from the Add Calendar modal)
app.post('/api/ical-fetch', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  const result = await fetchAndParseIcal(url);
  if (result.ok) res.json({ ok: true, count: result.events.length, events: result.events });
  else res.status(500).json({ error: result.error });
});

// Return merged events from all saved iCal feeds
app.get('/api/ical-events', auth, async (req, res) => {
  const feeds = await fs.readJson(files.icalFeeds).catch(() => []);
  console.log('iCal-events: loaded', feeds.length, 'feed(s):', feeds.map(f=>f.name).join(', '));
  if (!feeds.length) return res.json([]);

  const allEvents = [];
  await Promise.all(
    feeds.filter(f => f.url && !f.disabled).map(async (feed) => {
      console.log('iCal-events: fetching', feed.name, feed.url.substring(0,60));
      const result = await fetchAndParseIcal(feed.url);
      if (result.ok) {
        result.events.forEach(e => allEvents.push({
          ...e,
          feedName: feed.name,
          feedColor: feed.color || '#38bdf8',
          feedId: feed.id,
        }));
      } else {
        console.error('iCal-events: failed for', feed.name, '-', result.error);
      }
    })
  );

  allEvents.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));
  console.log('iCal-events: returning', allEvents.length, 'total events');
  res.json(allEvents);
});

// ── ICAL PARSER ────────────────────────────────────────────────────
// ── ICAL PARSER WITH RRULE EXPANSION ─────────────────────────────
function parseIcal(raw) {
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + 60);

  // Unfold continuation lines, split
  const lines = raw.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');

  // Parse a DTSTART/DTEND value into { date:'YYYY-MM-DD', time:'HH:MM'|null }
  function parseDateTime(val) {
    const clean = val.replace(/^[^:]*:/, '').replace('Z','').trim(); // handle DTSTART;TZID=...:value
    const d = clean.substring(0,8);
    if (d.length < 8 || !/^\d{8}$/.test(d)) return null;
    const date = d.substring(0,4)+'-'+d.substring(4,6)+'-'+d.substring(6,8);
    let time = null;
    if (clean.length >= 13 && clean[8]==='T') {
      time = clean.substring(9,11)+':'+clean.substring(11,13);
    }
    return { date, time };
  }

  // Parse RRULE string into object
  function parseRrule(val) {
    const obj = {};
    val.split(';').forEach(part => {
      const [k,v] = part.split('=');
      if (k && v) obj[k.trim()] = v.trim();
    });
    return obj;
  }

  // Expand a recurring event into occurrences within [today, cutoff]
  function expandRecurring(evt) {
    const rr = evt._rrule;
    const freq = (rr.FREQ||'').toUpperCase();
    if (!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(freq)) return [];

    const interval = parseInt(rr.INTERVAL||'1',10);
    const count = rr.COUNT ? parseInt(rr.COUNT,10) : 999;
    const until = rr.UNTIL ? new Date(
      rr.UNTIL.substring(0,4)+'-'+rr.UNTIL.substring(4,6)+'-'+rr.UNTIL.substring(6,8)+'T23:59:59'
    ) : cutoff;
    const limitDate = until < cutoff ? until : cutoff;

    // BYDAY for weekly — e.g. "MO,WE,FR"
    const byDay = rr.BYDAY ? rr.BYDAY.split(',').map(d=>d.replace(/[+-\d]/g,'').toUpperCase()) : null;
    const dayMap = {SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};

    const start = new Date(evt.date+'T12:00:00');
    const results = [];
    let cur = new Date(start);
    let n = 0;

    while (cur <= limitDate && n < count && n < 500) {
      if (cur >= today) {
        // For weekly with BYDAY, generate all matching days in this week
        if (freq === 'WEEKLY' && byDay) {
          const weekStart = new Date(cur);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
          byDay.forEach(d => {
            const dayNum = dayMap[d];
            if (dayNum === undefined) return;
            const candidate = new Date(weekStart);
            candidate.setDate(weekStart.getDate() + dayNum);
            if (candidate >= today && candidate <= limitDate && candidate >= start) {
              const ds = candidate.toISOString().slice(0,10);
              // Check not in EXDATE
              if (!evt._exdates || !evt._exdates.has(ds)) {
                results.push({ ...evt, date: ds, _rrule: undefined, _exdates: undefined });
              }
            }
          });
        } else {
          const ds = cur.toISOString().slice(0,10);
          if (!evt._exdates || !evt._exdates.has(ds)) {
            results.push({ ...evt, date: ds, _rrule: undefined, _exdates: undefined });
          }
        }
      }
      n++;
      // Advance by interval
      if (freq === 'DAILY') cur.setDate(cur.getDate() + interval);
      else if (freq === 'WEEKLY') cur.setDate(cur.getDate() + 7 * interval);
      else if (freq === 'MONTHLY') cur.setMonth(cur.getMonth() + interval);
      else if (freq === 'YEARLY') cur.setFullYear(cur.getFullYear() + interval);
    }
    return results;
  }

  const rawEvents = [];
  let current = null;

  for (const raw_line of lines) {
    const line = raw_line.trim();
    if (line === 'BEGIN:VEVENT') { current = { _exdates: new Set() }; continue; }
    if (line === 'END:VEVENT') {
      if (current) rawEvents.push(current);
      current = null; continue;
    }
    if (!current) continue;

    const col = line.indexOf(':');
    if (col === -1) continue;
    // Key may have params: DTSTART;TZID=America/New_York
    const keyFull = line.substring(0, col);
    const key = keyFull.split(';')[0].toUpperCase();
    const val = line.substring(col + 1).trim();

    if (key === 'SUMMARY')
      current.title = val.replace(/\\,/g,',').replace(/\\n/g,' ').replace(/\\;/g,';').trim();
    if (key === 'DTSTART') {
      const dt = parseDateTime(line); // pass full line to handle TZID params
      if (dt) { current.date = dt.date; if (dt.time) current.time = dt.time; }
    }
    if (key === 'DTEND') {
      const dt = parseDateTime(line);
      if (dt && dt.time) current.endTime = dt.time;
    }
    if (key === 'RRULE') current._rrule = parseRrule(val);
    if (key === 'EXDATE') {
      // excluded dates for recurring events
      val.split(',').forEach(v => {
        const clean = v.replace('Z','').replace(/T.*/,'');
        if (clean.length >= 8)
          current._exdates.add(clean.substring(0,4)+'-'+clean.substring(4,6)+'-'+clean.substring(6,8));
      });
    }
    if (key === 'LOCATION') current.location = val.replace(/\\,/g,',').trim();
    if (key === 'DESCRIPTION') current.notes = val.replace(/\\n/g,' ').replace(/\\,/g,',').trim().substring(0,200);
    if (key === 'UID') current.uid = val;
  }

  // Expand and filter
  const events = [];
  const seen = new Set(); // dedup uid+date

  for (const evt of rawEvents) {
    if (!evt.date) continue;

    if (evt._rrule) {
      // Recurring — expand into occurrences
      const occurrences = expandRecurring(evt);
      occurrences.forEach(occ => {
        const key = (occ.uid||occ.title||'') + '|' + occ.date;
        if (!seen.has(key)) { seen.add(key); events.push(occ); }
      });
      // Also include the base event if it falls in range
      const baseD = new Date(evt.date+'T12:00:00');
      if (baseD >= today && baseD <= cutoff) {
        const key = (evt.uid||evt.title||'') + '|' + evt.date;
        if (!seen.has(key)) {
          seen.add(key);
          events.push({ ...evt, _rrule:undefined, _exdates:undefined });
        }
      }
    } else {
      const d = new Date(evt.date+'T12:00:00');
      if (d >= today && d <= cutoff) {
        const key = (evt.uid||evt.title||'') + '|' + evt.date;
        if (!seen.has(key)) {
          seen.add(key);
          events.push({ ...evt, _rrule:undefined, _exdates:undefined });
        }
      }
    }
  }

  events.sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));
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

initData().then(async () => {
  // Clean up any corrupted icalFeeds entries (objects missing url/name from bad saves)
  try {
    const feeds = await fs.readJson(files.icalFeeds).catch(() => []);
    const clean = feeds.filter(f => f && typeof f.url === 'string' && f.url.length > 0);
    if (clean.length !== feeds.length) {
      console.log(`iCal cleanup: removed ${feeds.length - clean.length} corrupted feed entries, kept ${clean.length}`);
      await fs.writeJson(files.icalFeeds, clean, { spaces: 2 });
    }
  } catch(e) { console.error('iCal cleanup error:', e.message); }

  app.listen(PORT, () => console.log(`Mary's Vision Center on port ${PORT}`));
});
