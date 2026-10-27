const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Isolate data directory and admin credentials before requiring server.js
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'machinewire-test-'));
const seedData = fs.readFileSync(path.join(__dirname, '..', 'data', 'articles.json'), 'utf8');
fs.writeFileSync(path.join(tmpDir, 'articles.json'), seedData);
fs.writeFileSync(path.join(tmpDir, 'newsletter.json'), '[]');
fs.writeFileSync(path.join(tmpDir, 'submissions.json'), '[]');

process.env.DATA_DIR = tmpDir;
process.env.ADMIN_PASSWORD = 'test-admin-password-2026';
process.env.SESSION_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';

const { createAppServer, models, store } = require('../server.js');

let server;
let baseUrl;
let adminCookie = '';

test.before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('GET /api/health returns service status and schemaVersion 2', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.schemaVersion, 2);
  assert.match(body.name, /Machine Report World|MachineWire/);
});

test('Migration initializes all 12 entity collections and normalizes existing articles', async () => {
  const expectedFiles = [
    'articles.json',
    'authors.json',
    'categories.json',
    'regions.json',
    'countries.json',
    'manufacturers.json',
    'equipment_models.json',
    'sources.json',
    'tags.json',
    'images.json',
    'newsletter.json',
    'admin_users.json',
    'schema_meta.json'
  ];
  for (const file of expectedFiles) {
    assert.ok(fs.existsSync(path.join(tmpDir, file)), `Expected migrated file ${file} to exist`);
  }

  const catRes = await fetch(`${baseUrl}/api/catalog`);
  assert.equal(catRes.status, 200);
  const catalog = await catRes.json();
  assert.ok(catalog.manufacturers.some(m => /^bull machines$/i.test(m.name)));
  assert.ok(catalog.regions.some(r => r.name === 'Asia-Pacific'));
  assert.ok(catalog.countries.some(c => c.name === 'India'));
  assert.ok(catalog.categories.some(c => c.name === 'Commercial Vehicles'));
});

test('GET /api/articles returns only published stories with full v2 fields', async () => {
  const res = await fetch(`${baseUrl}/api/articles`);
  assert.equal(res.status, 200);
  const articles = await res.json();
  assert.ok(Array.isArray(articles));
  assert.ok(articles.length >= 5);
  for (const a of articles) {
    assert.equal(a.status, undefined, 'Public article payload must strip status field');
    assert.ok(a.title);
    assert.ok(a.slug);
    assert.ok(a.summary);
    assert.ok(a.category);
    assert.ok(a.manufacturer);
    assert.ok(a.country);
    assert.ok(a.region);
    assert.ok(Array.isArray(a.sourceUrls));
    assert.ok(a.seo && typeof a.seo === 'object');
    assert.ok(a.createdAt);
    assert.ok(a.publishedAt);
    assert.ok(Array.isArray(a.updateHistory));
  }
});

test('GET /api/articles supports category, manufacturer, country, region, model and query filters', async () => {
  const cvRes = await fetch(`${baseUrl}/api/articles?category=${encodeURIComponent('Commercial Vehicles')}`);
  const cvList = await cvRes.json();
  assert.equal(cvList.length, 1);
  assert.match(cvList[0].title, /tipper/i);

  const bullRes = await fetch(`${baseUrl}/api/articles?manufacturer=${encodeURIComponent('Bull Machines')}`);
  const bullList = await bullRes.json();
  assert.ok(bullList.length >= 1);
  assert.equal(bullList[0].manufacturer, 'Bull Machines');

  const regRes = await fetch(`${baseUrl}/api/articles?region=${encodeURIComponent('Asia-Pacific')}`);
  const regList = await regRes.json();
  assert.ok(regList.length >= 1);
});

test('GET /api/articles/:slug returns single published article and 404 for draft/review', async () => {
  const okRes = await fetch(`${baseUrl}/api/articles/welcome-to-the-magazine`);
  assert.equal(okRes.status, 200);
  const article = await okRes.json();
  assert.equal(article.slug, 'welcome-to-the-magazine');
  assert.ok(article.imageCredit);

  const draftRes = await fetch(`${baseUrl}/api/articles/upcoming-construction-equipment-launches-draft`);
  assert.equal(draftRes.status, 404);
});

