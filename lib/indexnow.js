const appConfig = require('./config.js');

/**
 * IndexNow Protocol Client
 * Dispatches background indexation pings to https://api.indexnow.org/indexnow
 * Never blocks publishing. All outcomes are logged to the audit trail.
 */
async function pingIndexNow({ urls = [], store = null, triggeredBy = 'system' }) {
  const key = process.env.INDEXNOW_KEY ? String(process.env.INDEXNOW_KEY).trim() : '';
  const siteUrl = appConfig.getSiteUrl();
  let host = 'machinereportworld.com';
  try {
    host = new URL(siteUrl).host;
  } catch {}

  const cleanUrls = (Array.isArray(urls) ? urls : [urls])
    .map(u => String(u || '').trim())
    .filter(Boolean)
    .map(u => (u.startsWith('http://') || u.startsWith('https://')) ? u : `${siteUrl.replace(/\/$/, '')}${u.startsWith('/') ? u : `/${u}`}`);

  if (!key) {
    if (store && typeof store.recordAuditLog === 'function') {
      try {
        store.recordAuditLog('indexnow_skipped', triggeredBy, {
          reason: 'INDEXNOW_KEY environment variable is not configured',
          urlList: cleanUrls
        });
      } catch {}
    }
    return {
      ok: false,
      status: 'unconfigured',
      message: 'INDEXNOW_KEY is not configured; search engine ping was skipped.',
      urlList: cleanUrls
    };
  }

  const keyLocation = `${siteUrl.replace(/\/$/, '')}/${key}.txt`;
  const payload = {
    host,
    key,
    keyLocation,
    urlList: cleanUrls
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    const isOk = res.ok || res.status === 200 || res.status === 202;
    const resultMsg = `IndexNow HTTP ${res.status}: ${res.statusText}`;

    if (store && typeof store.recordAuditLog === 'function') {
      try {
        store.recordAuditLog('indexnow_ping', triggeredBy, {
          httpStatus: res.status,
          keyLocation,
          urlList: cleanUrls
        });
      } catch {}
    }

    return {
      ok: isOk,
      status: res.status,
      message: resultMsg,
      urlList: cleanUrls
    };
  } catch (err) {
    if (store && typeof store.recordAuditLog === 'function') {
      try {
        store.recordAuditLog('indexnow_error', triggeredBy, {
          error: err.message,
          urlList: cleanUrls
        });
      } catch {}
    }
    return {
      ok: false,
      status: 'error',
      message: `IndexNow ping failed: ${err.message}`,
      urlList: cleanUrls
    };
  }
}

module.exports = {
  pingIndexNow
};
