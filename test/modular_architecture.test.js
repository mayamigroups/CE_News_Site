const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Set up clean isolated test directory
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrw-modular-arch-'));
const seedData = fs.readFileSync(path.join(__dirname, '..', 'data', 'articles.json'), 'utf8');
fs.writeFileSync(path.join(tmpDir, 'articles.json'), seedData);

const { createDataStore } = require('../lib/store.js');
const { createRepositories } = require('../lib/repositories');
const { createServices } = require('../lib/services');

test('Repository Abstraction: creates and retrieves entities cleanly across isolated stores', () => {
  const store = createDataStore(tmpDir);
  store.migrate();
  const repos = createRepositories(store);

  // 1. Articles repository
  assert.ok(repos.articles, 'Article repository should be initialized');
  const allArticles = repos.articles.getAll();
  assert.ok(Array.isArray(allArticles));
  assert.ok(allArticles.length > 0);

  const firstSlug = allArticles[0].slug;
  const bySlug = repos.articles.getBySlug(firstSlug);
  assert.equal(bySlug.id, allArticles[0].id);

  // 2. Taxonomies repository
  assert.ok(repos.taxonomies, 'Taxonomy repository should be initialized');
  const catalog = repos.taxonomies.getCatalogSummary();
  assert.ok(catalog.categories && catalog.manufacturers);

  // 3. Editorial repository
  assert.ok(repos.editorial, 'Editorial repository should be initialized');
  const logs = repos.editorial.getAuditLogs(10);
  assert.ok(Array.isArray(logs));

  // 4. Subscriber repository
  assert.ok(repos.subscribers, 'Subscriber repository should be initialized');
  const sub = repos.subscribers.addSubscriber({
    id: 'test-sub-1',
    email: 'test-arch@example.com',
    status: 'active'
  });
  assert.equal(sub.email, 'test-arch@example.com');
  const retrievedSub = repos.subscribers.getSubscriberByEmail('test-arch@example.com');
  assert.equal(retrievedSub.id, 'test-sub-1');
});

test('Service Layer: ArticleService and CatalogService business logic functions in isolation', () => {
  const store = createDataStore(tmpDir);
  store.migrate();
  const repos = createRepositories(store);
  const services = createServices({ repositories: repos, store });

  // 1. Catalog service
  assert.ok(services.catalog, 'Catalog service should be initialized');
  const hubs = services.catalog.getCanonicalRegionalHubs();
  assert.equal(hubs.length, 10, 'Expected 10 canonical regional hubs');

  const mfgResult = services.catalog.getManufacturers({ q: 'caterpillar' });
  assert.ok(mfgResult.disclaimer);
  assert.ok(mfgResult.manufacturers.length > 0);

  // 2. Article service duplicate detection
  assert.ok(services.articles, 'Article service should be initialized');
  const dupCheck = services.articles.checkDuplicate({ title: 'Welcome to your construction equipment news desk' });
  assert.equal(dupCheck.hasDuplicates, true);

  // 3. Seo service
  assert.ok(services.seo, 'SEO service should be initialized');
  const robots = services.seo.generateRobotsTxt('https://machinereportworld.com');
  assert.match(robots, /Sitemap: https:\/\/machinereportworld\.com\/sitemap\.xml/);

  // 4. Distribution service
  assert.ok(services.distribution, 'Distribution service should be initialized');
  const distCfg = services.distribution.getNewsletterConfig();
  assert.equal(typeof distCfg.count, 'number');
});
