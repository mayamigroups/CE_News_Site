const crypto = require('crypto');
const fs = require('fs');

/**
 * Google Search Console Authenticated Data Retrieval & Telemetry Auditor
 * 
 * STRICT INTEGRITY RULE:
 * MachineWire never claims Google Search Console is "connected" merely because
 * a site-verification meta code or property URL is configured.
 * Site verification (<meta name="google-site-verification">) only proves domain ownership to Google;
 * automated Search Console API data retrieval requires authenticated Google Cloud Service Account credentials.
 */

function getServiceAccountCredentials() {
  let clientEmail = String(process.env.GSC_CLIENT_EMAIL || '').trim();
  let privateKey = String(process.env.GSC_PRIVATE_KEY || '').trim();

  // Also support GOOGLE_APPLICATION_CREDENTIALS path if provided
  if ((!clientEmail || !privateKey) && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(credPath)) {
        const raw = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (raw.client_email) clientEmail = raw.client_email;
        if (raw.private_key) privateKey = raw.private_key;
      }
    } catch {
      // Ignore credential read errors; fall back to unconfigured
    }
  }

  // Normalize private key formatting (e.g. handle escaped \n in env strings)
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const hasCredentials = Boolean(
    clientEmail &&
    clientEmail.includes('@') &&
    privateKey &&
    privateKey.includes('-----BEGIN PRIVATE KEY-----')
  );

  return {
    hasCredentials,
    clientEmail: clientEmail || null,
    privateKey: privateKey || null
  };
}

/**
 * Audit Search Console connection status and determine if authenticated API access is active.
 */
function getSearchConsoleStatus(store) {
  const settings = (store && typeof store.getSettings === 'function') ? store.getSettings() : {};
  const verificationCode = String(process.env.GSC_VERIFICATION_CODE || settings.gscVerificationCode || '').trim();
  const propertyUrl = String(process.env.GSC_PROPERTY_URL || settings.gscPropertyUrl || '').trim();
  const creds = getServiceAccountCredentials();

  const verificationMetaPresent = Boolean(verificationCode);
  const propertyUrlConfigured = Boolean(propertyUrl);

  if (creds.hasCredentials && propertyUrlConfigured) {
    return {
      connected: true,
      authenticated: true,
      status: 'authenticated',
      statusLabel: 'Connected & Authenticated',
      message: `Google Search Console API authenticated via Service Account (${creds.clientEmail}) for property "${propertyUrl}".`,
      propertyUrl,
      clientEmail: creds.clientEmail,
      verificationMeta: {
        configured: verificationMetaPresent,
        code: verificationCode || null
      },
      lastAuditAt: new Date().toISOString()
    };
  }

  if (creds.hasCredentials && !propertyUrlConfigured) {
    return {
      connected: false,
      authenticated: false,
      status: 'property_missing',
      statusLabel: 'Not Connected — Missing Property URL',
      message: 'Service Account credentials detected, but GSC_PROPERTY_URL is not set. Specify your Search Console property URL (e.g. sc-domain:yourdomain.com).',
      propertyUrl: null,
      clientEmail: creds.clientEmail,
      verificationMeta: {
        configured: verificationMetaPresent,
        code: verificationCode || null
      },
      lastAuditAt: new Date().toISOString()
    };
  }

  // Verification meta tag only, or no credentials at all
  const statusLabel = verificationMetaPresent
    ? 'Not Connected (Verification Meta Tag Only)'
    : 'Not Connected';

  const message = verificationMetaPresent
    ? 'Google Search Console API is Not Connected. Site ownership verification meta tag is configured in HTML head for domain validation, but automated Search Console API data retrieval requires authenticated Google Cloud Service Account credentials (GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY).'
    : 'Google Search Console is Not Connected. No API service account credentials or verification tokens are configured. Machine Report World displays measured first-party telemetry and never invents search impressions or rankings.';

  return {
    connected: false,
    authenticated: false,
    status: 'not_connected',
    statusLabel,
    message,
    propertyUrl: propertyUrl || null,
    clientEmail: null,
    verificationMeta: {
      configured: verificationMetaPresent,
      code: verificationCode || null
    },
    lastAuditAt: new Date().toISOString()
  };
}

/**
 * Generate Google OAuth2 JWT for Service Account authentication
 */
function createGoogleJwt(clientEmail, privateKey, scope = 'https://www.googleapis.com/auth/webmasters.readonly') {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${encHeader}.${encPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey, 'base64url');

  return `${unsigned}.${signature}`;
}

/**
 * Attempt authenticated Search Console query if credentials exist.
 */
