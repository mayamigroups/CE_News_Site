const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const models = require('./models.js');

const USER_AGENT = 'MachineReportWorldNewsCollector/1.0 (+http://localhost:3000/editorial-policy.html; respectful-editorial-collector)';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB response size limit to prevent memory exhaustion
const MAX_REDIRECTS = 4;

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'source'
]);

// Approved official manufacturer, trade, and regulatory domains
const APPROVED_MANUFACTURER_DOMAINS = new Set([
  'jcb.com',
  'cat.com',
  'caterpillar.com',
  'komatsu.jp',
  'komatsu.com',
  'volvoce.com',
  'volvotrucks.com',
  'volvo.com',
  'tatamotors.com',
  'ashokleyland.com',
  'casece.com',
  'sanyglobal.com',
  'sany.com',
  'bullindia.com',
  'bullmachines.com',
  'hyundai-ce.com',
  'hd-hyundaice.com',
  'xcmg.com',
  'xcmgglobal.com',
  'deere.com',
  'daimlertruck.com',
  'oemoffhighway.com',
  'forconstructionpros.com',
  'prnewswire.com',
  'energy.gov',
  'acea.auto',
  'excon.in',
  'bauma.de',
  'conexpoconagg.com',
  'iso.org'
]);

/**
 * SSRF and Network Security Guard
 * Prevents access to localhost, internal networks, cloud metadata services, and non-http/https protocols.
 */
function isSafePublicUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, reason: 'Empty or invalid URL.' };
  }
  try {
    const parsed = new URL(rawUrl.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `Unsupported protocol "${parsed.protocol}". Only http: and https: are permitted.` };
    }
    const host = parsed.hostname.toLowerCase();

    // Reject loopback and local hosts
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host === '[::1]') {
      return { safe: false, reason: 'Localhost and loopback addresses prohibited (SSRF prevention).' };
    }

    // Reject internal / private TLDs
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.corp') || host.endsWith('.test')) {
      return { safe: false, reason: 'Internal/private network domains prohibited (SSRF prevention).' };
    }

    // Reject IPv4 private & link-local ranges
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const b1 = parseInt(ipv4[1], 10);
      const b2 = parseInt(ipv4[2], 10);
      if (b1 === 10) return { safe: false, reason: 'Private network (10.0.0.0/8) prohibited (SSRF prevention).' };
      if (b1 === 127) return { safe: false, reason: 'Loopback network (127.0.0.0/8) prohibited (SSRF prevention).' };
      if (b1 === 169 && b2 === 254) return { safe: false, reason: 'Link-local/cloud metadata IP (169.254.0.0/16) prohibited (SSRF prevention).' };
      if (b1 === 172 && b2 >= 16 && b2 <= 31) return { safe: false, reason: 'Private network (172.16.0.0/12) prohibited (SSRF prevention).' };
      if (b1 === 192 && b2 === 168) return { safe: false, reason: 'Private network (192.168.0.0/16) prohibited (SSRF prevention).' };
      if (b1 === 0) return { safe: false, reason: 'Network 0.0.0.0/8 prohibited.' };
    }

    return { safe: true, url: parsed.toString(), hostname: host };
  } catch (err) {
    return { safe: false, reason: `Malformed URL: ${err.message}` };
  }
}

/**
 * Check if a domain is an approved source or registered manufacturer domain
 */
function isDomainApproved(hostname, registeredSources = []) {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (APPROVED_MANUFACTURER_DOMAINS.has(host)) return true;
  for (const approved of APPROVED_MANUFACTURER_DOMAINS) {
    if (host.endsWith('.' + approved) || approved.endsWith('.' + host)) return true;
  }
  for (const s of registeredSources) {
    const sDomain = (s.domain || '').toLowerCase().replace(/^www\./, '');
    if (sDomain && (host === sDomain || host.endsWith('.' + sDomain))) return true;
  }
  return false;
}

/**
 * Normalize a URL into a deterministic canonical form
 */