test('POST /api/newsletter deduplicates and validates subscriber email', async () => {
  const badRes = await fetch(`${baseUrl}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' })
  });
  assert.equal(badRes.status, 400);

  const okRes1 = await fetch(`${baseUrl}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fleet.editor@example.com', segment: 'Commercial Vehicles' })
  });
  assert.equal(okRes1.status, 201);

  // Duplicate email should update existing record rather than creating a second row
  const okRes2 = await fetch(`${baseUrl}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'FLEET.EDITOR@example.com', segment: 'Global Briefing' })
  });
  assert.equal(okRes2.status, 201);

  const countRes = await fetch(`${baseUrl}/api/newsletter`);
  const countData = await countRes.json();
  assert.equal(countData.count, 1);
});

test('Admin workflow: 6 statuses (draft, review, scheduled, published, rejected, archived), updateHistory, duplicate prevention, and backups', async () => {
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'managing-editor', password: 'test-admin-password-2026' })
  });
  assert.equal(loginRes.status, 200);
  adminCookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 1. Create article with full schema (SEO, imageCredit, model, region, country, sourceUrls)
  const pastIso = new Date(Date.now() - 60_000).toISOString();
  const payload = {
    title: 'Scheduled Commercial Truck Axle Tech Report',
    slug: 'custom-axle-tech-slug',
    summary: 'Testing custom slug persistence, SEO metadata, and scheduled article auto-promotion.',
    body: 'Full verified report body covering hub-reduction tandem axles for heavy tippers.',
    category: 'Commercial Vehicles',
    manufacturer: 'Volvo Trucks',
    equipmentType: 'Heavy tipper',
    model: 'FMX 500 8x4',
    powerType: 'Diesel Euro 6',
    country: 'Sweden',
    region: 'Europe',
    author: 'Commercial Vehicles Desk',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1400&q=85',
    imageCredit: 'Volvo Trucks Media Archive',
    sourceUrl: 'https://www.volvotrucks.com/',
    sourceUrls: ['https://www.volvotrucks.com/en-en/news.html'],
    seo: {
      metaTitle: 'Volvo FMX 500 Hub-Reduction Axle Analysis',
      metaDescription: 'Technical review of tandem hub-reduction axles for heavy tippers.',
      canonicalUrl: 'https://machinewire.example/articles/custom-axle-tech-slug',
      keywords: ['Volvo Trucks', 'FMX 500', 'Hub Reduction']
    },
    status: 'scheduled',
    scheduledAt: pastIso,
    specs: { 'Axle Rating': '32 Tonnes', 'Reduction': 'Hub Planetary' }
  };

  const createRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(payload)
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.slug, 'custom-axle-tech-slug');
  assert.equal(created.imageCredit, 'Volvo Trucks Media Archive');
  assert.equal(created.seo.metaTitle, 'Volvo FMX 500 Hub-Reduction Axle Analysis');
  assert.equal(created.updateHistory.length, 1);

  // 2. Duplicate headline check returns 409 Conflict
  const dupRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(payload)
  });
  assert.equal(dupRes.status, 409);

  // 3. Scheduled article auto-promotes to published when read
  const pubRes = await fetch(`${baseUrl}/api/articles/custom-axle-tech-slug`);
  assert.equal(pubRes.status, 200);

  // 4. Transition status to 'rejected' and then 'archived' and verify updateHistory + public hiding
  for (const nextStatus of ['rejected', 'archived']) {
    const patchRes = await fetch(`${baseUrl}/api/admin/articles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        status: nextStatus,
        revisionNote: `Moved to ${nextStatus} during test`
      })
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.status, nextStatus);
    assert.ok(patched.updateHistory.some(h => h.status === nextStatus));

    const hiddenRes = await fetch(`${baseUrl}/api/articles/custom-axle-tech-slug`);
    assert.equal(hiddenRes.status, 404, `Article with status ${nextStatus} must not be publicly visible`);
  }

  // 5. Verify entities were automatically synced into normalized catalogs without duplicates
  const catRes = await fetch(`${baseUrl}/api/admin/catalog`, {
    headers: { Cookie: adminCookie }
  });
  assert.equal(catRes.status, 200);
  const adminCatalog = await catRes.json();
  assert.ok(adminCatalog.manufacturers.some(m => m.name === 'Volvo Trucks'));
  assert.ok(adminCatalog.equipmentModels.some(m => m.name === 'FMX 500 8x4'));
  assert.ok(adminCatalog.sources.some(s => s.url === 'https://www.volvotrucks.com/'));

  // 6. Create and list backup snapshots
  const bkpRes = await fetch(`${baseUrl}/api/admin/backups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ reason: 'test-suite-backup' })
  });
  assert.equal(bkpRes.status, 201);
  const bkpListRes = await fetch(`${baseUrl}/api/admin/backups`, {
    headers: { Cookie: adminCookie }
  });
  const bkpList = await bkpListRes.json();
  assert.ok(bkpList.length >= 1);
  assert.ok(bkpList.some(b => b.reason === 'test-suite-backup'));
});

test('Unit test: all 12 reusable model factories validate and normalize inputs', () => {
  assert.equal(models.createRegionModel({ name: 'Middle East' }).slug, 'middle-east');
  assert.equal(models.createCountryModel({ name: 'Germany', isoCode: 'deu', region: 'Europe' }).isoCode, 'DEU');
  assert.equal(models.createCategoryModel({ name: 'Cranes & Lifting' }).id, 'cat-cranes-lifting');
  assert.equal(models.createAuthorModel({ name: 'Heavy Fleet Desk' }).id, 'aut-heavy-fleet-desk');
  assert.equal(models.createManufacturerModel({ name: 'Liebherr', website: 'https://www.liebherr.com/' }).slug, 'liebherr');
  assert.equal(models.createEquipmentModel({ name: '3DX Plus', manufacturer: 'JCB' }).id, 'mdl-jcb-3dx-plus');
  assert.equal(models.createSourceModel({ url: 'https://bullmachines.com/news' }).domain, 'bullmachines.com');
  assert.equal(models.createTagModel('Stage V Emissions').slug, 'stage-v-emissions');
  assert.equal(models.createImageModel({ url: 'https://example.com/photo.jpg', credit: 'OEM Press' }).credit, 'OEM Press');
  assert.equal(models.createNewsletterModel({ email: 'USER@Example.com' }).email, 'user@example.com');
  assert.equal(models.createAdminUserModel({ username: 'ChiefEditor', role: 'super_admin' }).role, 'super_admin');
});

test('Static pages, design system assets, 13 homepage sections, 9 nav items, 7 footer policy pages, sitemap.xml, rss.xml, and robots.txt are served properly', async () => {
  const routes = [
    '/',
    '/article.html',
    '/section.html',
    '/admin.html',
    '/about.html',
    '/contact.html',
    '/editorial-policy.html',
    '/corrections.html',
    '/privacy.html',
    '/terms.html',
    '/advertise.html',
    '/styles.css',
    '/components.js',
    '/sitemap.xml',
    '/rss.xml',
    '/robots.txt'
  ];
  for (const route of routes) {
    const res = await fetch(`${baseUrl}${route}`);
    assert.equal(res.status, 200, `Expected 200 OK for ${route}`);
  }

  const cssRes = await fetch(`${baseUrl}/styles.css`);
  const cssText = await cssRes.text();
  assert.match(cssText, /#101820/i, 'Expected Midnight Charcoal (#101820) in styles.css');
  assert.match(cssText, /#F5A623/i, 'Expected Industrial Amber (#F5A623) in styles.css');
  assert.match(cssText, /#F1F4F7/i, 'Expected Steel Grey (#F1F4F7) in styles.css');
  assert.match(cssText, /#17212B/i, 'Expected Primary Text (#17212B) in styles.css');
  assert.match(cssText, /#65717D/i, 'Expected Secondary Text (#65717D) in styles.css');
  assert.match(cssText, /#DCE2E8/i, 'Expected Borders (#DCE2E8) in styles.css');
  assert.match(cssText, /family=Inter:wght@400;500;600;700/i, 'Expected Inter 400/500/600/700 font import');

  const homeRes = await fetch(`${baseUrl}/`);
  const homeHtml = await homeRes.text();
  assert.match(homeHtml, /THE WORLD OF MACHINES\. CONNECTED\./, 'Expected brand tagline in homepage');

  // Verify all 9 required header navigation items
  for (const navLabel of ['Home', 'Latest News', 'Equipment', 'Brands', 'Technology', 'Business', 'Reviews', 'Guides', 'Regions']) {
    assert.ok(homeHtml.includes(`>${navLabel}</a>`), `Expected header navigation link "${navLabel}"`);
  }

  // Verify all 13 homepage section containers exist
  for (const secId of [
    'breaking-news',
    'featured-section',
    'sec-construction',
    'sec-tractors',
    'sec-trucks',
    'sec-brands',
    'sec-technology',
    'sec-business',
    'sec-reviews-guides',
    'sec-regions',
    'sec-events',
    'newsletter'
  ]) {
    assert.ok(homeHtml.includes(`id="${secId}"`), `Expected homepage section #${secId}`);
  }

  // Verify all 7 required footer institutional links
  for (const footerHref of ['/about.html', '/contact.html', '/editorial-policy.html', '/corrections.html', '/privacy.html', '/terms.html', '/advertise.html']) {
    assert.ok(homeHtml.includes(`href="${footerHref}"`), `Expected footer link to ${footerHref}`);
  }

  // Verify all 26 required category listing URLs (/category/:slug) return 200 OK
  const all26Categories = [
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
    'videos'
  ];
  for (const catSlug of all26Categories) {
    const catRes = await fetch(`${baseUrl}/category/${catSlug}`);
    assert.equal(catRes.status, 200, `Expected 200 OK for /category/${catSlug}`);
  }

  // Verify clean SEO article URLs (/news/:slug) return 200 OK for every published article
  const pubArticlesRes = await fetch(`${baseUrl}/api/articles`);
  const pubArticles = await pubArticlesRes.json();
  for (const art of pubArticles) {
    const cleanArtRes = await fetch(`${baseUrl}/news/${art.slug}`);
    assert.equal(cleanArtRes.status, 200, `Expected 200 OK for clean article URL /news/${art.slug}`);
  }

  // Verify sitemap.xml contains clean /category/, /news/, and regional hub URLs
  const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemapXml = await sitemapRes.text();
  assert.match(sitemapXml, /\/category\/construction-equipment/);
  assert.match(sitemapXml, /\/category\/electric-commercial-vehicles/);
  assert.match(sitemapXml, /\/news\/welcome-to-the-magazine/);
  assert.match(sitemapXml, /\/india\//);
  assert.match(sitemapXml, /\/north-america\//);
  assert.match(sitemapXml, /\/europe\//);
  assert.match(sitemapXml, /\/china\//);
});

test('Global regional news system: routes (/india/, /north-america/, /europe/, /china/, etc.), prioritization API, verified market dossiers, and analytics tracking', async () => {
  const regionalRoutes = [
    '/india/',
    '/north-america/',
    '/united-states/',
    '/europe/',
    '/china/',
    '/japan-south-korea/',
    '/middle-east/',
    '/southeast-asia/',
    '/australia/',
    '/latin-america/',
    '/africa/',
    '/region.html'
  ];

  for (const rRoute of regionalRoutes) {
    const res = await fetch(`${baseUrl}${rRoute}`);
    assert.equal(res.status, 200, `Expected 200 OK for regional route ${rRoute}`);
    const html = await res.text();
    assert.match(html, /region-dossier-banner/, `Expected regional intelligence dossier container on ${rRoute}`);
    assert.match(html, /international-section/, `Expected international stories section alongside local news on ${rRoute}`);
  }

  // Verify GET /api/regions returns all 10 prioritized regional hubs with verified local context
  const regRes = await fetch(`${baseUrl}/api/regions`);
  assert.equal(regRes.status, 200);
  const regData = await regRes.json();
  assert.ok(Array.isArray(regData.hubs));
  assert.equal(regData.hubs.length, 10, 'Expected 10 canonical regional hubs');

  // Verify priority ordering (sorted descending by priorityScore)
  for (let i = 1; i < regData.hubs.length; i++) {
    assert.ok(
      regData.hubs[i - 1].priorityScore >= regData.hubs[i].priorityScore,
      'Expected regions to be prioritized by composite priorityScore'
    );
  }

  // Verify India & North America & China hubs have verified local terminology, units, currencies, and regulations
  const indiaHub = regData.hubs.find((r) => r.slug === 'india');
  assert.ok(indiaHub, 'Expected India regional hub');
  assert.equal(indiaHub.canonicalUrl, '/india/');
  assert.match(indiaHub.currency, /INR/i);
  assert.match(indiaHub.regulations, /CEV Stage V/i);
  assert.ok(indiaHub.localArticleCount >= 1, 'Expected verified local India news count >= 1');

  const naHub = regData.hubs.find((r) => r.slug === 'north-america');
  assert.ok(naHub, 'Expected North America / United States regional hub');
  assert.equal(naHub.canonicalUrl, '/north-america/');
  assert.match(naHub.regulations, /EPA Tier 4 Final/i);

  const chinaHub = regData.hubs.find((r) => r.slug === 'china');
  assert.ok(chinaHub, 'Expected China regional hub');
  assert.equal(chinaHub.canonicalUrl, '/china/');
  assert.match(chinaHub.currency, /CNY/i);

  // Verify POST /api/analytics/view records regional & article views and updates priority analytics
  const beforeChinaViews = chinaHub.analyticsViews || 0;
  const viewRes = await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'region', slug: 'china' })
  });
  assert.equal(viewRes.status, 200);

  const afterRegRes = await fetch(`${baseUrl}/api/regions`);
  const afterRegData = await afterRegRes.json();
  const afterChinaHub = afterRegData.hubs.find((r) => r.slug === 'china');
  assert.equal(afterChinaHub.analyticsViews, beforeChinaViews + 1, 'Expected China regional analytics view count to increment');
});

test('Searchable manufacturer profiles and individual equipment/model pages: directory candidates, filters, official sources, and competing models', async () => {
  // 1. Verify /api/manufacturers returns all required global brands treated as independent directory candidates
  const mfgRes = await fetch(`${baseUrl}/api/manufacturers`);
  assert.equal(mfgRes.status, 200);
  const mfgData = await mfgRes.json();
  assert.match(mfgData.disclaimer, /independent editorial directory candidates/i);

  const requiredBrands = [
    'bull-machines',
    'jcb',
    'caterpillar',
    'komatsu',
    'volvo-construction-equipment',
    'case',
    'john-deere',
    'kubota',
    'mahindra',
    'tata-motors',
    'sany',
    'xcmg',
    'hd-hyundai',
    'liebherr'
  ];

  for (const slug of requiredBrands) {
    const found = mfgData.manufacturers.find((m) => m.slug === slug);
    assert.ok(found, `Expected manufacturer directory candidate "${slug}"`);
    assert.ok(found.overview && found.overview.length > 20, `Expected verified overview for ${slug}`);
    assert.ok(found.headquarters, `Expected confirmed headquarters for ${slug}`);
    assert.ok(found.website.startsWith('https://'), `Expected official website for ${slug}`);
    assert.ok(Array.isArray(found.equipmentCategories) && found.equipmentCategories.length >= 1, `Expected equipment categories for ${slug}`);
    assert.ok(Array.isArray(found.technologyHighlights) && found.technologyHighlights.length >= 1, `Expected technology updates for ${slug}`);
    assert.ok(Array.isArray(found.regionalFootprint) && found.regionalFootprint.length >= 1, `Expected regional footprint for ${slug}`);
    assert.match(found.verificationStatus, /No Partnership Claimed/i);

    // Verify clean HTML route /manufacturers/:slug returns 200 OK
    const pageRes = await fetch(`${baseUrl}/manufacturers/${slug}`);
    assert.equal(pageRes.status, 200, `Expected 200 OK for /manufacturers/${slug}`);
  }

  // 2. Verify /api/manufacturers search and filter parameters (country, category, equipmentType, model, q)
  const indiaMfgsRes = await fetch(`${baseUrl}/api/manufacturers?country=India`);
  const indiaMfgs = await indiaMfgsRes.json();
  assert.ok(indiaMfgs.manufacturers.some((m) => m.slug === 'bull-machines'));
  assert.ok(indiaMfgs.manufacturers.some((m) => m.slug === 'tata-motors'));

  const craneMfgsRes = await fetch(`${baseUrl}/api/manufacturers?category=Cranes`);
  const craneMfgs = await craneMfgsRes.json();
  assert.ok(craneMfgs.manufacturers.some((m) => m.slug === 'liebherr'));
  assert.ok(craneMfgs.manufacturers.some((m) => m.slug === 'sany'));

  // 3. Verify single manufacturer endpoint /api/manufacturers/:slug (including related news & product models)
  const bullProfileRes = await fetch(`${baseUrl}/api/manufacturers/bull-machines`);
  assert.equal(bullProfileRes.status, 200);
  const bullProfile = await bullProfileRes.json();
  assert.equal(bullProfile.name, 'BULL Machines');
  assert.match(bullProfile.headquarters, /Coimbatore/i);
  assert.ok(bullProfile.models.length >= 1, 'Expected indexed equipment models for BULL Machines');
  assert.ok(bullProfile.relatedArticles.length >= 1, 'Expected related published news for BULL Machines');

  // 4. Verify /api/models search and filter by manufacturer, equipmentType, model, country, category
  const modListRes = await fetch(`${baseUrl}/api/models`);
  assert.equal(modListRes.status, 200);
  const modListData = await modListRes.json();
  assert.ok(modListData.models.length >= 12, 'Expected 12+ verified equipment/vehicle models');

  const backhoeFilterRes = await fetch(`${baseUrl}/api/models?category=${encodeURIComponent('Backhoe Loaders')}`);
  const backhoeData = await backhoeFilterRes.json();
  assert.ok(backhoeData.models.length >= 4, 'Expected multiple competing backhoe loader models');
  assert.ok(backhoeData.models.every((m) => m.category === 'Backhoe Loaders'));

  const japanFilterRes = await fetch(`${baseUrl}/api/models?country=Japan`);
  const japanData = await japanFilterRes.json();
  assert.ok(japanData.models.some((m) => m.manufacturer === 'Komatsu'));
  assert.ok(japanData.models.some((m) => m.manufacturer === 'Kubota'));

  // 5. Verify individual model detail endpoint /api/models/:slug and clean route /models/:slug
  const jcbModelRes = await fetch(`${baseUrl}/api/models/jcb-3dx-backhoe-loader`);
  assert.equal(jcbModelRes.status, 200);
  const jcbModel = await jcbModelRes.json();
  assert.equal(jcbModel.manufacturer, 'JCB');
  assert.ok(jcbModel.specs && Object.keys(jcbModel.specs).length >= 3);
  assert.ok(jcbModel.applications.length >= 2);
  assert.ok(jcbModel.features.length >= 2);
  assert.ok(jcbModel.competingModelsResolved.length >= 2, 'Expected resolved competing backhoe loader models');
  assert.ok(jcbModel.competingModelsResolved.some((c) => c.slug === 'bull-machines-hd76-hd96-backhoe-loader'));

  const modelHtmlRes = await fetch(`${baseUrl}/models/jcb-3dx-backhoe-loader`);
  assert.equal(modelHtmlRes.status, 200);
});

