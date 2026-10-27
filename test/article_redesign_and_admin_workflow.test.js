const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

const models = require('../lib/models.js');
const Store = require('../lib/store.js');
const { createRepositories } = require('../lib/repositories/index.js');
const { createServices } = require('../lib/services/index.js');
const handlePublicRoutes = require('../lib/routes/public-routes.js');
const handleAdminRoutes = require('../lib/routes/admin-routes.js');
const handleArticleRoutes = require('../lib/routes/article-routes.js');
const handleCollectionRoutes = require('../lib/routes/collection-routes.js');
const handleDistributionRoutes = require('../lib/routes/distribution-routes.js');
const handleNewsroomRoutes = require('../lib/routes/newsroom-routes.js');

test('Public Article Redesign & Admin Daily Workflow Structure', async (t) => {
  // 1. Verify public article DOM and CSS rules
  await t.test('public/article.html and styles.css implement the clean 680-780px B2B reading column', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/article.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, '../public/article.js'), 'utf8');

    // Hierarchy elements in article.js and styles.css
    assert.match(css, /\.article-reading-container\s*\{[^}]*max-width:\s*7[0-9]{2}px/);
    assert.match(css, /\.article-meta-bar/);
    assert.match(css, /\.article-headline/);
    assert.match(css, /\.article-deck/);
    assert.match(css, /\.article-byline/);
    assert.match(css, /\.article-share-bar/);
    assert.match(css, /\.article-hero-figure/);
    assert.match(css, /\.article-body-content/);
    assert.match(css, /\.why-this-matters/);
    assert.match(css, /\.specs-table/);
    assert.match(css, /\.article-sources-box/);
    assert.match(css, /\.manufacturer-callout/);
    assert.match(css, /\.article-related-container/);
    assert.match(css, /\.article-newsletter-card/);

    // Verify obsolete Story Dossier and Connected Hubs were cleaned up from reading layout
    assert.ok(!js.includes('class="story-dossier"'), 'Story dossier should not be in article reading layout');
    assert.ok(!js.includes('class="connected-hubs"'), 'Connected hubs box should not clutter article layout');
    assert.ok(!js.includes('class="demo-warning"'), 'Internal demo warnings should not be rendered');

    // Verify structured data injection
    assert.ok(js.includes('NewsArticle'), 'Must inject NewsArticle JSON-LD schema');
    assert.ok(js.includes('BreadcrumbList'), 'Must inject BreadcrumbList JSON-LD schema');
  });

  // 2. Verify model normalization of optional fields
  await t.test('lib/models.js normalizes optional article fields without losing data', () => {
    const raw = {
      title: 'Caterpillar Unveils Next-Gen Electric Mining Truck Prototype',
      summary: 'Heavy electric prototype achieves zero exhaust emissions in pilot quarry tests.',
      body: 'Caterpillar has revealed its latest electric prototype in Peoria.\n\nInitial tests demonstrated 8 hours of continuous operation under heavy payload cycles.',
      category: 'Construction Equipment',
      manufacturer: 'Caterpillar',
      keyFacts: ['8-hour battery endurance', '100-ton payload capacity', 'Zero direct exhaust emissions'],
      whyItMatters: 'Demonstrates electrification feasibility in ultra-heavy mining transport.',
      confirmedFacts: ['Tested at Peoria demonstration grounds', '100-ton target rating'],
      analysis: 'Long-term adoption depends on megawatt charging infrastructure deployment at remote mine sites.',
      equipmentModels: ['Cat 793 Electric'],
      sourceUrls: ['https://www.caterpillar.com/en/news/press-releases.html'],
      imageCredit: 'Caterpillar Inc. Press Kit',
      isSponsored: false
    };

    const normalized = models.validateAndNormalizeArticle(raw);
    assert.equal(normalized.title, raw.title);
    assert.deepEqual(normalized.keyFacts, raw.keyFacts);
    assert.equal(normalized.whyItMatters, raw.whyItMatters);
    assert.deepEqual(normalized.confirmedFacts, raw.confirmedFacts);
    assert.equal(normalized.analysis, raw.analysis);
    assert.deepEqual(normalized.equipmentModels, raw.equipmentModels);
    assert.deepEqual(normalized.sourceUrls, raw.sourceUrls);
    assert.equal(normalized.imageCredit, raw.imageCredit);
    assert.equal(normalized.isSponsored, false);
  });

  // 3. Verify Admin HTML contains 5 primary daily workflow tabs and Advanced workspace
  await t.test('public/admin.html organizes daily editorial workflow into 5 primary screens and advanced tools', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');

    // 5 primary tabs in navigation bar
    assert.match(adminHtml, /data-tab="tab-inbox"[^>]*>.*News Inbox/i);
    assert.match(adminHtml, /data-tab="tab-review"[^>]*>.*Review Queue/i);
    assert.match(adminHtml, /data-tab="tab-scheduled"[^>]*>.*Scheduled/i);
    assert.match(adminHtml, /data-tab="tab-published"[^>]*>.*Published/i);
    assert.match(adminHtml, /data-tab="tab-automation"[^>]*>.*Sources &amp; Automation/i);
    assert.match(adminHtml, /data-tab="tab-advanced"[^>]*>.*Advanced Tools/i);

    // 5 primary pane sections exist
    assert.match(adminHtml, /id="tab-inbox"/);
    assert.match(adminHtml, /id="tab-review"/);
    assert.match(adminHtml, /id="tab-scheduled"/);
    assert.match(adminHtml, /id="tab-published"/);
    assert.match(adminHtml, /id="tab-automation"/);
    assert.match(adminHtml, /id="tab-advanced"/);

    // News Inbox Table columns
    assert.match(adminHtml, /id="inbox-table"/);
    assert.match(adminHtml, /<th>Source<\/th>/i);
    assert.match(adminHtml, /<th>Headline<\/th>/i);
    assert.match(adminHtml, /<th>Manufacturer<\/th>/i);
    assert.match(adminHtml, /<th>Detected Date<\/th>/i);
    assert.match(adminHtml, /<th>Relevance<\/th>/i);
    assert.match(adminHtml, /<th>Duplicate Warning<\/th>/i);

    // Review Queue Table columns
    assert.match(adminHtml, /id="review-table"/);
    assert.match(adminHtml, /<th>Risk Level<\/th>/i);
    assert.match(adminHtml, /<th>Missing Information<\/th>/i);
    assert.match(adminHtml, /<th>SEO Status<\/th>/i);

    // Scheduled Table columns
    assert.match(adminHtml, /id="scheduled-table"/);
    assert.match(adminHtml, /<th>Scheduled Publication Time<\/th>/i);

    // Published Table columns
    assert.match(adminHtml, /id="published-table"/);
    assert.match(adminHtml, /<th>Search Performance \(GSC\)<\/th>/i);

    // Sources & Automation cards
    assert.match(adminHtml, /id="auto-enabled-sources"/);
    assert.match(adminHtml, /id="auto-last-run"/);
    assert.match(adminHtml, /id="auto-last-success"/);
    assert.match(adminHtml, /id="auto-error-count"/);
    assert.match(adminHtml, /id="auto-frequency"/);
    assert.match(adminHtml, /id="auto-daily-limit"/);
    assert.match(adminHtml, /id="auto-ai-status"/);
    assert.match(adminHtml, /id="auto-email-status"/);

    // Advanced workspace preserves secondary tools
    assert.match(adminHtml, /data-adv-target="tab-taxonomy"/);
    assert.match(adminHtml, /data-adv-target="tab-oems"/);
    assert.match(adminHtml, /data-adv-target="tab-geo"/);
    assert.match(adminHtml, /data-adv-target="tab-sources"/);
    assert.match(adminHtml, /data-adv-target="tab-images"/);
    assert.match(adminHtml, /data-adv-target="tab-newsletter"/);
    assert.match(adminHtml, /data-adv-target="tab-jobs"/);
    assert.match(adminHtml, /data-adv-target="tab-settings"/);
    assert.match(adminHtml, /data-adv-target="tab-ai-seo"/);
  });

  // 4. Verify admin.js contains render functions and action handlers
  await t.test('public/admin.js implements rendering and actions for all 5 workflow screens', () => {
    const adminJs = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8');

    assert.ok(adminJs.includes('renderNewsInbox'), 'Must define renderNewsInbox');
    assert.ok(adminJs.includes('renderReviewQueue'), 'Must define renderReviewQueue');
    assert.ok(adminJs.includes('renderScheduledQueue'), 'Must define renderScheduledQueue');
    assert.ok(adminJs.includes('renderPublishedDesk'), 'Must define renderPublishedDesk');
    assert.ok(adminJs.includes('renderAutomationDashboard'), 'Must define renderAutomationDashboard');
    assert.ok(adminJs.includes('renderDailyWorkflows'), 'Must define renderDailyWorkflows');
    assert.ok(adminJs.includes('loadArticleIntoEditor'), 'Must define loadArticleIntoEditor');
    assert.ok(adminJs.includes('openArticlePreview'), 'Must define openArticlePreview');

    // Action handlers
    assert.ok(adminJs.includes('data-inbox-draft'), 'Must handle Create Draft action');
    assert.ok(adminJs.includes('data-inbox-ignore'), 'Must handle Ignore action');
    assert.ok(adminJs.includes('data-review-read'), 'Must handle Read action');
    assert.ok(adminJs.includes('data-review-approve'), 'Must handle Approve & Schedule action');
    assert.ok(adminJs.includes('data-review-reject'), 'Must handle Reject action');
    assert.ok(adminJs.includes('data-scheduled-publish'), 'Must handle Scheduled Publish Now action');
    assert.ok(adminJs.includes('data-scheduled-reschedule'), 'Must handle Scheduled Change Time action');
    assert.ok(adminJs.includes('data-scheduled-return'), 'Must handle Return to Review action');
    assert.ok(adminJs.includes('data-published-update-note'), 'Must handle Published Update Note action');
    assert.ok(adminJs.includes('data-published-unpublish'), 'Must handle Published Unpublish action');
  });
});
