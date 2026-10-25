const {
  esc,
  REGIONAL_HUBS,
  resolveRegionSlug,
  regionUrl,
  articleUrl,
  renderArticleCard,
  renderPagination,
  setJsonLd,
  applyPaginationSeo,
  trackTelemetry
} = window.MWComponents;

const $ = (s, root = document) => root.querySelector(s);

// Resolve region slug from `/india/`, `/north-america/`, `/region/europe`, or `?region=china`
const pathParts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
const params = new URLSearchParams(location.search);
let rawRegion = params.get('region') || params.get('country') || '';
if (!rawRegion) {
  if ((pathParts[0] === 'region' || pathParts[0] === 'regions') && pathParts[1]) {
    rawRegion = pathParts[1];
  } else if (pathParts[0] && pathParts[0] !== 'region.html') {
    rawRegion = pathParts[0];
  }
}

const activeSlug = resolveRegionSlug(rawRegion || 'india');
const hub = REGIONAL_HUBS[activeSlug] || REGIONAL_HUBS['india'];

// Canonical URL prevents duplicate indexing across aliases (e.g., /united-states/ -> /north-america/)
const canonicalHref = `${location.origin}${regionUrl(hub.slug)}`;
const pageTitle = `${hub.title} Construction Equipment & Commercial Vehicle News | MACHINEWIRE`;
document.title = pageTitle;

const metaDesc = $('meta[name="description"]');
if (metaDesc) metaDesc.content = `${hub.title} — ${hub.description} Regulations: ${hub.regulations}.`;
const ogTitle = $('#og-title');
if (ogTitle) ogTitle.content = pageTitle;
const ogDesc = $('#og-desc');
if (ogDesc) ogDesc.content = hub.description;
const canon = $('#canonical-link');
if (canon) canon.href = canonicalHref;

$('#region-title').textContent = hub.title;
$('#crumb').textContent = hub.title;
$('#region-topline-badge').textContent = `${hub.shortName.toUpperCase()} DESK`;
$('#region-eyebrow').textContent = `${hub.shortName.toUpperCase()} MARKET & REGULATORY DOSSIER`;
$('#region-description').textContent = hub.description;
$('#local-section-heading').textContent = `${hub.shortName.toUpperCase()} LOCAL & REGIONAL COVERAGE`;
$('#intl-region-name').textContent = hub.title;
$('#year').textContent = new Date().getFullYear();

// Render verified local market context (Terminology, Units, Currencies, Regulations, Trade Shows)
const contextGrid = $('#region-context-grid');
if (contextGrid) {
  const items = [
    ['Currencies & Pricing Context', hub.currency],
    ['Engineering & Fleet Units', hub.units],
    ['Emissions & Homologation Regulations', hub.regulations],
    ['Regional Machine & Truck Terminology', hub.terminology],
    ['Major Regional Trade Exhibitions', hub.events]
  ];
  contextGrid.innerHTML = items
    .map(([dt, dd]) => `<div class="region-context-card"><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`)
    .join('');
}

let allPublished = [];
let localArticles = [];
let internationalArticles = [];
let prioritizedHubs = [];
let currentPage = Math.max(1, Number(params.get('page')) || 1);
const PAGE_SIZE = 6;

function renderPriorityRegionBar() {
  const pillsEl = $('#region-pills');
  if (!pillsEl) return;
  const list = prioritizedHubs.length
    ? prioritizedHubs
    : Object.values(REGIONAL_HUBS);

  pillsEl.innerHTML = list.map((h, idx) => {
    const isActive = h.slug === activeSlug;
    const badgeCount = h.localArticleCount !== undefined ? ` (${h.localArticleCount})` : '';
    return `<a class="filter ${isActive ? 'active' : ''}" href="${regionUrl(h.slug)}" ${isActive ? 'aria-current="page"' : ''} title="Priority Rank #${idx + 1} · Local stories: ${h.localArticleCount || 0} · Active OEMs: ${h.manufacturerCount || 0}">
      ${esc(h.shortName || h.title)}${esc(badgeCount)}
    </a>`;
  }).join('');

  const currentMeta = list.find(x => x.slug === activeSlug);
  const statsEl = $('#region-stats');
  if (statsEl && currentMeta) {
    statsEl.innerHTML = `
      <div class="region-stat-box"><small>Local Reports</small><strong>${currentMeta.localArticleCount || 0}</strong></div>
      <div class="region-stat-box"><small>Global Cross-Market</small><strong>${currentMeta.internationalArticleCount || 0}</strong></div>
      <div class="region-stat-box"><small>Tracked OEMs</small><strong>${currentMeta.manufacturerCount || 0}</strong></div>
    `;
  }
}

