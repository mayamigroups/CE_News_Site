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

function renderBlocks(rawText) {
  return String(rawText || '').split(/\n\s*\n/).map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^###?\s+/.test(trimmed)) {
      return `<h2 class="article-subheading">${inlineFormat(escapeHtml(trimmed.replace(/^###?\s+/, '')))}</h2>`;
    }
    const lines = trimmed.split('\n');
    if (lines.every(l => l.trim().startsWith('- '))) {
      return `<ul class="article-list">${lines.map(l => `<li>${inlineFormat(escapeHtml(l.trim().replace(/^-\s+/, '')))}</li>`).join('')}</ul>`;
    }
    return `<p>${lines.map(l => inlineFormat(escapeHtml(l))).join('<br>')}</p>`;
  }).join('');
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
  return {
    takeaways,
    takeawaysHtml: renderTakeawaysHtml(takeaways),
    bodyHtml: linkEntities(renderBlocks(article.body), catalog)
  };
}

module.exports = { renderArticleBody, renderBlocks, linkEntities, deriveTakeaways };
