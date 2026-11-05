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
const {
  renderArticleSsrHtml,
  renderCategorySsrHtml,
  renderAuthorSsrHtml,
  renderHomeSsrHtml,
  renderBrandSsrHtml,
  renderModelSsrHtml,
  renderRegionSsrHtml,
  renderCompareSsrHtml
} = require('./lib/ssr.js');
const appConfig = require('./lib/config.js');

function bootstrapDataDir(dataDir, exampleDir) {
  try {
    if (!fs.existsSync(exampleDir)) return;
    fs.mkdirSync(dataDir, { recursive: true });
    for (const name of fs.readdirSync(exampleDir)) {
      if (!name.endsWith('.json')) continue;
      const target = path.join(dataDir, name);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(exampleDir, name), target);
    }
  } catch (err) {
    console.warn('Data bootstrap note:', err.message);
  }
}

const { createRepositories } = require('./lib/repositories');
const { createServices } = require('./lib/services');
const { dispatchRoute } = require('./lib/routes');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const PKG_VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; }
})();

// SITE_URL: required and validated in production; defaults to http://localhost:3000 in development.
if (appConfig.isProduction()) {
  const siteUrlProblems = appConfig.validateProductionSiteUrl(process.env.SITE_URL);
  if (siteUrlProblems.length) {
    console.error([
      'FATAL: Refusing to start in production because SITE_URL is not configured correctly.',
      ...siteUrlProblems.map(p => `  - ${p}`),
      '  Set SITE_URL to your public https origin, e.g. SITE_URL=https://www.yourdomain.com (see SETUP.md).'
    ].join('\n'));
    process.exit(1);
  }
}
const SITE_URL = appConfig.getSiteUrl();
process.env.SITE_URL = SITE_URL; // every lib module reads the same resolved value
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// First start: copy any missing starter files from data.example/ into the data directory.
bootstrapDataDir(DATA_DIR, path.join(ROOT, 'data.example'));

const store = createDataStore(DATA_DIR);
store.migrate();
try {
  aiSeo.seedInitialSeoTasks(store);
} catch (err) {
  console.warn('Initial SEO task seed note:', err.message);
}

const repositories = createRepositories(store);
const services = createServices({ repositories, store });

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
  'na': 'north-america',
  'japan-and-south-korea': 'japan-south-korea',
  'japan-korea': 'japan-south-korea',
  'japan': 'japan-south-korea',
  'south-korea': 'japan-south-korea',
  'asean': 'southeast-asia',
  'sea': 'southeast-asia',
  'oceania': 'australia',
  'latam': 'latin-america',
  'mena': 'middle-east',
  'gcc': 'middle-east',
  'asia-pacific': 'india',
  'apac': 'india',
  'south-asia': 'india',
  'eu': 'europe',
  'uk': 'europe'
};