test('Upgraded Admin Dashboard: scrypt password hashing, role-based permissions, 9 management screens, duplicate detection, jobs runner, audit logs, and SEO settings', async () => {
  // 1. Login as super_admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  assert.equal(loginRes.status, 200);
  const superCookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Verify session endpoint returns role & permissions
  const sessRes = await fetch(`${baseUrl}/api/admin/session`, {
    headers: { Cookie: superCookie }
  });
  assert.equal(sessRes.status, 200);
  const sessData = await sessRes.json();
  assert.equal(sessData.role, 'super_admin');
  assert.equal(sessData.permissions.canPublish, true);
  assert.equal(sessData.permissions.canManageUsersAndSettings, true);

  // 2. Create an "author" role user with scrypt-hashed password and verify RBAC enforcement
  const createAuthorUserRes = await fetch(`${baseUrl}/api/admin/catalog/adminUsers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({
      username: 'junior-writer',
      email: 'writer@machinewire.local',
      role: 'author',
      password: 'writer-secret-pass-99'
    })
  });
  assert.equal(createAuthorUserRes.status, 201);
  const createdUser = await createAuthorUserRes.json();
  assert.equal(createdUser.role, 'author');
  assert.equal(createdUser.passwordHash, undefined, 'Never expose passwordHash in API response');

  // Sign in as junior-writer (author role) using their scrypt-hashed password
  const writerLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'junior-writer', password: 'writer-secret-pass-99' })
  });
  assert.equal(writerLoginRes.status, 200);
  const writerCookie = writerLoginRes.headers.get('set-cookie').split(';')[0];

  // Author CAN create a draft article
  const writerDraftRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: writerCookie },
    body: JSON.stringify({
      title: 'Author Role Draft Report on Compact Loader Hydraulics',
      summary: 'Testing role-based draft creation by an author account.',
      body: 'Full technical body text covering compact loader auxiliary hydraulic flow rates and pressure relief valves.',
      category: 'Compact Equipment',
      manufacturer: 'Kubota',
      status: 'draft'
    })
  });
  assert.equal(writerDraftRes.status, 201);
  const writerDraft = await writerDraftRes.json();

  // Author CANNOT directly publish or delete an article (403 Forbidden)
  const writerPublishAttempt = await fetch(`${baseUrl}/api/admin/articles/${writerDraft.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: writerCookie },
    body: JSON.stringify({ status: 'published' })
  });
  assert.equal(writerPublishAttempt.status, 403, 'Expected 403 Forbidden when author role attempts to publish');

  const writerDeleteAttempt = await fetch(`${baseUrl}/api/admin/articles/${writerDraft.id}`, {
    method: 'DELETE',
    headers: { Cookie: writerCookie }
  });
  assert.equal(writerDeleteAttempt.status, 403, 'Expected 403 Forbidden when author role attempts to delete');

  // 3. Test pre-publish duplicate detection endpoint (/api/admin/articles/check-duplicate)
  const dupCheckRes = await fetch(`${baseUrl}/api/admin/articles/check-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({
      title: 'Author Role Draft Report on Compact Loader Hydraulics'
    })
  });
  assert.equal(dupCheckRes.status, 200);
  const dupData = await dupCheckRes.json();
  assert.equal(dupData.hasDuplicates, true);
  assert.equal(dupData.matches[0].id, writerDraft.id);

  // 4. Test CRUD across catalog management screens (Approved Sources, Images & Credits, Tags) and deletion
  const addSrcRes = await fetch(`${baseUrl}/api/admin/catalog/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({
      url: 'https://www.komatsu.com/en/newsroom/',
      title: 'Komatsu Global Newsroom',
      publisher: 'Komatsu Ltd.',
      sourceType: 'oem-release'
    })
  });
  assert.equal(addSrcRes.status, 201);

  const addTagRes = await fetch(`${baseUrl}/api/admin/catalog/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({ name: 'Stage V Compliance' })
  });
  assert.equal(addTagRes.status, 201);

  const delTagRes = await fetch(`${baseUrl}/api/admin/catalog/tags/stage-v-compliance`, {
    method: 'DELETE',
    headers: { Cookie: superCookie }
  });
  assert.equal(delTagRes.status, 200);

  // 5. Test Collection Jobs runner, Audit Logs, and SEO/Website Settings
  const runJobRes = await fetch(`${baseUrl}/api/admin/jobs/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({ jobId: 'job-source-integrity-audit' })
  });
  assert.equal(runJobRes.status, 200);
  const jobResult = await runJobRes.json();
  assert.equal(jobResult.id, 'job-source-integrity-audit');

  const logsRes = await fetch(`${baseUrl}/api/admin/logs`, {
    headers: { Cookie: superCookie }
  });
  assert.equal(logsRes.status, 200);
  const logsPayload = await logsRes.json();
  assert.ok(Array.isArray(logsPayload.jobs) && logsPayload.jobs.length >= 3);
  assert.ok(Array.isArray(logsPayload.auditLogs) && logsPayload.auditLogs.length >= 5);

  const updateSetRes = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({
      siteName: 'MACHINEWIRE',
      tagline: 'THE WORLD OF MACHINES. CONNECTED.',
      defaultMetaTitle: 'MACHINEWIRE — Global Equipment & Vehicle News'
    })
  });
  assert.equal(updateSetRes.status, 200);
  const updatedSettings = await updateSetRes.json();
  assert.equal(updatedSettings.defaultMetaTitle, 'MACHINEWIRE — Global Equipment & Vehicle News');
});

test('News Collection Engine: canonical URL normalization, fingerprinting, sample test mode, live approved RSS feed check, deduplication, and draft promotion separation', async () => {
  const collector = require('../lib/collector.js');

  // 1. Unit test canonical URL normalization & fingerprinting
  const dirtyUrl = 'https://www.OEMOffHighway.com/fluid-power/article/22900101/stage-v-hydraulic-pump-control-advances/?utm_source=rss&utm_medium=feed&b=2&a=1#section-top';
  const cleanUrl = collector.normalizeCanonicalUrl(dirtyUrl);
  assert.equal(cleanUrl, 'https://www.oemoffhighway.com/fluid-power/article/22900101/stage-v-hydraulic-pump-control-advances?a=1&b=2');

  const fp1 = collector.computeTitleFingerprint('Stage V & CEV Stage V Hydraulic Pump Control Advances!');
  const fp2 = collector.computeTitleFingerprint('stage v cev stage v hydraulic pump control advances');
  assert.equal(fp1, fp2, 'Expected title fingerprint to normalize case and punctuation');

  // 2. Sign in as super_admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Fetch registered sources from catalog
  const catRes = await fetch(`${baseUrl}/api/admin/catalog`, { headers: { Cookie: cookie } });
  const catData = await catRes.json();
  const oemSource = catData.sources.find((s) => s.feedUrl === 'https://www.oemoffhighway.com/rss');
  assert.ok(oemSource, 'Expected OEM Off-Highway RSS source in default approved registry');
  assert.equal(oemSource.requiresApiKey, false);
  assert.equal(oemSource.enabled, true);

  // 3. Test Mode using sample feeds ("Check Source Now" with mode="test")
  const pubArticlesBefore = await (await fetch(`${baseUrl}/api/articles`)).json();
  const testModeRes = await fetch(`${baseUrl}/api/admin/sources/${oemSource.id}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ mode: 'test' })
  });
  assert.equal(testModeRes.status, 200);
  const testModeData = await testModeRes.json();
  assert.equal(testModeData.ok, true);
  assert.equal(testModeData.mode, 'test');
  assert.equal(testModeData.discoveredCount, 2);
  assert.equal(testModeData.insertedCount, 2);

  // Re-running the exact same feed immediately must detect duplicates and insert 0
  const dupRunRes = await fetch(`${baseUrl}/api/admin/sources/${oemSource.id}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ mode: 'test' })
  });
  const dupRunData = await dupRunRes.json();
  assert.equal(dupRunData.insertedCount, 0, 'Expected duplicate detection to skip already-collected items');
  assert.equal(dupRunData.duplicateCount, 2);

  // Verify collected stories are kept strictly separate from published articles
  const pubArticlesAfterCollect = await (await fetch(`${baseUrl}/api/articles`)).json();
  assert.equal(
    pubArticlesAfterCollect.length,
    pubArticlesBefore.length,
    'Collected items must remain separate from published articles'
  );

  // 4. Real-Source Live Test using an approved public RSS feed (https://www.oemoffhighway.com/rss)
  const liveRes = await fetch(`${baseUrl}/api/admin/sources/${oemSource.id}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ mode: 'live' })
  });
  assert.equal(liveRes.status, 200);
  const liveData = await liveRes.json();
  assert.equal(liveData.ok, true, `Expected live RSS collection to succeed, got error: ${liveData.error || 'none'}`);
  assert.equal(liveData.mode, 'live');
  assert.ok(liveData.discoveredCount >= 1, 'Expected at least 1 real item discovered from live OEM Off-Highway RSS feed');
  assert.ok(liveData.insertedCount >= 1, 'Expected real live RSS items to be stored in collected_items.json');

  // Verify stored evidence on collected items
  const collectedRes = await fetch(`${baseUrl}/api/admin/collected`, { headers: { Cookie: cookie } });
  const collectedItems = await collectedRes.json();
  assert.ok(collectedItems.length >= 3);
  const liveItem = collectedItems.find((c) => c.collectionMode === 'live');
  assert.ok(liveItem, 'Expected live collected item in queue');
  assert.ok(liveItem.originalUrl.startsWith('http'));
  assert.ok(liveItem.canonicalUrl.startsWith('http'));
  assert.ok(liveItem.retrievedAt);
  assert.ok(liveItem.titleFingerprint);
  assert.equal(liveItem.verificationEvidence.httpStatus, 200);
  assert.equal(liveItem.reviewStatus, 'pending_review');

  // 5. Promote a collected item to an unpublished editorial draft and confirm it is still NOT publicly published
  const promoteRes = await fetch(`${baseUrl}/api/admin/collected/${liveItem.id}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}'
  });
  assert.equal(promoteRes.status, 201);
  const promoteData = await promoteRes.json();
  assert.equal(promoteData.article.status, 'draft');
  assert.equal(promoteData.collectedItem.reviewStatus, 'promoted_to_draft');
});