async function fetchSearchConsoleMetrics(options = {}) {
  const creds = getServiceAccountCredentials();
  const propertyUrl = String(options.propertyUrl || process.env.GSC_PROPERTY_URL || '').trim();

  if (!creds.hasCredentials || !propertyUrl) {
    return {
      ok: false,
      connected: false,
      error: 'Google Search Console Service Account credentials or property URL not configured.',
      metrics: null
    };
  }

  try {
    const jwt = createGoogleJwt(creds.clientEmail, creds.privateKey);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 8000)
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return {
        ok: false,
        connected: false,
        error: `OAuth token exchange failed (HTTP ${tokenRes.status}): ${errText.slice(0, 200)}`,
        metrics: null
      };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const endDate = new Date().toISOString().slice(0, 10);
    const numDays = options.days || 28;
    const startDate = new Date(Date.now() - numDays * 86400000).toISOString().slice(0, 10);

    const queryRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: 500
        }),
        signal: AbortSignal.timeout(options.timeoutMs || 8000)
      }
    );

    if (!queryRes.ok) {
      const qErr = await queryRes.text();
      return {
        ok: false,
        connected: false,
        error: `Search Console API query failed (HTTP ${queryRes.status}): ${qErr.slice(0, 200)}`,
        metrics: null
      };
    }

    const queryData = await queryRes.json();
    return {
      ok: true,
      connected: true,
      propertyUrl,
      dateRange: { startDate, endDate },
      rows: queryData.rows || [],
      retrievedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      ok: false,
      connected: false,
      error: `Search Console retrieval error: ${err.message}`,
      metrics: null
    };
  }
}

/**
 * Synchronize Search Console data and store snapshots in data/gsc_snapshots.json.
 * If credentials are missing, returns honest unconfigured state (never fake numbers).
 */
async function syncSearchConsoleData(store) {
  const status = getSearchConsoleStatus(store);
  if (!status.authenticated || !status.propertyUrl) {
    return {
      ok: false,
      connected: false,
      status: status.status,
      statusLabel: status.statusLabel,
      message: status.message,
      lastSyncAt: null,
      topQueries: [],
      topPages: [],
      strikingDistance: [],
      highImpressionLowCtr: [],
      zeroImpressionPages: [],
      suggestedTasks: []
    };
  }

  const result = await fetchSearchConsoleMetrics({
    propertyUrl: status.propertyUrl,
    days: 90,
    timeoutMs: 12000
  });

  if (!result.ok) {
    return {
      ok: false,
      connected: true,
      status: 'api_error',
      statusLabel: 'Search Console API Error',
      message: result.error || 'Failed to retrieve Search Console telemetry.',
      lastSyncAt: null,
      topQueries: [],
      topPages: [],
      strikingDistance: [],
      highImpressionLowCtr: [],
      zeroImpressionPages: [],
      suggestedTasks: []
    };
  }

  const rows = result.rows || [];
  const snapshot = {
    id: `gsc-${Date.now()}`,
    retrievedAt: result.retrievedAt,
    dateRange: result.dateRange,
    rowCount: rows.length,
    rows
  };

  // Store snapshots and prune older than 90 days
  const snapshotsFile = store?.files?.gscSnapshots;
  if (snapshotsFile) {
    let list = store.readJson(snapshotsFile, []);
    const cutoff = Date.now() - 90 * 86400000;
    list = list.filter(s => new Date(s.retrievedAt || 0).getTime() >= cutoff);
    list.unshift(snapshot);
    store.writeJson(snapshotsFile, list.slice(0, 100));
  }

  return analyzeSearchConsoleRows(rows, store, result.retrievedAt);
}

/**
 * Analyze rows and return performance metrics & opportunities.
 */
