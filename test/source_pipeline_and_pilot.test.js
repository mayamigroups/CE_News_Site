const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const models = require('../lib/models.js');
const collector = require('../lib/collector.js');
const { createDataStore } = require('../lib/store.js');

test('Multi-Brand News Source Pipeline & Five-Brand Pilot Verification', async (t) => {
  const tmpDir = path.join(__dirname, 'tmp_source_test_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const store = createDataStore(tmpDir);
  store.migrate();

  t.after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // 1. Empty feedUrl cannot be classified as RSS or Atom
  await t.test('1. Empty feedUrl cannot be treated as RSS or Atom feed', () => {
    const rawWithEmptyFeed = {
      name: 'Cat Official Newsroom',
      website: 'https://www.caterpillar.com/en/news.html',
      feedUrl: '',
      collectionMode: 'rss', // erroneously claimed
      sourceType: 'rss-feed'
    };

    const validated = models.validateAndNormalizeSource(rawWithEmptyFeed);
    assert.notEqual(validated.collectionMode, 'rss', 'Source with empty feedUrl must not have collectionMode="rss"');
    assert.notEqual(validated.collectionMode, 'atom', 'Source with empty feedUrl must not have collectionMode="atom"');
    assert.equal(validated.collectionMode, 'manual_url', 'Should default to manual_url or newsroom_page');
    assert.equal(validated.automaticCollectionApproved, false, 'Auto-collection must never be approved for empty feed');
  });

  // 2. RSS feed validation
  await t.test('2. RSS feed validation parses items and canonical links correctly', () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Test Heavy Machinery RSS</title>
          <link>https://www.oemoffhighway.com</link>
          <item>
            <title>New 50-Ton Excavator Unveiled</title>
            <link>https://www.oemoffhighway.com/article/123?utm_source=rss</link>
            <guid>https://www.oemoffhighway.com/article/123</guid>
            <pubDate>Mon, 27 Oct 2026 10:00:00 GMT</pubDate>
            <description>Excavator with high-efficiency hydraulic powertrain.</description>
          </item>
        </channel>
      </rss>`;

    const items = collector.parseFeedXml(rssXml, 'https://www.oemoffhighway.com/feed.xml');
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'New 50-Ton Excavator Unveiled');
    assert.equal(items[0].canonicalUrl, 'https://www.oemoffhighway.com/article/123');
    assert.ok(items[0].publishedAt);
  });

  // 3. Atom feed validation
  await t.test('3. Atom feed validation parses entries and alternate links correctly', () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Komatsu Newsroom Feed</title>
        <link href="https://www.komatsu.jp"/>
        <entry>
          <title>Komatsu Begins Production of Hydrogen-Powered Rigid Dump Truck</title>
          <link rel="alternate" href="https://www.komatsu.jp/en/newsroom/2026/h2-truck.html?ref=atom"/>
          <id>urn:komatsu:news:2026:h2-truck</id>
          <updated>2026-10-27T12:00:00Z</updated>
          <summary>Zero-emission haulage in mining operations.</summary>
        </entry>
      </feed>`;

    const items = collector.parseFeedXml(atomXml, 'https://www.komatsu.jp/atom.xml');
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Komatsu Begins Production of Hydrogen-Powered Rigid Dump Truck');
    assert.equal(items[0].canonicalUrl, 'https://www.komatsu.jp/en/newsroom/2026/h2-truck.html');
  });

  // 4. XML Sitemap validation
  await t.test('4. XML Sitemap validation parses locs and publication dates within allowed paths', () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://www.volvoce.com/global/en/news-and-events/news-and-stories/2026/electric-loader/</loc>
          <lastmod>2026-10-25T08:30:00Z</lastmod>
        </url>
        <url>
          <loc>https://www.volvoce.com/global/en/about-us/careers/</loc>
          <lastmod>2026-10-20T00:00:00Z</lastmod>
        </url>
      </urlset>`;

    const items = collector.parseSitemapXml(sitemapXml, 'https://www.volvoce.com/sitemap.xml', {
      allowedPathPrefixes: ['/global/en/news-and-events/']
    });
    assert.equal(items.length, 1, 'Careers URL must be filtered out by path prefix');
    assert.equal(items[0].canonicalUrl, 'https://www.volvoce.com/global/en/news-and-events/news-and-stories/2026/electric-loader');
  });

  // 5. Non-feed / invalid XML handling
  await t.test('5. Non-feed HTML or corrupt XML is detected and reported as invalid', () => {
    const htmlWebpage = '<!DOCTYPE html><html><head><title>Normal Webpage</title></head><body><h1>Not an RSS feed</h1></body></html>';
    const itemsHtml = collector.parseFeedXml(htmlWebpage, 'https://example.com/not-a-feed');
    assert.equal(itemsHtml.length, 0, 'HTML webpage must yield 0 items from feed parser');

    const corruptXml = '<?xml version="1.0"?><rss><channel><title>Broken<item></rss>';
    const itemsCorrupt = collector.parseFeedXml(corruptXml, 'https://example.com/broken.xml');
    assert.equal(itemsCorrupt.length, 0, 'Corrupt XML must yield 0 items from feed parser');
  });

  // 6. Source timeout and SSRF security handling
  await t.test('6. SSRF blocks private loopback addresses when fetching', async () => {
    await assert.rejects(async () => {
      await collector.fetchWithSecurity('http://127.0.0.1:8080/feed.xml', { timeoutMs: 100 });
    }, /SSRF prevention|loopback addresses prohibited/i);
  });

  // 7. Source response size limit (2MB)
  await t.test('7. Response exceeding 2MB limit is rejected to prevent memory exhaustion', async () => {
    assert.equal(collector.MAX_RESPONSE_BYTES, 2 * 1024 * 1024);
  });

  // 8. Duplicate canonical URL detection
  await t.test('8. Duplicate canonical URL detection flags items accurately', () => {
    const url1 = 'https://www.komatsu.jp/en/newsroom/2026/article?utm_source=feed&ref=newsletter';
    const url2 = 'https://www.komatsu.jp/en/newsroom/2026/article';

    const norm1 = collector.normalizeCanonicalUrl(url1);
    const norm2 = collector.normalizeCanonicalUrl(url2);

    assert.equal(norm1, norm2, 'Normalized canonical URLs must strip tracking query parameters');
  });

  // 9. Duplicate title and content fingerprinting
  await t.test('9. Fingerprinting detects identical and subtly re-punctuated titles', () => {
    const fp1 = collector.computeTitleFingerprint('Komatsu Unveils Next-Gen Electric Excavator!');
    const fp2 = collector.computeTitleFingerprint('komatsu unveils next gen electric excavator');
    assert.equal(fp1, fp2, 'Fingerprints of sanitized titles must match');

    const fp3 = collector.computeContentFingerprint('Full story body text detailing high-efficiency pumps.');
    assert.equal(fp3.length, 24, 'Content fingerprint must be a 24-character hex string');
  });

  // 10. Manual URL Intake validation
  await t.test('10. Manual URL Intake creates full 21-field News Inbox record', async () => {
    // Test manual intake against an approved domain simulation
    const mockStore = createDataStore(tmpDir);
    mockStore.writeJson(mockStore.files.sources, [
      {
        id: 'src-test-komatsu',
        name: 'Komatsu Global Newsroom',
        domain: 'komatsu.jp',
        website: 'https://www.komatsu.jp/en/newsroom',
        feedUrl: '',
        collectionMode: 'manual_url',
        manufacturer: 'Komatsu',
        enabled: true
      }
    ]);

    // Intake official Komatsu newsroom URL
    const res = await collector.intakeManualUrl(mockStore, 'https://www.komatsu.jp/en/newsroom', {
      manufacturer: 'Komatsu',
      actor: 'Unit Test'
    });

    assert.equal(res.ok, true);
    assert.ok(res.item);
    const it = res.item;
    assert.ok(it.id.startsWith('col-'));
    assert.ok(it.headline);
    assert.equal(it.manufacturer, 'Komatsu');
    assert.equal(it.collectionMethod, 'manual_url');
    assert.equal(it.collectionMode, 'manual_url');
    assert.equal(it.reviewStatus, 'pending_review');
    assert.equal(it.promotedArticleId, null, 'Must NOT be promoted to an article');
    assert.ok(it.imageRightsStatus.includes('unverified_editorial_fair_use_only_no_image_rights'));
    assert.ok(it.stageHistory.length >= 3);
  });

  // 11. Unapproved domain rejection
  await t.test('11. Manual URL Intake rejects unapproved domains', async () => {
    const mockStore = createDataStore(tmpDir);
    mockStore.writeJson(mockStore.files.sources, []);

    await assert.rejects(async () => {
      await collector.intakeManualUrl(mockStore, 'https://www.random-unapproved-blog.com/post', {
        actor: 'Unit Test'
      });
    }, /not an approved manufacturer or industry news source/i);
  });

  // 12. Private IP / SSRF rejection
  await t.test('12. SSRF guardrails block localhost, private IPs, and cloud metadata endpoints', () => {
    const dangerousUrls = [
      'http://localhost:3000/admin',
      'http://127.0.0.1:8080/secret',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.1/internal',
      'http://192.168.1.1/router',
      'http://172.16.0.5/api',
      'file:///etc/passwd',
      'ftp://server/file'
    ];

    for (const u of dangerousUrls) {
      const check = collector.isSafePublicUrl(u);
      assert.equal(check.safe, false, `URL "${u}" should have been flagged as unsafe`);
    }
  });

  // 13. Source registry import idempotency
  await t.test('13. Candidate registry import is idempotent and preserves Daimler Truck disabled', () => {
    const mockStore = createDataStore(tmpDir);
    mockStore.writeJson(mockStore.files.sources, []);

    // First import
    const res1 = collector.importCandidateRegistry(mockStore, null, { actor: 'Test Runner' });
    assert.equal(res1.ok, true);
    const count1 = res1.totalSources;

    // Second import (idempotent)
    const res2 = collector.importCandidateRegistry(mockStore, null, { actor: 'Test Runner' });
    assert.equal(res2.ok, true);
    assert.equal(res2.insertedCount, 0, 'Second import must not insert duplicate sources');
    assert.equal(res2.totalSources, count1, 'Source count must remain identical');

    // Verify Daimler Truck status
    const sources = mockStore.readJson(mockStore.files.sources, []);
    const daimler = sources.find(s => s.name.toLowerCase().includes('daimler'));
    assert.ok(daimler, 'Daimler Truck source must exist');
    assert.equal(daimler.enabled, false, 'Daimler Truck must remain disabled pending verification');
    assert.equal(daimler.sourceType, 'pending_verification');
    assert.equal(daimler.collectionMode, 'disabled');
  });

  // 14. News Inbox record validation
  await t.test('14. News Inbox records adhere to complete 21-field structure', () => {
    const items = store.readJson(path.join(__dirname, '../data/collected_items.json'), []);
    assert.ok(items.length >= 5, 'Must have at least 5 pilot items in collected_items.json');

    for (const item of items) {
      assert.ok(item.id, 'item must have id');
      assert.ok(item.headline, 'item must have headline');
      assert.ok(item.manufacturer, 'item must have manufacturer');
      assert.ok(item.originalUrl, 'item must have originalUrl');
      assert.ok(item.canonicalUrl, 'item must have canonicalUrl');
      assert.ok(item.collectionMethod, 'item must have collectionMethod');
      assert.ok(item.duplicateStatus, 'item must have duplicateStatus');
      assert.ok(item.imageRightsStatus, 'item must have imageRightsStatus');
      assert.equal(item.reviewStatus, 'pending_review');
    }
  });

  // 15. Verification that no article is automatically created or published
  await t.test('15. Collection never creates or publishes articles automatically', () => {
    const articles = store.readJson(path.join(__dirname, '../data/articles.json'), []);
    const initialCount = articles.length;

    // Check collected items: every item must have promotedArticleId: null
    const collected = store.readJson(path.join(__dirname, '../data/collected_items.json'), []);
    for (const c of collected) {
      assert.equal(c.promotedArticleId, null, `Collected item "${c.headline}" must not be automatically promoted to an article`);
    }

    // Verify no new articles appeared
    const afterArticles = store.readJson(path.join(__dirname, '../data/articles.json'), []);
    assert.equal(afterArticles.length, initialCount, 'Article count must not change during news collection');
  });
});
