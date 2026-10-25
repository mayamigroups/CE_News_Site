const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

// Minimal .env loader: keeps this starter dependency-free. Existing process env wins.
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const models = require('./lib/models.js');
const { createDataStore, CURRENT_SCHEMA_VERSION } = require('./lib/store.js');
const collector = require('./lib/collector.js');
const newsroom = require('./lib/newsroom.js');
const workflow = require('./lib/workflow.js');
const seoLib = require('./lib/seo.js');
const distribution = require('./lib/distribution.js');
const aiSeo = require('./lib/ai_seo.js');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const store = createDataStore(DATA_DIR);
store.migrate();
try {
  aiSeo.seedInitialSeoTasks(store);
} catch (err) {
  console.warn('Initial SEO task seed note:', err.message);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const sessions = new Map();
const loginAttempts = new Map();
const publicPostAttempts = new Map();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self';"
};

const { VALID_ARTICLE_TYPES, VALID_STATUSES, makeSlug, validHttpUrl } = models;

const CANONICAL_REGIONAL_HUBS = [
  {
    slug: 'india',
    title: 'India & South Asia',
    shortName: 'India',
    countries: ['India'],
    regions: ['India', 'Asia-Pacific'],
    currency: 'INR (₹ / Crore)',
    units: 'Metric (tonnes, kW / hp, metres)',
    regulations: 'CEV Stage V (Construction Equipment) & BS-VI Phase 2 (Commercial Vehicles)',
    terminology: 'Backhoe Loaders, Multi-Axle Tippers (28T–55T GVW), Pick-and-Carry Cranes, Tractor Implements',
    events: 'EXCON (Bengaluru), Bauma CONEXPO INDIA (Greater Noida)'
  },
  {
    slug: 'north-america',
    title: 'United States & North America',
    shortName: 'North America',
    countries: ['United States', 'Canada', 'Mexico', 'North America'],
    regions: ['North America'],
    currency: 'USD ($) / CAD ($)',
    units: 'US Customary & Metric (lbs, short tons, hp, ft-lbs)',
    regulations: 'EPA Tier 4 Final (Off-Highway) & EPA 2027 / CARB ACT (Commercial Trucks)',
    terminology: 'Compact Track Loaders (CTLs), Skid-Steers, Class 7 & Class 8 Vocational Dump Trucks, Articulated Haulers',
    events: 'CONEXPO-CON/AGG (Las Vegas), World of Concrete, ACT Expo, Utility Expo (Louisville)'
  },
  {
    slug: 'europe',
    title: 'Europe (EU, UK & EEA)',
    shortName: 'Europe',
    countries: ['Germany', 'United Kingdom', 'Sweden', 'France', 'Italy', 'Europe'],
    regions: ['Europe'],
    currency: 'EUR (€) / GBP (£)',
    units: 'Metric (tonnes, kW, Nm, metres)',
    regulations: 'EU Stage V (Non-Road Mobile Machinery) & Euro 6e / Euro 7 (Heavy-Duty Vehicles)',
    terminology: 'Wheeled Excavators, Tiltrotators, Compact Electric Loaders, 8x4 Rigid Tippers, Telehandlers',
    events: 'Bauma (Munich), IAA Transportation (Hannover), Intermat (Paris), PlantWorx (UK)'
  },
  {
    slug: 'china',
    title: 'China',
    shortName: 'China',
    countries: ['China'],
    regions: ['China'],
    currency: 'CNY (¥ / RMB)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'China NRMM Stage IV (Off-Highway) & China VI-b / NEV Mandates (Commercial Trucks)',
    terminology: 'Battery-Electric Wheel Loaders, NEV Heavy Mining Dump Trucks, Ultra-Large Tonnage All-Terrain Cranes',
    events: 'bauma CHINA (Shanghai), BICES (Beijing)'
  },
  {
    slug: 'japan-south-korea',
    title: 'Japan & South Korea',
    shortName: 'Japan & Korea',
    countries: ['Japan', 'South Korea'],
    regions: ['Japan & South Korea'],
    currency: 'JPY (¥) / KRW (₩)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'MLIT Off-Road Act (Japan) & KMOE Stage V Equivalent (South Korea)',
    terminology: 'Zero-Tail-Swing Mini & Hydraulic Excavators, ICT Smart Construction, Hybrid Earthmoving',
    events: 'CSPI-EXPO (Chiba, Japan), CONEX Korea (Seoul)'
  },
  {
    slug: 'middle-east',
    title: 'Middle East & GCC',
    shortName: 'Middle East',
    countries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Middle East'],
    regions: ['Middle East', 'Middle East & Africa'],
    currency: 'AED / SAR / USD ($)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'GSO Euro V / VI Heavy Vehicle Standards & High-Ambient Desert Cooling Specs',
    terminology: 'Tower & Heavy Crawler Cranes, 50°C High-Ambient Excavators, Sand & Quarry Articulated Tippers',
    events: 'Big 5 Global Heavy (Dubai), Saudi Infrastructure Expo (Riyadh)'
  },
  {
    slug: 'southeast-asia',
    title: 'Southeast Asia (ASEAN)',
    shortName: 'Southeast Asia',
    countries: ['Indonesia', 'Thailand', 'Vietnam', 'Malaysia', 'Philippines', 'Singapore'],
    regions: ['Southeast Asia'],
    currency: 'IDR / THB / VND / MYR / USD',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'ASEAN Euro 4 / Euro 5 Diesel & Biofuel (B35) Powertrain Compatibility',
    terminology: '20-Tonne Class Forestry & Mining Excavators, Nickel/Coal Overburden Tipper Trucks, Ag Tractors',
    events: 'Mining Indonesia (Jakarta), CONSTECH Thailand (Bangkok), Philconstruct (Manila)'
  },
  {
    slug: 'australia',
    title: 'Australia & Oceania',
    shortName: 'Australia',
    countries: ['Australia', 'New Zealand'],
    regions: ['Australia'],
    currency: 'AUD (A$) / NZD (NZ$)',
    units: 'Metric (tonnes, kW, metres, GCM)',
    regulations: 'ADR 80/04 (Euro VI Heavy Trucks) & Autonomous Mining Haulage Safety Standards (MDG)',
    terminology: 'Autonomous Haulage Systems (AHS), Multi-Combination Road Trains, Ultra-Class Mining Shovels',
    events: 'AIMEX (Sydney), National Diesel Dirt & Turf Expo, Brisbane Truck Show'
  },
  {
    slug: 'latin-america',
    title: 'Latin America',
    shortName: 'Latin America',
    countries: ['Brazil', 'Chile', 'Argentina', 'Mexico', 'Peru', 'Colombia'],
    regions: ['Latin America'],
    currency: 'BRL (R$) / CLP / MXN / USD',
    units: 'Metric (tonnes, kW, cv / hp)',
    regulations: 'PROCONVE MAR-I (Off-Road) & PROCONVE P8 / Euro 6 (Commercial Trucks in Brazil)',
    terminology: 'Copper & Lithium Mining Haul Trucks, High-Horsepower Row-Crop Tractors, Bi-Train Vocational Trucks',
    events: 'M&T Expo (São Paulo), EXPOMIN (Santiago, Chile), Agrishow (Ribeirão Preto)'
  },
  {
    slug: 'africa',
    title: 'Africa',
    shortName: 'Africa',
    countries: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Zambia'],
    regions: ['Africa'],
    currency: 'ZAR (R) / NGN / KES / EGP / USD',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'Regional Sulphur-Tolerant Tier 2 / Tier 3 & Euro II–V Fleet Specifications',
    terminology: 'Articulated Dump Trucks (ADTs), Open-Pit Mining Excavators, Ruggedized 6x4 Tippers & Utility Backhoes',
    events: 'bauma CONEXPO AFRICA (Johannesburg), Investing in African Mining Indaba (Cape Town)'
  }
];

const REGION_PATH_ALIASES = {
  'united-states': 'north-america',
  'usa': 'north-america',
  'us': 'north-america',
  'japan-and-south-korea': 'japan-south-korea',
  'japan-korea': 'japan-south-korea',
  'japan': 'japan-south-korea',
  'south-korea': 'japan-south-korea',
  'asean': 'southeast-asia',
  'oceania': 'australia',
  'latam': 'latin-america',
  'mena': 'middle-east',
  'asia-pacific': 'india'
};

function resolveRegionHubSlug(raw) {
  const clean = String(raw || '').toLowerCase().trim().replace(/^\/+|\/+$/g, '');
  if (REGION_PATH_ALIASES[clean]) return REGION_PATH_ALIASES[clean];
  return CANONICAL_REGIONAL_HUBS.some(h => h.slug === clean) ? clean : '';
}