function normalizeCanonicalUrl(rawUrl, baseOrigin = '') {
  if (!rawUrl) return '';
  try {
    const parsed = baseOrigin ? new URL(String(rawUrl).trim(), baseOrigin) : new URL(String(rawUrl).trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    const cleanParams = new URLSearchParams();
    const keys = [...parsed.searchParams.keys()].sort();
    for (const k of keys) {
      if (!TRACKING_PARAMS.has(k.toLowerCase())) {
        cleanParams.append(k, parsed.searchParams.get(k));
      }
    }
    parsed.search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Decode common XML / HTML entities and strip HTML tags cleanly for excerpts
 */
function decodeAndStripHtml(raw = '') {
  return String(raw || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute deterministic SHA-256 fingerprints for duplicate detection
 */
function computeTitleFingerprint(title = '') {
  const normalized = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

function computeContentFingerprint(title = '', excerpt = '') {
  const combined = `${String(title || '').toLowerCase()}||${String(excerpt || '').toLowerCase().slice(0, 240)}`
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 24);
}

/**
 * Parse robots.txt Disallow rules
 */
function isPathAllowedByRobotsTxt(robotsTxt = '', targetPathname = '/') {
  if (!robotsTxt) return true;
  const lines = String(robotsTxt).split(/\r?\n/);
  let applies = false;
  const disallows = [];
  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [directive, ...rest] = line.split(':');
    const val = rest.join(':').trim();
    if (/^user-agent$/i.test(directive)) {
      applies = val === '*' || /machinereport|machinewire/i.test(val);
    } else if (applies && /^disallow$/i.test(directive) && val) {
      disallows.push(val);
    }
  }
  for (const rule of disallows) {
    if (rule === '/') return false;
    if (targetPathname.startsWith(rule)) return false;
  }
  return true;
}

/**
 * Secure fetch with SSRF guard, redirect restriction, response size limit, and timeout
 */
async function fetchWithSecurity(rawUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 7000;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const enforceSizeLimit = Boolean(options.enforceSizeLimit);
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': options.accept || 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
    ...(options.headers || {})
  };

  let currentUrl = rawUrl;
  let redirectsFollowed = 0;

  while (redirectsFollowed <= maxRedirects) {
    const check = isSafePublicUrl(currentUrl);
    if (!check.safe) {
      const err = new Error(`Security validation failed: ${check.reason}`);
      err.isSecurityBlock = true;
      throw err;
    }

    const res = await fetch(currentUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    });

    // Handle manual redirects safely
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      redirectsFollowed++;
      if (redirectsFollowed > maxRedirects) {
        throw new Error(`Too many redirects (exceeded limit of ${maxRedirects}).`);
      }
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`HTTP ${res.status} redirect without location header.`);
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }

    if (res.status === 401 || res.status === 403 || res.status === 402) {
      const err = new Error(`HTTP ${res.status} Access Restricted / Paywall / Bot Protection — collection aborted respectfully.`);
      err.noRetry = true;
      err.httpStatus = res.status;
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} (${res.statusText || 'Error'}) from ${currentUrl}`);
      err.httpStatus = res.status;
      throw err;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    
    // Validate supported content types (reject binaries/audio/video)
    if (contentType.includes('audio/') || contentType.includes('video/') || contentType.includes('application/octet-stream') || contentType.includes('application/zip')) {
      const err = new Error(`Unsupported content type "${contentType}". Only XML, HTML, and JSON are supported.`);
      err.noRetry = true;
      throw err;
    }

    // Check content-length header if present
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      const err = new Error(`Response size (${contentLength} bytes) exceeds safety limit of ${MAX_RESPONSE_BYTES} bytes.`);
      err.noRetry = true;
      throw err;
    }

    const text = await res.text();
    if (enforceSizeLimit && text.length > MAX_RESPONSE_BYTES) {
      const err = new Error(`Response body exceeds maximum size limit of ${MAX_RESPONSE_BYTES} bytes.`);
      err.noRetry = true;
      throw err;
    }

    return {
      status: res.status,
      contentType,
      etag: res.headers.get('etag') || '',
      lastModified: res.headers.get('last-modified') || '',
      text: text.slice(0, MAX_RESPONSE_BYTES),
      finalUrl: currentUrl,
      redirectsFollowed
    };
  }

  throw new Error(`Redirect chain exceeded limit of ${maxRedirects}.`);
}

/**
 * Fetch a URL with safe retries, backoff, and timeout handling
 */
async function fetchWithRetry(url, options = {}) {
  const maxRetries = options.retries ?? 2;
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithSecurity(url, options);
    } catch (err) {
      lastErr = err;
      if (err.noRetry || err.isSecurityBlock || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Parse RSS 2.0 (<item>) and Atom 1.0 (<entry>) XML documents
 */
function parseFeedXml(xmlText, fallbackBaseUrl = '') {
  const text = String(xmlText || '');
  const items = [];

  const itemRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[2];

    const extractTag = (tagNames) => {
      for (const tag of tagNames) {
        const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const m = block.match(re);
        if (m && m[1]) return m[1].trim();
      }
      return '';
    };

    const rawTitle = extractTag(['title']);
    const title = decodeAndStripHtml(rawTitle).slice(0, 220);

    let rawLink = extractTag(['link']);
    if (!rawLink || rawLink.startsWith('<')) {
      const atomLinkMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
      if (atomLinkMatch) rawLink = atomLinkMatch[1];
    }
    rawLink = decodeAndStripHtml(rawLink);
    if (!rawLink) {
      const guid = decodeAndStripHtml(extractTag(['guid', 'id']));
      if (/^https?:\/\//i.test(guid)) rawLink = guid;
    }

    const originalUrl = rawLink || fallbackBaseUrl;
    const canonicalUrl = normalizeCanonicalUrl(originalUrl, fallbackBaseUrl);

    const rawDate = decodeAndStripHtml(extractTag(['pubDate', 'published', 'updated', 'dc:date']));
    let publishedAt = null;
    if (rawDate) {
      const parsedMs = Date.parse(rawDate);
      if (Number.isFinite(parsedMs)) publishedAt = new Date(parsedMs).toISOString();
    }

    const rawDesc = extractTag(['description', 'summary', 'content:encoded', 'content']);
    const excerpt = decodeAndStripHtml(rawDesc).slice(0, 480);

    const guid = decodeAndStripHtml(extractTag(['guid', 'id'])).slice(0, 240);

    // Extract image if present
    let imageUrl = '';
    const encMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
    if (encMatch && /^https?:\/\//i.test(encMatch[1])) {
      imageUrl = encMatch[1];
    } else {
      const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
      if (mediaMatch && /^https?:\/\//i.test(mediaMatch[1])) {
        imageUrl = mediaMatch[1];
      }
    }

    if (title && canonicalUrl) {
      items.push({
        title,
        headline: title,
        originalUrl,
        canonicalUrl,
        publishedAt,
        originalPublicationDate: publishedAt,
        excerpt: excerpt || `${title} — official feed dispatch.`,
        summary: excerpt || `${title} — official feed dispatch.`,
        guid: guid || canonicalUrl,
        imageUrl: imageUrl || null
      });
    }
  }
  return items;
}

/**
 * Parse XML Sitemaps (<urlset> with <url><loc>...</loc><lastmod>...</lastmod></url>)
 */
function parseSitemapXml(xmlText, fallbackUrlOrOptions = {}, maybeOptions = {}) {
  const text = String(xmlText || '');
  const items = [];
  const options = (typeof fallbackUrlOrOptions === 'object' && fallbackUrlOrOptions !== null)
    ? fallbackUrlOrOptions
    : (maybeOptions || {});
  const allowedPrefixes = options.allowedPathPrefixes || [];
  const maxItems = options.maxItems || 15;

  const urlRegex = /<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const block = match[1];
    const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
    if (!locMatch) continue;
    const rawUrl = locMatch[1].trim();
    const canonical = normalizeCanonicalUrl(rawUrl);
    if (!canonical) continue;

    // Filter by allowed path prefixes if configured
    if (allowedPrefixes.length > 0) {
      try {
        const p = new URL(canonical).pathname;
        if (!allowedPrefixes.some(pref => p.startsWith(pref))) continue;
      } catch {
        continue;
      }
    }

    const modMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    let publishedAt = null;
    if (modMatch) {
      const parsedMs = Date.parse(modMatch[1].trim());
      if (Number.isFinite(parsedMs)) publishedAt = new Date(parsedMs).toISOString();
    }

    items.push({
      originalUrl: rawUrl,
      canonicalUrl: canonical,
      publishedAt,
      originalPublicationDate: publishedAt
    });

    if (items.length >= maxItems) break;
  }
  return items;
}

/**
 * Source Endpoint Validator Service
 * Tests availability, redirects, content-type, RSS/Atom/sitemap validity, dates, canonical URLs, and deduplication.
 */
async function validateSourceEndpoint(url, options = {}) {
  const testedAt = new Date().toISOString();
  const sec = isSafePublicUrl(url);
  if (!sec.safe) {
    return {
      valid: false,
      testedAt,
      url,
      httpStatus: null,
      contentType: null,
      detectedFormat: 'security_blocked',
      error: sec.reason,
      itemCount: 0,
      canExtractDates: false,
      canExtractCanonical: false
    };
  }

  try {
    const res = await fetchWithRetry(url, {
      timeoutMs: options.timeoutMs || 8000,
      retries: 1,
      enforceSizeLimit: options.enforceSizeLimit
    });

    const isXml = res.contentType.includes('xml') || res.text.trim().startsWith('<?xml') || /<(rss|feed|urlset|sitemapindex)/i.test(res.text);
    let detectedFormat = 'unknown';
    let sampleItems = [];
    let canExtractDates = false;
    let canExtractCanonical = false;

    if (isXml) {
      if (/<(item|entry)/i.test(res.text)) {
        detectedFormat = /<entry/i.test(res.text) ? 'atom' : 'rss';
        sampleItems = parseFeedXml(res.text, url).slice(0, 5);
        canExtractDates = sampleItems.some(i => Boolean(i.publishedAt));
        canExtractCanonical = sampleItems.some(i => Boolean(i.canonicalUrl));
      } else if (/<(urlset|sitemapindex)/i.test(res.text)) {
        detectedFormat = 'sitemap';
        sampleItems = parseSitemapXml(res.text, { maxItems: 5 });
        canExtractDates = sampleItems.some(i => Boolean(i.publishedAt));
        canExtractCanonical = sampleItems.some(i => Boolean(i.canonicalUrl));
      } else {
        detectedFormat = 'invalid_xml';
      }
    } else if (res.contentType.includes('html')) {
      detectedFormat = 'html_webpage';
    } else if (res.contentType.includes('json')) {
      detectedFormat = 'json_api';
    }

    const isValidFeed = detectedFormat === 'rss' || detectedFormat === 'atom' || detectedFormat === 'sitemap';

    return {
      valid: isValidFeed,
      testedAt,
      url,
      finalUrl: res.finalUrl,
      httpStatus: res.status,
      contentType: res.contentType,
      redirectsFollowed: res.redirectsFollowed,
      detectedFormat,
      itemCount: sampleItems.length,
      sampleItems: sampleItems.map(s => ({
        title: s.title || s.canonicalUrl,
        canonicalUrl: s.canonicalUrl,
        publishedAt: s.publishedAt
      })),
      canExtractDates,
      canExtractCanonical,
      notes: isValidFeed
        ? `Successfully verified machine-readable ${detectedFormat.toUpperCase()} endpoint with ${sampleItems.length} sample item(s).`
        : `Endpoint returned HTTP ${res.status} (${detectedFormat}), but is not a valid RSS/Atom feed or XML sitemap.`
    };
  } catch (err) {
    return {
      valid: false,
      testedAt,
      url,
      httpStatus: err.httpStatus || null,
      contentType: null,
      detectedFormat: 'unreachable',
      error: err.message,
      itemCount: 0,
      canExtractDates: false,
      canExtractCanonical: false,
      notes: `Endpoint test failed: ${err.message}`
    };
  }
}

/**
 * Manual URL Intake Action
 * Accepts a single press-release URL, extracts factual evidence, and places it into the News Inbox.
 */
async function intakeManualUrl(store, rawUrl, options = {}) {
  const actor = options.actor || 'editorial-admin';
  const nowIso = new Date().toISOString();

  // 1. SSRF and protocol safety check
  const sec = isSafePublicUrl(rawUrl);
  if (!sec.safe) {
    throw new Error(`Manual URL Intake rejected: ${sec.reason}`);
  }

  const sources = store.readJson(store.files.sources, []);

  // 2. Domain verification against approved manufacturer or trade domains
  const targetHost = new URL(sec.url).hostname;
  if (!isDomainApproved(targetHost, sources)) {
    throw new Error(`Domain "${targetHost}" is not an approved manufacturer or industry news source. Add it to the Approved Source Registry first.`);
  }

  // 3. Find matching source or best fallback
  const matchedSource = sources.find(s => {
    const sDomain = (s.domain || '').toLowerCase().replace(/^www\./, '');
    const tDomain = targetHost.toLowerCase().replace(/^www\./, '');
    return sDomain && (tDomain === sDomain || tDomain.endsWith('.' + sDomain));
  }) || {
    id: `src-manual-${crypto.createHash('sha1').update(targetHost).digest('hex').slice(0, 8)}`,
    name: `${targetHost} Official Newsroom`,
    publisher: targetHost,
    manufacturer: options.manufacturer || 'Various',
    category: options.category || 'Construction Equipment',
    country: options.country || 'Global',
    region: options.region || 'Global'
  };

  // 4. Fetch page with size limit and timeout
  const fetched = await fetchWithRetry(sec.url, {
    timeoutMs: options.timeoutMs || 8000,
    accept: 'text/html, application/xhtml+xml, */*;q=0.8'
  });

  const html = fetched.text;

  // 5. Extract metadata from HTML tags
  const extractMeta = (props) => {
    for (const prop of props) {
      const re = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
      const m = html.match(re);
      if (m && m[1]) return m[1].trim();
      const reAlt = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
      const mAlt = html.match(reAlt);
      if (mAlt && mAlt[1]) return mAlt[1].trim();
    }
    return '';
  };

  let title = decodeAndStripHtml(extractMeta(['og:title', 'twitter:title']));
  if (!title) {
    const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch) title = decodeAndStripHtml(titleTagMatch[1]);
  }
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = decodeAndStripHtml(h1Match[1]);
  }
  title = (title || 'Official Manufacturer Announcement').slice(0, 220);

  let excerpt = decodeAndStripHtml(extractMeta(['og:description', 'twitter:description', 'description']));
  if (!excerpt) {
    const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) excerpt = decodeAndStripHtml(pMatch[1]);
  }
  excerpt = (excerpt || `${title} — verified official dispatch.`).slice(0, 480);

  const canonicalMeta = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonicalUrl = normalizeCanonicalUrl(canonicalMeta ? canonicalMeta[1] : fetched.finalUrl);

  const rawPubDate = extractMeta(['article:published_time', 'og:published_time', 'publication_date', 'date']);
  let publishedAt = null;
  if (rawPubDate) {
    const pMs = Date.parse(rawPubDate);
    if (Number.isFinite(pMs)) publishedAt = new Date(pMs).toISOString();
  }
  if (!publishedAt) {
    const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeMatch) {
      const pMs = Date.parse(timeMatch[1]);
      if (Number.isFinite(pMs)) publishedAt = new Date(pMs).toISOString();
    }
  }

  let imageUrl = extractMeta(['og:image', 'twitter:image']);
  if (imageUrl && !validHttpUrl(imageUrl)) imageUrl = '';

  const titleFp = computeTitleFingerprint(title);
  const contentFp = computeContentFingerprint(title, excerpt);

  // 6. Check duplicate status against collected items and articles
  const existingCollected = store.readJson(store.files.collectedItems, []);
  const existingArticles = store.readJson(store.files.articles, []);

  let duplicateStatus = 'unique';
  let duplicateWarning = false;

  const dupUrlInCollected = existingCollected.some(c => c.canonicalUrl === canonicalUrl);
  const dupUrlInArticles = existingArticles.some(a => normalizeCanonicalUrl(a.sourceUrl || '') === canonicalUrl);
  const dupTitleInCollected = existingCollected.some(c => c.titleFingerprint === titleFp);
  const dupTitleInArticles = existingArticles.some(a => computeTitleFingerprint(a.title) === titleFp);

  if (dupUrlInCollected || dupUrlInArticles) {
    duplicateStatus = 'duplicate_url';
    duplicateWarning = true;
  } else if (dupTitleInCollected || dupTitleInArticles) {
    duplicateStatus = 'duplicate_title';
    duplicateWarning = true;
  }

  const manufacturer = options.manufacturer || matchedSource.manufacturer || 'Various';
  const category = options.category || matchedSource.category || 'Construction Equipment';
  const country = options.country || matchedSource.country || 'Global';
  const region = options.region || matchedSource.region || 'Global';

  // 7. Build full News Inbox record (Part 6)
  const item = {
    id: `col-${crypto.randomBytes(6).toString('hex')}`,
    headline: title,
    title,
    summary: excerpt,
    sourceExcerpt: excerpt,
    excerpt,
    originalUrl: sec.url,
    canonicalUrl,
    sourceId: matchedSource.id,
    sourceName: matchedSource.name,
    publisher: matchedSource.publisher || matchedSource.name,
    manufacturer,
    category,
    country,
    region,
    originalPublicationDate: publishedAt,
    publishedAt,
    collectionDate: nowIso,
    retrievedAt: nowIso,
    collectionMode: 'manual_url',
    collectionMethod: 'manual_url',
    duplicateStatus,
    duplicateWarning,
    contentFingerprint: contentFp,
    titleFingerprint: titleFp,
    imageUrl: imageUrl || null,
    image: imageUrl || null,
    imageRightsStatus: 'unverified_editorial_fair_use_only_no_image_rights',
    reviewStatus: 'pending_review',
    pipelineStage: 'DEDUPLICATED',
    verificationEvidence: {
      httpStatus: fetched.status,
      contentType: fetched.contentType,
      intakeBy: actor,
      copyrightNotice: 'Headline and excerpt only; full story remains on official publisher origin. Image requires independent license verification.'
    },
    verificationNotes: `Verified via Manual URL Intake from approved domain ${targetHost}. Headline, excerpt, and canonical URL extracted directly from official press release.`,
    stageHistory: [
      { stage: 'DISCOVERED', at: nowIso, by: actor, note: `Discovered via Manual URL Intake (${sec.url})` },
      { stage: 'COLLECTED', at: nowIso, by: actor, note: `Collected canonical URL ${canonicalUrl}` },
      { stage: 'DEDUPLICATED', at: nowIso, by: actor, note: `Assigned duplicateStatus="${duplicateStatus}" (Title FP: ${titleFp.slice(0, 8)})` }
    ],
    promotedArticleId: null
  };

  existingCollected.unshift(item);
  store.writeJson(store.files.collectedItems, existingCollected.slice(0, 500));

  store.appendAuditLog({
    actor,
    action: 'collector.manual_url_intake',
    target: title,
    level: 'info',
    details: `Manual URL intake completed for "${title}" (${canonicalUrl}) [duplicateStatus: ${duplicateStatus}].`
  });

  return { ok: true, item, duplicateStatus };
}

/**
 * Built-in Sample Feeds for Test Mode
 */
const SAMPLE_FEEDS_BY_SOURCE = {
  'default': `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Machine Report World Approved Sample OEM &amp; Industry Feed</title>
    <link>https://www.oemoffhighway.com/</link>
    <description>Sample RSS feed for deterministic collection engine testing.</description>
    <item>
      <title>Stage V &amp; CEV Stage V Hydraulic Pump Control Advances for Backhoe Loaders</title>
      <link>https://www.oemoffhighway.com/fluid-power/article/22900101/stage-v-hydraulic-pump-control-advances?utm_source=rss&amp;utm_medium=feed</link>
      <guid>https://www.oemoffhighway.com/fluid-power/article/22900101/stage-v-hydraulic-pump-control-advances</guid>
      <pubDate>Fri, 24 Oct 2026 08:30:00 GMT</pubDate>
      <description><![CDATA[<p>Electronic load-sensing axial piston pumps reduce parasitic fuel losses across backhoe loader roading and trenching cycles.</p>]]></description>
    </item>
    <item>
      <title>Heavy-Duty Vocational Truck Axle &amp; Braking Architectures for Quarry Haulage</title>
      <link>https://www.forconstructionpros.com/trucks/article/22900202/heavy-duty-vocational-truck-axle-architectures?fbclid=12345</link>
      <guid>https://www.forconstructionpros.com/trucks/article/22900202/heavy-duty-vocational-truck-axle-architectures</guid>
      <pubDate>Thu, 23 Oct 2026 14:15:00 GMT</pubDate>
      <description><![CDATA[<p>Hub-reduction tandem axles and auxiliary driveline retarders improve gradeability and brake lining life on 8x4 mining tippers.</p>]]></description>
    </item>
  </channel>
</rss>`
};

/**
 * Check a single registered source, extract items, deduplicate, and record into News Inbox.
 */
async function checkSourceNow(store, sourceId, options = {}) {
  const mode = options.mode === 'test' ? 'test' : 'live';
  const actor = options.actor || 'collection-engine';
  const sources = store.readJson(store.files.sources, []);
  const srcIdx = sources.findIndex(s => s.id === sourceId);
  if (srcIdx < 0) throw new Error(`Approved source not found: ${sourceId}`);

  const source = sources[srcIdx];
  const nowIso = new Date().toISOString();
  const targetFeedUrl = source.feedUrl || source.apiEndpoint || source.sitemapUrl || '';

  // In live mode, verify source is enabled and has an approved collection endpoint
  if (mode === 'live' && source.enabled === false) {
    const msg = `Source "${source.name}" is disabled. Enable it before running live collection.`;
    return { ok: false, source, mode, discoveredCount: 0, insertedCount: 0, duplicateCount: 0, error: msg };
  }

  if (mode === 'live' && (source.collectionMode === 'manual_url' || source.collectionMode === 'newsroom_page')) {
    const msg = `Source "${source.name}" is classified as ${source.collectionMode}. Automatic polling is disabled; use Manual URL Intake to ingest specific press releases.`;
    return { ok: false, source, mode, discoveredCount: 0, insertedCount: 0, duplicateCount: 0, error: msg };
  }

  if (mode === 'live' && !targetFeedUrl) {
    const msg = `Source "${source.name}" has no feedUrl, sitemapUrl, or apiEndpoint. Automatic polling is disabled.`;
    return { ok: false, source, mode, discoveredCount: 0, insertedCount: 0, duplicateCount: 0, error: msg };
  }

  let rawXml = '';
  let httpEvidence = { status: 200, contentType: 'application/rss+xml (sample-test-mode)', robotsAllowed: true };

  try {
    if (mode === 'test') {
      rawXml = options.sampleXml || SAMPLE_FEEDS_BY_SOURCE[source.id] || SAMPLE_FEEDS_BY_SOURCE.default;
    } else {
      const parsedFeed = new URL(targetFeedUrl);
      const robotsUrl = `${parsedFeed.origin}/robots.txt`;
      let robotsAllowed = true;
      try {
        const robRes = await fetch(robotsUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(3500)
        });
        if (robRes.ok) {
          const robText = await robRes.text();
          robotsAllowed = isPathAllowedByRobotsTxt(robText, parsedFeed.pathname);
        }
      } catch {
        // Proceed cautiously if robots.txt unreachable
      }

      if (!robotsAllowed) {
        throw new Error(`Disallowed by ${robotsUrl} for path ${parsedFeed.pathname}. Respecting robots.txt.`);
      }

      const fetched = await fetchWithRetry(targetFeedUrl, {
        timeoutMs: options.timeoutMs || 8000,
        retries: options.retries ?? 2,
        enforceSizeLimit: options.enforceSizeLimit
      });
      rawXml = fetched.text;
      httpEvidence = {
        status: fetched.status,
        contentType: fetched.contentType,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        robotsAllowed: true
      };
    }

    const parsedItems = parseFeedXml(rawXml, source.url || source.website);
    const existingCollected = store.readJson(store.files.collectedItems, []);
    const existingArticles = store.readJson(store.files.articles, []);

    const inserted = [];
    let duplicateCount = 0;

    for (const rawItem of parsedItems.slice(0, 25)) {
      const titleFp = computeTitleFingerprint(rawItem.title);
      const contentFp = computeContentFingerprint(rawItem.title, rawItem.excerpt);

      const dupInCollected = existingCollected.some(c =>
        c.canonicalUrl === rawItem.canonicalUrl ||
        c.titleFingerprint === titleFp ||
        c.contentFingerprint === contentFp
      );
      const dupInArticles = existingArticles.some(a =>
        normalizeCanonicalUrl(a.sourceUrl || '') === rawItem.canonicalUrl ||
        computeTitleFingerprint(a.title) === titleFp
      );

      if (dupInCollected || dupInArticles) {
        duplicateCount++;
        continue;
      }

      const collectedRecord = {
        id: `col-${crypto.randomBytes(6).toString('hex')}`,
        headline: rawItem.title,
        title: rawItem.title,
        summary: rawItem.excerpt,
        sourceExcerpt: rawItem.excerpt,
        excerpt: rawItem.excerpt,
        originalUrl: rawItem.originalUrl,
        canonicalUrl: rawItem.canonicalUrl,
        sourceId: source.id,
        sourceName: source.name,
        publisher: source.publisher || source.name,
        manufacturer: source.manufacturer || 'Various',
        category: source.category || 'Construction Equipment',
        country: source.country || 'Global',
        region: source.region || 'Global',
        originalPublicationDate: rawItem.publishedAt || null,
        publishedAt: rawItem.publishedAt || null,
        collectionDate: nowIso,
        retrievedAt: nowIso,
        collectionMode: mode,
        collectionMethod: mode === 'test' ? 'test' : (source.collectionMode || 'rss'),
        duplicateStatus: 'unique',
        duplicateWarning: false,
        contentFingerprint: contentFp,
        titleFingerprint: titleFp,
        imageUrl: rawItem.imageUrl || null,
        image: rawItem.imageUrl || null,
        imageRightsStatus: 'unverified_editorial_fair_use_only_no_image_rights',
        reviewStatus: 'pending_review',
        pipelineStage: 'DEDUPLICATED',
        verificationEvidence: {
          guid: rawItem.guid,
          httpStatus: httpEvidence.status,
          contentType: httpEvidence.contentType,
          etag: httpEvidence.etag || '',
          robotsTxtRespected: httpEvidence.robotsAllowed,
          copyrightNotice: 'Headline and excerpt only; full text remains on publisher origin. Image requires separate license verification.'
        },
        verificationNotes: `Discovered and verified via ${mode} collection from ${source.name}.`,
        stageHistory: [
          { stage: 'DISCOVERED', at: nowIso, by: actor, note: `Discovered in feed (${source.name})` },
          { stage: 'COLLECTED', at: nowIso, by: actor, note: `Collected with canonical URL ${rawItem.canonicalUrl}` },
          { stage: 'DEDUPLICATED', at: nowIso, by: actor, note: `Passed SHA-256 title/content fingerprint & URL deduplication (FP: ${titleFp.slice(0, 8)})` }
        ],
        promotedArticleId: null
      };

      existingCollected.unshift(collectedRecord);
      inserted.push(collectedRecord);
    }

    store.writeJson(store.files.collectedItems, existingCollected.slice(0, 500));

    source.lastCheckedAt = nowIso;
    source.lastSuccessAt = nowIso;
    source.lastItemCount = parsedItems.length;
    source.consecutiveFailureCount = 0;
    source.recentErrors = [];
    source.lastError = null;
    sources[srcIdx] = source;
    store.writeJson(store.files.sources, sources);

    store.appendAuditLog({
      actor,
      action: `collector.check.${mode}`,
      target: source.name,
      level: 'info',
      details: `Checked "${source.name}" (${mode} mode): discovered ${parsedItems.length} item(s), stored ${inserted.length} new, skipped ${duplicateCount} duplicate(s).`
    });

    return {
      ok: true,
      source,
      mode,
      discoveredCount: parsedItems.length,
      insertedCount: inserted.length,
      duplicateCount,
      inserted
    };
  } catch (err) {
    const errMsg = err.message || 'Collection check failed';
    const isNetworkRestriction = Boolean(
      err.code === 'ENOTFOUND' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN' ||
      err.code === 'ENETUNREACH' ||
      err.code === 'EHOSTUNREACH' ||
      err.name === 'TimeoutError' ||
      /fetch failed|getaddrinfo|network|timeout|connect|unreachable/i.test(errMsg)
    );
    const errorDetails = {
      at: nowIso,
      message: errMsg,
      isNetworkRestriction,
      errorType: isNetworkRestriction ? 'network_restriction' : 'collection_failure'
    };
    source.lastCheckedAt = nowIso;
    source.consecutiveFailureCount = (source.consecutiveFailureCount || 0) + 1;
    source.recentErrors = [errorDetails, ...(source.recentErrors || [])].slice(0, 10);
    source.lastError = errorDetails;
    sources[srcIdx] = source;
    store.writeJson(store.files.sources, sources);

    store.appendAuditLog({
      actor,
      action: isNetworkRestriction ? `collector.network_restriction.${mode}` : `collector.error.${mode}`,
      target: source.name,
      level: 'warn',
      details: isNetworkRestriction ? `Network restricted in environment: ${errMsg}` : errMsg
    });

    return {
      ok: false,
      source,
      mode,
      discoveredCount: 0,
      insertedCount: 0,
      duplicateCount: 0,
      error: errMsg,
      isNetworkRestriction,
      errorType: isNetworkRestriction ? 'network_restriction' : 'collection_failure'
    };
  }
}

/**
 * Clear source error history
 */
function clearSourceErrors(store, sourceId, actor = 'editorial-admin') {
  const sources = store.readJson(store.files.sources, []);
  const srcIdx = sources.findIndex(s => s.id === sourceId);
  if (srcIdx < 0) return false;
  sources[srcIdx].recentErrors = [];
  sources[srcIdx].lastError = null;
  sources[srcIdx].consecutiveFailureCount = 0;
  store.writeJson(store.files.sources, sources);
  store.appendAuditLog({
    actor,
    action: 'collector.errors_cleared',
    target: sources[srcIdx].name,
    level: 'info',
    details: 'Cleared source error history.'
  });
  return true;
}

/**
 * Import candidate registry idempotently, normalize existing sources, and log audit changes
 */
function importCandidateRegistry(store, candidateEntries = null, options = {}) {
  const actor = (typeof options === 'string' ? options : options.actor) || 'editorial-admin';
  const sources = store.readJson(store.files.sources, []);
  const now = new Date().toISOString();
  let updatedCount = 0;
  let insertedCount = 0;

  let candidatesList = candidateEntries;
  if (!Array.isArray(candidatesList) || candidatesList.length === 0) {
    let candidatesPath = path.join(path.dirname(store.files.sources), 'source_registry_candidates.json');
    if (!fs.existsSync(candidatesPath)) {
      candidatesPath = path.join(__dirname, '..', 'data', 'source_registry_candidates.json');
    }
    try {
      if (fs.existsSync(candidatesPath)) {
        candidatesList = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
      }
    } catch {
      candidatesList = [];
    }
  }
  if (!Array.isArray(candidatesList)) candidatesList = [];

  // 1. First, normalize all existing sources to fix empty feedUrl classifications
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const normalized = models.createSourceModel(s, s);
    sources[i] = normalized;
  }

  // 2. Import candidates
  for (const c of candidatesList) {
    const candidateUrl = c.website || c.url || '';
    if (!candidateUrl) continue;
    const normUrl = normalizeCanonicalUrl(candidateUrl);
    const domain = (c.domain || new URL(candidateUrl).hostname || '').toLowerCase().replace(/^www\./, '');

    // Match existing source by canonical URL or domain+manufacturer
    let matchIdx = sources.findIndex(s => {
      const sUrl = normalizeCanonicalUrl(s.website || s.url || '');
      if (sUrl && normUrl && sUrl === normUrl) return true;
      const sDomain = (s.domain || '').toLowerCase().replace(/^www\./, '');
      return sDomain === domain && s.manufacturer.toLowerCase() === (c.manufacturer || '').toLowerCase();
    });

    const isDaimler = (c.name || '').includes('Daimler') || (c.publisher || '').includes('Daimler') || candidateUrl.includes('daimlertruck.com');

    if (matchIdx >= 0) {
      // Update existing source while preserving ID
      const existing = sources[matchIdx];
      const merged = models.createSourceModel({
        ...existing,
        name: c.name || existing.name,
        website: candidateUrl || existing.website,
        url: candidateUrl || existing.url,
        publisher: c.publisher || existing.publisher,
        manufacturer: c.manufacturer || existing.manufacturer,
        category: c.category || existing.category,
        region: c.region || existing.region,
        verifiedPrimary: c.verifiedPrimary ?? existing.verifiedPrimary,
        collectionMode: isDaimler ? 'disabled' : (c.collectionMode || (existing.feedUrl ? 'rss' : 'newsroom_page')),
        sourceType: isDaimler ? 'pending_verification' : (c.sourceType || existing.sourceType),
        enabled: isDaimler ? false : (existing.enabled ?? true),
        automaticCollectionApproved: isDaimler ? false : (existing.automaticCollectionApproved ?? false)
      }, existing);
      sources[matchIdx] = merged;
      updatedCount++;
    } else {
      // Create new stable source record
      const newSource = models.createSourceModel({
        id: `src-${crypto.createHash('sha1').update(candidateUrl).digest('hex').slice(0, 12)}`,
        name: c.name,
        publisher: c.publisher || c.name,
        url: candidateUrl,
        website: candidateUrl,
        feedUrl: c.feedUrl || '',
        sitemapUrl: c.sitemapUrl || '',
        apiEndpoint: c.apiEndpoint || '',
        manufacturer: c.manufacturer || 'Various',
        category: c.category || 'Construction Equipment',
        country: c.country || (c.region === 'India' ? 'India' : 'Global'),
        region: c.region || 'Global',
        collectionMode: isDaimler ? 'disabled' : (c.collectionMode || 'newsroom_page'),
        sourceType: isDaimler ? 'pending_verification' : (c.sourceType || 'newsroom_page'),
        enabled: isDaimler ? false : (c.enabled ?? true),
        verifiedPrimary: Boolean(c.verifiedPrimary),
        automaticCollectionApproved: false, // Strict safety rule: remain false until machine endpoint verified
        permissionsNote: 'Official manufacturer newsroom / fair use reporting. Image rights must be verified independently.',
        imageRightsNote: 'OEM press kit imagery only with explicit credit.'
      });
      sources.push(newSource);
      insertedCount++;
    }
  }

  store.writeJson(store.files.sources, sources);
  store.appendAuditLog({
    actor,
    action: 'collector.import_candidate_registry',
    target: 'sources.json',
    level: 'info',
    details: `Imported candidate registry: normalized ${sources.length} sources, updated ${updatedCount}, inserted ${insertedCount} new candidate sources.`
  });

  return { ok: true, totalSources: sources.length, updatedCount, insertedCount };
}

function validHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  USER_AGENT,
  MAX_RESPONSE_BYTES,
  APPROVED_MANUFACTURER_DOMAINS,
  isSafePublicUrl,
  isDomainApproved,
  normalizeCanonicalUrl,
  decodeAndStripHtml,
  computeTitleFingerprint,
  computeContentFingerprint,
  isPathAllowedByRobotsTxt,
  fetchWithSecurity,
  fetchWithRetry,
  parseFeedXml,
  parseSitemapXml,
  validateSourceEndpoint,
  intakeManualUrl,
  checkSourceNow,
  clearSourceErrors,
  importCandidateRegistry
};
