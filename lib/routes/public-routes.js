const { CURRENT_SCHEMA_VERSION } = require('../store.js');

/**
 * Public routes: health, meta, catalog, regions, manufacturers, models, analytics, sitemap, rss, robots
 * @param {Object} ctx
 * @returns {Promise<boolean>} true if handled, false otherwise
 */
async function handlePublicRoutes(ctx) {
  const { req, res, pathname, url, method, services, repositories, send, sendText, readBody, siteUrl } = ctx;

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
    const sitemap = services.seo.generateSitemapXml(siteUrl);
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