function isLocalToHub(article, targetHub) {
  const cty = (article.country || '').toLowerCase();
  const reg = (article.region || '').toLowerCase();
  const hay = [article.title, article.summary, article.body, article.manufacturer, ...(article.tags || [])].join(' ').toLowerCase();

  if (targetHub.countries.some(c => c.toLowerCase() === cty)) return true;
  if (targetHub.regions.some(r => r.toLowerCase() === reg) && cty !== 'global') return true;
  if (targetHub.slug === 'india' && /india|excon|bull machines|tata|mahindra|cev/i.test(hay)) return true;
  if (targetHub.slug === 'europe' && /europe|bauma|iaa|stage v|volvo|liebherr|jcb/i.test(hay)) return true;
  if (targetHub.slug === 'north-america' && /north america|conexpo|united states|caterpillar|deere|case/i.test(hay)) return true;
  if (targetHub.slug === 'china' && /china|xcmg|sany/i.test(hay)) return true;
  if (targetHub.slug === 'japan-south-korea' && /japan|korea|komatsu|kubota|hyundai/i.test(hay)) return true;
  return false;
}

function populateDropdowns() {
  const pool = [...localArticles, ...internationalArticles];
  const categories = [...new Set(pool.map(a => a.category).filter(Boolean))].sort();
  const manufacturers = [...new Set(pool.map(a => a.manufacturer).filter(Boolean))].sort();
  const equipmentTypes = [...new Set(pool.map(a => a.equipmentType).filter(Boolean))].sort();

  const catEl = $('#filter-category');
  if (catEl) {
    catEl.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
  const mfgEl = $('#filter-manufacturer');
  if (mfgEl) {
    mfgEl.innerHTML = '<option value="">All Manufacturers / OEMs</option>' +
      manufacturers.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  }
  const eqEl = $('#filter-equipment');
  if (eqEl) {
    eqEl.innerHTML = '<option value="">All Equipment &amp; Vehicles</option>' +
      equipmentTypes.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  }
}

function applyFiltersToPool(pool) {
  const q = ($('#q')?.value || '').trim().toLowerCase();
  const selectedCat = $('#filter-category')?.value || '';
  const selectedMfg = $('#filter-manufacturer')?.value || '';
  const selectedEq = $('#filter-equipment')?.value || '';
  const sortOrder = $('#sort-date')?.value || 'newest';

  const filtered = pool.filter(a => {
    if (selectedCat && a.category !== selectedCat) return false;
    if (selectedMfg && (a.manufacturer || '').toLowerCase() !== selectedMfg.toLowerCase()) return false;
    if (selectedEq && (a.equipmentType || '').toLowerCase() !== selectedEq.toLowerCase()) return false;
    if (q) {
      const hay = [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortOrder === 'oldest') return new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0);
    if (sortOrder === 'updated') return new Date(b.updatedAt || b.publishedAt || 0) - new Date(a.updatedAt || a.publishedAt || 0);
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });

  return filtered;
}

function render(resetPage = false) {
  if (resetPage) currentPage = 1;

  const filteredLocal = applyFiltersToPool(localArticles);
  const filteredIntl = applyFiltersToPool(internationalArticles);

  const countEl = $('#local-count');
  if (countEl) {
    countEl.textContent = `${filteredLocal.length} LOCAL · ${filteredIntl.length} INTERNATIONAL`;
  }

  // Active filter summary
  const q = ($('#q')?.value || '').trim();
  const selectedCat = $('#filter-category')?.value || '';
  const selectedMfg = $('#filter-manufacturer')?.value || '';
  const selectedEq = $('#filter-equipment')?.value || '';
  const parts = [];
  if (selectedCat) parts.push(`Category: ${selectedCat}`);
  if (selectedMfg) parts.push(`OEM: ${selectedMfg}`);
  if (selectedEq) parts.push(`Type: ${selectedEq}`);
  if (q) parts.push(`Search: "${q}"`);

  const activeBar = $('#region-active-filters');
  const activeSummary = $('#region-filter-summary');
  if (activeBar && activeSummary) {
    if (parts.length) {
      activeSummary.textContent = `Filtering ${hub.shortName} & International coverage by ${parts.join(' · ')}`;
      activeBar.hidden = false;
    } else {
      activeBar.hidden = true;
    }
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pagedLocal = filteredLocal.slice(start, start + PAGE_SIZE);

  $('#local-grid').innerHTML = pagedLocal.map(a => renderArticleCard(a, { lazy: true })).join('');
  $('#local-empty').hidden = filteredLocal.length > 0;

  const pagEl = $('#local-pagination');
  const totalPages = Math.max(1, Math.ceil(filteredLocal.length / PAGE_SIZE));
  if (pagEl) {
    pagEl.innerHTML = renderPagination({
      totalItems: filteredLocal.length,
      pageSize: PAGE_SIZE,
      currentPage
    });
  }

  if (applyPaginationSeo) {
    applyPaginationSeo({
      currentPage,
      totalPages,
      baseUrl: canonicalHref,
      baseTitle: pageTitle
    });
  }

  // Render International stories alongside local news
  const intlGrid = $('#international-grid');
  const intlSec = $('#international-section');
  if (intlGrid && intlSec) {
    intlGrid.innerHTML = filteredIntl.slice(0, 6).map(a => renderArticleCard(a, { lazy: true })).join('');
    intlSec.hidden = filteredIntl.length === 0;
  }

  // Structured data
  const combinedForSchema = [...filteredLocal, ...filteredIntl].slice(0, 10);
  setJsonLd('region-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': pageTitle,
    'description': hub.description,
    'url': canonicalHref,
    'spatialCoverage': {
      '@type': 'Place',
      'name': hub.title
    },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': combinedForSchema.map((a, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'url': `${location.origin}${articleUrl(a.slug)}`,
        'name': a.title
      }))
    }
  });
}