const OLD_CATEGORY_REDIRECTS = {
  'business': '/category/industry-news',
  'industry-business': '/category/industry-news',
  'industry': '/category/industry-news',
  'reviews': '/category/reviews-comparisons',
  'guides': '/category/buying-guides',
  'events': '/category/events-exhibitions',
  'equipment': '/category/construction-equipment',
  'brands': '/manufacturers',
  'regions': '/india/'
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
  <title>${status} ${escapeXml(title)} | Machine Report World</title>
  <link rel="stylesheet" href="/styles.css?v=${PKG_VERSION}">
</head>
<body>
  <header class="site-header">
    <div class="wrap masthead">
      <a class="brand" href="/">
        <span class="brand-mark">MRW<span>+</span></span>
        <span class="brand-words">MACHINE REPORT <span>WORLD</span><small>THE WORLD OF MACHINES. CONNECTED.</small></span>
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
      <a class="button button-dark" href="/">← Return to Machine Report World Homepage</a>
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
  let token = cookieValue(req, 'bm_session');
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
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

  const session = getAdminSession(req);
  const ip = req.socket?.remoteAddress || 'local';

  const isAdminOrApi = pathname.startsWith('/api/') || pathname.toLowerCase().includes('admin');
  const routeSend = (targetRes, status, data, headers = {}) => {
    const finalHeaders = isAdminOrApi ? { 'X-Robots-Tag': 'noindex, nofollow', ...headers } : headers;
    return send(targetRes, status, data, finalHeaders);
  };
  const routeSendText = (targetRes, status, text, type = 'text/plain; charset=utf-8', headers = {}) => {
    const finalHeaders = isAdminOrApi ? { 'X-Robots-Tag': 'noindex, nofollow', ...headers } : headers;
    return sendText(targetRes, status, text, type, finalHeaders);
  };

  // Build routing context
  const ctx = {
    req,
    res,
    pathname,
    url,
    method: req.method,
    session,
    ip,
    services,
    repositories,
    store,
    send: routeSend,
    sendText: routeSendText,
    readBody,
    hasMinRole,
    sessions,
    signToken: (id, expiry) => `${id}.${expiry}.${sign(`${id}.${expiry}`)}`,
    checkLoginRateLimit,
    recordFailedLogin,
    loginAttempts,
    checkRateLimit: checkPublicPostRateLimit,
    adminPassword: ADMIN_PASSWORD,
    sessionSecret: SESSION_SECRET,
    siteUrl: SITE_URL,
    pkgVersion: PKG_VERSION
  };

  // Dispatch modular routes
  const handled = await dispatchRoute(ctx);
  if (handled) return;

  // Static / SSR page handlers with metadata & structured data

  // 1. Home page SSR
  if (pathname === '/' || pathname === '/index.html') {
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const allPublished = services.articles.getPublicArticles();
    const ssrHtml = renderHomeSsrHtml(templateHtml, { siteUrl: SITE_URL, store, articles: allPublished });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }

  // 2. Open Data & Press static pages
  if (pathname === '/data' || pathname === '/data.html') {
    const html = fs.readFileSync(path.join(PUBLIC, 'data.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL)
      .replace(/(<link[^>]+rel="canonical"[^>]+href=")(\/[^"]*"[^>]*>)/i, `$1${SITE_URL}$2`);
    return sendText(res, 200, html, 'text/html; charset=utf-8');
  }
  if (pathname === '/press' || pathname === '/press.html') {
    const html = fs.readFileSync(path.join(PUBLIC, 'press.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL)
      .replace(/(<link[^>]+rel="canonical"[^>]+href=")(\/[^"]*"[^>]*>)/i, `$1${SITE_URL}$2`);
    return sendText(res, 200, html, 'text/html; charset=utf-8');
  }

  // 3. Model comparison page: /compare/<model-a>-vs-<model-b>
  const compareMatch = pathname.match(/^\/compare\/([a-z0-9-_]+)-vs-([a-z0-9-_]+)\/?$/i);
  if (compareMatch) {
    const slugA = compareMatch[1].toLowerCase();
    const slugB = compareMatch[2].toLowerCase();
    const modelA = services.catalog.getModelBySlug(slugA);
    const modelB = services.catalog.getModelBySlug(slugB);
    if (!modelA || !modelB) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Comparison Models Not Found', 'One or both equipment models for this comparison could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'section.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const ssrHtml = renderCompareSsrHtml(templateHtml, { modelA, modelB, siteUrl: SITE_URL });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }

  // 4. Regional Hubs: /india/, /north-america/, etc.
  const topRegionSlug = resolveRegionHubSlug(pathname);
  const subRegionMatch = pathname.match(/^\/regions?\/([a-z0-9-_]+)\/?$/i);
  const activeRegionSlug = topRegionSlug || (subRegionMatch && resolveRegionHubSlug(subRegionMatch[1]));
  if (activeRegionSlug) {
    const hub = CANONICAL_REGIONAL_HUBS.find(h => h.slug === activeRegionSlug);
    if (hub) {
      const templateHtml = fs.readFileSync(path.join(PUBLIC, 'region.html'), 'utf8')
        .replace(/__SITE_URL__/g, SITE_URL);
      const allPublished = services.articles.getPublicArticles();
      const regionalArticles = allPublished.filter(a =>
        hub.countries.some(c => (a.country || '').toLowerCase() === c.toLowerCase()) ||
        hub.regions.some(r => (a.region || '').toLowerCase() === r.toLowerCase())
      );
      const ssrHtml = renderRegionSsrHtml(templateHtml, { hub, articles: regionalArticles, siteUrl: SITE_URL });
      return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
    }
  }

  // 5. Manufacturers / Brands: /manufacturers, /brands, /manufacturers/:slug
  const mfgSingleMatch = pathname.match(/^\/(?:manufacturers|brands)\/([a-z0-9-_]+)\/?$/i);
  if (mfgSingleMatch) {
    const mfgSlug = mfgSingleMatch[1].toLowerCase();
    const manufacturer = services.catalog.getManufacturerBySlug(mfgSlug);
    if (!manufacturer) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Manufacturer Not Found', 'The requested equipment manufacturer profile could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'manufacturer.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const ssrHtml = renderBrandSsrHtml(templateHtml, { manufacturer, siteUrl: SITE_URL });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }
  if (['/manufacturers', '/manufacturers/', '/brands', '/brands/'].includes(pathname)) {
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'manufacturer.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const allMfgs = store.getCatalogSummary().manufacturers || [];
    const ssrHtml = renderBrandSsrHtml(templateHtml, { allManufacturers: allMfgs, siteUrl: SITE_URL });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }

  // 6. Models: /models, /models/:slug, /equipment-models
  const modelSingleMatch = pathname.match(/^\/(?:models|equipment-models|equipment)\/([a-z0-9-_]+)\/?$/i);
  if (modelSingleMatch) {
    const modelSlug = modelSingleMatch[1].toLowerCase();
    const model = services.catalog.getModelBySlug(modelSlug);
    if (!model) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Equipment Model Not Found', 'The requested equipment model specification could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'model.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const allModels = store.getCatalogSummary().equipmentModels || [];
    const ssrHtml = renderModelSsrHtml(templateHtml, { model, allModels, siteUrl: SITE_URL });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }
  if (['/models', '/models/', '/equipment-models', '/equipment-models/'].includes(pathname)) {
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'model.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const allModels = store.getCatalogSummary().equipmentModels || [];
    const ssrHtml = renderModelSsrHtml(templateHtml, { allModels, siteUrl: SITE_URL });
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }

  // Clean SEO-friendly route rewrites:
  // Top-level regional hubs: /india/, /north-america/, /europe/, /china/, etc. -> region.html
  // /region/:slug or /regions/:slug -> region.html
  // /manufacturers, /brands, /manufacturers/:slug, /brands/:slug -> manufacturer.html
  // /models, /equipment-models, /models/:slug, /equipment/:slug -> model.html
  // /category/:slug or /section/:slug -> section.html
  // /news/:slug or /articles/:slug -> article.html
  // 301 Redirects for merged / legacy category & section URLs
  const oldSectionMatch = pathname.match(/^\/section\/([a-z0-9-_]+)\/?$/i);
  if (oldSectionMatch) {
    const rawSec = oldSectionMatch[1].toLowerCase();
    const targetPath = OLD_CATEGORY_REDIRECTS[rawSec] || `/category/${rawSec}`;
    res.writeHead(301, { Location: `${targetPath}${url.search || ''}`, ...SECURITY_HEADERS });
    return res.end();
  }
  if (pathname === '/section.html' && url.searchParams.get('section')) {
    const rawSec = String(url.searchParams.get('section') || '').toLowerCase().trim();
    const targetPath = OLD_CATEGORY_REDIRECTS[rawSec] || `/category/${rawSec}`;
    res.writeHead(301, { Location: targetPath, ...SECURITY_HEADERS });
    return res.end();
  }
  const catRouteMatch = pathname.match(/^\/category\/([a-z0-9-_]+)\/?$/i);
  if (catRouteMatch) {
    const catSlug = catRouteMatch[1].toLowerCase();
    if (OLD_CATEGORY_REDIRECTS[catSlug]) {
      res.writeHead(301, { Location: `${OLD_CATEGORY_REDIRECTS[catSlug]}${url.search || ''}`, ...SECURITY_HEADERS });
      return res.end();
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'section.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const allPublished = services.articles.getPublicArticles();
    const categories = store.getCatalogSummary().categories || [];
    const ssrCategoryHtml = renderCategorySsrHtml(templateHtml, {
      slug: catSlug,
      searchParams: url.searchParams,
      articles: allPublished,
      categories,
      siteUrl: SITE_URL
    });
    return sendText(res, 200, ssrCategoryHtml, 'text/html; charset=utf-8');
  }

  const authorRouteMatch = pathname.match(/^\/authors\/([a-z0-9-_]+)\/?$/i);
  if (authorRouteMatch) {
    const authorSlug = authorRouteMatch[1].toLowerCase();
    const author = services.catalog.getAuthorBySlug(authorSlug, services.articles.getPublicArticleView);
    if (!author) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Author Not Found', 'The requested Machine Report World author or desk profile could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'author.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const ssrAuthorHtml = renderAuthorSsrHtml(templateHtml, { author, siteUrl: SITE_URL });
    return sendText(res, 200, ssrAuthorHtml, 'text/html; charset=utf-8');
  }

  if (/^\/(news|articles)\/([a-z0-9-_]+)\/?$/i.test(pathname)) {
    const articleMatch = pathname.match(/^\/(news|articles)\/([a-z0-9-_]+)\/?$/i);
    const articleSlug = articleMatch ? articleMatch[2] : '';
    const article = services.articles.getPublicArticleBySlug(articleSlug);
    if (!article) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Article Not Found', 'The requested Machine Report World article could not be found or is not yet published.', pathname),
        'text/html; charset=utf-8'
      );
    }
    const templateHtml = fs.readFileSync(path.join(PUBLIC, 'article.html'), 'utf8')
      .replace(/__SITE_URL__/g, SITE_URL);
    const ssrHtml = renderArticleSsrHtml(templateHtml, article, SITE_URL);
    return sendText(res, 200, ssrHtml, 'text/html; charset=utf-8');
  }

  const resolvedRelative = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath = path.join(PUBLIC, resolvedRelative);
  if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== path.join(PUBLIC, 'index.html')) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) throw new Error();
    const ext = path.extname(filePath);
    const isAdminAsset = path.basename(filePath).toLowerCase().startsWith('admin.');
    const cacheHeader = isAdminAsset
      ? 'no-cache, no-store, must-revalidate, max-age=0'
      : (['.css', '.js', '.svg', '.png', '.jpg', '.webp', '.ico'].includes(ext)
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'public, max-age=60, stale-while-revalidate=300');
    const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
    if (!isAdminAsset && req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'Cache-Control': cacheHeader,
        'ETag': etag
      });
      return res.end();
    }
    if (ext === '.html' && !isAdminAsset) {
      const html = fs.readFileSync(filePath, 'utf8')
        .replace(/__SITE_URL__/g, SITE_URL)
        .replace(/(<link[^>]+rel="canonical"[^>]+href=")(\/[^"]*"[^>]*>)/i, `$1${SITE_URL}$2`);
      res.writeHead(200, {
        'Content-Type': MIME[ext],
        'Cache-Control': cacheHeader,
        'ETag': etag,
        ...SECURITY_HEADERS
      });
      return res.end(html);
    }
    const extraAdminHeaders = isAdminAsset ? { 'X-Robots-Tag': 'noindex, nofollow' } : {};
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheHeader,
      'ETag': etag,
      ...SECURITY_HEADERS,
      ...extraAdminHeaders
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    const wantsHtml = (req.headers.accept || '').includes('text/html') || pathname.endsWith('.html') || !pathname.startsWith('/api/');
    if (wantsHtml) {
      return sendText(
        res,
        404,
        renderErrorPageHtml(404, 'Page Not Found', 'The requested Machine Report World page or resource could not be found.', pathname),
        'text/html; charset=utf-8'
      );
    }
    sendText(res, 404, 'Not found');
  }
}

function createAppServer() {
  return http.createServer((req, res) => {
    const startMs = Date.now();
    res.on('finish', () => {
      let reqPath = req.url || '/';
      try { reqPath = new URL(req.url || '/', SITE_URL).pathname; } catch {}
      process.stdout.write(JSON.stringify({
        method: req.method || 'GET',
        path: reqPath,
        status: res.statusCode,
        ms: Date.now() - startMs
      }) + '\n');
    });
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
        err.message.startsWith('Only published articles') ||
        err.message.startsWith('Publishing standards not met');
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
  server.listen(PORT, () => console.log(`Machine Report World running at http://localhost:${PORT}`));
}

module.exports = {
  createAppServer,
  handle,
  validateArticle,
  makeSlug,
  store,
  models,
  repositories,
  services,
  readArticles,
  writeArticles
};
