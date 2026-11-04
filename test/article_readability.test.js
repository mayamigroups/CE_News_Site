const test = require('node:test');
const assert = require('node:assert/strict');
const { renderArticleBody, linkEntities } = require('../lib/article-render.js');
const { renderArticleSsrHtml } = require('../lib/ssr.js');

const catalog = {
  manufacturers: [
    { name: 'Komatsu', slug: 'komatsu' },
    { name: 'Caterpillar', slug: 'caterpillar' },
    { name: 'Various', slug: 'various' }
  ],
  equipmentModels: [
    { name: 'PC210 Hydraulic Excavator Series', slug: 'komatsu-pc210-10m0-hydraulic-excavator' },
    { name: 'Various Platforms', slug: 'various-platforms' }
  ]
};

test('linkEntities links the first OEM / model mention once and skips headings and existing links', () => {
  const html = '<h2 class="article-subheading">Komatsu overview</h2><p>Komatsu builds the PC210. Komatsu again. <a href="/x">Caterpillar</a></p>';
  const out = linkEntities(html, catalog);
  assert.equal((out.match(/href="\/manufacturers\/komatsu"/g) || []).length, 1);
  assert.match(out, /href="\/models\/komatsu-pc210-10m0-hydraulic-excavator"[^>]*>PC210<\/a>/);
  assert.ok(!out.includes('/manufacturers/caterpillar'), 'existing links are not re-linked');
  assert.ok(!/<h2[^>]*><a/.test(out), 'headings stay unlinked');
});

test('renderArticleBody derives takeaways from the body and escapes HTML', () => {
  const body = [
    'Komatsu has launched a new hydraulic system for fleet buyers. It is aimed at quarries.',
    'Caterpillar answered with a competing electro-hydraulic valve package for 2027. Details follow.',
    '<script>alert(1)</script> Third paragraph with enough words to qualify as a takeaway sentence.'
  ].join('\n\n');
  const r = renderArticleBody({ body, keyFacts: [] }, catalog);
  assert.equal(r.takeaways.length, 3);
  assert.ok(!r.bodyHtml.includes('<script>'));
});

test('SSR article page contains the readable body for crawlers without JavaScript', () => {
  const template = '<html><head><title>x</title></head><body><main class="wrap article-page" id="article-content"><p>Loading…</p></main></body></html>';
  const article = {
    title: 'Test Story', slug: 'test-story', category: 'Technology', summary: 'Deck',
    seo: { metaTitle: 'Test Story | Machine Report World' }, bodyHtml: '<p>Unique body sentence.</p>',
    takeaways: ['One key point that matters.'], sourceUrls: ['https://example.com/a']
  };
  const html = renderArticleSsrHtml(template, article, 'https://example.org');
  assert.match(html, /Unique body sentence\./);
  assert.match(html, /Key takeaways/);
  assert.match(html, /<title>Test Story \| Machine Report World<\/title>/);
  assert.ok(!html.includes('Loading…'));
});