$('#region-search')?.addEventListener('submit', e => {
  e.preventDefault();
  const qVal = ($('#q')?.value || '').trim();
  if (qVal && trackTelemetry) trackTelemetry({ type: 'search', query: qVal });
  render(true);
});
$('#q')?.addEventListener('input', () => render(true));
$('#filter-category')?.addEventListener('change', () => render(true));
$('#filter-manufacturer')?.addEventListener('change', () => render(true));
$('#filter-equipment')?.addEventListener('change', () => render(true));
$('#sort-date')?.addEventListener('change', () => render(true));

$('#reset-region-filters')?.addEventListener('click', () => {
  if ($('#q')) $('#q').value = '';
  if ($('#filter-category')) $('#filter-category').value = '';
  if ($('#filter-manufacturer')) $('#filter-manufacturer').value = '';
  if ($('#filter-equipment')) $('#filter-equipment').value = '';
  if ($('#sort-date')) $('#sort-date').value = 'newest';
  render(true);
});

$('#local-pagination')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;
  currentPage = Number(btn.dataset.page) || 1;
  render(false);
  $('#region-main')?.scrollIntoView({ behavior: 'smooth' });
});

// Record regional reader interest in analytics and load articles + priority hubs
fetch('/api/analytics/view', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'region', slug: activeSlug })
}).catch(() => {});

Promise.all([
  fetch('/api/articles').then(r => r.json()),
  fetch('/api/regions').then(r => r.json()).catch(() => ({ hubs: [] }))
]).then(([articlesData, regionsData]) => {
  allPublished = Array.isArray(articlesData) ? articlesData : [];
  prioritizedHubs = Array.isArray(regionsData.hubs) ? regionsData.hubs : [];

  localArticles = allPublished.filter(a => isLocalToHub(a, hub));
  const localIds = new Set(localArticles.map(x => x.id));
  internationalArticles = allPublished.filter(a => !localIds.has(a.id));

  renderPriorityRegionBar();
  populateDropdowns();
  render(false);
}).catch(() => {
  renderPriorityRegionBar();
  $('#local-empty').hidden = false;
});