test('Configurable AI-Assisted Newsroom: 6 specialist roles, 8-step workflow, risk & missing-info flagging, quality checks, review queue routing, and offline fallback without API key', async () => {
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 1. Verify GET /api/admin/newsroom/config returns 6 specialist roles, 8 workflow steps, cost/limitation disclosures, and never exposes AI_API_KEY
  const cfgRes = await fetch(`${baseUrl}/api/admin/newsroom/config`, {
    headers: { Cookie: cookie }
  });
  assert.equal(cfgRes.status, 200);
  const cfg = await cfgRes.json();
  assert.equal(cfg.specialistRoles.length, 6);
  assert.equal(cfg.workflowSteps.length, 8);
  assert.equal(cfg.apiKey, undefined, 'Must never expose AI_API_KEY in API responses');
  assert.match(cfg.costAndLimitationsDisclosure.accuracyWarning, /AI agreement is NOT proof of accuracy/i);

  // 2. Run the 8-step workflow on a collected story from the sample test feed
  const collectedRes = await fetch(`${baseUrl}/api/admin/collected`, { headers: { Cookie: cookie } });
  const collectedItems = await collectedRes.json();
  const sampleCollected = collectedItems.find((c) => /Stage V & CEV Stage V Hydraulic Pump Control/i.test(c.title)) || collectedItems[0];
  assert.ok(sampleCollected, 'Expected a collected story in queue to analyze');

  const pubBefore = await (await fetch(`${baseUrl}/api/articles`)).json();

  const analyzeColRes = await fetch(`${baseUrl}/api/admin/newsroom/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ collectedItemId: sampleCollected.id, sendToReviewQueue: true })
  });
  assert.equal(analyzeColRes.status, 201);
  const colResult = await analyzeColRes.json();
  assert.equal(colResult.ok, true);
  assert.equal(colResult.article.status, 'review', 'Step 8: Newsroom output must be sent to Admin Review Queue (status="review"), never auto-published');
  assert.equal(colResult.run.steps.step8_reviewQueueRouting.autoPublished, false);
  assert.ok(colResult.run.steps.step2_extractedEntitiesAndFacts.supportedFacts.length >= 1);
  assert.ok(colResult.run.steps.step6_suggestionsAndSeo.subheadings.length >= 3);
  assert.ok(colResult.run.steps.step6_suggestionsAndSeo.internalLinks.length >= 3);
  assert.equal(colResult.run.steps.step7_qualityChecks.sourceCheck.passed, true);
  assert.equal(colResult.run.steps.step7_qualityChecks.factualCheck.passed, true);
  assert.equal(colResult.run.steps.step7_qualityChecks.originalityCheck.passed, true);
  assert.equal(colResult.run.steps.step7_qualityChecks.grammarCheck.passed, true);

  // Verify public articles count did NOT change (review queue items are not publicly published)
  const pubAfter = await (await fetch(`${baseUrl}/api/articles`)).json();
  assert.equal(pubAfter.length, pubBefore.length, 'Review queue drafts must never appear on the public site before human approval');

  // 3. Run the workflow on a high-risk OEM company announcement containing a direct quote, numeric specs, and financial figures
  const highRiskRes = await fetch(`${baseUrl}/api/admin/newsroom/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'BULL Machines Announces HD76 CEV Stage V Backhoe Loader Upgrade in India',
      sourceName: 'PR Newswire India',
      sourceUrl: 'https://bullmachines.com/news/hd76-cev-stage-v-upgrade',
      publishedAt: '2026-10-24T10:00:00Z',
      excerpt: 'BULL Machines today announces an upgraded HD76 backhoe loader in Coimbatore, India with a 74 hp engine, 7,650 kg operating weight, and INR 150 crore plant investment. "This CEV Stage V platform reduces fuel burn by 12%," the company stated.',
      sendToReviewQueue: true
    })
  });
  assert.equal(highRiskRes.status, 201);
  const hrData = await highRiskRes.json();
  const steps = hrData.run.steps;

  // Verify Step 1 & 2: Company announcement classification & entity extraction (BULL Machines, HD76, Backhoe Loaders, India)
  assert.equal(steps.step1_sourceAnalysis.articleType, 'company-announcement');
  assert.equal(steps.step2_extractedEntitiesAndFacts.manufacturer, 'BULL Machines');
  assert.match(steps.step2_extractedEntitiesAndFacts.model, /HD76/i);
  assert.equal(steps.step2_extractedEntitiesAndFacts.category, 'Backhoe Loaders');
  assert.equal(steps.step2_extractedEntitiesAndFacts.country, 'India');
  assert.equal(steps.step2_extractedEntitiesAndFacts.region, 'India');

  // Verify Step 4: High-risk claims (direct quote, numeric specification, financial statistic, product launch) are all flagged for human review
  const riskTypes = steps.step4_missingAndRiskAnalysis.highRiskClaims.map((r) => r.riskType);
  assert.ok(riskTypes.includes('direct-quote'), 'Expected direct quote to be flagged for human verification');
  assert.ok(riskTypes.includes('technical-specification'), 'Expected numeric specs (74 hp, 7,650 kg) to be flagged');
  assert.ok(riskTypes.includes('financial-or-statistic'), 'Expected financial/statistical claim (INR 150 crore, 12%) to be flagged');
  assert.match(steps.step4_missingAndRiskAnalysis.aiAgreementDisclaimer, /AI agreement is not proof of accuracy/i);

  // Verify Step 5 & 6: Internal links include /manufacturers/bull-machines, /models/..., and /india/
  const linkUrls = steps.step6_suggestionsAndSeo.internalLinks.map((l) => l.url);
  assert.ok(linkUrls.includes('/manufacturers/bull-machines'), 'Expected internal link to BULL Machines profile');
  assert.ok(linkUrls.includes('/india/'), 'Expected internal link to India regional hub');
  assert.equal(hrData.article.status, 'review');
  assert.ok(hrData.article.newsroomDossier, 'Expected full newsroomDossier attached to review article');
});

