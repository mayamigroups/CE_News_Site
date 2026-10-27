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

const CATEGORY_SLUGS = [
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
  'tractors',
  'agricultural-machinery',
  'heavy-trucks',
  'pickups',
  'vans',
  'buses',
  'electric-commercial-vehicles',
  'technology',
  'business',
  'reviews',
  'guides',
  'projects',
  'events',
  'videos',
  'bull-machines',
  'brands',
  'regions'
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

  generateSitemapXml(siteUrl) {
    const articles = this.articleRepo.getPublishedArticles().filter(a => !a.seo?.noIndex);
    const canonicalHubs = this.catalogService ? this.catalogService.getCanonicalHubs() : [];
    const catalog = this.taxonomyRepo.getCatalogSummary();

    const publicMfgs = (catalog.manufacturers || []).filter(m =>
      !['all-manufacturers', 'various', 'volvo', 'tata'].includes(m.slug)
    );
    const publicModels = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      m.slug !== 'bull-machines-full-lineup'
    );

    const staticPaths = [
      '/',
      '/manufacturers',
      '/models',
      ...canonicalHubs.map(h => `/${h.slug}/`),
      ...CATEGORY_SLUGS.map(s => `/category/${s}`),
      ...publicMfgs.map(m => `/manufacturers/${m.slug}`),
      ...publicModels.map(m => `/models/${m.slug}`),
      '/about.html',
      '/contact.html',
      '/editorial-policy.html',
      '/corrections.html',
      '/privacy.html',
      '/terms.html',
      '/advertise.html'
    ];

    const urls = [
      ...staticPaths.map(x => `<url><loc>${escapeXml(siteUrl + x)}</loc></url>`),
      ...articles.map(a =>
        `<url><loc>${escapeXml(`${siteUrl}/news/${encodeURIComponent(a.slug)}`)}</loc><lastmod>${escapeXml((a.updatedAt || a.publishedAt || new Date().toISOString()).slice(0, 10))}</lastmod></url>`
      )
    ].join('');

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  }

  generateRssXml(siteUrl, limit = 25) {
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
    <title>Machine Report World — THE WORLD OF MACHINES. CONNECTED.</title>
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