function analyzeSearchConsoleRows(rows = [], store = null, retrievedAt = null) {
  const queryMap = new Map();
  const pageMap = new Map();

  for (const r of rows) {
    const q = r.keys?.[0] || '';
    const p = r.keys?.[1] || '';
    const clicks = Number(r.clicks || 0);
    const impressions = Number(r.impressions || 0);
    const pos = Number(r.position || 0);

    if (q) {
      const cur = queryMap.get(q) || { query: q, clicks: 0, impressions: 0, totalPos: 0, count: 0 };
      cur.clicks += clicks;
      cur.impressions += impressions;
      cur.totalPos += pos * impressions;
      cur.count += impressions;
      queryMap.set(q, cur);
    }

    if (p) {
      const cur = pageMap.get(p) || { page: p, clicks: 0, impressions: 0, totalPos: 0, count: 0 };
      cur.clicks += clicks;
      cur.impressions += impressions;
      cur.totalPos += pos * impressions;
      cur.count += impressions;
      pageMap.set(p, cur);
    }
  }

  const topQueries = [...queryMap.values()]
    .map(q => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.impressions > 0 ? Number((q.clicks / q.impressions).toFixed(4)) : 0,
      position: q.count > 0 ? Number((q.totalPos / q.count).toFixed(1)) : 0
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10);

  const topPages = [...pageMap.values()]
    .map(p => ({
      page: p.page,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.impressions > 0 ? Number((p.clicks / p.impressions).toFixed(4)) : 0,
      position: p.count > 0 ? Number((p.totalPos / p.count).toFixed(1)) : 0
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10);

  // Striking distance: Position 8.0 - 20.0
  const strikingDistance = [...queryMap.values()]
    .map(q => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.impressions > 0 ? Number((q.clicks / q.impressions).toFixed(4)) : 0,
      position: q.count > 0 ? Number((q.totalPos / q.count).toFixed(1)) : 0
    }))
    .filter(q => q.position >= 8.0 && q.position <= 20.0 && q.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  // High impression low CTR: impressions >= 50, CTR < 2%
  const highImpressionLowCtr = [...queryMap.values()]
    .map(q => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.impressions > 0 ? Number((q.clicks / q.impressions).toFixed(4)) : 0,
      position: q.count > 0 ? Number((q.totalPos / q.count).toFixed(1)) : 0
    }))
    .filter(q => q.impressions >= 50 && q.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  // Zero impression pages from published articles
  let zeroImpressionPages = [];
  if (store && store.files && store.files.articles) {
    const articles = store.readJson(store.files.articles, []).filter(a => a.status === 'published');
    const activePageUrls = new Set([...pageMap.keys()].map(u => u.toLowerCase()));
    zeroImpressionPages = articles
      .filter(a => {
        const pathSlug = `/news/${a.slug}`.toLowerCase();
        return ![...activePageUrls].some(u => u.includes(pathSlug));
      })
      .map(a => ({
        slug: a.slug,
        title: a.title,
        url: `/news/${a.slug}`,
        publishedAt: a.publishedAt
      }))
      .slice(0, 15);
  }

  // Generate suggested tasks & de-duplicate with seo_tasks.json
  const suggestedTasks = [];
  for (const q of strikingDistance.slice(0, 5)) {
    suggestedTasks.push({
      id: `task-gsc-pos-${crypto.createHash('md5').update(q.query).digest('hex').slice(0, 8)}`,
      title: `Optimize ranking for striking-distance query "${q.query}"`,
      taskType: 'striking_distance_query',
      query: q.query,
      targetUrl: topPages[0]?.page || '/',
      evidenceRationale: `Query "${q.query}" averages position ${q.position} with ${q.impressions} impressions. Moving to top 5 yields substantial traffic gain.`,
      recommendedAction: `Integrate query "${q.query}" into H2 subheadings, image captions, and introductory copy.`
    });
  }

  for (const q of highImpressionLowCtr.slice(0, 5)) {
    suggestedTasks.push({
      id: `task-gsc-ctr-${crypto.createHash('md5').update(q.query).digest('hex').slice(0, 8)}`,
      title: `Improve SERP CTR for high-impression query "${q.query}"`,
      taskType: 'low_ctr_query',
      query: q.query,
      targetUrl: topPages[0]?.page || '/',
      evidenceRationale: `Query "${q.query}" generated ${q.impressions} impressions but only ${(q.ctr * 100).toFixed(1)}% CTR.`,
      recommendedAction: `Rewrite meta title and meta description to be more compelling and directly answer user intent for "${q.query}".`
    });
  }

  // De-duplicate into seo_tasks.json if store is available
  if (store && store.files && store.files.seoTasks) {
    const existing = store.readJson(store.files.seoTasks, []);
    let added = false;
    for (const st of suggestedTasks) {
      if (!existing.some(e => e.id === st.id || e.title === st.title)) {
        existing.push({
          ...st,
          assignedRole: 'technical_seo',
          status: 'pending',
          importance: 8,
          confidence: 8,
          effort: 'medium',
          priorityScore: 75,
          resultNotes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null
        });
        added = true;
      }
    }
    if (added) {
      store.writeJson(store.files.seoTasks, existing);
    }
  }

  return {
    ok: true,
    connected: true,
    status: 'authenticated',
    statusLabel: 'Connected & Authenticated',
    message: 'Google Search Console telemetry successfully synchronized.',
    lastSyncAt: retrievedAt || new Date().toISOString(),
    topQueries,
    topPages,
    strikingDistance,
    highImpressionLowCtr,
    zeroImpressionPages,
    suggestedTasks
  };
}

/**
 * Retrieve current Search Performance view (cached snapshot or unconfigured status).
 */
function getSearchPerformanceData(store) {
  const status = getSearchConsoleStatus(store);
  if (!status.authenticated || !status.propertyUrl) {
    return {
      connected: false,
      status: status.status,
      statusLabel: status.statusLabel,
      message: status.message,
      lastSyncAt: null,
      topQueries: [],
      topPages: [],
      strikingDistance: [],
      highImpressionLowCtr: [],
      zeroImpressionPages: [],
      suggestedTasks: []
    };
  }

  const snapshotsFile = store?.files?.gscSnapshots;
  const list = snapshotsFile ? store.readJson(snapshotsFile, []) : [];
  if (list.length > 0) {
    const latest = list[0];
    return analyzeSearchConsoleRows(latest.rows || [], store, latest.retrievedAt);
  }

  return {
    connected: true,
    status: 'authenticated_pending_sync',
    statusLabel: 'Connected (Sync Pending)',
    message: 'Service Account credentials configured. Click "Sync Search Console" to retrieve recent telemetry.',
    lastSyncAt: null,
    topQueries: [],
    topPages: [],
    strikingDistance: [],
    highImpressionLowCtr: [],
    zeroImpressionPages: [],
    suggestedTasks: []
  };
}

module.exports = {
  getServiceAccountCredentials,
  getSearchConsoleStatus,
  createGoogleJwt,
  fetchSearchConsoleMetrics,
  syncSearchConsoleData,
  getSearchPerformanceData
};