function computeRegionsPriorityData() {
  const articles = readArticles().filter(a => a.status === 'published');
  const catalog = store.getCatalogSummary();
  const analytics = store.getAnalytics();

  return CANONICAL_REGIONAL_HUBS.map((hub, idx) => {
    const localArticles = articles.filter(a =>
      hub.countries.some(c => (a.country || '').toLowerCase() === c.toLowerCase()) ||
      hub.regions.some(r => (a.region || '').toLowerCase() === r.toLowerCase())
    );
    const internationalArticles = articles.filter(a =>
      !localArticles.some(loc => loc.id === a.id) &&
      ((a.country || '').toLowerCase() === 'global' || (a.region || '').toLowerCase() === 'global')
    );
    const activeOems = (catalog.manufacturers || []).filter(m =>
      hub.countries.some(c => (m.country || '').toLowerCase() === c.toLowerCase())
    );
    const regionViews = Number(analytics.regionViews?.[hub.slug] || 0);
    const articleViews = localArticles.reduce((sum, a) => sum + Number(analytics.articleViews?.[a.slug] || 0), 0);

    // Priority Score = (Verified Local News Volume * 35) + (Active Local OEMs * 15) + (Reader Interest & Analytics Views * 5) + Baseline Global Weight
    const priorityScore = (localArticles.length * 35) + (activeOems.length * 15) + ((regionViews + articleViews) * 5) + (12 - idx);

    return {
      ...hub,
      canonicalUrl: `/${hub.slug}/`,
      localArticleCount: localArticles.length,
      internationalArticleCount: internationalArticles.length,
      manufacturerCount: activeOems.length,
      activeManufacturers: activeOems.map(m => m.name),
      analyticsViews: regionViews + articleViews,
      priorityScore
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

function readArticles() {
  try {
    workflow.processDueScheduledArticles(store, 'On-Request Scheduler');
  } catch {}
  return store.readJson(store.files.articles, []);
}

function writeArticles(articles) {
  store.writeJson(store.files.articles, articles);
}

function readNewsletter() { return store.readJson(store.files.newsletter, []); }
function writeNewsletter(rows) { store.writeJson(store.files.newsletter, rows); }

function readSubmissions() { return store.readJson(store.files.submissions, []); }
function writeSubmissions(rows) { store.writeJson(store.files.submissions, rows); }

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...headers
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    ...SECURITY_HEADERS,
    ...headers
  });
  res.end(text);
}

function renderErrorPageHtml(status, title, message, requestedPath = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${status} ${escapeXml(title)} | MACHINEWIRE</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap masthead">
      <a class="brand" href="/">
        <span class="brand-mark">MW<span>+</span></span>
        <span class="brand-words">MACHINE<span>WIRE</span><small>THE WORLD OF MACHINES. CONNECTED.</small></span>
      </a>
      <div class="masthead-actions">
        <a class="button button-dark" href="/">Homepage</a>
        <a class="button button-amber" href="/manufacturers">OEM Directory</a>
      </div>
    </div>
  </header>
  <main class="wrap" style="padding: 64px 20px; max-width: 820px;">
    <span class="eyebrow">HTTP ${status} · EDITORIAL DESK NOTICE</span>
    <h1 style="margin: 12px 0 16px; font-size: 36px;">${escapeXml(title)}</h1>
    <p style="font-size: 17px; color: #65717D; margin-bottom: 24px;">${escapeXml(message)}${requestedPath ? ` (<code>${escapeXml(requestedPath)}</code>)` : ''}</p>
    <div style="display: flex; flex-wrap: wrap; gap: 12px;">
      <a class="button button-dark" href="/">← Return to MachineWire Homepage</a>
      <a class="button button-outline" href="/category/construction-equipment">Construction Equipment Desk</a>
      <a class="button button-outline" href="/manufacturers">Browse Manufacturers</a>
      <a class="button button-outline" href="/models">Browse Equipment Models</a>
    </div>
  </main>
</body>
</html>`;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function cookieValue(req, name) {
  const row = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : '';
}

const ROLE_RANKS = {
  author: 1,
  reviewer: 2,
  managing_editor: 3,
  super_admin: 4
};

function getAdminSession(req) {
  const token = cookieValue(req, 'bm_session');
  if (!token || !SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expiry, signature] = parts;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) {
    sessions.delete(id);
    return null;
  }
  const expected = sign(`${id}.${expiry}`);
  if (!safeEqual(signature, expected) || !sessions.has(id)) return null;
  return sessions.get(id);
}

function isAdmin(req) {
  return Boolean(getAdminSession(req));
}

function hasMinRole(session, minRole) {
  if (!session) return false;
  return (ROLE_RANKS[session.role] || 0) >= (ROLE_RANKS[minRole] || 99);
}

function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      } else {
        raw += chunk;
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function publicArticle(a) {
  const { status, verificationNotes, rejectionReason, ...rest } = a;
  return rest;
}

function validateArticle(input, existing = null, options = {}) {
  return models.validateAndNormalizeArticle(input, existing, options);
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return true;
  if (now - record.firstAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return true;
  }
  return record.count < 10;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count += 1;
  }
}

function checkPublicPostRateLimit(ip, bucket = 'default', maxPerWindow = 40) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const record = publicPostAttempts.get(key);
  if (!record || now - record.firstAttempt > 10 * 60 * 1000) {
    publicPostAttempts.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  record.count += 1;
  return record.count <= maxPerWindow;
}

async function handle(req, res) {
  const url = new URL(req.url, SITE_URL);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, { error: 'Malformed URL path' });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return send(res, 200, {
      ok: true,
      name: 'MachineWire — Global Equipment & Commercial Vehicle News',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      time: new Date().toISOString()
    });
  }

  if (req.method === 'GET' && pathname === '/api/meta') {
    const articles = readArticles().filter(a => a.status === 'published');
    const countBy = key => {
      const map = new Map();
      for (const a of articles) {
        const val = String(a[key] || '').trim();
        if (val) map.set(val, (map.get(val) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    };
    const catalog = store.getCatalogSummary();
    return send(res, 200, {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      totalPublished: articles.length,
      categories: countBy('category'),
      manufacturers: countBy('manufacturer'),
      equipmentTypes: countBy('equipmentType'),
      countries: countBy('country'),
      regions: countBy('region'),
      articleTypes: countBy('articleType'),
      catalogCounts: {
        authors: catalog.authors.length,
        categories: catalog.categories.length,
        regions: catalog.regions.length,
        countries: catalog.countries.length,
        manufacturers: catalog.manufacturers.length,
        equipmentModels: catalog.equipmentModels.length,
        sources: catalog.sources.length,
        tags: catalog.tags.length,
        images: catalog.images.length
      }
    });
  }

  if (req.method === 'GET' && pathname === '/api/catalog') {
    const summary = store.getCatalogSummary();
    return send(res, 200, {
      categories: summary.categories,
      regions: summary.regions,
      countries: summary.countries,
      manufacturers: summary.manufacturers,
      equipmentModels: summary.equipmentModels,
      authors: summary.authors,
      tags: summary.tags
    });
  }

  if (req.method === 'GET' && pathname === '/api/regions') {
    return send(res, 200, {
      hubs: computeRegionsPriorityData()
    });
  }

  // Manufacturer & Brand Directory API (Search & filter by manufacturer, equipmentType, model, country, category)
  if (req.method === 'GET' && pathname === '/api/manufacturers') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim().slice(0, 100);
    const country = (url.searchParams.get('country') || '').toLowerCase().trim();
    const category = (url.searchParams.get('category') || '').toLowerCase().trim();
    const equipmentType = (url.searchParams.get('equipmentType') || '').toLowerCase().trim();
    const modelQuery = (url.searchParams.get('model') || '').toLowerCase().trim();

    const catalog = store.getCatalogSummary();
    const articles = readArticles().filter(a => a.status === 'published');
    const allModels = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      !['All Manufacturers', 'Various'].includes(m.manufacturer)
    );

    // Filter out meta-placeholders ('All Manufacturers', 'Various') and merge legacy 'Volvo'/'Tata' aliases if present
    const rawMfgs = (catalog.manufacturers || []).filter(m =>
      !['all-manufacturers', 'various', 'volvo', 'tata'].includes(m.slug)
    );

    const enriched = rawMfgs.map(mfg => {
      const mfgModels = allModels.filter(em =>
        em.manufacturerSlug === mfg.slug ||
        em.manufacturer.toLowerCase() === mfg.name.toLowerCase() ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(em.manufacturer)) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(em.manufacturer))
      );
      const mfgArticles = articles.filter(a =>
        (a.manufacturer || '').toLowerCase() === mfg.name.toLowerCase() ||
        models.makeSlug(a.manufacturer || '', 80) === mfg.slug ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(a.manufacturer || '')) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(a.manufacturer || ''))
      );
      return {
        ...mfg,
        canonicalUrl: `/manufacturers/${mfg.slug}`,
        modelCount: mfgModels.length,
        articleCount: mfgArticles.length,
        models: mfgModels.map(em => ({
          name: em.name,
          slug: em.slug,
          equipmentType: em.equipmentType,
          category: em.category,
          powerType: em.powerType,
          canonicalUrl: `/models/${em.slug}`
        }))
      };
    });

    const filtered = enriched.filter(mfg => {
      if (country && mfg.country.toLowerCase() !== country && !(mfg.regionalFootprint || []).some(r => r.toLowerCase() === country)) {
        return false;
      }
      if (category && !(mfg.equipmentCategories || []).some(c => c.toLowerCase().includes(category)) && !mfg.focus.toLowerCase().includes(category)) {
        return false;
      }
      if (equipmentType && !mfg.models.some(m => m.equipmentType.toLowerCase().includes(equipmentType)) && !mfg.focus.toLowerCase().includes(equipmentType)) {
        return false;
      }
      if (modelQuery && !mfg.models.some(m => m.name.toLowerCase().includes(modelQuery) || m.slug.includes(modelQuery))) {
        return false;
      }
      if (q) {
        const hay = [
          mfg.name,
          mfg.country,
          mfg.headquarters,
          mfg.focus,
          mfg.overview,
          ...(mfg.equipmentCategories || []),
          ...(mfg.technologyHighlights || []),
          ...(mfg.regionalFootprint || []),
          ...mfg.models.map(m => `${m.name} ${m.equipmentType}`)
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return send(res, 200, {
      disclaimer: 'All manufacturers listed are independent editorial directory candidates. Inclusion does not imply any commercial partnership, sponsorship, or OEM endorsement.',
      total: filtered.length,
      manufacturers: filtered
    });
  }

  const mfgMatch = pathname.match(/^\/api\/manufacturers\/([a-z0-9-_]+)$/i);
  if (req.method === 'GET' && mfgMatch) {
    const rawSlug = mfgMatch[1].toLowerCase();
    const aliasMap = {
      'volvo': 'volvo-construction-equipment',
      'volvo-ce': 'volvo-construction-equipment',
      'tata': 'tata-motors',
      'bull': 'bull-machines',
      'cat': 'caterpillar',
      'deere': 'john-deere',
      'hyundai': 'hd-hyundai'
    };
    const targetSlug = aliasMap[rawSlug] || rawSlug;
    const catalog = store.getCatalogSummary();
    const mfg = (catalog.manufacturers || []).find(m => m.slug === targetSlug || m.slug === rawSlug);
    if (!mfg || ['all-manufacturers', 'various'].includes(mfg.slug)) {
      return send(res, 404, { error: 'Manufacturer profile not found' });
    }

    const articles = readArticles().filter(a => a.status === 'published');
    const relatedArticles = articles
      .filter(a =>
        (a.manufacturer || '').toLowerCase() === mfg.name.toLowerCase() ||
        models.makeSlug(a.manufacturer || '', 80) === mfg.slug ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(a.manufacturer || '')) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(a.manufacturer || ''))
      )
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .map(publicArticle);

    const productModels = (catalog.equipmentModels || []).filter(em =>
      em.manufacturerSlug === mfg.slug ||
      em.manufacturer.toLowerCase() === mfg.name.toLowerCase() ||
      (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(em.manufacturer)) ||
      (mfg.slug === 'tata-motors' && /tata/i.test(em.manufacturer))
    ).map(em => ({
      ...em,
      canonicalUrl: `/models/${em.slug}`
    }));

    return send(res, 200, {
      ...mfg,
      canonicalUrl: `/manufacturers/${mfg.slug}`,
      disclaimer: 'Independent editorial profile. Not an official manufacturer partnership or endorsement.',
      models: productModels,
      relatedArticles
    });
  }

  // Equipment & Model Directory API (Search & filter by manufacturer, equipmentType, model, country, category)
  if (req.method === 'GET' && pathname === '/api/models') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim().slice(0, 100);
    const manufacturer = (url.searchParams.get('manufacturer') || '').toLowerCase().trim();
    const equipmentType = (url.searchParams.get('equipmentType') || '').toLowerCase().trim();
    const category = (url.searchParams.get('category') || '').toLowerCase().trim();
    const country = (url.searchParams.get('country') || '').toLowerCase().trim();
    const modelFilter = (url.searchParams.get('model') || '').toLowerCase().trim();

    const catalog = store.getCatalogSummary();
    const allModels = (catalog.equipmentModels || []).filter(em =>
      !['all-manufacturers', 'various'].includes(String(em.manufacturerSlug || '').toLowerCase()) &&
      !['All Manufacturers', 'Various'].includes(em.manufacturer) &&
      em.slug !== 'bull-machines-full-lineup'
    );

    const filtered = allModels.filter(em => {
      if (manufacturer && em.manufacturer.toLowerCase() !== manufacturer && em.manufacturerSlug !== manufacturer) {
        return false;
      }
      if (equipmentType && !em.equipmentType.toLowerCase().includes(equipmentType)) {
        return false;
      }
      if (category && !(em.category || '').toLowerCase().includes(category) && !em.equipmentType.toLowerCase().includes(category)) {
        return false;
      }
      if (country && (em.country || '').toLowerCase() !== country) {
        return false;
      }
      if (modelFilter && !em.name.toLowerCase().includes(modelFilter) && !em.slug.includes(modelFilter)) {
        return false;
      }
      if (q) {
        const hay = [
          em.name,
          em.manufacturer,
          em.equipmentType,
          em.category,
          em.country,
          em.powerType,
          em.summary,
          ...(em.applications || []),
          ...(em.features || []),
          ...Object.entries(em.specs || {}).map(([k, v]) => `${k} ${v}`)
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).map(em => ({
      ...em,
      canonicalUrl: `/models/${em.slug}`,
      manufacturerUrl: `/manufacturers/${em.manufacturerSlug || models.makeSlug(em.manufacturer, 80)}`
    }));

    return send(res, 200, {
      disclaimer: 'Specifications are reference summaries from official OEM documentation. Never rely on unverified figures for lift planning or procurement; consult the official manufacturer datasheet.',
      total: filtered.length,
      models: filtered
    });
  }

  const modelMatch = pathname.match(/^\/api\/models\/([a-z0-9-_]+)$/i);
  if (req.method === 'GET' && modelMatch) {
    const targetSlug = modelMatch[1].toLowerCase();
    const catalog = store.getCatalogSummary();
    const allModels = catalog.equipmentModels || [];
    const em = allModels.find(m => m.slug === targetSlug || m.id === `mdl-${targetSlug}`);
    if (!em) {
      return send(res, 404, { error: 'Equipment model profile not found' });
    }

    const mfg = (catalog.manufacturers || []).find(m =>
      m.slug === em.manufacturerSlug || m.name.toLowerCase() === em.manufacturer.toLowerCase()
    ) || null;

    // Resolve competing models where reliable data exists in our catalog
    const competingModels = (em.competingModels || [])
      .map(compSlug => allModels.find(m => m.slug === compSlug))
      .filter(Boolean)
      .map(comp => ({
        name: comp.name,
        slug: comp.slug,
        manufacturer: comp.manufacturer,
        manufacturerSlug: comp.manufacturerSlug,
        equipmentType: comp.equipmentType,
        category: comp.category,
        powerType: comp.powerType,
        country: comp.country,
        canonicalUrl: `/models/${comp.slug}`
      }));

    // Related published articles matching this model, manufacturer, or equipmentType
    const articles = readArticles().filter(a => a.status === 'published');
    const relatedArticles = articles
      .filter(a =>
        (a.model && a.model.toLowerCase() === em.name.toLowerCase()) ||
        (a.manufacturer && a.manufacturer.toLowerCase() === em.manufacturer.toLowerCase()) ||
        (a.equipmentType && em.equipmentType && a.equipmentType.toLowerCase() === em.equipmentType.toLowerCase()) ||
        (a.category && em.category && a.category.toLowerCase() === em.category.toLowerCase())
      )
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 6)
      .map(publicArticle);

    return send(res, 200, {
      ...em,
      canonicalUrl: `/models/${em.slug}`,
      manufacturerProfile: mfg ? {
        name: mfg.name,
        slug: mfg.slug,
        headquarters: mfg.headquarters,
        country: mfg.country,
        website: mfg.website,
        canonicalUrl: `/manufacturers/${mfg.slug}`
      } : null,
      competingModelsResolved: competingModels,
      relatedArticles
    });
  }

  if (req.method === 'POST' && pathname === '/api/analytics/view') {
    const body = await readBody(req);
    seoLib.recordTelemetryEvent(store, body);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/analytics/config') {
    return send(res, 200, seoLib.getAnalyticsAndSearchConfig(store));
  }

  if (req.method === 'GET' && pathname === '/api/newsletter') {
    const distCfg = distribution.getDistributionConfig(store);
    const allSubs = readNewsletter();
    return send(res, 200, {
      count: allSubs.filter(x => x.status !== 'unsubscribed').length,
      verifiedCount: allSubs.filter(x => x.status !== 'unsubscribed' && x.verified).length,
      providerConnected: distCfg.emailService.connected,
      emailService: distCfg.emailService,
      interestOptions: distCfg.interestOptions,
      privacyCompliance: distCfg.privacyCompliance
    });
  }

  if (req.method === 'POST' && pathname === '/api/newsletter') {
    const ip = req.socket?.remoteAddress || 'local';
    if (!checkPublicPostRateLimit(ip, 'newsletter', 30)) {
      return send(res, 429, { error: 'Too many subscription requests. Please wait a few minutes and try again.' });
    }
    const body = await readBody(req);
    const rows = readNewsletter();
    const existing = rows.find(x => x.email === String(body.email || '').trim().toLowerCase());
    const sub = models.createNewsletterModel(
      {
        ...body,
        verified: body.verified !== undefined ? Boolean(body.verified) : (existing?.verified ?? false)
      },
      existing || {}
    );
    const existingIdx = rows.findIndex(x => x.email === sub.email);
    if (existingIdx >= 0) {
      rows[existingIdx] = {
        ...rows[existingIdx],
        ...sub,
        status: 'active',
        updatedAt: new Date().toISOString()
      };
    } else {
      rows.push(sub);
    }
    writeNewsletter(rows);
    seoLib.recordTelemetryEvent(store, { type: 'newsletter_conversion', slug: sub.segment });

    const distCfg = distribution.getDistributionConfig(store);
    const reqOrigin = req.headers.host ? `http://${req.headers.host}` : SITE_URL;
    const verificationUrl = `${reqOrigin}/api/newsletter/verify?token=${encodeURIComponent(sub.verificationToken)}&email=${encodeURIComponent(sub.email)}`;
    const unsubscribeUrl = `${reqOrigin}/api/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}&email=${encodeURIComponent(sub.email)}`;

    distribution.appendDistributionLog(store, {
      kind: 'verification_email',
      channel: distCfg.emailService.provider,
      targetId: sub.id,
      targetTitle: `Confirm MachineWire subscription (${sub.email})`,
      fingerprint: `verify:${sub.id}`,
      status: distCfg.emailService.connected ? 'delivered' : 'provider_not_configured',
      recipientCount: 1,
      actor: 'visitor',
      details: distCfg.emailService.connected
        ? `Sent double opt-in verification link to ${sub.email}.`
        : `Email provider not yet connected; saved subscriber ${sub.email} with local verification & unsubscribe links.`
    });

    return send(res, 201, {
      ok: true,
      count: rows.filter(x => x.status !== 'unsubscribed').length,
      providerConnected: distCfg.emailService.connected,
      providerNotice: distCfg.emailService.publicNotice,
      subscriber: {
        id: sub.id,
        email: sub.email,
        interests: sub.interests,
        frequency: sub.frequency,
        status: sub.status,
        verified: sub.verified,
        consent: sub.consent,
        consentTimestamp: sub.consentTimestamp
      },
      verificationUrl,
      unsubscribeUrl
    });
  }

  if (req.method === 'GET' && pathname === '/api/newsletter/verify') {
    const token = String(url.searchParams.get('token') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    const format = String(url.searchParams.get('format') || '').toLowerCase();
    const rows = readNewsletter();
    const idx = rows.findIndex(x =>
      (token && x.verificationToken === token) ||
      (email && x.email === email && (!token || x.verificationToken === token))
    );
    if (idx < 0) {
      if (format === 'json' || (req.headers.accept || '').includes('application/json')) {
        return send(res, 404, { error: 'Invalid or expired verification link.' });
      }
      return sendText(res, 404, '<h1>Verification link not found</h1><p><a href="/">Return to MACHINEWIRE</a></p>', 'text/html; charset=utf-8');
    }
    rows[idx].verified = true;
    rows[idx].verifiedAt = new Date().toISOString();
    rows[idx].status = 'active';
    rows[idx].updatedAt = rows[idx].verifiedAt;
    writeNewsletter(rows);

    if (format === 'json' || (req.headers.accept || '').includes('application/json')) {
      return send(res, 200, {
        ok: true,
        verified: true,
        email: rows[idx].email,
        verifiedAt: rows[idx].verifiedAt,
        interests: rows[idx].interests
      });
    }
    return sendText(
      res,
      200,
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Subscription Verified | MACHINEWIRE</title><link rel="stylesheet" href="/styles.css"></head><body style="padding:48px 24px;max-width:640px;margin:0 auto;"><h1>Email Verified ✓</h1><p>Your subscription for <strong>${escapeXml(rows[idx].email)}</strong> is now verified for MachineWire industry briefings (${escapeXml((rows[idx].interests || []).join(', '))}).</p><p><a class="button button-dark" href="/">Return to MACHINEWIRE</a></p></body></html>`,
      'text/html; charset=utf-8'
    );
  }

  if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/newsletter/unsubscribe') {
    const body = req.method === 'POST' ? await readBody(req).catch(() => ({})) : {};
    const token = String(url.searchParams.get('token') || body.token || '').trim();
    const email = String(url.searchParams.get('email') || body.email || '').trim().toLowerCase();
    const format = String(url.searchParams.get('format') || body.format || '').toLowerCase();
    const rows = readNewsletter();
    const idx = rows.findIndex(x =>
      (token && x.unsubscribeToken === token) ||
      (email && x.email === email)
    );
    if (idx < 0) {
      if (format === 'json' || req.method === 'POST' || (req.headers.accept || '').includes('application/json')) {
        return send(res, 404, { error: 'Subscriber not found for unsubscribe request.' });
      }
      return sendText(res, 404, '<h1>Subscriber not found</h1><p><a href="/">Return to MACHINEWIRE</a></p>', 'text/html; charset=utf-8');
    }
    rows[idx].status = 'unsubscribed';
    rows[idx].unsubscribedAt = new Date().toISOString();
    rows[idx].updatedAt = rows[idx].unsubscribedAt;
    writeNewsletter(rows);

    if (format === 'json' || req.method === 'POST' || (req.headers.accept || '').includes('application/json')) {
      return send(res, 200, {
        ok: true,
        status: 'unsubscribed',
        email: rows[idx].email,
        unsubscribedAt: rows[idx].unsubscribedAt
      });
    }
    return sendText(
      res,
      200,
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribed | MACHINEWIRE</title><link rel="stylesheet" href="/styles.css"></head><body style="padding:48px 24px;max-width:640px;margin:0 auto;"><h1>Unsubscribed ✓</h1><p><strong>${escapeXml(rows[idx].email)}</strong> has been unsubscribed from MachineWire briefings.</p><p><a class="button button-dark" href="/">Return to MACHINEWIRE</a></p></body></html>`,
      'text/html; charset=utf-8'
    );
  }

  if (req.method === 'POST' && pathname === '/api/submissions') {
    const ip = req.socket?.remoteAddress || 'local';
    if (!checkPublicPostRateLimit(ip, 'submissions', 25)) {
      return send(res, 429, { error: 'Too many tip submissions. Please wait a few minutes and try again.' });
    }
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const organization = String(body.organization || '').trim().slice(0, 120);
    const submissionType = ['press-release', 'news-tip', 'correction', 'event'].includes(body.submissionType) ? body.submissionType : 'news-tip';
    const subject = String(body.subject || '').trim().slice(0, 180);
    const sourceUrl = String(body.sourceUrl || '').trim().slice(0, 1500);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!subject || message.length < 15) {
      return send(res, 400, { error: 'Please include a subject and detailed message (at least 15 characters).' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return send(res, 400, { error: 'Please provide a valid contact email address.' });
    }
    if (!validHttpUrl(sourceUrl)) {
      return send(res, 400, { error: 'Source link must be a valid http or https URL.' });
    }
    const rows = readSubmissions();
    // Deduplicate identical subject + message submissions
    if (!rows.some(r => r.subject.toLowerCase() === subject.toLowerCase() && r.message === message)) {
      const item = {
        id: crypto.randomUUID(),
        name: name || 'Anonymous Tip',
        email,
        organization,
        submissionType,
        subject,
        sourceUrl,
        message,
        status: 'unread',
        createdAt: new Date().toISOString()
      };
      rows.unshift(item);
      writeSubmissions(rows);
    }
    return send(res, 201, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/articles') {
    const q = (url.searchParams.get('q') || '').toLowerCase().slice(0, 100);
    const category = url.searchParams.get('category') || '';
    const manufacturer = url.searchParams.get('manufacturer') || '';
    const equipment = url.searchParams.get('equipment') || '';
    const modelParam = url.searchParams.get('model') || '';
    const country = url.searchParams.get('country') || '';
    const region = url.searchParams.get('region') || '';
    const articleType = url.searchParams.get('articleType') || '';
    const tag = url.searchParams.get('tag') || '';

    let articles = readArticles().filter(a => a.status === 'published');
    if (q) {
      if (q.length >= 2) {
        try { seoLib.recordTelemetryEvent(store, { type: 'search', query: q }); } catch {}
      }
      articles = articles.filter(a =>
        [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (category) {
      articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    if (manufacturer) {
      articles = articles.filter(a => (a.manufacturer || '').toLowerCase().includes(manufacturer.toLowerCase()));
    }
    if (equipment) {
      articles = articles.filter(a => (a.equipmentType || '').toLowerCase().includes(equipment.toLowerCase()));
    }
    if (modelParam) {
      articles = articles.filter(a => (a.model || '').toLowerCase().includes(modelParam.toLowerCase()));
    }
    if (country) {
      articles = articles.filter(a =>
        (a.country || '').toLowerCase() === country.toLowerCase() ||
        (a.region || '').toLowerCase() === country.toLowerCase()
      );
    }
    if (region) {
      articles = articles.filter(a => (a.region || '').toLowerCase() === region.toLowerCase());
    }
    if (articleType) {
      articles = articles.filter(a => (a.articleType || 'news') === articleType);
    }
    if (tag) {
      articles = articles.filter(a => (a.tags || []).some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    articles.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return send(res, 200, articles.map(publicArticle));
  }

  if (req.method === 'GET' && pathname.startsWith('/api/articles/')) {
    const slug = pathname.slice('/api/articles/'.length);
    const article = readArticles().find(a => a.slug === slug && a.status === 'published');
    if (!article) return send(res, 404, { error: 'Article not found' });
    const internalLinks = seoLib.buildInternalLinkGraphForArticle(article, store);
    const shareLinks = distribution.buildShareableLinksForArticle(article, store);
    return send(res, 200, {
      ...publicArticle(article),
      internalLinks,
      shareLinks
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    if (!ADMIN_PASSWORD || !SESSION_SECRET) {
      return send(res, 503, { error: 'Admin login is not configured. Copy .env.example to .env and set ADMIN_PASSWORD and SESSION_SECRET.' });
    }
    const ip = req.socket?.remoteAddress || 'local';
    if (!checkLoginRateLimit(ip)) {
      return send(res, 429, { error: 'Too many login attempts. Please wait 15 minutes before trying again.' });
    }
    const body = await readBody(req);
    const username = String(body.username || 'editorial-admin').trim().toLowerCase();
    const rawUsers = store.readJson(store.files.adminUsers, []);
    const matchedUser = rawUsers.find(u => String(u.username || '').toLowerCase() === username);

    let authenticated = false;
    let role = 'super_admin';

    if (matchedUser && matchedUser.active === false) {
      return send(res, 403, { error: 'This admin account has been deactivated.' });
    }

    if (matchedUser && matchedUser.passwordHash) {
      authenticated = models.verifyPassword(body.password || '', matchedUser.passwordHash) ||
        (username === 'editorial-admin' && safeEqual(body.password || '', ADMIN_PASSWORD));
      role = matchedUser.role || 'managing_editor';
    } else if (safeEqual(body.password || '', ADMIN_PASSWORD)) {
      authenticated = true;
      role = matchedUser?.role || 'super_admin';
    }

    if (!authenticated) {
      recordFailedLogin(ip);
      store.appendAuditLog({
        actor: username,
        role: 'unauthenticated',
        action: 'auth.login_failed',
        target: ip,
        level: 'warn',
        details: `Failed sign-in attempt for username "${username}".`
      });
      return send(res, 401, { error: 'Incorrect username or password.' });
    }

    loginAttempts.delete(ip);
    const id = crypto.randomBytes(24).toString('hex');
    const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
    const token = `${id}.${expiry}.${sign(`${id}.${expiry}`)}`;
    sessions.set(id, { username, role, loginAt: new Date().toISOString() });

    // Record lastLoginAt and ensure scrypt passwordHash is stored
    try {
      store.upsertCatalogEntity('adminUsers', {
        ...(matchedUser || {}),
        username,
        email: matchedUser?.email || `${username}@machinewire.local`,
        role,
        passwordHash: matchedUser?.passwordHash || models.hashPassword(body.password),
        lastLoginAt: new Date().toISOString()
      });
    } catch {}

    store.appendAuditLog({
      actor: username,
      role,
      action: 'auth.login',
      target: username,
      level: 'info',
      details: `Signed in with role "${role}".`
    });

    return send(res, 200, { ok: true, username, role }, {
      'Set-Cookie': `bm_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const sess = getAdminSession(req);
    const token = cookieValue(req, 'bm_session');
    if (token) sessions.delete(token.split('.')[0]);
    if (sess) {
      store.appendAuditLog({
        actor: sess.username,
        role: sess.role,
        action: 'auth.logout',
        target: sess.username,
        level: 'info',
        details: 'Admin session signed out.'
      });
    }
    return send(res, 200, { ok: true }, {
      'Set-Cookie': 'bm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  if (pathname.startsWith('/api/admin/')) {
    const session = getAdminSession(req);
    if (!session) return send(res, 401, { error: 'Please log in to the admin panel.' });

    if (req.method === 'GET' && pathname === '/api/admin/session') {
      return send(res, 200, {
        ok: true,
        username: session.username,
        role: session.role,
        loginAt: session.loginAt,
        permissions: {
          canCreateDraft: hasMinRole(session, 'author'),
          canReview: hasMinRole(session, 'reviewer'),
          canPublish: hasMinRole(session, 'managing_editor'),
          canDelete: hasMinRole(session, 'managing_editor'),
          canManageUsersAndSettings: hasMinRole(session, 'super_admin')
        }
      });
    }

    if (req.method === 'GET' && pathname === '/api/admin/articles') {
      return send(res, 200, readArticles().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    }

    if (req.method === 'POST' && pathname === '/api/admin/articles/check-duplicate') {
      const body = await readBody(req);
      const excludeId = String(body.excludeId || '');
      const checkTitle = String(body.title || '').trim().toLowerCase();
      const checkSlug = makeSlug(body.slug || body.title || '');
      const checkSource = String(body.sourceUrl || '').trim().toLowerCase();
      const all = readArticles().filter(a => a.id !== excludeId);

      const matches = all.filter(a =>
        (checkTitle && a.title.toLowerCase() === checkTitle) ||
        (checkSlug && a.slug === checkSlug) ||
        (checkSource && (a.sourceUrl || '').toLowerCase() === checkSource)
      ).map(a => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        reason: checkTitle && a.title.toLowerCase() === checkTitle
          ? 'Exact headline match'
          : (checkSlug && a.slug === checkSlug ? 'Identical URL slug' : 'Shared primary source URL')
      }));

      return send(res, 200, { hasDuplicates: matches.length > 0, matches });
    }

    if (req.method === 'GET' && pathname === '/api/admin/catalog') {
      return send(res, 200, store.getCatalogSummary());
    }

    const catMatch = pathname.match(/^\/api\/admin\/catalog\/([a-zA-Z]+)$/);
    if (catMatch && req.method === 'POST') {
      const entityType = catMatch[1];
      if (entityType === 'adminUsers' && !hasMinRole(session, 'super_admin')) {
        return send(res, 403, { error: 'Only super_admin can create or modify admin user accounts.' });
      }
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Your role does not have permission to modify catalog records.' });
      }
      const payload = await readBody(req);
      const saved = store.upsertCatalogEntity(entityType, payload);
      const { passwordHash, ...safeSaved } = saved;
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: `catalog.upsert.${entityType}`,
        target: safeSaved.name || safeSaved.username || safeSaved.url || safeSaved.id,
        level: 'info',
        details: `Upserted record in ${entityType}.`
      });
      return send(res, 201, safeSaved);
    }

    const catDelMatch = pathname.match(/^\/api\/admin\/catalog\/([a-zA-Z]+)\/([a-z0-9-_@.:/]+)$/i);
    if (catDelMatch && req.method === 'DELETE') {
      const entityType = catDelMatch[1];
      const targetKey = decodeURIComponent(catDelMatch[2]);
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Only managing_editor or super_admin can delete catalog records.' });
      }
      const removed = store.deleteCatalogEntity(entityType, targetKey);
      if (!removed) return send(res, 404, { error: 'Catalog record not found' });
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: `catalog.delete.${entityType}`,
        target: targetKey,
        level: 'warn',
        details: `Deleted record "${targetKey}" from ${entityType}.`
      });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/api/admin/settings') {
      return send(res, 200, store.getSettings());
    }

    if (req.method === 'PATCH' && pathname === '/api/admin/settings') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Only managing_editor or super_admin can update website & SEO settings.' });
      }
      const body = await readBody(req);
      const updated = store.updateSettings(body);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'settings.update',
        target: 'settings.json',
        level: 'info',
        details: `Updated website & global SEO settings (${updated.siteName}).`
      });
      return send(res, 200, updated);
    }

    if (req.method === 'GET' && pathname === '/api/admin/logs') {
      const jobs = store.getJobs();
      const auditLogs = store.getAuditLogs(100);
      const articles = readArticles();
      const validationWarnings = articles
        .filter(a => a.status === 'published' && (!a.sourceUrl || !a.imageCredit))
        .map(a => ({
          articleId: a.id,
          title: a.title,
          slug: a.slug,
          issue: !a.sourceUrl ? 'Missing primary source URL' : 'Missing image credit attribution'
        }));
      return send(res, 200, { jobs, auditLogs, validationWarnings });
    }

    if (req.method === 'POST' && pathname === '/api/admin/jobs/run') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Insufficient role to trigger collection/indexing jobs.' });
      }
      const body = await readBody(req);
      const jobId = String(body.jobId || 'job-catalog-entity-sync');

      const execRes = await workflow.executeJobWithLockAndRetry(
        store,
        jobId,
        async () => {
          if (body.simulateFailure) {
            throw new Error(String(body.simulateFailure));
          }
          if (jobId === 'job-scheduled-publisher') {
            const publishedDue = workflow.processDueScheduledArticles(store, session.username);
            const r = store.runJob(jobId, session.username);
            return { ...r, itemsProcessed: publishedDue.length + (r.itemsProcessed || 0) };
          }
          return store.runJob(jobId, session.username);
        },
        {
          actor: session.username,
          maxRetries: body.maxRetries ? Number(body.maxRetries) : undefined,
          retryDelayMs: body.retryDelayMs !== undefined ? Number(body.retryDelayMs) : undefined,
          holdLockForTest: Boolean(body.holdLockForTest)
        }
      );

      if (execRes.duplicatePrevented) {
        return send(res, 409, { error: execRes.error, duplicatePrevented: true, jobId });
      }
      if (!execRes.ok) {
        return send(res, 500, { error: execRes.error, attempts: execRes.attempts, failureAlert: execRes.failureAlert });
      }
      return send(res, 200, { ...execRes.result, attempts: execRes.attempts, lockId: execRes.lockId });
    }

    // News Collection Engine Endpoints:
    // 1. Manual "Check Source Now" for a single approved source (supports mode="live" or mode="test")
    const checkSourceMatch = pathname.match(/^\/api\/admin\/sources\/([a-z0-9-_]+)\/check$/i);
    if (checkSourceMatch && req.method === 'POST') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to poll news sources.' });
      }
      const sourceId = checkSourceMatch[1];
      const body = await readBody(req);
      const mode = body.mode === 'test' ? 'test' : 'live';
      const result = await collector.checkSourceNow(store, sourceId, {
        mode,
        actor: session.username,
        sampleXml: body.sampleXml
      });
      return send(res, 200, result);
    }

    // 2. Check all enabled RSS/Atom sources that require no API key (or have configured keys)
    if (req.method === 'POST' && pathname === '/api/admin/sources/check-all') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to run collection.' });
      }
      const body = await readBody(req);
      const mode = body.mode === 'test' ? 'test' : 'live';
      const allSources = store.readJson(store.files.sources, []);
      const runnable = allSources.filter(s => s.enabled !== false && (mode === 'test' || s.feedUrl || s.apiEndpoint));
      const results = [];
      for (const s of runnable) {
        const resItem = await collector.checkSourceNow(store, s.id, { mode, actor: session.username });
        results.push(resItem);
      }
      return send(res, 200, {
        ok: true,
        mode,
        sourcesChecked: results.length,
        totalDiscovered: results.reduce((sum, r) => sum + (r.discoveredCount || 0), 0),
        totalInserted: results.reduce((sum, r) => sum + (r.insertedCount || 0), 0),
        totalDuplicates: results.reduce((sum, r) => sum + (r.duplicateCount || 0), 0),
        results
      });
    }

    // 3. List, promote-to-draft, or dismiss collected items (kept strictly separate from published articles)
    if (req.method === 'GET' && pathname === '/api/admin/collected') {
      const items = store.readJson(store.files.collectedItems, []);
      return send(res, 200, items);
    }

    const colPromoteMatch = pathname.match(/^\/api\/admin\/collected\/([a-z0-9-_]+)\/promote$/i);
    if (colPromoteMatch && req.method === 'POST') {
      const items = store.readJson(store.files.collectedItems, []);
      const idx = items.findIndex(x => x.id === colPromoteMatch[1]);
      if (idx < 0) return send(res, 404, { error: 'Collected item not found' });
      const col = items[idx];

      const articles = readArticles();
      const { slugInput, ...draftArticle } = validateArticle({
        title: col.title,
        summary: col.excerpt.slice(0, 320),
        excerpt: col.excerpt.slice(0, 320),
        body: `${col.excerpt}\n\n[Editorial Verification Required: Verify facts, regional specifications, and wording directly against the original source (${col.canonicalUrl}) before publishing.]`,
        category: col.category || 'Industry News',
        manufacturer: col.manufacturer || 'Various',
        country: col.country || 'Global',
        region: col.region || 'Global',
        sourceUrl: col.canonicalUrl,
        sourceUrls: [col.canonicalUrl],
        author: session.username || 'Editorial Desk',
        status: 'draft',
        revisionNote: `Promoted from collected feed item (${col.sourceName})`
      }, null, {
        actor: session.username,
        note: `Promoted from collected feed item (${col.sourceName})`
      });

      let baseSlug = slugInput || makeSlug(draftArticle.title) || 'collected-draft';
      let candidate = baseSlug;
      let n = 2;
      while (articles.some(a => a.slug === candidate)) candidate = `${baseSlug}-${n++}`;
      draftArticle.slug = candidate;

      articles.push(draftArticle);
      writeArticles(articles);
      store.syncEntitiesFromArticle(draftArticle);

      items[idx].reviewStatus = 'promoted_to_draft';
      items[idx].promotedArticleId = draftArticle.id;
      store.writeJson(store.files.collectedItems, items);

      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'collector.promote_to_draft',
        target: `${draftArticle.title} (${draftArticle.id})`,
        level: 'info',
        details: `Promoted collected item from "${col.sourceName}" into a draft article (not published).`
      });

      return send(res, 201, { ok: true, article: draftArticle, collectedItem: items[idx] });
    }

    const colItemMatch = pathname.match(/^\/api\/admin\/collected\/([a-z0-9-_]+)$/i);
    if (colItemMatch && req.method === 'DELETE') {
      const items = store.readJson(store.files.collectedItems, []);
      const next = items.filter(x => x.id !== colItemMatch[1]);
      store.writeJson(store.files.collectedItems, next);
      return send(res, 200, { ok: true });
    }

    // Configurable AI-Assisted Newsroom Endpoints:
    // 1. Get provider configuration, 6 specialist roles, API cost/limitation disclosures, and recent runs (never exposes AI_API_KEY)
    if (req.method === 'GET' && pathname === '/api/admin/newsroom/config') {
      const cfg = newsroom.getNewsroomConfig();
      const recentRuns = store.readJson(store.files.newsroomRuns, []).slice(0, 20);
      return send(res, 200, {
        ...cfg,
        recentRuns
      });
    }

    // 2. Run the 8-step / 6-specialist-role newsroom workflow on a collected story or raw source evidence and send to Admin Review Queue
    if (req.method === 'POST' && pathname === '/api/admin/newsroom/analyze') {
      if (!hasMinRole(session, 'author')) {
        return send(res, 403, { error: 'Insufficient role to run the AI-assisted newsroom workflow.' });
      }
      const body = await readBody(req);
      const result = await newsroom.runNewsroomWorkflow(store, body, {
        actor: session.username,
        sendToReviewQueue: body.sendToReviewQueue !== false
      });
      return send(res, 201, result);
    }

    // 8-Stage Editorial Workflow, Publication Gates, Rollback/Unpublish, Failure Alerts & Publication Ledger:
    if (req.method === 'GET' && pathname === '/api/admin/workflow') {
      return send(res, 200, workflow.getEditorialPipelineSummary(store));
    }

    if (req.method === 'PATCH' && pathname === '/api/admin/workflow/config') {
      if (!hasMinRole(session, 'super_admin')) {
        return send(res, 403, { error: 'Only super_admin can modify editorial workflow & automatic publication settings.' });
      }
      const body = await readBody(req);
      const updated = workflow.saveWorkflowConfig(store, body, session.username);
      return send(res, 200, updated);
    }

    if (req.method === 'POST' && pathname === '/api/admin/workflow/test-rules') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Requires managing_editor or super_admin role to run the publication rule verification suite.' });
      }
      const suiteRes = workflow.runPublicationRulesTestSuite(store, session.username);
      return send(res, 200, suiteRes);
    }

    const wfEvalMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/evaluate-gates$/i);
    if (wfEvalMatch && req.method === 'GET') {
      const targetArt = readArticles().find(a => a.id === wfEvalMatch[1]);
      if (!targetArt) return send(res, 404, { error: 'Article not found' });
      return send(res, 200, workflow.evaluateStoryPublicationGates(targetArt, store));
    }

    const wfTransMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/transition$/i);
    if (wfTransMatch && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '');
      const result = workflow.transitionArticleStage(store, wfTransMatch[1], action, body, session);
      return send(res, 200, result);
    }

    const ackAlertMatch = pathname.match(/^\/api\/admin\/workflow\/alerts\/([a-z0-9-_]+)\/ack$/i);
    if (ackAlertMatch && req.method === 'POST') {
      const alerts = store.readJson(store.files.failureAlerts, []);
      const idx = alerts.findIndex(a => a.id === ackAlertMatch[1]);
      if (idx < 0) return send(res, 404, { error: 'Failure alert not found' });
      alerts[idx].acknowledged = true;
      alerts[idx].acknowledgedBy = session.username;
      alerts[idx].acknowledgedAt = new Date().toISOString();
      store.writeJson(store.files.failureAlerts, alerts);
      return send(res, 200, alerts[idx]);
    }

    if (req.method === 'GET' && pathname === '/api/admin/seo-analytics') {
      return send(res, 200, seoLib.getContentPrioritizationReport(store));
    }

    if (req.method === 'GET' && pathname === '/api/admin/backups') {
      return send(res, 200, store.listBackups());
    }

    if (req.method === 'POST' && pathname === '/api/admin/backups') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Only managing_editor or super_admin can create system backups.' });
      }
      const body = await readBody(req);
      const reason = String(body.reason || 'manual-admin-snapshot').slice(0, 80);
      const backup = store.createBackup(reason);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'backup.create',
        target: backup.id,
        level: 'info',
        details: `Created backup snapshot (${reason}).`
      });
      return send(res, 201, backup);
    }

    if (req.method === 'GET' && pathname === '/api/admin/newsletter') {
      return send(res, 200, readNewsletter());
    }

    const newsMatch = pathname.match(/^\/api\/admin\/newsletter\/([a-z0-9-_]+)$/i);
    if (newsMatch && req.method === 'PATCH') {
      const rows = readNewsletter();
      const idx = rows.findIndex(x => x.id === newsMatch[1]);
      if (idx < 0) return send(res, 404, { error: 'Subscriber not found' });
      const body = await readBody(req);
      if (body.status && ['pending_verification', 'active', 'unsubscribed', 'bounced'].includes(body.status)) {
        rows[idx].status = body.status;
      }
      if (body.verified !== undefined) {
        rows[idx].verified = Boolean(body.verified);
        if (rows[idx].verified && !rows[idx].verifiedAt) rows[idx].verifiedAt = new Date().toISOString();
      }
      if (Array.isArray(body.interests)) {
        rows[idx].interests = body.interests.filter(x => models.VALID_NEWSLETTER_INTERESTS.includes(x));
      }
      if (body.frequency && ['daily', 'weekly'].includes(body.frequency)) {
        rows[idx].frequency = body.frequency;
      }
      if (body.segment) rows[idx].segment = String(body.segment).trim().slice(0, 80);
      rows[idx].updatedAt = new Date().toISOString();
      writeNewsletter(rows);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'newsletter.update',
        target: rows[idx].email,
        level: 'info',
        details: `Updated subscriber status to "${rows[idx].status}" (${rows[idx].segment}).`
      });
      return send(res, 200, rows[idx]);
    }

    if (newsMatch && req.method === 'DELETE') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Only managing_editor or super_admin can delete subscribers.' });
      }
      const rows = readNewsletter();
      const target = rows.find(x => x.id === newsMatch[1]);
      if (!target) return send(res, 404, { error: 'Subscriber not found' });
      try { store.createBackup(`pre-delete-subscriber-${target.id}`); } catch {}
      writeNewsletter(rows.filter(x => x.id !== newsMatch[1]));
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'newsletter.delete',
        target: target.email,
        level: 'warn',
        details: `Removed subscriber ${target.email}.`
      });
      return send(res, 200, { ok: true });
    }

    // Newsletter Templates & Content-Distribution Endpoints
    if (req.method === 'GET' && pathname === '/api/admin/distribution/config') {
      return send(res, 200, {
        ...distribution.getDistributionConfig(store),
        logs: store.readJson(store.files.distributionLogs, []).slice(0, 50)
      });
    }

    if (req.method === 'GET' && pathname === '/api/admin/distribution/template') {
      const editionType = url.searchParams.get('edition') === 'daily' ? 'daily' : 'weekly';
      const interestsParam = url.searchParams.get('interests') || '';
      const interests = interestsParam
        ? interestsParam.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      return send(res, 200, distribution.generateNewsletterTemplate(store, { editionType, interests }));
    }

    // AI SEO & Newsroom Endpoints
    if (req.method === 'GET' && pathname === '/api/admin/ai-seo/dashboard') {
      const dash = aiSeo.getAiOperationsDashboard(store);
      return send(res, 200, dash);
    }

    if (req.method === 'GET' && pathname === '/api/admin/ai-seo/tasks') {
      const tasks = store.getSeoTasks();
      const roleFilter = url.searchParams.get('role');
      const statusFilter = url.searchParams.get('status');
      let filtered = tasks;
      if (roleFilter) filtered = filtered.filter(t => t.assignedRole === roleFilter);
      if (statusFilter) filtered = filtered.filter(t => t.status === statusFilter);
      return send(res, 200, filtered);
    }

    if (req.method === 'POST' && pathname === '/api/admin/ai-seo/tasks') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Requires reviewer or higher role to create SEO tasks.' });
      }
      const body = await readBody(req);
      try {
        const newTask = aiSeo.createSeoTaskModel(body);
        store.saveSeoTask(newTask);
        store.appendAuditLog({
          actor: session.username,
          role: session.role,
          action: 'ai_seo.task_created',
          target: newTask.title,
          level: 'info',
          details: `Role: ${newTask.assignedRole}, Category: ${newTask.category}, Priority: ${newTask.priorityScore}`
        });
        return send(res, 201, newTask);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    const seoTaskMatch = pathname.match(/^\/api\/admin\/ai-seo\/tasks\/([a-z0-9-_]+)$/i);
    if (seoTaskMatch && req.method === 'PATCH') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Requires reviewer or higher role to update SEO tasks.' });
      }
      const taskId = seoTaskMatch[1];
      const tasks = store.getSeoTasks();
      const existing = tasks.find(t => t.id === taskId);
      if (!existing) return send(res, 404, { error: 'SEO task not found.' });

      const body = await readBody(req);
      const updated = aiSeo.createSeoTaskModel(body, existing);
      store.saveSeoTask(updated);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'ai_seo.task_updated',
        target: updated.title,
        level: 'info',
        details: `Status: ${updated.status}, Role: ${updated.assignedRole}`
      });
      return send(res, 200, updated);
    }

    if (seoTaskMatch && req.method === 'DELETE') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Requires managing_editor or super_admin role to delete SEO tasks.' });
      }
      const taskId = seoTaskMatch[1];
      const ok = store.deleteSeoTask(taskId);
      if (!ok) return send(res, 404, { error: 'SEO task not found.' });
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'ai_seo.task_deleted',
        target: taskId,
        level: 'info',
        details: 'Deleted SEO task'
      });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/admin/ai-seo/audit') {
      const audit = aiSeo.runTechnicalSeoAudit(store);
      const issueCount = (audit.issuesFound || []).length;
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'ai_seo.audit_run',
        target: 'technical_audit',
        level: issueCount ? 'warn' : 'info',
        details: `Technical SEO score: ${audit.overallHealthScore}/100. Issues detected: ${issueCount}`
      });
      return send(res, 200, audit);
    }

    if (req.method === 'POST' && pathname === '/api/admin/distribution/send-newsletter') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Requires managing_editor or super_admin role to dispatch newsletters.' });
      }
      const body = await readBody(req);
      const resDispatch = await distribution.sendNewsletterEdition(store, {
        editionType: body.editionType || 'weekly',
        interests: body.interests || [],
        simulateDeliveryError: body.simulateDeliveryError || '',
        actor: session.username
      });
      const statusHttp = resDispatch.duplicatePrevented ? 409 : 200;
      return send(res, statusHttp, resDispatch);
    }

    if (req.method === 'POST' && pathname === '/api/admin/distribution/social') {
      if (!hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to distribute articles.' });
      }
      const body = await readBody(req);
      const resSocial = await distribution.distributeArticleToSocial(store, {
        articleId: body.articleId,
        channel: body.channel || 'linkedin',
        simulateDeliveryError: body.simulateDeliveryError || '',
        actor: session.username
      });
      const statusHttp = resSocial.duplicatePrevented ? 409 : 200;
      return send(res, statusHttp, resSocial);
    }

    if (req.method === 'GET' && pathname === '/api/admin/submissions') {
      return send(res, 200, readSubmissions());
    }

    const subMatch = pathname.match(/^\/api\/admin\/submissions\/([a-z0-9-_]+)$/i);
    if (subMatch && req.method === 'PATCH') {
      const rows = readSubmissions();
      const idx = rows.findIndex(x => x.id === subMatch[1]);
      if (idx < 0) return send(res, 404, { error: 'Submission not found' });
      const body = await readBody(req);
      if (body.status && ['unread', 'reviewed', 'archived'].includes(body.status)) {
        rows[idx].status = body.status;
      }
      writeSubmissions(rows);
      return send(res, 200, rows[idx]);
    }
    if (subMatch && req.method === 'DELETE') {
      const rows = readSubmissions();
      const next = rows.filter(x => x.id !== subMatch[1]);
      writeSubmissions(next);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/admin/articles') {
      const rawBody = await readBody(req);
      const requestedStatus = rawBody.status || 'draft';

      if (['published', 'scheduled', 'archived'].includes(requestedStatus) && !hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: `Your role (${session.role}) can create drafts or submit for review, but only managing_editor or super_admin can set status to "${requestedStatus}".` });
      }
      if (requestedStatus === 'rejected' && !hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: `Your role (${session.role}) cannot reject articles.` });
      }

      const articles = readArticles();

      // Prevent duplicate article creation by exact case-insensitive title match unless allowDuplicateTitle is set
      const cleanTitle = String(rawBody.title || '').trim().toLowerCase();
      if (!rawBody.allowDuplicateTitle && articles.some(a => a.title.toLowerCase() === cleanTitle)) {
        store.appendAuditLog({
          actor: session.username,
          role: session.role,
          action: 'article.duplicate_blocked',
          target: rawBody.title || 'Untitled',
          level: 'warn',
          details: 'Blocked duplicate headline creation.'
        });
        return send(res, 409, { error: 'An article with this exact headline already exists. Edit the existing article or modify the headline.' });
      }

      const { slugInput, ...article } = validateArticle(rawBody, null, {
        actor: session.username || rawBody.author || 'Editorial Desk',
        note: rawBody.revisionNote || ''
      });

      if (article.featured) {
        for (const a of articles) a.featured = false;
      }

      let baseSlug = slugInput || makeSlug(article.title) || 'news-story';
      let candidate = baseSlug;
      let n = 2;
      while (articles.some(a => a.slug === candidate)) candidate = `${baseSlug}-${n++}`;
      article.slug = candidate;

      articles.push(article);
      writeArticles(articles);
      store.syncEntitiesFromArticle(article);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: `article.create.${article.status}`,
        target: `${article.title} (${article.slug})`,
        level: 'info',
        details: `Created article with status "${article.status}".`
      });
      return send(res, 201, article);
    }

    // Match any safe article ID (supports both custom string IDs like "welcome-to-the-magazine" and UUIDs)
    const match = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)$/i);
    if (match && req.method === 'PATCH') {
      const articles = readArticles();
      const index = articles.findIndex(a => a.id === match[1]);
      if (index < 0) return send(res, 404, { error: 'Article not found' });
      const patch = await readBody(req);
      const nextStatus = patch.status || articles[index].status;

      if (['published', 'scheduled', 'archived'].includes(nextStatus) && !hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: `Role "${session.role}" cannot transition an article to "${nextStatus}". Requires managing_editor or super_admin.` });
      }
      if (nextStatus === 'rejected' && !hasMinRole(session, 'reviewer')) {
        return send(res, 403, { error: `Role "${session.role}" cannot reject articles. Requires reviewer or higher.` });
      }

      // Check title collision with other articles
      if (patch.title) {
        const cleanTitle = String(patch.title).trim().toLowerCase();
        if (articles.some((a, i) => i !== index && a.title.toLowerCase() === cleanTitle)) {
          return send(res, 409, { error: 'Another article already uses this exact headline.' });
        }
      }

      const { slugInput, ...updated } = validateArticle(patch, articles[index], {
        actor: patch.updatedBy || session.username || patch.author || articles[index].author || 'Editorial Desk',
        note: patch.revisionNote || ''
      });

      if (updated.featured) {
        articles.forEach((a, i) => { if (i !== index) a.featured = false; });
      }

      if (patch.slug && slugInput && slugInput !== articles[index].slug) {
        let candidate = slugInput;
        let n = 2;
        while (articles.some((a, i) => i !== index && a.slug === candidate)) candidate = `${slugInput}-${n++}`;
        updated.slug = candidate;
      } else if (patch.title && patch.title !== articles[index].title && !patch.slug) {
        const base = makeSlug(updated.title) || 'news-story';
        let slug = base;
        let n = 2;
        while (articles.some((a, i) => i !== index && a.slug === slug)) slug = `${base}-${n++}`;
        updated.slug = slug;
      }

      articles[index] = updated;
      writeArticles(articles);
      store.syncEntitiesFromArticle(updated);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: `article.update.${updated.status}`,
        target: `${updated.title} (${updated.slug})`,
        level: 'info',
        details: patch.revisionNote || `Updated article (status: ${updated.status}).`
      });
      return send(res, 200, articles[index]);
    }

    if (match && req.method === 'DELETE') {
      if (!hasMinRole(session, 'managing_editor')) {
        return send(res, 403, { error: 'Only managing_editor or super_admin can permanently delete articles.' });
      }
      const articles = readArticles();
      const targetArt = articles.find(a => a.id === match[1]);
      if (!targetArt) return send(res, 404, { error: 'Article not found' });
      try { store.createBackup(`pre-delete-article-${targetArt.slug}`); } catch {}
      const next = articles.filter(a => a.id !== match[1]);
      writeArticles(next);
      store.appendAuditLog({
        actor: session.username,
        role: session.role,
        action: 'article.delete',
        target: `${targetArt.title} (${targetArt.id})`,
        level: 'warn',
        details: 'Permanently deleted article.'
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'Admin endpoint not found' });
  }

  if (req.method === 'GET' && pathname === '/sitemap.xml') {
    const articles = readArticles().filter(a => a.status === 'published' && !a.seo?.noIndex);
    const categorySlugs = [
      'construction-equipment',
      'backhoe-loaders',
      'excavators',
      'wheel-loaders',
      'bulldozers',
      'cranes',
      'graders',
      'telehandlers',
      'roadbuilding',
      'mining-equipment',
      'compact-equipment',
      'attachments',
      'tractors',
      'agricultural-machinery',
      'heavy-trucks',
      'pickups',
      'vans',
      'buses',
      'electric-commercial-vehicles',
      'technology',
      'business',
      'reviews',
      'guides',
      'projects',
      'events',
      'videos',
      'bull-machines',
      'brands',
      'regions'
    ];
    const catalog = store.getCatalogSummary();
    const publicMfgs = (catalog.manufacturers || []).filter(m => !['all-manufacturers', 'various', 'volvo', 'tata'].includes(m.slug));
    const publicModels = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      m.slug !== 'bull-machines-full-lineup'
    );
    const staticPaths = [
      '/',
      '/manufacturers',
      '/models',
      ...CANONICAL_REGIONAL_HUBS.map(h => `/${h.slug}/`),
      ...categorySlugs.map(s => `/category/${s}`),
      ...publicMfgs.map(m => `/manufacturers/${m.slug}`),
      ...publicModels.map(m => `/models/${m.slug}`),
      '/about.html',
      '/contact.html',
      '/editorial-policy.html',
      '/corrections.html',
      '/privacy.html',
      '/terms.html',
      '/advertise.html'
    ];
    const urls = [
      ...staticPaths.map(x => `<url><loc>${escapeXml(SITE_URL + x)}</loc></url>`),
      ...articles.map(a => `<url><loc>${escapeXml(`${SITE_URL}/news/${encodeURIComponent(a.slug)}`)}</loc><lastmod>${escapeXml((a.updatedAt || a.publishedAt || new Date().toISOString()).slice(0, 10))}</lastmod></url>`)
    ].join('');
    return sendText(
      res,
      200,
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
      'application/xml; charset=utf-8'
    );
  }

  if (req.method === 'GET' && (pathname === '/rss.xml' || pathname === '/feed.xml')) {
    const articles = readArticles()
      .filter(a => a.status === 'published')
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 25);
    const items = articles.map(a => `
      <item>
        <title>${escapeXml(a.title)}</title>
        <link>${escapeXml(`${SITE_URL}/news/${encodeURIComponent(a.slug)}`)}</link>
        <guid isPermaLink="true">${escapeXml(`${SITE_URL}/news/${encodeURIComponent(a.slug)}`)}</guid>
        <description>${escapeXml(a.summary || a.excerpt)}</description>
        <category>${escapeXml(a.category)}</category>
        <pubDate>${new Date(a.publishedAt || Date.now()).toUTCString()}</pubDate>
      </item>`).join('');
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MACHINEWIRE — THE WORLD OF MACHINES. CONNECTED.</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Global construction equipment, backhoe loaders, heavy machinery and commercial vehicle intelligence.</description>
    <language>en</language>${items}
  </channel>
</rss>`;
    return sendText(res, 200, rss, 'application/xml; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/robots.txt') {
    const robotsTxt = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin.html',
      'Disallow: /api/admin/',
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      ''
    ].join('\n');
    return sendText(res, 200, robotsTxt, 'text/plain; charset=utf-8', {
      'Cache-Control': 'public, max-age=3600'
    });
  }

  // Clean SEO-friendly route rewrites:
  // Top-level regional hubs: /india/, /north-america/, /europe/, /china/, etc. -> region.html
  // /region/:slug or /regions/:slug -> region.html
  // /manufacturers, /brands, /manufacturers/:slug, /brands/:slug -> manufacturer.html
  // /models, /equipment-models, /models/:slug, /equipment/:slug -> model.html
  // /category/:slug or /section/:slug -> section.html
  // /news/:slug or /articles/:slug -> article.html
  let resolvedRelative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const topRegionSlug = resolveRegionHubSlug(pathname);
  const subRegionMatch = pathname.match(/^\/regions?\/([a-z0-9-_]+)\/?$/i);
  if (topRegionSlug || (subRegionMatch && resolveRegionHubSlug(subRegionMatch[1]))) {
    resolvedRelative = 'region.html';
  } else if (/^\/(manufacturers|brands)(\/[a-z0-9-_]+)?\/?$/i.test(pathname)) {
    resolvedRelative = 'manufacturer.html';
  } else if (/^\/(models|equipment-models)(\/[a-z0-9-_]+)?\/?$/i.test(pathname) || /^\/equipment\/[a-z0-9-_]+\/?$/i.test(pathname)) {
    resolvedRelative = 'model.html';
  } else if (/^\/(category|section)\/[a-z0-9-_]+\/?$/i.test(pathname)) {
    resolvedRelative = 'section.html';
  } else if (/^\/(news|articles)\/[a-z0-9-_]+\/?$/i.test(pathname)) {
    resolvedRelative = 'article.html';
  }

  let filePath = path.join(PUBLIC, resolvedRelative);
  if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== path.join(PUBLIC, 'index.html')) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error();
    const ext = path.extname(filePath);
    const isAdminPage = path.basename(filePath) === 'admin.html';
    const cacheHeader = isAdminPage
      ? 'no-store'
      : (['.css', '.js', '.svg', '.png', '.jpg', '.webp', '.ico'].includes(ext)
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'public, max-age=60, stale-while-revalidate=300');
    const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
    if (!isAdminPage && req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'Cache-Control': cacheHeader,
        'ETag': etag
      });
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheHeader,
      'ETag': etag,
      ...SECURITY_HEADERS
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    const wantsHtml = (req.headers.accept || '').includes('text/html') || pathname.endsWith('.html') || !pathname.startsWith('/api/');
    if (wantsHtml) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Page Not Found', 'The requested MachineWire page or resource could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    sendText(res, 404, 'Not found');
  }
}

function createAppServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch(err => {
      const isClientErr =
        err.message === 'Invalid JSON body' ||
        err.message === 'Request body too large' ||
        err.message.includes(' is required') ||
        err.message.includes('valid email') ||
        err.message.includes('http or https') ||
        err.message.startsWith('Newsroom workflow requires') ||
        err.message.startsWith('Collected story not found') ||
        err.message.startsWith('Automatic publication cannot be enabled') ||
        err.message.startsWith('Cannot approve an article') ||
        err.message.startsWith('Primary source URL is required') ||
        err.message.startsWith('Requires ') ||
        err.message.startsWith('Add a title') ||
        err.message.startsWith('Image and source') ||
        err.message.startsWith('Scheduled articles') ||
        err.message.startsWith('SEO ') ||
        err.message.startsWith('Explicit privacy') ||
        err.message.startsWith('Article not found') ||
        err.message.startsWith('Only published articles');
      if (!isClientErr) {
        console.error(err);
        try {
          store.appendAuditLog({
            actor: 'server',
            role: 'system',
            action: 'server.error',
            target: req.url || '',
            level: 'error',
            details: err.message || 'Unhandled server error'
          });
        } catch {}
      }
      if (!res.headersSent) {
        send(res, isClientErr ? 400 : 500, { error: err.message || 'Internal server error' });
      } else {
        res.destroy();
      }
    });
  });
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(PORT, () => console.log(`MachineWire running at http://localhost:${PORT}`));
}

module.exports = { createAppServer, handle, validateArticle, makeSlug, store, models };