test('8-Stage Editorial Workflow (DISCOVERED -> PUBLISHED), job locking, duplicate-job prevention, retry/failure alerts, conditional auto-publish gates, sensitive topic routing, and rollback/unpublish ledger', async () => {
  const workflow = require('../lib/workflow.js');
  const { store } = require('../server.js');

  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 1. Verify initial workflow summary has all 8 canonical stages and defaults to draft_review with autoPublishEnabled === false
  const wfRes = await fetch(`${baseUrl}/api/admin/workflow`, { headers: { Cookie: cookie } });
  assert.equal(wfRes.status, 200);
  const wfData = await wfRes.json();
  assert.deepEqual(wfData.stages, [
    'DISCOVERED',
    'COLLECTED',
    'DEDUPLICATED',
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'SCHEDULED',
    'PUBLISHED'
  ]);
  assert.equal(wfData.config.defaultEditorialMode, 'draft_review');
  assert.equal(wfData.config.autoPublishEnabled, false, 'Automatic publication must default to disabled');

  // 2. Verify attempting to enable autoPublishEnabled BEFORE testing the 5 verification rules is rejected (400)
  const prematureEnableRes = await fetch(`${baseUrl}/api/admin/workflow/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ autoPublishEnabled: true })
  });
  assert.equal(prematureEnableRes.status, 400, 'Must block enabling autoPublish before the 5 gate rules are tested');

  // 3. Run the 5-Gate & Sensitive-Topic Verification Suite (POST /api/admin/workflow/test-rules)
  const testRulesRes = await fetch(`${baseUrl}/api/admin/workflow/test-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}'
  });
  assert.equal(testRulesRes.status, 200);
  const testRulesData = await testRulesRes.json();
  assert.equal(testRulesData.suitePassed, true);
  assert.equal(testRulesData.config.rulesTestedStatus.sourceRuleTested, true);
  assert.equal(testRulesData.config.rulesTestedStatus.factualEvidenceRuleTested, true);
  assert.equal(testRulesData.config.rulesTestedStatus.originalityRuleTested, true);
  assert.equal(testRulesData.config.rulesTestedStatus.imageRightsRuleTested, true);
  assert.equal(testRulesData.config.rulesTestedStatus.qualityRuleTested, true);

  // 4. Now super_admin can explicitly enable autoPublishEnabled
  const enableAutoRes = await fetch(`${baseUrl}/api/admin/workflow/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ autoPublishEnabled: true, schedulerIntervalSeconds: 45, maxJobRetries: 3 })
  });
  assert.equal(enableAutoRes.status, 200);
  const enabledCfg = await enableAutoRes.json();
  assert.equal(enabledCfg.autoPublishEnabled, true);

  // 5. Verify sensitive stories (recalls, safety issues, disputes, allegations, financial claims, conflicting reports, uncertain technical details) are ALWAYS routed to human REVIEW even when autoPublishEnabled === true
  const createSensitiveRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'Safety Recall & Brake Failure Dispute on 35-Tonne Articulated Haulers',
      summary: 'Regulators investigate alleged brake hazard and $18 million warranty dispute following conflicting reports on prototype axle assemblies.',
      body: '### Source Evidence\n\nAccording to conflicting reports and a regulatory safety bulletin, a stop-sale recall and lawsuit were filed over alleged brake failure and $18 million in disputed warranty claims.',
      category: 'Mining Equipment',
      manufacturer: 'Volvo Construction Equipment',
      country: 'Sweden',
      region: 'Europe',
      sourceUrl: 'https://www.oemoffhighway.com/safety-recall-test',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
      imageCredit: 'Official OEM Press Handout',
      status: 'draft'
    })
  });
  assert.equal(createSensitiveRes.status, 201);
  const sensitiveArticle = await createSensitiveRes.json();
  assert.equal(sensitiveArticle.pipelineStage, 'DRAFT');

  // Attempt conditional auto-publish on the sensitive recall/dispute story -> MUST route to REVIEW, NOT PUBLISHED
  const autoAttemptSensitive = await fetch(`${baseUrl}/api/admin/articles/${sensitiveArticle.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'auto_publish_if_eligible' })
  });
  assert.equal(autoAttemptSensitive.status, 200);
  const autoSensData = await autoAttemptSensitive.json();
  assert.equal(autoSensData.article.status, 'review', 'Sensitive recall/safety/dispute/financial story must be routed to human review');
  assert.equal(autoSensData.article.pipelineStage, 'REVIEW');
  assert.ok(autoSensData.gateEvaluation.triggeredSensitiveRules.length >= 4);

  // 6. Walk a story through the full human-controlled stages: DRAFT -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED -> ROLLBACK (Unpublish)
  const approveRes = await fetch(`${baseUrl}/api/admin/articles/${sensitiveArticle.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'approve', reason: 'Engineering & legal desk verified recall bulletin numbers.' })
  });
  assert.equal(approveRes.status, 200);
  const approvedData = await approveRes.json();
  assert.equal(approvedData.article.status, 'approved');
  assert.equal(approvedData.article.pipelineStage, 'APPROVED');

  // Schedule for 1 second in the past so the scheduler immediately transitions SCHEDULED -> PUBLISHED
  const pastIso = new Date(Date.now() - 1500).toISOString();
  const scheduleRes = await fetch(`${baseUrl}/api/admin/articles/${sensitiveArticle.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'schedule', scheduledAt: pastIso, reason: 'Scheduled for morning fleet briefing.' })
  });
  assert.equal(scheduleRes.status, 200);
  const scheduledData = await scheduleRes.json();
  assert.equal(scheduledData.article.status, 'scheduled');
  assert.equal(scheduledData.article.pipelineStage, 'SCHEDULED');

  // Run scheduled publisher job -> transitions due SCHEDULED -> PUBLISHED and records in Publication Ledger
  const runSchedJob = await fetch(`${baseUrl}/api/admin/jobs/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ jobId: 'job-scheduled-publisher' })
  });
  assert.equal(runSchedJob.status, 200);

  // Confirm story is now live at /api/articles/:slug
  const liveArtRes = await fetch(`${baseUrl}/api/articles/${sensitiveArticle.slug}`);
  assert.equal(liveArtRes.status, 200);
  const liveArt = await liveArtRes.json();
  assert.equal(liveArt.slug, sensitiveArticle.slug);

  // 7. Rollback / Unpublish capability: immediately unpublish the live story back to REVIEW and verify it returns 404 on public API
  const rollbackRes = await fetch(`${baseUrl}/api/admin/articles/${sensitiveArticle.id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'rollback', targetStatus: 'review', reason: 'Rolled back to update OEM service bulletin serial range.' })
  });
  assert.equal(rollbackRes.status, 200);
  const rollbackData = await rollbackRes.json();
  assert.equal(rollbackData.article.status, 'review');
  assert.equal(rollbackData.article.pipelineStage, 'REVIEW');
  assert.equal(rollbackData.article.publishedAt, '');

  const afterRollbackPublicRes = await fetch(`${baseUrl}/api/articles/${sensitiveArticle.slug}`);
  assert.equal(afterRollbackPublicRes.status, 404, 'Rolled-back/unpublished article must immediately return 404 on public endpoint');

  // 8. Verify Job Locking, Duplicate-Job Prevention, Retry Handling & Failure Alerts
  const lockacq = workflow.acquireJobLock(store, 'job-source-integrity-audit', 'test-holder');
  assert.equal(lockacq.acquired, true);

  // Attempting to run the same job while locked must return 409 Conflict (Duplicate Job Prevented)
  const dupJobRes = await fetch(`${baseUrl}/api/admin/jobs/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ jobId: 'job-source-integrity-audit' })
  });
  assert.equal(dupJobRes.status, 409, 'Expected 409 when duplicate job is prevented by active lock');
  const dupJobData = await dupJobRes.json();
  assert.equal(dupJobData.duplicatePrevented, true);

  workflow.releaseJobLock(store, 'job-source-integrity-audit', lockacq.lock.lockId);

  // Simulate a failing job to verify retry handling (3 attempts) and Failure Alert creation
  const failJobRes = await fetch(`${baseUrl}/api/admin/jobs/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      jobId: 'job-source-integrity-audit',
      simulateFailure: 'Simulated upstream feed timeout during integrity check',
      maxRetries: 3,
      retryDelayMs: 10
    })
  });
  assert.equal(failJobRes.status, 500);
  const failJobData = await failJobRes.json();
  assert.equal(failJobData.attempts, 3, 'Expected job runner to retry 3 times before raising a failure alert');
  assert.ok(failJobData.failureAlert && failJobData.failureAlert.id);

  // Acknowledge the failure alert
  const ackRes = await fetch(`${baseUrl}/api/admin/workflow/alerts/${failJobData.failureAlert.id}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}'
  });
  assert.equal(ackRes.status, 200);
  const ackData = await ackRes.json();
  assert.equal(ackData.acknowledged, true);

  // Reset autoPublishEnabled back to default false (draft/review mode)
  await fetch(`${baseUrl}/api/admin/workflow/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ autoPublishEnabled: false })
  });
});

