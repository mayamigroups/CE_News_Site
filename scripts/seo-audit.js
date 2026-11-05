#!/usr/bin/env node
'use strict';

/**
 * Machine Report World — Production Technical SEO Crawler & Audit
 *
 * Verifies every page linked from navigation, home page, and XML sitemaps:
 *  - Missing or duplicate titles and meta descriptions
 *  - Title length > 70 or meta description > 170
 *  - Missing canonicals or mismatched canonical URLs
 *  - Multiple <h1> tags on a page (must have exactly 1)
 *  - Images missing alt attributes
 *  - Broken internal links (HTTP 4xx / 5xx)
 *  - Redirect chains (> 1 hop)
 *  - Orphan pages (in sitemaps vs internal link graph)
 *
 * Usage:
 *   node scripts/seo-audit.js [baseUrl]
 *
 * Exit code 0 if all clean, 1 if any issues found.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_BASE_URL = 'http://localhost:3000';
const rawBaseArg = process.argv[2] || DEFAULT_BASE_URL;
const targetBaseUrl = rawBaseArg.replace(/\/+$/, '');
const baseOrigin = new URL(targetBaseUrl).origin;

// Helper: fetch a URL with redirect following and hop count
function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve) => {
    let hops = 0;
    let current = targetUrl;

    function doRequest(urlStr) {
      try {
        const parsed = new URL(urlStr);
        const client = parsed.protocol === 'https:' ? https : http;

        const req = client.get(urlStr, {
          headers: {
            'User-Agent': 'MRW-SEO-Audit-Crawler/1.0 (+https://machinereportworld.com)'
          },
          timeout: 10000
        }, (res) => {
          const status = res.statusCode || 0;
          const location = res.headers.location;

          if ([301, 302, 303, 307, 308].includes(status) && location) {
            hops++;
            if (hops > maxRedirects) {
              res.resume();
              return resolve({
                url: urlStr,
                status,
                hops,
                redirectChain: true,
                body: '',
                headers: res.headers,
                error: `Exceeded max redirects (${maxRedirects})`
              });
            }
            const nextUrl = new URL(location, urlStr).toString();
            res.resume();
            return doRequest(nextUrl);
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            resolve({
              url: urlStr,
              initialUrl: targetUrl,
              status,
              hops,
              redirectChain: hops > 1,
              body: data,
              headers: res.headers,
              error: null
            });
          });
        });

        req.on('error', (err) => {
          resolve({
            url: urlStr,
            initialUrl: targetUrl,
            status: 0,
            hops,
            redirectChain: false,
            body: '',
            headers: {},
            error: err.message
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            url: urlStr,
            initialUrl: targetUrl,
            status: 408,
            hops,
            redirectChain: false,
            body: '',
            headers: {},
            error: 'Request timeout'
          });
        });
      } catch (err) {
        resolve({
          url: urlStr,
          initialUrl: targetUrl,
          status: 0,
          hops,
          redirectChain: false,
          body: '',
          headers: {},
          error: err.message
        });
      }
    }

    doRequest(targetUrl);
  });
}

// Extract tags and attributes using regex
function parseHtmlPage(html, pageUrl) {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null;

  // Meta description
  const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

  // Canonical tag
  const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i)
    || html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

  // H1 headings
  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Count = h1Matches.length;

  // Images missing alt attribute
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesMissingAlt = [];
  for (const img of imgTags) {
    if (!/\balt\s*=/i.test(img)) {
      imagesMissingAlt.push(img);
    }
  }

  // Links <a href="...">
  const links = [];
  const linkMatches = html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi);
  for (const match of linkMatches) {
    const rawHref = match[1].trim();
    if (rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('/api/') || rawHref.includes('/admin')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, pageUrl);
      if (resolved.origin === baseOrigin) {
        links.push(resolved.toString());
      }
    } catch {}
  }

  return {
    title,
    metaDescription,
    canonical,
    h1Count,
    imagesMissingAlt,
    links
  };
}

// Extract locs from XML sitemap
function extractSitemapLocs(xml) {
  const locs = [];
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
  for (const m of matches) {
    locs.push(m[1].trim());
  }
  return locs;
}

// Normalize URL path for duplicate check
function normalizeUrlPath(urlStr) {
  try {
    const u = new URL(urlStr);
    let p = u.pathname.replace(/\/+$/, '') || '/';
    return p;
  } catch {
    return urlStr;
  }
}

async function runAudit() {
  console.log(`======================================================================`);
  console.log(`  MACHINE REPORT WORLD — TECHNICAL SEO AUDIT`);
  console.log(`  Target: ${targetBaseUrl}`);
  console.log(`======================================================================\n`);

  const errors = [];
  const warnings = [];

  // Step 1: Audit Sitemaps
  console.log(`[1/4] Inspecting Sitemap Index and Child Sitemaps...`);
  const sitemapIndexRes = await fetchUrl(`${targetBaseUrl}/sitemap.xml`);
  if (sitemapIndexRes.status !== 200) {
    errors.push(`Sitemap index /sitemap.xml returned HTTP ${sitemapIndexRes.status}`);
  }

  const childSitemaps = extractSitemapLocs(sitemapIndexRes.body);
  console.log(`  ✓ Discovered ${childSitemaps.length} child sitemaps in index:`);
  childSitemaps.forEach(loc => console.log(`    - ${loc}`));

  const sitemapUrls = new Set();
  for (const sitemapUrl of childSitemaps) {
    // Ensure child sitemap is queried against targetBaseUrl
    const resolvedSitemapUrl = sitemapUrl.replace(/https?:\/\/[^/]+/i, targetBaseUrl);
    const childRes = await fetchUrl(resolvedSitemapUrl);
    if (childRes.status !== 200) {
      errors.push(`Child sitemap ${resolvedSitemapUrl} returned HTTP ${childRes.status}`);
      continue;
    }
    const locs = extractSitemapLocs(childRes.body);
    for (const loc of locs) {
      const resolvedLoc = loc.replace(/https?:\/\/[^/]+/i, targetBaseUrl);
      sitemapUrls.add(resolvedLoc);
    }
  }
  console.log(`  ✓ Total URLs indexed in sitemaps: ${sitemapUrls.size}\n`);

  // Step 2: Crawl internal links starting from Home Page
  console.log(`[2/4] Crawling internal links & auditing pages...`);
  const visited = new Set();
  const queue = [targetBaseUrl + '/'];
  for (const sUrl of sitemapUrls) {
    queue.push(sUrl);
  }

  // Maps for audit checks
  const crawledPages = new Map(); // url -> parsed data
  const inboundLinks = new Map(); // targetUrlPath -> Set of sourceUrlPaths
  const titlesMap = new Map(); // title -> url
  const descriptionsMap = new Map(); // desc -> url

  while (queue.length > 0) {
    const rawUrl = queue.shift();
    const cleanUrl = rawUrl.split('#')[0];
    if (visited.has(cleanUrl)) continue;
    visited.add(cleanUrl);

    const res = await fetchUrl(cleanUrl);

    // Redirect chain check
    if (res.redirectChain) {
      errors.push(`Redirect chain detected (> 1 hop) for: ${cleanUrl} (${res.hops} hops)`);
    }

    if (res.hops > 0) {
      // It redirected to res.url
      if (!visited.has(res.url) && !queue.includes(res.url)) {
        queue.push(res.url);
      }
      continue;
    }

    // Broken internal link check
    if (res.status >= 400 || res.status === 0) {
      errors.push(`Broken internal link (${res.status || 'CONN_ERROR'}): ${cleanUrl} — ${res.error || 'HTTP Error'}`);
      continue;
    }

    const contentType = (res.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('text/html')) {
      // Non-HTML asset (CSS, JS, CSV, SVG, etc.) verified HTTP 200
      continue;
    }

    const parsed = parseHtmlPage(res.body, res.url);
    const pathKey = normalizeUrlPath(cleanUrl);
    crawledPages.set(cleanUrl, parsed);

    // Track inbound links
    for (const link of parsed.links) {
      const targetPath = normalizeUrlPath(link);
      if (!inboundLinks.has(targetPath)) {
        inboundLinks.set(targetPath, new Set());
      }
      inboundLinks.get(targetPath).add(pathKey);

      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
      }
    }

    // Check 1: Missing or Length of Title
    if (!parsed.title) {
      errors.push(`Missing <title> tag on: ${cleanUrl}`);
    } else {
      if (parsed.title.length > 70) {
        errors.push(`Title exceeds 70 characters (${parsed.title.length} chars) on ${cleanUrl}: "${parsed.title}"`);
      }
      // Duplicate title check (across distinct path keys)
      if (titlesMap.has(parsed.title) && titlesMap.get(parsed.title) !== pathKey) {
        errors.push(`Duplicate <title> found on ${cleanUrl} and ${titlesMap.get(parsed.title)}: "${parsed.title}"`);
      } else {
        titlesMap.set(parsed.title, pathKey);
      }
    }

    // Check 2: Missing or Length of Meta Description
    if (!parsed.metaDescription) {
      // Admin page is exempt since it sends noindex
      if (!cleanUrl.includes('/admin')) {
        errors.push(`Missing meta description on: ${cleanUrl}`);
      }
    } else {
      if (parsed.metaDescription.length > 170) {
        errors.push(`Meta description exceeds 170 characters (${parsed.metaDescription.length} chars) on ${cleanUrl}`);
      }
      // Duplicate meta description check
      if (descriptionsMap.has(parsed.metaDescription) && descriptionsMap.get(parsed.metaDescription) !== pathKey) {
        errors.push(`Duplicate meta description on ${cleanUrl} and ${descriptionsMap.get(parsed.metaDescription)}`);
      } else {
        descriptionsMap.set(parsed.metaDescription, pathKey);
      }
    }

    // Check 3: Canonical tag
    if (!parsed.canonical) {
      if (!cleanUrl.includes('/admin')) {
        errors.push(`Missing canonical tag on: ${cleanUrl}`);
      }
    } else {
      // Validate canonical match
      try {
        const parsedCanonical = new URL(parsed.canonical, targetBaseUrl);
        const parsedClean = new URL(cleanUrl);
        // On pages without query params, canonical path must match page path
        if (!parsedClean.search && parsedCanonical.pathname.replace(/\/+$/, '') !== parsedClean.pathname.replace(/\/+$/, '')) {
          errors.push(`Mismatched canonical URL on ${cleanUrl}: canonical points to ${parsed.canonical}`);
        }
      } catch (err) {
        errors.push(`Invalid canonical URL "${parsed.canonical}" on ${cleanUrl}`);
      }
    }

    // Check 4: Exactly one <h1>
    if (parsed.h1Count !== 1) {
      errors.push(`Page must have exactly 1 <h1> (found ${parsed.h1Count}) on: ${cleanUrl}`);
    }

    // Check 5: Images missing alt
    if (parsed.imagesMissingAlt.length > 0) {
      errors.push(`Page has ${parsed.imagesMissingAlt.length} image(s) missing alt attribute on: ${cleanUrl}`);
    }
  }
  console.log(`  ✓ Audited ${crawledPages.size} HTML pages and verified ${visited.size} total resources.\n`);

  // Step 3: Orphan Pages Check (in sitemaps vs internal link graph)
  console.log(`[3/4] Checking for orphan pages...`);
  let orphanCount = 0;
  for (const sitemapUrl of sitemapUrls) {
    const sPath = normalizeUrlPath(sitemapUrl);
    // Home page is root, not orphan
    if (sPath === '/' || sPath === '') continue;

    const inbounds = inboundLinks.get(sPath);
    // If no page linked to it (or only self-linked)
    if (!inbounds || inbounds.size === 0 || (inbounds.size === 1 && inbounds.has(sPath))) {
      errors.push(`Orphan page: ${sitemapUrl} is listed in sitemap but has 0 incoming internal links from the site.`);
      orphanCount++;
    }
  }
  if (orphanCount === 0) {
    console.log(`  ✓ Zero orphan pages detected. All sitemap URLs are cleanly linked internally.\n`);
  }

  // Step 4: Summary & Exit
  console.log(`[4/4] Audit Results Summary:`);
  console.log(`----------------------------------------------------------------------`);
  console.log(`  Total Resources Crawled:  ${visited.size}`);
  console.log(`  HTML Pages Audited:       ${crawledPages.size}`);
  console.log(`  Sitemap Index URLs:       ${sitemapUrls.size}`);
  console.log(`  Warnings:                 ${warnings.length}`);
  console.log(`  Errors:                   ${errors.length}`);
  console.log(`----------------------------------------------------------------------`);

  if (warnings.length > 0) {
    console.log(`\n⚠ WARNINGS:`);
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  if (errors.length > 0) {
    console.log(`\n❌ AUDIT FAILURES (${errors.length}):`);
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    console.log(`\nAudit completed with ERRORS. Exit code: 1\n`);
    process.exit(1);
  }

  console.log(`\n✅ ALL AUDIT CHECKS PASSED CLEANLY! Exit code: 0\n`);
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Fatal audit runner error:', err);
  process.exit(1);
});
