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
      message: 'Service Account credentials detected, but GSC_PROPERTY_URL is not set. Specify your Search Console property URL (e.g. sc-domain:machinewire.com).',
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
    : 'Google Search Console is Not Connected. No API service account credentials or verification tokens are configured. MachineWire displays measured first-party telemetry and never invents search impressions or rankings.';

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
    const startDate = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

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
          rowLimit: 25
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

module.exports = {
  getServiceAccountCredentials,
  getSearchConsoleStatus,
  createGoogleJwt,
  fetchSearchConsoleMetrics
};