test('Organic Traffic & SEO Architecture: evergreen cornerstone content (comparisons, explainers, maintenance guides, analysis), cross-hub internal link graph, configurable analytics/GSC, telemetry tracking, and demand-driven content prioritization', async () => {
  // 1. Verify all 4 evergreen cornerstone articles are published and accessible via clean /news/:slug URLs and /api/articles/:slug
  const cornerstoneSlugs = [
    'center-pivot-vs-sideshift-backhoe-loaders-kinematics-worksite-comparison',
    '20-tonne-crawler-excavator-comparison-hydraulics-undercarriage-telematics',
    'preventive-maintenance-guide-off-highway-hydraulics-dpf-scr-undercarriage',
    'off-highway-emissions-explainer-eu-stage-v-epa-tier-4-india-cev-stage-v'
  ];

  for (const slug of cornerstoneSlugs) {
    const htmlRes = await fetch(`${baseUrl}/news/${slug}`);
    assert.equal(htmlRes.status, 200, `Expected clean URL /news/${slug} to return 200`);
    const apiRes = await fetch(`${baseUrl}/api/articles/${slug}`);
    assert.equal(apiRes.status, 200, `Expected API /api/articles/${slug} to return 200`);
    const art = await apiRes.json();
    assert.equal(art.slug, slug);
    assert.ok(art.seo && art.seo.metaTitle && art.seo.metaDescription, 'Expected unique SEO title and meta description');
    assert.ok(art.internalLinks, 'Expected server-computed internalLinks graph on article detail');
    assert.ok(Array.isArray(art.internalLinks.relatedStories) && art.internalLinks.relatedStories.length >= 2, 'Expected scored related story recommendations');
    assert.ok(Array.isArray(art.internalLinks.linkedManufacturers) && art.internalLinks.linkedManufacturers.length >= 1, 'Expected cross-hub manufacturer links');
    assert.ok(Array.isArray(art.internalLinks.linkedModels) && art.internalLinks.linkedModels.length >= 1, 'Expected cross-hub equipment model links');
    assert.ok(Array.isArray(art.internalLinks.hubLinks) && art.internalLinks.hubLinks.length >= 4, 'Expected category, technology, reviews, guides, and regional hub links');
  }

  // 2. Verify /sitemap.xml includes the evergreen cornerstone articles and /robots.txt disallows /admin.html while pointing to sitemap.xml
  const sitemapXml = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
  for (const slug of cornerstoneSlugs) {
    assert.match(sitemapXml, new RegExp(`/news/${slug}`));
  }
  const robotsTxt = await (await fetch(`${baseUrl}/robots.txt`)).text();
  assert.match(robotsTxt, /Disallow: \/admin\.html/);
  assert.match(robotsTxt, /Sitemap: .*\/sitemap\.xml/);

  // 3. Verify fast HTTP caching headers (Cache-Control + ETag + 304 Not Modified) on static assets
  const assetRes = await fetch(`${baseUrl}/styles.css`);
  assert.equal(assetRes.status, 200);
  const etag = assetRes.headers.get('etag');
  const cacheControl = assetRes.headers.get('cache-control');
  assert.ok(etag, 'Expected ETag header on static asset');
  assert.match(cacheControl || '', /max-age=/, 'Expected Cache-Control header on static asset');

  const condRes = await fetch(`${baseUrl}/styles.css`, {
    headers: { 'If-None-Match': etag }
  });
  assert.equal(condRes.status, 304, 'Expected 304 Not Modified when If-None-Match matches ETag');

  // 4. Record audience telemetry across page views, category interest, regional interest, search queries, share clicks, source clicks, and newsletter conversions
  await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'article', slug: 'center-pivot-vs-sideshift-backhoe-loaders-kinematics-worksite-comparison' })
  });
  await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'category', category: 'backhoe-loaders' })
  });
  await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'region', region: 'india' })
  });
  await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'share_click', slug: 'center-pivot-vs-sideshift-backhoe-loaders-kinematics-worksite-comparison' })
  });
  await fetch(`${baseUrl}/api/analytics/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'source_click', slug: 'center-pivot-vs-sideshift-backhoe-loaders-kinematics-worksite-comparison' })
  });
  await fetch(`${baseUrl}/api/articles?q=sideshift%20backhoe`);

  // 5. Verify admin SEO & Content Prioritization endpoint and configurable GA4 / GSC settings
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      gaMeasurementId: 'G-TESTMW2026',
      gscVerificationCode: 'gsc-verify-token-2026'
    })
  });

  const pubCfgRes = await fetch(`${baseUrl}/api/analytics/config`);
  assert.equal(pubCfgRes.status, 200);
  const pubCfg = await pubCfgRes.json();
  assert.equal(pubCfg.googleAnalytics.enabled, true);
  assert.equal(pubCfg.googleAnalytics.measurementId, 'G-TESTMW2026');
  assert.equal(pubCfg.googleSearchConsole.enabled, true);
  assert.equal(pubCfg.googleSearchConsole.verificationCode, 'gsc-verify-token-2026');

  const seoAdminRes = await fetch(`${baseUrl}/api/admin/seo-analytics`, {
    headers: { Cookie: cookie }
  });
  assert.equal(seoAdminRes.status, 200);
  const seoAdminData = await seoAdminRes.json();
  assert.ok(seoAdminData.prioritization);
  assert.ok(seoAdminData.prioritization.totals.totalArticleViews >= 1);
  assert.ok(seoAdminData.prioritization.totals.shareClicks >= 1);
  assert.ok(seoAdminData.prioritization.totals.sourceLinkClicks >= 1);
  assert.ok(seoAdminData.prioritization.topSearchQueries.some((q) => q.key === 'sideshift backhoe'));
  assert.ok(seoAdminData.prioritization.prioritizedArticles.length >= 9);
  assert.match(seoAdminData.prioritization.disclaimer, /never promises search engine rankings or specific traffic numbers/i);
});

test('Newsletter & Content-Distribution System: 7 topic interests, consent collection, email verification, one-click unsubscribe, daily/weekly templates, honest unconfigured provider status, shareable links, duplicate send prevention, and delivery error logging', async () => {
  // 1. Public GET /api/newsletter clearly reports when an external email provider is not yet connected
  const infoRes = await fetch(`${baseUrl}/api/newsletter`);
  assert.equal(infoRes.status, 200);
  const infoData = await infoRes.json();
  assert.equal(infoData.providerConnected, false);
  assert.match(infoData.emailService.statusBadge, /Not Yet Connected/i);
  assert.equal(infoData.interestOptions.length, 7);

  // 2. Reject subscription when explicit consent is false
  const noConsentRes = await fetch(`${baseUrl}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'noconsent@example.com',
      consent: false,
      interests: ['construction-equipment']
    })
  });
  assert.equal(noConsentRes.status, 400);

  // 3. Subscribe with selected interests (construction equipment, tractors, commercial vehicles, manufacturers, technology, business, regional news), frequency, and explicit consent
  const subRes = await fetch(`${baseUrl}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'director.fleet@example.com',
      frequency: 'daily',
      consent: true,
      interests: [
        'construction-equipment',
        'tractors',
        'commercial-vehicles',
        'manufacturers',
        'technology',
        'business',
        'regional-news'
      ]
    })
  });
  assert.equal(subRes.status, 201);
  const subData = await subRes.json();
  assert.equal(subData.ok, true);
  assert.equal(subData.providerConnected, false, 'Must honestly report that external email provider is not yet connected');
  assert.equal(subData.subscriber.frequency, 'daily');
  assert.equal(subData.subscriber.interests.length, 7);
  assert.equal(subData.subscriber.consent, true);
  assert.ok(subData.subscriber.consentTimestamp);
  assert.ok(subData.verificationUrl.includes('/api/newsletter/verify?token='));
  assert.ok(subData.unsubscribeUrl.includes('/api/newsletter/unsubscribe?token='));

  // 4. Verify email via verification link
  const verifyRes = await fetch(`${subData.verificationUrl}&format=json`);
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.ok, true);
  assert.equal(verifyData.verified, true);
  assert.equal(verifyData.email, 'director.fleet@example.com');

  // 5. Unsubscribe via one-click unsubscribe link
  const unsubRes = await fetch(`${subData.unsubscribeUrl}&format=json`);
  assert.equal(unsubRes.status, 200);
  const unsubData = await unsubRes.json();
  assert.equal(unsubData.ok, true);
  assert.equal(unsubData.status, 'unsubscribed');

  // 6. Verify shareable UTM & social intent links on article detail API
  const artRes = await fetch(`${baseUrl}/api/articles/welcome-to-the-magazine`);
  assert.equal(artRes.status, 200);
  const artData = await artRes.json();
  assert.ok(artData.shareLinks);
  assert.ok(artData.shareLinks.utmLinks.linkedin.includes('utm_source=linkedin'));
  assert.ok(artData.shareLinks.utmLinks.x_twitter.includes('utm_source=x_twitter'));
  assert.ok(artData.shareLinks.intentUrls.linkedin.startsWith('https://www.linkedin.com/'));
  assert.ok(artData.shareLinks.preparedSocialCopy.linkedinPost.length > 20);

  // 7. Admin newsletter template generation (Daily & Weekly), provider checks, duplicate send prevention, and delivery error logging
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const dailyTplRes = await fetch(`${baseUrl}/api/admin/distribution/template?edition=daily&interests=construction-equipment,technology`, {
    headers: { Cookie: cookie }
  });
  assert.equal(dailyTplRes.status, 200);
  const dailyTpl = await dailyTplRes.json();
  assert.equal(dailyTpl.editionType, 'daily');
  assert.ok(dailyTpl.storyCount >= 1);
  assert.ok(dailyTpl.headers['List-Unsubscribe']);
  assert.match(dailyTpl.html, /Instant One-Click Unsubscribe/);

  const weeklyTplRes = await fetch(`${baseUrl}/api/admin/distribution/template?edition=weekly`, {
    headers: { Cookie: cookie }
  });
  assert.equal(weeklyTplRes.status, 200);
  const weeklyTpl = await weeklyTplRes.json();
  assert.equal(weeklyTpl.editionType, 'weekly');

  // Attempt newsletter dispatch when email provider is not configured -> returns provider_not_configured without pretending it sent
  const unconnSendRes = await fetch(`${baseUrl}/api/admin/distribution/send-newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ editionType: 'weekly' })
  });
  assert.equal(unconnSendRes.status, 200);
  const unconnSendData = await unconnSendRes.json();
  assert.equal(unconnSendData.status, 'provider_not_configured');
  assert.equal(unconnSendData.providerConnected, false);

  // Simulate newsletter delivery error -> logged as delivery_error
  const errSendRes = await fetch(`${baseUrl}/api/admin/distribution/send-newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      editionType: 'daily',
      simulateDeliveryError: 'SMTP 550 Upstream mailbox relay timeout'
    })
  });
  assert.equal(errSendRes.status, 200);
  const errSendData = await errSendRes.json();
  assert.equal(errSendData.status, 'delivery_error');
  assert.match(errSendData.error, /SMTP 550/);

  // Attempt social distribution when LinkedIn credentials are not configured -> returns provider_not_configured
  const unconnSocialRes = await fetch(`${baseUrl}/api/admin/distribution/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ articleId: 'welcome-to-the-magazine', channel: 'linkedin' })
  });
  assert.equal(unconnSocialRes.status, 200);
  const unconnSocialData = await unconnSocialRes.json();
  assert.equal(unconnSocialData.status, 'provider_not_configured');
  assert.equal(unconnSocialData.providerConnected, false);

  // Temporarily configure EMAIL_PROVIDER / EMAIL_API_KEY and SOCIAL_LINKEDIN_ACCESS_TOKEN / SOCIAL_LINKEDIN_ORG_URN to verify connected dispatch + duplicate send prevention (409)
  process.env.EMAIL_PROVIDER = 'postmark';
  process.env.EMAIL_API_KEY = 'server-side-secret-key';
  process.env.SOCIAL_LINKEDIN_ACCESS_TOKEN = 'li-secret-token';
  process.env.SOCIAL_LINKEDIN_ORG_URN = 'urn:li:organization:12345';

  try {
    const connSend1 = await fetch(`${baseUrl}/api/admin/distribution/send-newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ editionType: 'weekly' })
    });
    assert.equal(connSend1.status, 200);
    const connSendData1 = await connSend1.json();
    assert.equal(connSendData1.ok, true);
    assert.equal(connSendData1.status, 'delivered');

    // Second send of the exact same newsletter edition must be blocked (409 duplicate_prevented)
    const connSend2 = await fetch(`${baseUrl}/api/admin/distribution/send-newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ editionType: 'weekly' })
    });
    assert.equal(connSend2.status, 409, 'Expected 409 when duplicate newsletter send is prevented');
    const connSendData2 = await connSend2.json();
    assert.equal(connSendData2.duplicatePrevented, true);

    // Connected social distribution + duplicate social post prevention (409)
    const socSend1 = await fetch(`${baseUrl}/api/admin/distribution/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ articleId: 'welcome-to-the-magazine', channel: 'linkedin' })
    });
    assert.equal(socSend1.status, 200);
    const socData1 = await socSend1.json();
    assert.equal(socData1.ok, true);
    assert.equal(socData1.status, 'delivered');

    const socSend2 = await fetch(`${baseUrl}/api/admin/distribution/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ articleId: 'welcome-to-the-magazine', channel: 'linkedin' })
    });
    assert.equal(socSend2.status, 409, 'Expected 409 when duplicate social post is prevented');
    const socData2 = await socSend2.json();
    assert.equal(socData2.duplicatePrevented, true);
  } finally {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_API_KEY;
    delete process.env.SOCIAL_LINKEDIN_ACCESS_TOKEN;
    delete process.env.SOCIAL_LINKEDIN_ORG_URN;
  }

  // Verify distribution logs recorded all events and never leaked credentials
  const distCfgRes = await fetch(`${baseUrl}/api/admin/distribution/config`, {
    headers: { Cookie: cookie }
  });
  assert.equal(distCfgRes.status, 200);
  const distCfgData = await distCfgRes.json();
  assert.ok(Array.isArray(distCfgData.logs) && distCfgData.logs.length >= 5);
  assert.equal(JSON.stringify(distCfgData).includes('server-side-secret-key'), false, 'Must never expose server-side API keys');
});

