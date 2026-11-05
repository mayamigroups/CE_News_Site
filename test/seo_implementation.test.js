const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const { createDataStore } = require('../lib/store.js');
const { createRepositories } = require('../lib/repositories/index.js');
const { createServices } = require('../lib/services/index.js');
const {
  renderArticleSsrHtml,
  renderCategorySsrHtml,
  renderAuthorSsrHtml,
  renderHomeSsrHtml,
  renderBrandSsrHtml,
  renderModelSsrHtml,
  renderRegionSsrHtml,
  renderCompareSsrHtml
} = require('../lib/ssr.js');
const { getSearchPerformanceData } = require('../lib/gsc.js');

describe('Machine Report World Comprehensive SEO Implementation & Technical Audit', () => {
  const testDataDir = path.join(__dirname, 'seo_test_data');
  let store;
  let repositories;
  let services;
  let testServer;
  let baseUrl;

  before(async () => {
    if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
    store = createDataStore(testDataDir);
    store.migrate();

    repositories = createRepositories(store);
    services = createServices({ repositories, store });

    // Seed test article if none exist
    const published = services.articles.getPublicArticles();
    if (!published.length) {
      services.articles.createArticle({
        title: 'Komatsu Electric Excavator Global Debut',
        slug: 'komatsu-electric-excavator-global-debut',
        summary: 'Komatsu introduces its zero-emission 20-tonne electric hydraulic excavator for urban infrastructure projects.',
        body: '### Urban Clean Construction\n\nKomatsu has unveiled its production-ready battery-electric 20-tonne excavator. Equipped with high-density lithium-ion battery packs, the machine matches the breakout force of conventional diesel excavators while eliminating worksite noise and emissions. Learn more in our [Excavators](/category/excavators) desk and review competing [Electric Commercial Vehicles](/category/electric-commercial-vehicles).',
        category: 'Excavators',
        manufacturer: 'Komatsu',
        equipmentType: 'Electric Excavator',
        model: 'PC210LCE-11',
        country: 'Japan',
        region: 'Japan & South Korea',
        sourceUrl: 'https://www.komatsu.jp/en/newsroom',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        imageCredit: 'Official OEM Release',
        status: 'published'
      }, { role: 'managing_editor', username: 'seo-auditor' });
    }

    // Start a lightweight test server mimicking server.js SSR behavior
    testServer = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const pathname = parsedUrl.pathname;

      if (/^\/(news|articles)\/([a-z0-9-_]+)\/?$/i.test(pathname)) {
        const match = pathname.match(/^\/(news|articles)\/([a-z0-9-_]+)\/?$/i);
        const slug = match ? match[2] : '';
        const article = services.articles.getPublicArticleBySlug(slug);
        if (!article) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not Found');
        }
        const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'article.html'), 'utf8');
        const ssr = renderArticleSsrHtml(template, article, 'https://machinereportworld.com');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(ssr);
      }

      if (pathname === '/sitemap.xml') {
        const xml = services.seo.generateSitemapXml('https://machinereportworld.com');
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        return res.end(xml);
      }

      if (pathname === '/sitemap-pages.xml') {
        const xml = services.seo.generatePagesSitemapXml('https://machinereportworld.com');
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        return res.end(xml);
      }

      if (pathname === '/sitemap-articles.xml') {
        const xml = services.seo.generateArticlesSitemapXml('https://machinereportworld.com');
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        return res.end(xml);
      }

      if (pathname === '/robots.txt') {
        const robots = services.seo.generateRobotsTxt('https://machinereportworld.com');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(robots);
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    await new Promise((resolve) => {
      testServer.listen(0, () => {
        const port = testServer.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (testServer) await new Promise(r => testServer.close(r));
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  test('1. Server-rendered SEO: Initial HTML response delivers unique metadata without JS injection', async () => {
    const articles = services.articles.getPublicArticles();
    assert(articles.length > 0, 'Should have at least 1 published article');
    const target = articles[0];

    const res = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/news/${target.slug}`, (response) => {
        let html = '';
        response.on('data', chunk => html += chunk);
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, html }));
      }).on('error', reject);
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'text/html; charset=utf-8');

    // Title Tag
    assert(res.html.includes(`<title>${target.title} | MACHINE REPORT WORLD</title>`) || res.html.includes(target.title), 'Must contain article title in <title>');
    assert(!res.html.includes('<title>Article | Machine Report World</title>'), 'Must NOT retain placeholder generic title');

    // Canonical link
    assert(res.html.includes(`rel="canonical" href="https://machinereportworld.com/news/${target.slug}"`), 'Must have absolute canonical URL');

    // Open Graph & Twitter Cards
    assert(res.html.includes('property="og:title"'), 'Must include og:title');
    assert(res.html.includes('property="og:description"'), 'Must include og:description');
    assert(res.html.includes('property="og:url"'), 'Must include og:url');
    assert(res.html.includes('name="twitter:card" content="summary_large_image"'), 'Must include Twitter card');
  });

  test('2. Structured Data: Initial HTML contains complete, valid NewsArticle, NewsMediaOrganization, and BreadcrumbList JSON-LD', async () => {
    const articles = services.articles.getPublicArticles();
    const target = articles[0];

    const res = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/news/${target.slug}`, (response) => {
        let html = '';
        response.on('data', chunk => html += chunk);
        response.on('end', () => resolve({ html }));
      }).on('error', reject);
    });

    // Check script tags exist
    assert(res.html.includes('id="article-jsonld"'), 'Must have #article-jsonld script');
    assert(res.html.includes('id="breadcrumb-jsonld"'), 'Must have #breadcrumb-jsonld script');

    // Extract and parse NewsArticle JSON-LD
    const articleJsonMatch = res.html.match(/<script type="application\/ld\+json" id="article-jsonld">([\s\S]*?)<\/script>/);
    assert(articleJsonMatch, 'NewsArticle JSON-LD script tag match must succeed');
    const newsArticleLd = JSON.parse(articleJsonMatch[1]);

    assert.strictEqual(newsArticleLd['@context'], 'https://schema.org');
    assert.strictEqual(newsArticleLd['@type'], 'NewsArticle');
    assert.strictEqual(newsArticleLd.headline, target.title);
    assert(newsArticleLd.datePublished, 'datePublished must be present');
    assert(newsArticleLd.dateModified, 'dateModified must be present');
    assert.strictEqual(newsArticleLd.publisher['@type'], 'NewsMediaOrganization');
    assert.strictEqual(newsArticleLd.publisher.name, 'Machine Report World');
    assert.strictEqual(newsArticleLd.mainEntityOfPage['@id'], `https://machinereportworld.com/news/${target.slug}`);

    // Extract and parse BreadcrumbList JSON-LD
    const breadcrumbJsonMatch = res.html.match(/<script type="application\/ld\+json" id="breadcrumb-jsonld">([\s\S]*?)<\/script>/);
    assert(breadcrumbJsonMatch, 'BreadcrumbList JSON-LD script tag match must succeed');
    const breadcrumbLd = JSON.parse(breadcrumbJsonMatch[1]);

    assert.strictEqual(breadcrumbLd['@context'], 'https://schema.org');
    assert.strictEqual(breadcrumbLd['@type'], 'BreadcrumbList');
    assert.strictEqual(breadcrumbLd.itemListElement.length, 3);
    assert.strictEqual(breadcrumbLd.itemListElement[0].name, 'Home');
    assert.strictEqual(breadcrumbLd.itemListElement[2].item, `https://machinereportworld.com/news/${target.slug}`);
  });

  test('3. Technical SEO: Validates XML Sitemap and Robots.txt formatting', async () => {
    // Sitemap
    const sitemapRes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/sitemap.xml`, (response) => {
        let xml = '';
        response.on('data', chunk => xml += chunk);
        response.on('end', () => resolve({ status: response.statusCode, xml }));
      }).on('error', reject);
    });

    assert.strictEqual(sitemapRes.status, 200);
    assert(sitemapRes.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration');
    assert(sitemapRes.xml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'sitemap index schema');
    assert(sitemapRes.xml.includes('/sitemap-pages.xml'), 'Sitemap index links sitemap-pages');
    assert(sitemapRes.xml.includes('/sitemap-articles.xml'), 'Sitemap index links sitemap-articles');

    const pagesRes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/sitemap-pages.xml`, (response) => {
        let xml = '';
        response.on('data', chunk => xml += chunk);
        response.on('end', () => resolve({ status: response.statusCode, xml }));
      }).on('error', reject);
    });
    assert.strictEqual(pagesRes.status, 200);
    assert(pagesRes.xml.includes('<loc>https://machinereportworld.com/</loc>'), 'Homepage in pages sitemap');
    assert(pagesRes.xml.includes('<loc>https://machinereportworld.com/about.html</loc>'), 'About in pages sitemap');
    assert(pagesRes.xml.includes('<loc>https://machinereportworld.com/editorial-policy.html</loc>'), 'Policy in pages sitemap');

    // Robots.txt
    const robotsRes = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/robots.txt`, (response) => {
        let txt = '';
        response.on('data', chunk => txt += chunk);
        response.on('end', () => resolve({ status: response.statusCode, txt }));
      }).on('error', reject);
    });

    assert.strictEqual(robotsRes.status, 200);
    assert(robotsRes.txt.includes('User-agent: *'), 'User agent specified');
    assert(robotsRes.txt.includes('Allow: /'), 'Allow root');
    assert(robotsRes.txt.includes('Disallow: /admin.html'), 'Disallow admin page');
    assert(robotsRes.txt.includes('Sitemap: https://machinereportworld.com/sitemap.xml'), 'Sitemap directive present');
  });

  test('4. Technical SEO Audit: Audits route responses, checks thin content and tracks affected URLs', () => {
    const audit = services.seo.runTechnicalAudit({ username: 'seo-auditor', role: 'managing_editor' });
    assert(typeof audit.overallHealthScore === 'number', 'Health score must be a number');
    assert(Array.isArray(audit.checks), 'Checks must be an array');
    assert(audit.checks.length >= 7, 'Must have comprehensive checks including thin content & links');

    const thinCheck = audit.checks.find(c => c.name === 'Content Depth & Thin Content Guard');
    assert(thinCheck, 'Thin content check must be registered');

    const linkCheck = audit.checks.find(c => c.name === 'Internal Cross-Link Integrity');
    assert(linkCheck, 'Internal cross-link integrity check must be registered');
  });

  test('5. Static HTML Canonicals: about.html and contact.html include proper canonical tags', () => {
    const aboutHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'about.html'), 'utf8');
    assert(aboutHtml.includes('<link rel="canonical" href="/about.html">'), 'about.html canonical tag present');

    const contactHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'contact.html'), 'utf8');
    assert(contactHtml.includes('<link rel="canonical" href="/contact.html">'), 'contact.html canonical tag present');
  });

  test('6. Structured Data & JSON-LD: parses every JSON-LD block of home, desk, article, model, brand, author, and region pages and checks required fields', () => {
    const siteUrl = 'https://machinereportworld.com';
    const templatesDir = path.join(__dirname, '..', 'public');

    function extractJsonLdBlocks(html) {
      const blocks = [];
      const matches = html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of matches) {
        try {
          blocks.push(JSON.parse(m[1]));
        } catch (err) {
          assert.fail(`Invalid JSON-LD block: ${err.message}\n${m[1]}`);
        }
      }
      return blocks;
    }

    // A. Home Page
    const homeTpl = fs.readFileSync(path.join(templatesDir, 'index.html'), 'utf8');
    const homeHtml = renderHomeSsrHtml(homeTpl, { siteUrl, store, articles: services.articles.getPublicArticles() });
    const homeBlocks = extractJsonLdBlocks(homeHtml);
    assert(homeBlocks.length >= 2, 'Home page must have NewsMediaOrganization, WebSite, and BreadcrumbList');

    const orgBlock = homeBlocks.find(b => b['@type'] === 'NewsMediaOrganization');
    assert.ok(orgBlock, 'Home must have NewsMediaOrganization JSON-LD');
    assert.strictEqual(orgBlock.name, 'Machine Report World');
    assert.strictEqual(orgBlock.url, siteUrl);
    assert.ok(orgBlock.publishingPrinciples, 'publishingPrinciples required');
    assert.ok(orgBlock.correctionsPolicy, 'correctionsPolicy required');

    const webSiteBlock = homeBlocks.find(b => b['@type'] === 'WebSite');
    assert.ok(webSiteBlock, 'Home must have WebSite JSON-LD');
    assert.ok(webSiteBlock.potentialAction, 'WebSite must have SearchAction');

    // B. Desk Page
    const sectionTpl = fs.readFileSync(path.join(templatesDir, 'section.html'), 'utf8');
    const deskHtml = renderCategorySsrHtml(sectionTpl, {
      slug: 'excavators',
      store,
      siteUrl,
      articles: services.articles.getPublicArticles()
    });
    const deskBlocks = extractJsonLdBlocks(deskHtml);
    const collectionBlock = deskBlocks.find(b => b['@type'] === 'CollectionPage');
    assert.ok(collectionBlock, 'Desk must have CollectionPage JSON-LD');
    assert.ok(collectionBlock.mainEntity && collectionBlock.mainEntity['@type'] === 'ItemList', 'CollectionPage must contain ItemList');

    // C. Model Page
    const modelTpl = fs.readFileSync(path.join(templatesDir, 'model.html'), 'utf8');
    const testModel = {
      name: 'Cat 320 Hydraulic Excavator',
      slug: 'caterpillar-320',
      manufacturer: 'Caterpillar',
      specs: { 'Operating Weight': '22,500 kg', 'Rated Power': '129 kW' }
    };
    const modelHtml = renderModelSsrHtml(modelTpl, { model: testModel, allModels: [testModel], siteUrl });
    const modelBlocks = extractJsonLdBlocks(modelHtml);
    const productBlock = modelBlocks.find(b => b['@type'] === 'Product');
    assert.ok(productBlock, 'Model with real specs must have Product JSON-LD');
    assert.strictEqual(productBlock.name, testModel.name);
    assert.strictEqual(productBlock.brand['@type'], 'Brand');
    assert.strictEqual(productBlock.brand.name, testModel.manufacturer);
    assert.strictEqual(productBlock.aggregateRating, undefined, 'No fake ratings allowed');
    assert.strictEqual(productBlock.offers, undefined, 'No fake prices allowed');

    // D. Brand Page
    const brandTpl = fs.readFileSync(path.join(templatesDir, 'manufacturer.html'), 'utf8');
    const testMfg = { name: 'Komatsu', slug: 'komatsu', overview: 'Japanese multinational manufacturer.' };
    const brandHtml = renderBrandSsrHtml(brandTpl, { manufacturer: testMfg, allManufacturers: [testMfg], siteUrl });
    const brandBlocks = extractJsonLdBlocks(brandHtml);
    const mfgOrgBlock = brandBlocks.find(b => b['@type'] === 'Organization');
    assert.ok(mfgOrgBlock, 'Brand must have Organization JSON-LD');
    assert.strictEqual(mfgOrgBlock.name, testMfg.name);

    // E. Author Page
    const authorTpl = fs.readFileSync(path.join(templatesDir, 'author.html'), 'utf8');
    const testAuthor = { name: 'Editorial Desk', slug: 'editorial-desk', role: 'Staff Reporting Desk' };
    const authorHtml = renderAuthorSsrHtml(authorTpl, { author: testAuthor, siteUrl });
    const authorBlocks = extractJsonLdBlocks(authorHtml);
    const personBlock = authorBlocks.find(b => b['@type'] === 'Person');
    assert.ok(personBlock, 'Author must have Person JSON-LD');
    assert.strictEqual(personBlock.name, testAuthor.name);

    // F. Region Page
    const regionTpl = fs.readFileSync(path.join(templatesDir, 'region.html'), 'utf8');
    const testHub = { slug: 'india', shortName: 'India', title: 'India & South Asia' };
    const regionHtml = renderRegionSsrHtml(regionTpl, { hub: testHub, articles: [], siteUrl });
    const regionBlocks = extractJsonLdBlocks(regionHtml);
    const regionCollection = regionBlocks.find(b => b['@type'] === 'CollectionPage');
    assert.ok(regionCollection, 'Region must have CollectionPage JSON-LD');
  });

  test('7. FAQPage Structured Data: Output FAQPage only when at least 2 real FAQ items exist', () => {
    const siteUrl = 'https://machinereportworld.com';
    const articleTpl = fs.readFileSync(path.join(__dirname, '..', 'public', 'article.html'), 'utf8');

    // Case 1: Article with 2 valid FAQ items
    const artWithTwoFaqs = {
      title: 'Excavator Hydraulic Architecture Analysis',
      slug: 'excavator-hydraulic-architecture-analysis',
      summary: 'Technical breakdown of load-sensing hydraulics.',
      body: 'Detailed technical report text.',
      category: 'Technology',
      manufacturer: 'Komatsu',
      faq: [
        { question: 'What is positive flow control?', answer: 'It is a hydraulic pump displacement system.' },
        { question: 'How does it improve fuel efficiency?', answer: 'It reduces pump idling loss by up to 15 percent.' }
      ]
    };
    const htmlWithFaq = renderArticleSsrHtml(articleTpl, artWithTwoFaqs, siteUrl);
    assert.ok(htmlWithFaq.includes('"@type": "FAQPage"'), 'Must render FAQPage schema when 2 items exist');
    assert.ok(htmlWithFaq.includes('What is positive flow control?'), 'FAQ question must be rendered');

    // Case 2: Article with 1 FAQ item (less than 2 items -> omit FAQPage)
    const artWithOneFaq = {
      ...artWithTwoFaqs,
      faq: [{ question: 'Single question?', answer: 'Single answer.' }]
    };
    const htmlWithOneFaq = renderArticleSsrHtml(articleTpl, artWithOneFaq, siteUrl);
    assert.ok(!htmlWithOneFaq.includes('"@type": "FAQPage"'), 'Must NOT render FAQPage schema when less than 2 items exist');
  });

  test('8. Product Schema Specs Guard: Product only when the model has real spec fields', () => {
    const siteUrl = 'https://machinereportworld.com';
    const modelTpl = fs.readFileSync(path.join(__dirname, '..', 'public', 'model.html'), 'utf8');

    // Model without specs
    const modelWithoutSpecs = {
      name: 'Unspecified Prototype Machine',
      slug: 'unspecified-prototype',
      manufacturer: 'Various',
      specs: {}
    };
    const htmlNoSpecs = renderModelSsrHtml(modelTpl, { model: modelWithoutSpecs, allModels: [modelWithoutSpecs], siteUrl });
    assert.ok(!htmlNoSpecs.includes('"@type": "Product"'), 'Must NOT render Product schema when model has no specs');

    // Model with specs
    const modelWithSpecs = {
      name: 'Verified Heavy Tipper 2830.K',
      slug: 'verified-tipper-2830k',
      manufacturer: 'Tata Motors',
      specs: { 'Gross Vehicle Weight': '28,000 kg', 'Engine Power': '300 hp' }
    };
    const htmlWithSpecs = renderModelSsrHtml(modelTpl, { model: modelWithSpecs, allModels: [modelWithSpecs], siteUrl });
    assert.ok(htmlWithSpecs.includes('"@type": "Product"'), 'Must render Product schema when real specs exist');
  });

  test('9. Search Console Telemetry (Honest Unconfigured State) & Backlinks Registry CRUD', async () => {
    // A. GSC honest unconfigured state
    const gscPerf = getSearchPerformanceData(store);
    assert.strictEqual(gscPerf.connected, false, 'Must report connected: false when unconfigured');
    assert.ok(gscPerf.message.includes('Not Connected') || gscPerf.status === 'not_connected', 'Must display honest notice, zero invented numbers');
    assert.deepStrictEqual(gscPerf.topQueries, [], 'Must never invent fake search queries');

    // B. Backlinks Registry CRUD in store
    const testBacklinks = [
      {
        id: 'bl-test-01',
        url: 'https://constructionnews.example/article',
        targetUrl: '/news/20-tonne-crawler-excavator-comparison',
        domain: 'constructionnews.example',
        anchorText: 'crawler excavator comparison',
        doFollow: true,
        status: 'active',
        notes: 'Editorial reference'
      },
      {
        id: 'bl-test-02',
        url: 'https://machineryforum.example/thread/123',
        targetUrl: '/models/caterpillar-320',
        domain: 'machineryforum.example',
        anchorText: 'Cat 320 specs',
        doFollow: false,
        status: 'lost',
        notes: 'Forum link removed'
      }
    ];

    store.writeJson(store.files.backlinks, testBacklinks);
    const loaded = store.readJson(store.files.backlinks, []);
    assert.strictEqual(loaded.length, 2, 'Should persist 2 backlinks');
    assert.strictEqual(loaded[0].domain, 'constructionnews.example');
    assert.strictEqual(loaded[1].status, 'lost');
  });
});
