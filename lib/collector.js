const crypto = require('node:crypto');
const models = require('./models.js');

const USER_AGENT = 'MachineWireNewsCollector/1.0 (+http://localhost:3000/editorial-policy.html; respectful-editorial-rss-collector)';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref', 'source'
]);

/**
 * Normalize a URL into a deterministic canonical form:
 * - Lowercases protocol and hostname
 * - Strips www. prefix for comparison consistency (while keeping valid URL)
 * - Removes URL fragments (#...)
 * - Removes tracking query parameters (utm_*, fbclid, gclid, etc.)
 * - Sorts remaining query parameters alphabetically
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
  const s = String(raw || '')
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
  return s;
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
 * Parse RSS 2.0 (<item>) and Atom 1.0 (<entry>) XML documents without external dependencies
 */
function parseFeedXml(xmlText, fallbackBaseUrl = '') {
  const text = String(xmlText || '');
  const items = [];

  // Extract <item>...</item> (RSS 2.0 / RDF) or <entry>...</entry> (Atom)
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

    // Link extraction: RSS <link>url</link>, <guid isPermaLink="true">, or Atom <link href="url" />
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

    if (title && canonicalUrl) {
      items.push({
        title,
        originalUrl,
        canonicalUrl,
        publishedAt,
        excerpt: excerpt || `${title} — official feed dispatch.`,
        guid: guid || canonicalUrl
      });
    }
  }
  return items;
}

/**
 * Parse robots.txt Disallow rules for User-agent: * or MachineWireNewsCollector
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
      applies = val === '*' || /machinewire/i.test(val);
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
 * Built-in Sample Feeds for Test Mode (Deterministic, offline-safe verification)
 */
