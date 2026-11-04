const { escapeHtml } = require('./ssr.js');

const MAX_AUTO_LINKS = 8;
const SKIP_MANUFACTURER_SLUGS = new Set(['various', 'all-manufacturers', 'volvo', 'tata']);
const MANUFACTURER_ALIASES = {
  caterpillar: ['Caterpillar', 'Cat'],
  'volvo-construction-equipment': ['Volvo Construction Equipment', 'Volvo CE', 'Volvo'],
  'tata-motors': ['Tata Motors', 'Tata'],
  'bull-machines': ['BULL Machines', 'Bull Machines']
};
const MODEL_CODE_PATTERN = /\b[A-Z]{1,3}\d{2,4}[A-Z]?\b|\b\d[A-Z]{2}\b/g;

function makeHeadingId(text, idx = 1) {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  return clean ? `sec-${clean}` : `sec-heading-${idx}`;
}

function countWords(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function inlineFormat(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawHref) => {
      const href = String(rawHref || '').trim();
      if (href.startsWith('/')) return `<a class="text-link" href="${href}">${label}</a>`;
      if (/^https?:\/\//i.test(href)) return `<a class="text-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      return label;
    });
}

function renderBlocksWithHeadings(rawText) {
  const headings = [];
  const usedIds = new Set();
  let hIdx = 0;

  const html = String(rawText || '').split(/\n\s*\n/).map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^###\s+/.test(trimmed)) {
      hIdx++;
      const rawTitle = trimmed.replace(/^###\s+/, '').trim();
      let id = makeHeadingId(rawTitle, hIdx);
      let n = 2;
      while (usedIds.has(id)) id = `${makeHeadingId(rawTitle, hIdx)}-${n++}`;
      usedIds.add(id);
      headings.push({ level: 3, text: rawTitle.replace(/\*\*/g, ''), id });
      return `<h3 id="${id}" class="article-subheading article-subheading-h3">${inlineFormat(escapeHtml(rawTitle))}</h3>`;
    }
    if (/^##\s+/.test(trimmed)) {
      hIdx++;
      const rawTitle = trimmed.replace(/^##\s+/, '').trim();
      let id = makeHeadingId(rawTitle, hIdx);
      let n = 2;
      while (usedIds.has(id)) id = `${makeHeadingId(rawTitle, hIdx)}-${n++}`;
      usedIds.add(id);
      headings.push({ level: 2, text: rawTitle.replace(/\*\*/g, ''), id });
      return `<h2 id="${id}" class="article-subheading">${inlineFormat(escapeHtml(rawTitle))}</h2>`;
    }
    const lines = trimmed.split('\n');
    if (lines.every(l => l.trim().startsWith('- '))) {
      return `<ul class="article-list">${lines.map(l => `<li>${inlineFormat(escapeHtml(l.trim().replace(/^-\s+/, '')))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map(l => inlineFormat(escapeHtml(l))).join('<br>')}</p>`;
  }).join('');

  return { html, headings };
}

function renderBlocks(rawText) {
  return renderBlocksWithHeadings(rawText).html;
}

function renderTocHtml(headings = [], wordCount = 0) {
  if (wordCount <= 800 || !Array.isArray(headings) || headings.length === 0) return '';
  return `<nav class="article-toc" aria-label="Table of contents"><h2>Contents</h2><ol>${headings.map(h => `<li class="toc-level-${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`).join('')}</ol></nav>`;
}

function buildLinkTargets(catalog = {}) {
  const targets = [];
  for (const m of catalog.manufacturers || []) {
    if (!m.slug || SKIP_MANUFACTURER_SLUGS.has(m.slug)) continue;
    const names = MANUFACTURER_ALIASES[m.slug] || [m.name];
    for (const name of names) targets.push({ text: name, url: `/manufacturers/${m.slug}`, title: `${m.name} OEM profile` });
  }
  for (const em of catalog.equipmentModels || []) {
    if (!em.slug || /^(various|all-manufacturers)-/.test(em.slug)) continue;
    for (const code of new Set(String(em.name || '').match(MODEL_CODE_PATTERN) || [])) {
      targets.push({ text: code, url: `/models/${em.slug}`, title: `${em.name} specifications` });
    }
  }
  return targets.sort((a, b) => b.text.length - a.text.length);
}

function extractBrandsMentioned(article = {}, catalog = {}) {
  const found = [];
  const seenSlugs = new Set();
  const hay = `${article.title || ''} ${article.summary || ''} ${article.manufacturer || ''} ${article.body || ''}`;

  for (const m of catalog.manufacturers || []) {
    if (!m.slug || SKIP_MANUFACTURER_SLUGS.has(m.slug)) continue;
    const names = MANUFACTURER_ALIASES[m.slug] || [m.name];
    const matched = names.some(name => {
      const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!escaped) return false;
      const re = new RegExp(`(^|[^\\w])(${escaped})(?![\\w])`, 'i');
      return re.test(hay);
    });
    if (matched && !seenSlugs.has(m.slug)) {
      seenSlugs.add(m.slug);
      found.push({
        name: m.name,
        slug: m.slug,
        url: `/manufacturers/${m.slug}`
      });
    }
  }
  return found;
}

function hasRealPostPublishEdit(article = {}) {
  if (!article || !article.publishedAt) return false;
  const pubTime = new Date(article.publishedAt).getTime();
  if (!Number.isFinite(pubTime)) return false;
  const history = Array.isArray(article.updateHistory) ? article.updateHistory : [];
  return history.some(entry => {
    if (!entry || !entry.at) return false;
    const entryTime = new Date(entry.at).getTime();
    if (!Number.isFinite(entryTime) || entryTime <= pubTime + 1000) return false;
    if (entry.by === 'System Migration') return false;
    if (entry.action === 'created') return false;
    if (/Normalized to v2 content architecture schema/i.test(String(entry.note || ''))) return false;
    return true;
  });
}

/** Links the first mention of each known OEM / model in text nodes, skipping headings and existing links. */
function linkEntities(html, catalog) {
  const targets = buildLinkTargets(catalog);
  if (!targets.length) return html;
  const used = new Set();
  let count = 0;
  let depthA = 0;
  let inHeading = false;
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) depthA++;
      else if (/^<\/a>/i.test(part)) depthA = Math.max(0, depthA - 1);
      else if (/^<h[1-6][\s>]/i.test(part)) inHeading = true;
      else if (/^<\/h[1-6]>/i.test(part)) inHeading = false;
      return part;
    }
    if (depthA || inHeading || count >= MAX_AUTO_LINKS) return part;
    let segments = [part]; // anchors inserted below are frozen so later targets never match inside them
    for (const t of targets) {
      if (count >= MAX_AUTO_LINKS || used.has(t.url)) continue;
      const escaped = escapeHtml(t.text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^\\w>])(${escaped})(?![\\w])`);
      const idx = segments.findIndex(s => !s.startsWith('<a ') && re.test(s));
      if (idx < 0) continue;
      const seg = segments[idx];
      const found = re.exec(seg);
      const start = found.index + found[1].length;
      const link = `<a class="text-link" href="${t.url}" title="${escapeHtml(t.title)}">${found[2]}</a>`;
      segments.splice(idx, 1, seg.slice(0, start), link, seg.slice(start + found[2].length));
      used.add(t.url);
      count++;
    }
    return segments.join('');
  }).join('');
}

