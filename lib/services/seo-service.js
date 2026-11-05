const seoLib = require('../seo.js');
const aiSeo = require('../ai_seo.js');

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getArticleRealLastmod(a) {
  if (!a) return null;
  const history = Array.isArray(a.updateHistory) ? a.updateHistory : [];
  const editorialEdits = history.filter(entry => {
    if (!entry || !entry.at) return false;
    if (entry.by === 'System Migration') return false;
    if (entry.action === 'created') return false;
    if (/Normalized to v2 content architecture schema/i.test(String(entry.note || ''))) return false;
    return true;
  });
  if (editorialEdits.length > 0) {
    const latest = editorialEdits.map(e => e.at).sort().pop();
    if (latest) {
      const d = new Date(latest);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  if (a.publishedAt) {
    const d = new Date(a.publishedAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (a.createdAt) {
    const d = new Date(a.createdAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

const CATEGORY_SLUGS = [
  'industry-news',
  'bull-machines',
  'construction-equipment',
  'backhoe-loaders',
  'excavators',
  'wheel-loaders',
  'bulldozers',
  'cranes',
  'graders',
  'telehandlers',
  'roadbuilding',
  'mining-equipment',
  'compact-equipment',
  'attachments',
  'new-launches',
  'agricultural-machinery',
  'tractors',
  'commercial-vehicles',
  'heavy-trucks',
  'pickups',
  'vans',
  'buses',
  'electric-commercial-vehicles',
  'technology',
  'reviews-comparisons',
  'buying-guides',
  'market-updates',
  'projects',
  'events-exhibitions',
  'videos'
];

class SeoService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/json/article-repository')} dependencies.articleRepository
   * @param {import('../repositories/json/taxonomy-repository')} dependencies.taxonomyRepository
   * @param {import('../repositories/json/analytics-repository')} dependencies.analyticsRepository
   * @param {import('../repositories/json/editorial-repository')} dependencies.editorialRepository
   * @param {import('../services/catalog-service')} dependencies.catalogService
   * @param {Object} dependencies.store
   */
  constructor({ articleRepository, taxonomyRepository, analyticsRepository, editorialRepository, catalogService, store }) {
    this.articleRepo = articleRepository;
    this.taxonomyRepo = taxonomyRepository;
    this.analyticsRepo = analyticsRepository;
    this.editorialRepo = editorialRepository;
    this.catalogService = catalogService;
    this.store = store;
  }

  generateSitemapIndexXml(siteUrl) {
    const articles = this.articleRepo.getPublishedArticles().filter(a => !a.seo?.noIndex);
    const latestArticleLastmod = articles.map(a => getArticleRealLastmod(a)).filter(Boolean).sort().pop();

    const childSitemaps = [
      { path: '/sitemap-news.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-articles.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-categories.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-brands.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-models.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-regions.xml', lastmod: latestArticleLastmod },
      { path: '/sitemap-pages.xml', lastmod: latestArticleLastmod }
    ];

    const entries = childSitemaps.map(sm => {
      const lm = sm.lastmod ? ('\n    <lastmod>' + escapeXml(sm.lastmod) + '</lastmod>') : '';
      return '\n  <sitemap>\n    <loc>' + escapeXml(siteUrl + sm.path) + '</loc>' + lm + '\n  </sitemap>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + '\n</sitemapindex>';
  }

  generateNewsSitemapXml(siteUrl) {
    const settings = this.store ? this.store.getSettings() : {};
    const siteName = settings.siteName || 'Machine Report World';
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const recentArticles = this.articleRepo.getPublishedArticles().filter(a => {
      if (a.seo?.noIndex) return false;
      const pubTime = new Date(a.publishedAt || 0).getTime();
      return Number.isFinite(pubTime) && pubTime >= cutoff;
    }).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    const urls = recentArticles.map(a => {
      const pubDate = new Date(a.publishedAt).toISOString();
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + '/news/' + encodeURIComponent(a.slug)) + '</loc>\n    <news:news>\n      <news:publication>\n        <news:name>' + escapeXml(siteName) + '</news:name>\n        <news:language>en</news:language>\n      </news:publication>\n      <news:publication_date>' + escapeXml(pubDate) + '</news:publication_date>\n      <news:title>' + escapeXml(a.title) + '</news:title>\n    </news:news>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' + urls + '\n</urlset>';
  }

  generateArticlesSitemapXml(siteUrl) {
    const articles = this.articleRepo.getPublishedArticles().filter(a => !a.seo?.noIndex);
    const urls = articles.map(a => {
      const lm = getArticleRealLastmod(a);
      const lmTag = lm ? ('\n    <lastmod>' + escapeXml(lm) + '</lastmod>') : '';
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + '/news/' + encodeURIComponent(a.slug)) + '</loc>' + lmTag + '\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generateCategoriesSitemapXml(siteUrl) {
    const urls = CATEGORY_SLUGS.map(s => {
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + '/category/' + s) + '</loc>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generateBrandsSitemapXml(siteUrl) {
    const catalog = this.taxonomyRepo.getCatalogSummary();
    const publicMfgs = (catalog.manufacturers || []).filter(m =>
      !['all-manufacturers', 'various', 'volvo', 'tata'].includes(m.slug)
    );

    const paths = ['/manufacturers', ...publicMfgs.map(m => '/manufacturers/' + m.slug)];
    const urls = paths.map(p => {
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + p) + '</loc>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generateModelsSitemapXml(siteUrl) {
    const catalog = this.taxonomyRepo.getCatalogSummary();
    const publicModels = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      m.slug !== 'bull-machines-full-lineup'
    );

    const paths = ['/models', ...publicModels.map(m => '/models/' + m.slug)];
    const urls = paths.map(p => {
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + p) + '</loc>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generateRegionsSitemapXml(siteUrl) {
    const canonicalHubs = this.catalogService ? this.catalogService.getCanonicalHubs() : [];
    const urls = canonicalHubs.map(h => {
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + '/' + h.slug + '/') + '</loc>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generatePagesSitemapXml(siteUrl) {
    const pages = [
      '/',
      '/about.html',
      '/contact.html',
      '/editorial-policy.html',
      '/corrections.html',
      '/privacy.html',
      '/terms.html',
      '/advertise.html',
      '/data',
      '/press'
    ];

    const catalog = this.taxonomyRepo.getCatalogSummary();
    const models = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      m.slug !== 'bull-machines-full-lineup' && m.specs
    );
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const a = models[i];
        const b = models[j];
        const commonKeys = Object.keys(a.specs || {}).filter(k => Object.prototype.hasOwnProperty.call(b.specs || {}, k));
        if (commonKeys.length >= 5) {
          pages.push('/compare/' + a.slug + '-vs-' + b.slug);
        }
      }
    }

    const urls = pages.map(p => {
      return '\n  <url>\n    <loc>' + escapeXml(siteUrl + p) + '</loc>\n  </url>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '\n</urlset>';
  }

  generateSitemapXml(siteUrl) {
    return this.generateSitemapIndexXml(siteUrl);
  }

  generateRssXml(siteUrl, limit = 25) {
    const settings = this.store ? this.store.getSettings() : {};
    const siteName = settings.siteName || 'Machine Report World';
    const articles = this.articleRepo.getPublishedArticles()
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, limit);

    const items = articles.map(a => `
      <item>
        <title>${escapeXml(a.title)}</title>
        <link>${escapeXml(`${siteUrl}/news/${encodeURIComponent(a.slug)}`)}</link>
        <guid isPermaLink="true">${escapeXml(`${siteUrl}/news/${encodeURIComponent(a.slug)}`)}</guid>
        <description>${escapeXml(a.summary || a.excerpt)}</description>
        <category>${escapeXml(a.category)}</category>
        <pubDate>${new Date(a.publishedAt || Date.now()).toUTCString()}</pubDate>
      </item>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteName)} — THE WORLD OF MACHINES. CONNECTED.</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Global construction equipment, backhoe loaders, heavy machinery and commercial vehicle intelligence.</description>
    <language>en</language>${items}
  </channel>
</rss>`;
  }

  generateRobotsTxt(siteUrl) {
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin.html',
      'Disallow: /api/admin/',
      `Sitemap: ${siteUrl}/sitemap.xml`,
      ''
    ].join('\n');
  }

  getAnalyticsAndSearchConfig() {
    return seoLib.getAnalyticsAndSearchConfig(this.store);
  }

  recordTelemetry(event) {
    return seoLib.recordTelemetryEvent(this.store, event);
  }

  getDashboard() {
    return aiSeo.getAiOperationsDashboard(this.store);
  }

  getTasks({ role, status } = {}) {
    let tasks = this.analyticsRepo.getSeoTasks();
    if (role) tasks = tasks.filter(t => t.assignedRole === role);
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks;
  }

  createTask(data, actor = {}) {
    const newTask = aiSeo.createSeoTaskModel(data);
    this.analyticsRepo.saveSeoTask(newTask);

    this.editorialRepo.appendAuditLog({
      actor: actor.username || 'System',
      role: actor.role || 'editor',
      action: 'ai_seo.task_created',
      target: newTask.title,
      level: 'info',
      details: `Role: ${newTask.assignedRole}, Category: ${newTask.category}, Priority: ${newTask.priorityScore}`
    });

    return newTask;
  }

  updateTask(taskId, data, actor = {}) {
    const existing = this.analyticsRepo.getSeoTasks().find(t => t.id === taskId);
    if (!existing) {
      const err = new Error('SEO task not found.');
      err.statusCode = 404;
      throw err;
    }

    const updated = aiSeo.createSeoTaskModel(data, existing);
    this.analyticsRepo.saveSeoTask(updated);

    this.editorialRepo.appendAuditLog({
      actor: actor.username || 'System',
      role: actor.role || 'editor',
      action: 'ai_seo.task_updated',
      target: updated.title,
      level: 'info',
      details: `Status: ${updated.status}, Role: ${updated.assignedRole}`
    });

    return updated;
  }

  deleteTask(taskId, actor = {}) {
    const ok = this.analyticsRepo.deleteSeoTask(taskId);
    if (!ok) {
      const err = new Error('SEO task not found.');
      err.statusCode = 404;
      throw err;
    }

    this.editorialRepo.appendAuditLog({
      actor: actor.username || 'System',
      role: actor.role || 'managing_editor',
      action: 'ai_seo.task_deleted',
      target: taskId,
      level: 'info',
      details: 'Deleted SEO task'
    });

    return true;
  }

  runTechnicalAudit(actor = {}) {
    const audit = aiSeo.runTechnicalSeoAudit(this.store);
    const issueCount = (audit.issuesFound || []).length;

    this.editorialRepo.appendAuditLog({
      actor: actor.username || 'System',
      role: actor.role || 'managing_editor',
      action: 'ai_seo.audit_run',
      target: 'technical_audit',
      level: issueCount ? 'warn' : 'info',
      details: `Technical SEO score: ${audit.overallHealthScore}/100. Issues detected: ${issueCount}`
    });

    return audit;
  }
}

module.exports = SeoService;