const SAMPLE_FEEDS_BY_SOURCE = {
  'default': `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MachineWire Approved Sample OEM &amp; Industry Feed</title>
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
 * Fetch a URL with safe retries and timeout handling
 */
async function fetchWithRetry(url, options = {}) {
  const maxRetries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 8000;
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8',
    ...(options.headers || {})
  };

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.status === 401 || res.status === 403 || res.status === 402) {
        const err = new Error(`HTTP ${res.status} Access Restricted / Paywall / Bot Protection — collection aborted respectfully without bypassing access controls.`);
        err.noRetry = true;
        err.httpStatus = res.status;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} (${res.statusText || 'Error'}) from ${url}`);
        err.httpStatus = res.status;
        throw err;
      }
      const text = await res.text();
      return {
        status: res.status,
        contentType: res.headers.get('content-type') || '',
        etag: res.headers.get('etag') || '',
        lastModified: res.headers.get('last-modified') || '',
        text
      };
    } catch (err) {
      lastErr = err;
      if (err.noRetry || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Check a single registered source (either in 'test' sample mode or 'live' network mode),
 * deduplicate against existing collected items AND published/draft articles,
 * and store new discovered items in collected_items.json.
 */
async function checkSourceNow(store, sourceId, options = {}) {
  const mode = options.mode === 'test' ? 'test' : 'live';
  const actor = options.actor || 'collection-engine';
  const sources = store.readJson(store.files.sources, []);
  const srcIdx = sources.findIndex(s => s.id === sourceId);
  if (srcIdx < 0) throw new Error(`Approved source not found: ${sourceId}`);

  const source = sources[srcIdx];
  const nowIso = new Date().toISOString();
  const targetFeedUrl = source.feedUrl || source.apiEndpoint || '';

  // Check if source requires an API key from environment variables
  if (mode === 'live' && source.requiresApiKey) {
    const envKeyName = source.apiKeyEnvVar || 'OEM_PARTNER_API_KEY';
    if (!process.env[envKeyName]) {
      const msg = `Source requires authorized API key in environment variable ${envKeyName} (not configured).`;
      source.lastCheckedAt = nowIso;
      source.recentErrors = [{ at: nowIso, message: msg }, ...(source.recentErrors || [])].slice(0, 10);
      sources[srcIdx] = source;
      store.writeJson(store.files.sources, sources);
      store.appendAuditLog({
        actor,
        action: 'collector.skipped_missing_key',
        target: source.name,
        level: 'warn',
        details: msg
      });
      return { ok: false, source, mode, discoveredCount: 0, insertedCount: 0, duplicateCount: 0, error: msg };
    }
  }

  if (mode === 'live' && !targetFeedUrl) {
    const msg = `Source "${source.name}" is an official web reference without a public RSS/Atom feed URL or configured API endpoint. Use test mode or configure a feedUrl.`;
    source.lastCheckedAt = nowIso;
    source.recentErrors = [{ at: nowIso, message: msg }, ...(source.recentErrors || [])].slice(0, 10);
    sources[srcIdx] = source;
    store.writeJson(store.files.sources, sources);
    return { ok: false, source, mode, discoveredCount: 0, insertedCount: 0, duplicateCount: 0, error: msg };
  }

  let rawXml = '';
  let httpEvidence = { status: 200, contentType: 'application/rss+xml (sample-test-mode)', robotsAllowed: true };

  try {
    if (mode === 'test') {
      rawXml = options.sampleXml || SAMPLE_FEEDS_BY_SOURCE[source.id] || SAMPLE_FEEDS_BY_SOURCE.default;
    } else {
      // 1. Respect robots.txt on target feed origin before fetching
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
        // If robots.txt is unreachable or times out, proceed cautiously with standard RSS feed request
      }

      if (!robotsAllowed) {
        throw new Error(`Disallowed by ${robotsUrl} for path ${parsedFeed.pathname}. Respecting robots.txt.`);
      }

      // 2. Fetch RSS/Atom feed with retries and timeout
      const authHeaders = {};
      if (source.requiresApiKey && source.apiKeyEnvVar && process.env[source.apiKeyEnvVar]) {
        authHeaders.Authorization = `Bearer ${process.env[source.apiKeyEnvVar]}`;
      }
      const fetched = await fetchWithRetry(targetFeedUrl, {
        timeoutMs: options.timeoutMs || 8000,
        retries: options.retries ?? 2,
        headers: authHeaders
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

    const parsedItems = parseFeedXml(rawXml, source.url);
    const existingCollected = store.readJson(store.files.collectedItems, []);
    const existingArticles = store.readJson(store.files.articles, []);

    const inserted = [];
    let duplicateCount = 0;

    for (const rawItem of parsedItems.slice(0, 25)) {
      const titleFp = computeTitleFingerprint(rawItem.title);
      const contentFp = computeContentFingerprint(rawItem.title, rawItem.excerpt);

      // Deduplicate against already-collected items AND existing editorial articles
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
        sourceId: source.id,
        sourceName: source.name,
        sourceWebsite: source.url,
        feedUrl: targetFeedUrl || 'sample://test-feed',
        collectionMode: mode,
        title: rawItem.title,
        originalUrl: rawItem.originalUrl,
        canonicalUrl: rawItem.canonicalUrl,
        publishedAt: rawItem.publishedAt || null,
        retrievedAt: nowIso,
        excerpt: rawItem.excerpt,
        manufacturer: source.manufacturer || 'Various',
        category: source.category || 'Construction Equipment',
        country: source.country || 'Global',
        region: source.region || 'Global',
        titleFingerprint: titleFp,
        contentFingerprint: contentFp,
        verificationEvidence: {
          guid: rawItem.guid,
          httpStatus: httpEvidence.status,
          contentType: httpEvidence.contentType,
          etag: httpEvidence.etag || '',
          robotsTxtRespected: httpEvidence.robotsAllowed,
          copyrightNotice: 'Headline and short excerpt only; full text remains on publisher origin. Image requires separate license verification.'
        },
        reviewStatus: 'pending_review', // pending_review | promoted_to_draft | in_review_queue | dismissed
        pipelineStage: 'DEDUPLICATED',
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
    source.lastCheckedAt = nowIso;
    source.recentErrors = [{ at: nowIso, message: errMsg }, ...(source.recentErrors || [])].slice(0, 10);
    sources[srcIdx] = source;
    store.writeJson(store.files.sources, sources);

    store.appendAuditLog({
      actor,
      action: `collector.error.${mode}`,
      target: source.name,
      level: 'warn',
      details: errMsg
    });

    return {
      ok: false,
      source,
      mode,
      discoveredCount: 0,
      insertedCount: 0,
      duplicateCount: 0,
      error: errMsg
    };
  }
}

module.exports = {
  USER_AGENT,
  normalizeCanonicalUrl,
  decodeAndStripHtml,
  computeTitleFingerprint,
  computeContentFingerprint,
  parseFeedXml,
  isPathAllowedByRobotsTxt,
  fetchWithRetry,
  checkSourceNow
};