function deriveTakeaways(article) {
  const explicit = (Array.isArray(article.keyFacts) ? article.keyFacts : []).map(s => String(s).trim()).filter(Boolean);
  if (explicit.length) return explicit.slice(0, 4);
  const paragraphs = String(article.body || '').split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p && !/^#{2,3}\s/.test(p) && !p.startsWith('- '));
  if (paragraphs.length < 3) return [];
  return paragraphs.slice(0, 3)
    .map(p => (p.match(/^.+?[.!?](?=\s|$)/) || [p])[0].replace(/\*\*/g, '').trim())
    .filter(s => s.length >= 40 && s.length <= 260);
}

function renderTakeawaysHtml(takeaways) {
  if (!takeaways.length) return '';
  return `<aside class="article-takeaways" aria-label="Key takeaways"><h2>Key takeaways</h2><ul>${takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></aside>`;
}

function renderArticleBody(article, catalog) {
  const takeaways = deriveTakeaways(article);
  const wordCount = countWords(article.body);
  const { html, headings } = renderBlocksWithHeadings(article.body);
  const toc = wordCount > 800 ? headings : [];
  const tocHtml = renderTocHtml(headings, wordCount);
  const brandsMentioned = extractBrandsMentioned(article, catalog);
  return {
    takeaways,
    takeawaysHtml: renderTakeawaysHtml(takeaways),
    wordCount,
    headings,
    toc,
    tocHtml,
    brandsMentioned,
    hasRealUpdate: hasRealPostPublishEdit(article),
    bodyHtml: linkEntities(html, catalog)
  };
}

module.exports = {
  renderArticleBody,
  renderBlocks,
  renderBlocksWithHeadings,
  renderTocHtml,
  extractBrandsMentioned,
  hasRealPostPublishEdit,
  countWords,
  linkEntities,
  deriveTakeaways
};