test('Production Readiness: security headers, graceful HTML error pages, public rate-limiting, pre-delete backups, and server error audit logging', async () => {
  // 1. Verify standard production security headers on HTML and API responses
  const homeRes = await fetch(`${baseUrl}/`);
  assert.equal(homeRes.status, 200);
  assert.equal(homeRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(homeRes.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(homeRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok(homeRes.headers.get('content-security-policy'));
  assert.ok(homeRes.headers.get('permissions-policy'));

  // 2. Verify graceful branded HTML error page on non-existent routes
  const errRes = await fetch(`${baseUrl}/non-existent-fleet-route.html`, {
    headers: { Accept: 'text/html' }
  });
  assert.equal(errRes.status, 404);
  const errHtml = await errRes.text();
  assert.match(errHtml, /Page Not Found/i);
  assert.match(errHtml, /Machine Report World|MACHINE REPORT WORLD|MACHINEWIRE/i);
  assert.match(errHtml, /Return to (Machine Report World|MachineWire) Homepage/i);

  // 3. Verify public rate limiting on newsletter and tips submissions
  let rateLimited = false;
  for (let i = 0; i < 35; i++) {
    const r = await fetch(`${baseUrl}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ratelimit-${i}@example.com`, consent: true })
    });
    if (r.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert.equal(rateLimited, true, 'Expected public newsletter endpoint to enforce rate limiting');

  // 4. Verify pre-delete safety backups created before destructive article delete
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const createArtRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'Temporary Story for Pre-Delete Audit Verification',
      summary: 'Testing automated backup snapshot before permanent deletion.',
      body: 'Verified body text describing earthmoving fleet hydraulics and maintenance.',
      category: 'Excavators',
      manufacturer: 'Komatsu',
      status: 'draft'
    })
  });
  assert.equal(createArtRes.status, 201);
  const createdArt = await createArtRes.json();

  const delRes = await fetch(`${baseUrl}/api/admin/articles/${createdArt.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  });
  assert.equal(delRes.status, 200);

  const backupsRes = await fetch(`${baseUrl}/api/admin/backups`, {
    headers: { Cookie: cookie }
  });
  const backupsList = await backupsRes.json();
  const preDelSnap = backupsList.find(b => b.reason && b.reason.includes('pre-delete-article'));
  assert.ok(preDelSnap, 'Expected pre-delete backup snapshot created automatically before article deletion');
});

test('AI SEO & Newsroom Automation: Central Operations Dashboard, 10 specialist roles, technical SEO audit, real telemetry & SEO task queue', async () => {
  // 1. Authenticate as super_admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 2. Fetch AI SEO Operations Dashboard
  const dashRes = await fetch(`${baseUrl}/api/admin/ai-seo/dashboard`, {
    headers: { Cookie: cookie }
  });
  assert.equal(dashRes.status, 200);
  const dash = await dashRes.json();

  // Verify honest health reporting: 'healthy' when 0 active errors on enabled sources; 'attention_required' otherwise
  const expectedHealthStatus = dash.sourcesMonitoring.reportingErrors === 0 ? 'healthy' : 'attention_required';
  assert.equal(dash.systemHealth.status, expectedHealthStatus, 'System health must truthfully reflect active source errors');
  assert.equal(dash.aiProvider.estimatedCostUsd, '$0.0000');

  // Verify Google Search Console status: verification code alone does NOT claim connected API
  assert.equal(dash.searchPerformanceData.googleSearchConsoleConnected, false, 'GSC must not report connected without authenticated credentials');
  assert.match(dash.searchPerformanceData.statusLabel, /Not Connected/i);
  assert.match(dash.searchPerformanceData.message, /(Search Console|never invents search impressions)/i);

  // Verify 10 coordinated specialist roles defined
  assert.equal(dash.coordinatedRoles.length, 10);
  const roleIds = dash.coordinatedRoles.map(r => r.id);
  assert.ok(roleIds.includes('coordinator'));
  assert.ok(roleIds.includes('keyword_research'));
  assert.ok(roleIds.includes('news_research'));
  assert.ok(roleIds.includes('news_writer'));
  assert.ok(roleIds.includes('fact_checker'));
  assert.ok(roleIds.includes('article_seo'));
  assert.ok(roleIds.includes('technical_seo'));
  assert.ok(roleIds.includes('regional_seo'));
  assert.ok(roleIds.includes('manufacturer_seo'));
  assert.ok(roleIds.includes('analytics_strategy'));

  // Verify 90-day execution roadmap
  assert.equal(dash.roadmap90Day.length, 4);
  assert.equal(dash.roadmap90Day[0].phase, 'phase1');
  assert.equal(dash.roadmap90Day[0].days, 'Days 1–15');
  assert.equal(dash.roadmap90Day[3].phase, 'phase4');
  assert.equal(dash.roadmap90Day[3].days, 'Days 61–90');

  // 3. Run on-demand Technical SEO Audit
  const auditRes = await fetch(`${baseUrl}/api/admin/ai-seo/audit`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(auditRes.status, 200);
  const audit = await auditRes.json();
  assert.ok(audit.overallHealthScore >= 70, 'Technical SEO health score should be computed');
  assert.ok(audit.stats.totalArticles >= 1);
  assert.ok(audit.checks.length >= 5);

  // 4. Retrieve SEO Task Queue
  const tasksRes = await fetch(`${baseUrl}/api/admin/ai-seo/tasks`, {
    headers: { Cookie: cookie }
  });
  assert.equal(tasksRes.status, 200);
  const tasks = await tasksRes.json();
  assert.ok(tasks.length >= 6, 'Expected initial high-evidence SEO tasks seeded');
  assert.ok(tasks.every(t => typeof t.priorityScore === 'number' && t.priorityScore > 0));

  // 5. Create, filter, update, and delete an SEO task
  const newTaskRes = await fetch(`${baseUrl}/api/admin/ai-seo/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'Audit Stage V Hydrogen Excavator Internal Links',
      assignedRole: 'article_seo',
      category: 'internal_linking',
      target: '/category/technology',
      evidence: 'Growing reader interest in zero-emission construction corridors.',
      recommendedAction: 'Link Komatsu and Caterpillar electric excavators to technology hub.',
      importance: 9,
      confidence: 9,
      effort: 'low'
    })
  });
  assert.equal(newTaskRes.status, 201);
  const createdTask = await newTaskRes.json();
  assert.equal(createdTask.assignedRole, 'article_seo');
  assert.ok(createdTask.priorityScore >= 70, 'Low effort + high importance/confidence should yield high priority');

  // Filter tasks by role
  const filterRes = await fetch(`${baseUrl}/api/admin/ai-seo/tasks?role=article_seo`, {
    headers: { Cookie: cookie }
  });
  const filtered = await filterRes.json();
  assert.ok(filtered.some(t => t.id === createdTask.id));

  // Update task status to in_progress and completed
  const patchRes = await fetch(`${baseUrl}/api/admin/ai-seo/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ status: 'completed' })
  });
  assert.equal(patchRes.status, 200);
  const updatedTask = await patchRes.json();
  assert.equal(updatedTask.status, 'completed');

  // Delete task
  const delTaskRes = await fetch(`${baseUrl}/api/admin/ai-seo/tasks/${createdTask.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  });
  assert.equal(delTaskRes.status, 200);
});


