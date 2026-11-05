const { CURRENT_SCHEMA_VERSION } = require('../store.js');

/**
 * Public routes: health, meta, catalog, regions, manufacturers, models, analytics, sitemap, rss, robots
 * @param {Object} ctx
 * @returns {Promise<boolean>} true if handled, false otherwise
 */
async function handlePublicRoutes(ctx) {
  const { req, res, pathname, url, method, services, repositories, store, send, sendText, readBody, siteUrl, pkgVersion } = ctx;

  // IndexNow verification key route: /<INDEXNOW_KEY>.txt
  const keyMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\.txt$/);
  if (method === 'GET' && keyMatch) {
    const configuredKey = process.env.INDEXNOW_KEY;
    if (configuredKey && keyMatch[1] === configuredKey) {
      sendText(res, 200, configuredKey, 'text/plain; charset=utf-8');
      return true;
    }
  }

  // Embeddable badge for brands: /badge/<brand-slug>.svg
  const badgeMatch = pathname.match(/^\/badge\/([a-z0-9-_]+)\.svg$/i);
  if (method === 'GET' && badgeMatch) {
    const slug = badgeMatch[1].toLowerCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="48" viewBox="0 0 240 48" role="img" aria-label="Featured on Machine Report World">
  <rect width="240" height="48" rx="6" fill="#101820"/>
  <rect x="1" y="1" width="238" height="46" rx="5" fill="none" stroke="#2a3848" stroke-width="1.5"/>
  <path d="M14 14h5l3.5 10 3.5-10h5v20h-3.5V20.5L24 30h-3l-3.5-9.5V34H14V14z" fill="#f59e0b"/>
  <text x="42" y="20" fill="#94a3b8" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="700" letter-spacing="1">VERIFIED OEM PROFILE</text>
  <text x="42" y="34" fill="#ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="12" font-weight="700">Machine Report World</text>
</svg>`;
    sendText(res, 200, svg, 'image/svg+xml; charset=utf-8', {
      'Cache-Control': 'public, max-age=86400'
    });
    return true;
  }

  // Open Data CSV: OEM Directory
  if (method === 'GET' && pathname === '/data/oem-directory.csv') {
    const catalog = repositories.taxonomies.getCatalogSummary();
    const mfgs = catalog.manufacturers || [];
    const lines = [
      '# Source: Machine Report World (machinereportworld.com)',
      `# Generated on: ${new Date().toISOString()}`,
      '# Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)',
      'Name,Slug,Country,Headquarters,Website,Focus,Equipment Categories'
    ];
    for (const m of mfgs) {
      const escapeCsv = v => `"${String(v || '').replace(/"/g, '""')}"`;
      const cats = Array.isArray(m.equipmentCategories) ? m.equipmentCategories.join('; ') : (m.equipmentCategories || '');
      lines.push([
        escapeCsv(m.name),
        escapeCsv(m.slug),
        escapeCsv(m.country),
        escapeCsv(m.headquarters),
        escapeCsv(m.website),
        escapeCsv(m.focus),
        escapeCsv(cats)
      ].join(','));
    }
    sendText(res, 200, lines.join('\n'), 'text/csv; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="oem-directory.csv"',
      'Cache-Control': 'public, max-age=3600'
    });
    return true;
  }

  // Open Data CSV: Equipment Models
  if (method === 'GET' && pathname === '/data/models.csv') {
    const catalog = repositories.taxonomies.getCatalogSummary();
    const modelsList = catalog.equipmentModels || [];
    const lines = [
      '# Source: Machine Report World (machinereportworld.com)',
      `# Generated on: ${new Date().toISOString()}`,
      '# Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)',
      'Name,Slug,Manufacturer,Equipment Type,Category,Country,Power Type'
    ];
    for (const mdl of modelsList) {
      const escapeCsv = v => `"${String(v || '').replace(/"/g, '""')}"`;
      lines.push([
        escapeCsv(mdl.name),
        escapeCsv(mdl.slug),
        escapeCsv(mdl.manufacturer),
        escapeCsv(mdl.equipmentType),
        escapeCsv(mdl.category),
        escapeCsv(mdl.country),
        escapeCsv(mdl.powerType)
      ].join(','));
    }
    sendText(res, 200, lines.join('\n'), 'text/csv; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="models.csv"',
      'Cache-Control': 'public, max-age=3600'
    });
    return true;
  }

  // Public submissions (press releases)
  if (method === 'POST' && pathname === '/api/submissions') {
    const body = await readBody(req);
    const company = String(body.company || '').trim();
    const contactEmail = String(body.contactEmail || '').trim();
    const title = String(body.title || '').trim();
    const content = String(body.body || '').trim();
    const type = String(body.type || 'press-release').trim();

    if (!contactEmail.includes('@') || title.length < 5 || content.length < 20) {
      send(res, 400, { error: 'Please provide a valid company email, headline (at least 5 characters), and release body (at least 20 characters).' });
      return true;
    }

    const submission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      company,
      submitterName: String(body.submitterName || '').trim(),
      contactEmail,
      title,
      body: content,
      sourceUrl: String(body.sourceUrl || '').trim(),
      status: 'received',
      createdAt: new Date().toISOString()
    };

    if (store && store.files && store.files.submissions) {
      const list = store.readJson(store.files.submissions, []);
      list.push(submission);
      store.writeJson(store.files.submissions, list);
    }

    send(res, 201, { ok: true, id: submission.id });
    return true;
  }

  if (method === 'GET' && pathname === '/healthz') {
    send(res, 200, {
      ok: true,
      uptime: Math.round(process.uptime()),
      version: pkgVersion || '1.1.0'
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/health') {
    send(res, 200, {
      ok: true,
      name: 'Machine Report World — Global Equipment & Commercial Vehicle News',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      time: new Date().toISOString()
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/meta') {
    const articles = repositories.articles.getPublishedArticles();
    const countBy = key => {
      const map = new Map();
      for (const a of articles) {
        const val = String(a[key] || '').trim();
        if (val) map.set(val, (map.get(val) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    };
    const catalog = repositories.taxonomies.getCatalogSummary();
    send(res, 200, {
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
    return true;
  }

  if (method === 'GET' && pathname === '/api/catalog') {
    const summary = repositories.taxonomies.getCatalogSummary();
    send(res, 200, {
      categories: summary.categories,
      regions: summary.regions,
      countries: summary.countries,
      manufacturers: summary.manufacturers,
      equipmentModels: summary.equipmentModels,
      authors: summary.authors,
      tags: summary.tags
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/authors') {
    send(res, 200, { authors: services.catalog.getAuthors(services.articles.getPublicArticleView) });
    return true;
  }

  const authorMatch = pathname.match(/^\/api\/authors\/([a-z0-9-_]+)$/i);
  if (method === 'GET' && authorMatch) {
    const slug = authorMatch[1].toLowerCase();
    const author = services.catalog.getAuthorBySlug(slug, services.articles.getPublicArticleView);
    if (!author) {
      send(res, 404, { error: 'Author profile not found' });
      return true;
    }
    send(res, 200, author);
    return true;
  }

  if (method === 'GET' && pathname === '/api/regions') {
    send(res, 200, {
      hubs: services.catalog.getRegionsData()
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/manufacturers') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim().slice(0, 100);
    const country = (url.searchParams.get('country') || '').toLowerCase().trim();
    const category = (url.searchParams.get('category') || '').toLowerCase().trim();
    const equipmentType = (url.searchParams.get('equipmentType') || '').toLowerCase().trim();
    const modelQuery = (url.searchParams.get('model') || '').toLowerCase().trim();

    const result = services.catalog.getManufacturers({ q, country, category, equipmentType, modelQuery });
    send(res, 200, result);
    return true;
  }

  const mfgMatch = pathname.match(/^\/api\/manufacturers\/([a-z0-9-_]+)$/i);
  if (method === 'GET' && mfgMatch) {
    const rawSlug = mfgMatch[1].toLowerCase();
    const result = services.catalog.getManufacturerBySlug(rawSlug);
    if (!result) {
      send(res, 404, { error: 'Manufacturer profile not found' });
      return true;
    }
    send(res, 200, result);
    return true;
  }

  if (method === 'GET' && pathname === '/api/models') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim().slice(0, 100);
    const manufacturer = (url.searchParams.get('manufacturer') || '').toLowerCase().trim();
    const equipmentType = (url.searchParams.get('equipmentType') || '').toLowerCase().trim();
    const category = (url.searchParams.get('category') || '').toLowerCase().trim();
    const country = (url.searchParams.get('country') || '').toLowerCase().trim();
    const modelFilter = (url.searchParams.get('model') || '').toLowerCase().trim();

    const result = services.catalog.getModels({ q, manufacturer, equipmentType, category, country, modelFilter });
    send(res, 200, result);
    return true;
  }

  const modelMatch = pathname.match(/^\/api\/models\/([a-z0-9-_]+)$/i);
  if (method === 'GET' && modelMatch) {
    const targetSlug = modelMatch[1].toLowerCase();
    const result = services.catalog.getModelBySlug(targetSlug);
    if (!result) {
      send(res, 404, { error: 'Equipment model profile not found' });
      return true;
    }
    send(res, 200, result);
    return true;
  }

  if (method === 'POST' && pathname === '/api/analytics/view') {
    const body = await readBody(req);
    services.seo.recordTelemetry(body);
    send(res, 200, { ok: true });
    return true;
  }

  if (method === 'GET' && pathname === '/api/analytics/config') {
    send(res, 200, services.seo.getAnalyticsAndSearchConfig());
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap.xml') {
    const sitemap = services.seo.generateSitemapIndexXml ? services.seo.generateSitemapIndexXml(siteUrl) : services.seo.generateSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-news.xml') {
    const sitemap = services.seo.generateNewsSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-articles.xml') {
    const sitemap = services.seo.generateArticlesSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-categories.xml') {
    const sitemap = services.seo.generateCategoriesSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-brands.xml') {
    const sitemap = services.seo.generateBrandsSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-models.xml') {
    const sitemap = services.seo.generateModelsSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-regions.xml') {
    const sitemap = services.seo.generateRegionsSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/sitemap-pages.xml') {
    const sitemap = services.seo.generatePagesSitemapXml(siteUrl);
    sendText(res, 200, sitemap, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && (pathname === '/rss.xml' || pathname === '/feed.xml')) {
    const rss = services.seo.generateRssXml(siteUrl, 25);
    sendText(res, 200, rss, 'application/xml; charset=utf-8');
    return true;
  }

  if (method === 'GET' && pathname === '/robots.txt') {
    const robots = services.seo.generateRobotsTxt(siteUrl);
    sendText(res, 200, robots, 'text/plain; charset=utf-8', {
      'Cache-Control': 'public, max-age=3600'
    });
    return true;
  }

  return false;
}

module.exports = handlePublicRoutes;
