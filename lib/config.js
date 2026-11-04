/**
 * Central runtime configuration: one source of truth for SITE_URL, brand name and contact emails.
 * Every module that builds absolute URLs or shows contact addresses must read from here.
 */
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DEV_SITE_URL = 'http://localhost:3000';
const DEFAULT_SITE_NAME = 'Machine Report World';
const DEFAULT_SITE_SHORT_NAME = 'MRW';

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Returns a list of problems with SITE_URL for production. Empty array means valid.
 */
function validateProductionSiteUrl(raw) {
  const value = String(raw || '').trim();
  const problems = [];
  if (!value) {
    problems.push('SITE_URL is empty.');
    return problems;
  }
  if (/localhost|127\.0\.0\.1/i.test(value)) problems.push(`SITE_URL "${value}" points to localhost.`);
  let parsed = null;
  try { parsed = new URL(value); } catch { problems.push(`SITE_URL "${value}" is not a valid URL.`); }
  if (parsed && parsed.protocol !== 'https:') problems.push(`SITE_URL "${value}" must use https://.`);
  return problems;
}

/**
 * Resolve the canonical public origin (no trailing slash).
 * Production: SITE_URL is required (validated at server startup).
 * Development/test: falls back to http://localhost:<PORT>.
 */
function getSiteUrl() {
  const raw = String(process.env.SITE_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  const port = Number(process.env.PORT || 3000);
  return port === 3000 ? DEFAULT_DEV_SITE_URL : `http://localhost:${port}`;
}

function readSettingsFile() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** Brand name shown to the public. Read from data/settings.json (siteName). */
function getSiteName(settings) {
  const s = settings || readSettingsFile();
  const name = String(s.siteName || '').trim();
  // Legacy brand values are normalised to the single public brand.
  if (!name || /machine\s*wire/i.test(name)) return DEFAULT_SITE_NAME;
  return name;
}

function getSiteShortName(settings) {
  const s = settings || readSettingsFile();
  return String(s.siteShortName || '').trim() || DEFAULT_SITE_SHORT_NAME;
}

/** Contact addresses come from environment variables only (never hardcoded domains). */
function getContactEmails() {
  return {
    editorial: String(process.env.EDITORIAL_EMAIL || '').trim(),
    corrections: String(process.env.CORRECTIONS_EMAIL || '').trim(),
    advertising: String(process.env.ADVERTISING_EMAIL || '').trim(),
    from: String(process.env.EMAIL_FROM || '').trim()
  };
}

module.exports = {
  DEFAULT_DEV_SITE_URL,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SHORT_NAME,
  isProduction,
  validateProductionSiteUrl,
  getSiteUrl,
  getSiteName,
  getSiteShortName,
  getContactEmails
};