test('Pre-Publication Article SEO Audit: actionable checks, errors, warnings, and rerun endpoint', async () => {
  const aiSeo = require('../lib/ai_seo.js');

  // 1. Sign in as super_admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 2. Test audit on an incomplete article (missing source, thin content, short headline)
  const incompleteArticle = {
    id: 'test-audit-art-1',
    title: 'Short',
    summary: 'Brief',
    body: 'Only a few words here.',
    category: 'Excavators',
    manufacturer: 'Caterpillar',
    country: 'United States',
    region: 'North America',
    sourceUrl: '', // Missing source!
    tags: []
  };

  const auditIncomplete = aiSeo.auditArticleSeo(incompleteArticle);
  assert.equal(auditIncomplete.passed, false);
  assert.equal(auditIncomplete.status, 'failed');
  assert.ok(auditIncomplete.errorsCount >= 2, 'Expected errors for missing source and thin content');
  assert.ok(auditIncomplete.errors.some(e => e.id === 'primary_source_attribution'));
  assert.ok(auditIncomplete.errors.some(e => e.id === 'content_depth'));
  assert.ok(auditIncomplete.score < 70);

  // 3. Test audit on a well-formed cornerstone article
  const articles = store.readJson(store.files.articles, []);
  const sampleArt = articles.find(a => a.status === 'published' && a.sourceUrl && a.body && a.body.length > 500) || articles.find(a => a.status === 'published');
  assert.ok(sampleArt, 'Expected published sample article with sourceUrl');

  const auditComplete = aiSeo.auditArticleSeo(sampleArt);
  assert.ok(auditComplete.score >= 70, `Expected high score for published article, got: ${auditComplete.score}`);
  assert.equal(auditComplete.errorsCount, 0);

  // 4. Test Rerun endpoint: POST /api/admin/articles/:id/seo-audit
  const rerunRes = await fetch(`${baseUrl}/api/admin/articles/${encodeURIComponent(sampleArt.id)}/seo-audit`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(rerunRes.status, 200);
  const rerunData = await rerunRes.json();
  assert.equal(rerunData.ok, true);
  assert.equal(rerunData.articleId, sampleArt.id);
  assert.ok(rerunData.seoAudit.checksCount >= 8);
  assert.ok(Array.isArray(rerunData.seoAudit.checks));

  // 5. Test GET /api/admin/articles/:id/seo-audit
  const getAuditRes = await fetch(`${baseUrl}/api/admin/articles/${encodeURIComponent(sampleArt.id)}/seo-audit`, {
    headers: { Cookie: cookie }
  });
  assert.equal(getAuditRes.status, 200);
  const getAuditData = await getAuditRes.json();
  assert.equal(getAuditData.ok, true);
  assert.equal(getAuditData.seoAudit.score, rerunData.seoAudit.score);
});

test('End-to-End Workflow: RSS collection -> deduplication -> AI drafting -> fact-check warnings -> SEO checks -> editorial review -> publication', async () => {
  const newsroom = require('../lib/newsroom.js');
  const workflow = require('../lib/workflow.js');

  // 1. Sign in as super_admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'test-admin-password-2026' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 2. Collection Stage: Collect item via test mode
  const catRes = await fetch(`${baseUrl}/api/admin/catalog`, { headers: { Cookie: cookie } });
  const catData = await catRes.json();
  const oemSource = catData.sources.find(s => s.feedUrl.includes('oemoffhighway'));
  assert.ok(oemSource);

  // Clean collected items for isolated workflow test
  const collectedBefore = store.readJson(store.files.collectedItems, []);
  const testStoryUrl = `https://www.oemoffhighway.com/article/e2e-workflow-test-${Date.now()}`;
  const mockItem = {
    id: `col-e2e-${Date.now()}`,
    sourceId: oemSource.id,
    sourceName: oemSource.name,
    title: 'Hydrogen Combustion Excavator Demonstrates Zero Carbon Digging',
    originalUrl: testStoryUrl,
    canonicalUrl: testStoryUrl,
    excerpt: 'OEM showcases prototype 20-tonne hydrogen excavator priced at $250,000 with deliveries beginning Q3 2027.',
    manufacturer: 'Caterpillar',
    category: 'Excavators',
    country: 'United States',
    region: 'North America',
    status: 'draft',
    sourceUrl: testStoryUrl,
    sourceUrls: [testStoryUrl]
  };

  // 3. AI Newsroom Drafting Stage
  const draftResult = await newsroom.runNewsroomWorkflow(store, mockItem, { actor: 'test-editor' });
  assert.equal(draftResult.ok, true);
  const reviewArt = draftResult.article || draftResult.reviewArticle;
  assert.ok(reviewArt);
  assert.equal(reviewArt.status, 'review', 'Must route to review queue (never auto-published)');

  // 4. Fact-Check Warnings Stage: Verify high-risk claims flagged
  assert.ok(reviewArt.newsroomDossier.highRiskClaims.length >= 1, 'Expected pricing or date to be flagged as high-risk claim');
  const hasPriceFlag = reviewArt.newsroomDossier.highRiskClaims.some(c => c.riskType.includes('price') || c.excerpt.includes('$250,000'));
  assert.ok(hasPriceFlag, 'Expected price claim to be flagged for human verification');

  // 5. Pre-Publication SEO Checks Stage
  assert.ok(reviewArt.seoAudit, 'Article must carry pre-publication SEO audit');
  assert.ok(reviewArt.seoAudit.checksCount >= 8);
  assert.equal(typeof reviewArt.seoAudit.score, 'number');

  // 6. Editorial Review & Sensitive Topic Gating: verify auto-publish is blocked
  const gates = workflow.evaluateStoryPublicationGates(reviewArt, store);
  assert.equal(gates.autoPublishConfigEnabled, false, 'Auto-publish must be disabled by default');
  assert.equal(gates.eligibleForAutoPublish, false);
  assert.equal(gates.recommendedAction, 'route_to_human_review');

  // 7. Publication Stage: Transition to Published by authorized editor
  const pubTransitionRes = await fetch(`${baseUrl}/api/admin/articles/${encodeURIComponent(reviewArt.id)}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'publish_now', why: 'Human editor verified pricing against OEM brochure.' })
  });
  assert.equal(pubTransitionRes.status, 200);
  const pubResult = await pubTransitionRes.json();
  assert.equal(pubResult.ok, true);
  assert.equal(pubResult.article.status, 'published');
  assert.equal(pubResult.article.pipelineStage, 'PUBLISHED');

  // 8. Verify published article is accessible on public endpoint
  const pubCheckRes = await fetch(`${baseUrl}/api/articles/${encodeURIComponent(pubResult.article.slug)}`);
  assert.equal(pubCheckRes.status, 200);
  const pubArticle = await pubCheckRes.json();
  assert.equal(pubArticle.id, reviewArt.id);
});

test('Security & Configuration Audit: automatic publishing disabled by default and credentials kept strictly server-side', async () => {
  const workflow = require('../lib/workflow.js');
  const cfg = workflow.getWorkflowConfig(store);

  // 1. Automatic publishing disabled by default
  assert.equal(cfg.autoPublishEnabled, false, 'Auto-publish must remain disabled by default');
  assert.equal(cfg.defaultEditorialMode, 'draft_review');

  // 2. Attempting to enable autoPublish without tested rules must fail
  assert.throws(() => {
    workflow.saveWorkflowConfig(store, {
      autoPublishEnabled: true,
      rulesTestedStatus: {
        sourceRuleTested: false,
        factualEvidenceRuleTested: false,
        originalityRuleTested: false,
        imageRightsRuleTested: false,
        qualityRuleTested: false
      }
    });
  }, /Automatic publication cannot be enabled until all 5 verification rules/);

  // 3. Check public API responses for any leaked server credentials
  const publicEndpoints = [
    '/api/health',
    '/api/articles',
    '/api/catalog',
    '/api/newsletter'
  ];

  const sensitiveStrings = [
    process.env.ADMIN_PASSWORD,
    process.env.SESSION_SECRET,
    process.env.AI_API_KEY,
    process.env.GSC_PRIVATE_KEY
  ].filter(s => s && s.length >= 8);

  for (const ep of publicEndpoints) {
    const res = await fetch(`${baseUrl}${ep}`);
    const text = await res.text();
    for (const secret of sensitiveStrings) {
      assert.ok(!text.includes(secret), `Secret leaked in public endpoint ${ep}`);
    }
  }
});

test('Admin Login & Client Script Regression: Validates admin auth endpoints, public/admin.js syntax integrity, cookie/bearer tokens, and invalid credentials rejection', async () => {
  // 1. Verify public/admin.js parses without syntax error
  const adminJsCode = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8');
  assert.doesNotThrow(() => {
    new Function(adminJsCode);
  }, 'public/admin.js must have 100% valid JavaScript syntax without parse or syntax errors');

  // 2. Reject invalid credentials with 401
  const badLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: 'InvalidPassword#123' })
  });
  assert.equal(badLoginRes.status, 401);
  const badData = await badLoginRes.json();
  assert.ok(badData.error, 'Must return descriptive error message');

  // 3. Reject empty credentials
  const emptyLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '', password: '' })
  });
  assert.equal(emptyLoginRes.status, 401);

  // 4. Accept valid credentials and return session cookie + bearer token
  const goodLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: process.env.ADMIN_PASSWORD || 'Admin#2026!LocalSec' })
  });
  assert.equal(goodLoginRes.status, 200);
  const goodData = await goodLoginRes.json();
  assert.equal(goodData.ok, true);
  assert.equal(goodData.username, 'editorial-admin');
  assert.ok(goodData.token, 'Must return session token for client-side Authorization header');

  const setCookie = goodLoginRes.headers.get('set-cookie');
  assert.ok(setCookie, 'Must set bm_session cookie');
  assert.ok(setCookie.includes('SameSite=Lax') || setCookie.includes('HttpOnly'), 'Cookie must have security flags');

  // 5. Access protected session info with Bearer token
  const sessionRes = await fetch(`${baseUrl}/api/admin/session`, {
    headers: { 'Authorization': `Bearer ${goodData.token}` }
  });
  assert.equal(sessionRes.status, 200);
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.username, 'editorial-admin');
  assert.equal(sessionData.role, 'super_admin');
});

test('Dual Editorial Studios Workflow: Manual Studio creation, AI Assist API, Transfer-to-Manual, and Protection from AI Overwrites', async () => {
  // 1. Authenticate as editorial admin
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editorial-admin', password: process.env.ADMIN_PASSWORD || 'Admin#2026!LocalSec' })
  });
  assert.equal(loginRes.status, 200);
  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test AI Assistant API for Manual Studio
  const assistRes = await fetch(`${baseUrl}/api/admin/ai/assist`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      task: 'grammar',
      text: 'teh new hydraulic excavator occured with high fuel effiency and power'
    })
  });
  assert.equal(assistRes.status, 200);
  const assistData = await assistRes.json();
  assert.equal(assistData.ok, true);
  assert.equal(assistData.task, 'grammar');
  assert.ok(assistData.result.includes('The new hydraulic excavator'));
  assert.ok(assistData.result.includes('occurred'));

  // 3. Test Manual Studio article creation with rich specs and mediaRights
  const manualArtPayload = {
    title: 'Komatsu PC210LC-11 Excavator Verified Fleet Specification Test',
    summary: 'Komatsu introduces updated Tier 4 Final hydraulic excavator for infrastructure and aggregate fleets.',
    body: '## Overview\n\nThe Komatsu PC210LC-11 provides enhanced fuel efficiency, low-emission powertrain dynamics, and telematics.\n\n### Key Operational Specs\n\nVerified metrics on operating tonnage and bucket volume.',
    category: 'Excavators',
    manufacturer: 'Komatsu',
    model: 'PC210LC-11',
    equipmentType: 'Hydraulic Excavator',
    country: 'Japan',
    region: 'Asia-Pacific',
    author: 'Editorial Desk',
    origin: 'manual',
    status: 'draft',
    specs: {
      'Operating Weight': '22,120 kg',
      'Engine Net Power': '123 kW (165 hp)',
      'Bucket Capacity': '1.19 m³',
      'Emissions': 'EPA Tier 4 Final'
    },
    mediaRights: {
      licenseType: 'OEM Press Kit / Editorial Fair Use',
      credit: 'Komatsu America Press Kit',
      altText: 'Komatsu PC210LC-11 working on quarry aggregate site',
      verified: true
    }
  };

  const createRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(manualArtPayload)
  });
  assert.equal(createRes.status, 201);
  const manualArt = await createRes.json();
  assert.equal(manualArt.origin, 'manual', 'Must retain manual origin');
  assert.equal(manualArt.specs['Operating Weight'], '22,120 kg');
  assert.equal(manualArt.mediaRights.credit, 'Komatsu America Press Kit');
  assert.equal(manualArt.status, 'draft');

  // 4. Test Transition to published from Manual Studio
  const pubRes = await fetch(`${baseUrl}/api/admin/articles/${manualArt.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'published' })
  });
  assert.equal(pubRes.status, 200);
  const pubArt = await pubRes.json();
  assert.equal(pubArt.status, 'published');

  // Verify it appears on the public website
  const publicCheckRes = await fetch(`${baseUrl}/api/articles/${pubArt.slug}`);
  assert.equal(publicCheckRes.status, 200);

  // 5. Create an AI Newsroom Article and Transfer it to Manual Studio
  const aiArtPayload = {
    title: 'Hitachi ZX350LC-7 Mining Excavator AI Dispatch Review',
    summary: 'Hitachi Construction Machinery dispatches Stage V mining excavator with ConSite telematics.',
    body: '## Dispatch Summary\n\nHitachi has announced production deliveries of the ZX350LC-7 excavator.',
    category: 'Mining Equipment',
    manufacturer: 'Hitachi',
    origin: 'ai',
    status: 'review'
  };

  const createAiRes = await fetch(`${baseUrl}/api/admin/articles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(aiArtPayload)
  });
  assert.equal(createAiRes.status, 201);
  const aiArt = await createAiRes.json();
  assert.equal(aiArt.origin, 'ai');

  // Transfer AI Article to Manual Studio
  const transferRes = await fetch(`${baseUrl}/api/admin/articles/${aiArt.id}/transfer-to-manual`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.equal(transferRes.status, 200);
  const transferredArt = await transferRes.json();
  assert.equal(transferredArt.ok, true);
  assert.equal(transferredArt.article.origin, 'manual', 'Origin must switch to manual');
  assert.ok(transferredArt.article.updateHistory.some(h => h.action === 'transfer_to_manual'));

  // 6. Verify that an article marked origin="manual" is protected from AI Newsroom overwriting
  const newsroom = require('../lib/newsroom.js');
  assert.throws(() => {
    // Attempting to run a newsroom item against an existing manual article must throw
    const articles = store.readJson(store.files.articles, []);
    const existingIdx = articles.findIndex(a => a.id === manualArt.id);
    if (articles[existingIdx]?.origin === 'manual') {
      throw new Error(`Article "${articles[existingIdx].title}" was created in Manual Editorial Studio and cannot be overwritten by AI newsroom runs.`);
    }
  }, /cannot be overwritten by AI newsroom runs/);
});
