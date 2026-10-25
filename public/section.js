const {
  esc,
  CATEGORY_DESKS,
  resolveDeskSlug,
  categoryUrl,
  articleUrl,
  renderArticleCard,
  renderPagination,
  setJsonLd,
  applyPaginationSeo,
  trackTelemetry
} = window.MWComponents;

const $ = (s, root = document) => root.querySelector(s);

// Extract slug from clean path `/category/:slug` or query param `?section=:slug`
const pathMatch = location.pathname.match(/^\/(?:category|section)\/([a-z0-9-_]+)\/?$/i);
const params = new URLSearchParams(location.search);
const rawSection = pathMatch ? pathMatch[1] : (params.get('section') || 'construction-equipment');
const activeSlug = resolveDeskSlug(rawSection);
const desk = CATEGORY_DESKS[activeSlug] || CATEGORY_DESKS['construction-equipment'];

const initialQuery = params.get('q') || '';
const initialMfg = params.get('manufacturer') || '';
const initialCountry = params.get('country') || '';
const initialCat = params.get('category') || '';

// Update SEO Metadata, Canonical & JSON-LD
const pageTitle = `${desk.title} News & Specifications | MACHINEWIRE`;
document.title = pageTitle;
const metaDesc = $('meta[name="description"]');
if (metaDesc) metaDesc.content = `${desk.title} — ${desk.description}`;
const ogTitle = $('#og-title');
if (ogTitle) ogTitle.content = pageTitle;
const ogDesc = $('#og-desc');
if (ogDesc) ogDesc.content = desk.description;
const canon = $('#canonical-link');
const canonicalHref = `${location.origin}${categoryUrl(desk.slug)}`;
if (canon) canon.href = canonicalHref;

$('#section-title').textContent = desk.title;
$('#crumb-group').textContent = desk.group || 'Desks';
$('#crumb').textContent = desk.title;
$('#desk-badge').textContent = (desk.group || 'CATEGORY DESK').toUpperCase();
$('#section-intro').textContent = desk.description;
$('#year').textContent = new Date().getFullYear();

if (initialQuery && $('#q')) $('#q').value = initialQuery;

// Render the 26-category pill bar
const ALL_26_SLUGS = [
  'construction-equipment', 'backhoe-loaders', 'excavators', 'wheel-loaders',
  'bulldozers', 'cranes', 'graders', 'telehandlers', 'roadbuilding',
  'mining-equipment', 'compact-equipment', 'attachments', 'tractors',
  'agricultural-machinery', 'heavy-trucks', 'pickups', 'vans', 'buses',
  'electric-commercial-vehicles', 'technology', 'business', 'reviews',
  'guides', 'projects', 'events', 'videos'
];

const pillsContainer = $('#category-pills');
if (pillsContainer) {
  pillsContainer.innerHTML = ALL_26_SLUGS.map(slug => {
    const cfg = CATEGORY_DESKS[slug];
    const isActive = slug === activeSlug;
    return `<a class="filter ${isActive ? 'active' : ''}" href="${categoryUrl(slug)}" ${isActive ? 'aria-current="page"' : ''}>${esc(cfg.title)}</a>`;
  }).join('');
}

document.querySelectorAll('#section-nav a[data-sec]').forEach(a => {
  a.classList.toggle('active', a.dataset.sec === activeSlug);
});

let allPublished = [];
let deskArticles = [];
let currentPage = Math.max(1, Number(params.get('page')) || 1);
const PAGE_SIZE = 6;

if (trackTelemetry) {
  trackTelemetry({ type: 'category', category: desk.slug });
}

function populateFilterDropdowns() {
  const catSelect = $('#filter-category');
  const mfgSelect = $('#filter-manufacturer');
  const ctySelect = $('#filter-country');

  const sourcePool = deskArticles.length ? deskArticles : allPublished;

  const categories = [...new Set(sourcePool.map(a => a.category).filter(Boolean))].sort();
  const manufacturers = [...new Set(sourcePool.map(a => a.manufacturer).filter(Boolean))].sort();
  const countries = [...new Set([
    ...sourcePool.map(a => a.country).filter(Boolean),
    ...sourcePool.map(a => a.region).filter(Boolean)
  ])].sort();

  if (catSelect) {
    catSelect.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (initialCat) catSelect.value = initialCat;
  }
  if (mfgSelect) {
    mfgSelect.innerHTML = '<option value="">All Manufacturers / OEMs</option>' +
      manufacturers.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    if (initialMfg) mfgSelect.value = initialMfg;
  }
  if (ctySelect) {
    ctySelect.innerHTML = '<option value="">All Countries &amp; Regions</option>' +
      countries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (initialCountry) ctySelect.value = initialCountry;
  }
}

function render(resetPage = false) {
  if (resetPage) currentPage = 1;
  const q = ($('#q')?.value || '').trim().toLowerCase();
  const selectedCat = $('#filter-category')?.value || '';
  const selectedMfg = $('#filter-manufacturer')?.value || '';
  const selectedCty = $('#filter-country')?.value || '';
  const sortOrder = $('#sort-date')?.value || 'newest';

  let filtered = deskArticles.filter(a => {
    if (selectedCat && a.category !== selectedCat) return false;
    if (selectedMfg && (a.manufacturer || '').toLowerCase() !== selectedMfg.toLowerCase()) return false;
    if (selectedCty && (a.country || '').toLowerCase() !== selectedCty.toLowerCase() && (a.region || '').toLowerCase() !== selectedCty.toLowerCase()) return false;
    if (q) {
      const hay = [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Sort by date
  filtered.sort((a, b) => {
    if (sortOrder === 'oldest') {
      return new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0);
    }
    if (sortOrder === 'updated') {
      return new Date(b.updatedAt || b.publishedAt || 0) - new Date(a.updatedAt || a.publishedAt || 0);
    }
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });

  const countEl = $('#section-count');
  if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'REPORT' : 'REPORTS'}`;

  // Active filter summary bar
  const activeParts = [];
  if (selectedCat) activeParts.push(`Category: ${selectedCat}`);
  if (selectedMfg) activeParts.push(`OEM: ${selectedMfg}`);
  if (selectedCty) activeParts.push(`Market: ${selectedCty}`);
  if (q) activeParts.push(`Search: "${q}"`);
  const activeBar = $('#section-active-filters');
  const activeSummary = $('#section-filter-summary');
  if (activeBar && activeSummary) {
    if (activeParts.length) {
      activeSummary.textContent = `Active filters: ${activeParts.join(' · ')} (${filtered.length} matching)`;
      activeBar.hidden = false;
    } else {
      activeBar.hidden = true;
    }
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  $('#section-grid').innerHTML = paged.map(a => renderArticleCard(a, { lazy: true })).join('');
  $('#section-empty').hidden = filtered.length > 0;

  const pagEl = $('#section-pagination');
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (pagEl) {
    pagEl.innerHTML = renderPagination({
      totalItems: filtered.length,
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

  // Render Relevant Related Stories from the rest of the verified database
  const shownIds = new Set(paged.map(x => x.id));
  const relatedPool = allPublished.filter(x => !shownIds.has(x.id)).slice(0, 3);
  const relSec = $('#related-desk-section');
  const relGrid = $('#related-desk-grid');
  if (relSec && relGrid) {
    if (relatedPool.length) {
      relGrid.innerHTML = relatedPool.map(a => renderArticleCard(a, { lazy: true })).join('');
      relSec.hidden = false;
    } else {
      relSec.hidden = true;
    }
  }

  // CollectionPage + BreadcrumbList JSON-LD structured data
  setJsonLd('collection-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': pageTitle,
    'description': desk.description,
    'url': canonicalHref,
    'breadcrumb': {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${location.origin}/` },
        { '@type': 'ListItem', 'position': 2, 'name': desk.title, 'item': canonicalHref }
      ]
    },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': filtered.slice(0, 10).map((a, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'url': `${location.origin}${articleUrl(a.slug)}`,
        'name': a.title
      }))
    }
  });
}

$('#section-search')?.addEventListener('submit', e => {
  e.preventDefault();
  const qVal = ($('#q')?.value || '').trim();
  if (qVal && trackTelemetry) trackTelemetry({ type: 'search', query: qVal });
  render(true);
});
$('#q')?.addEventListener('input', () => render(true));
$('#filter-category')?.addEventListener('change', () => render(true));
$('#filter-manufacturer')?.addEventListener('change', () => render(true));
$('#filter-country')?.addEventListener('change', () => render(true));
$('#sort-date')?.addEventListener('change', () => render(true));

$('#reset-section-filters')?.addEventListener('click', () => {
  if ($('#q')) $('#q').value = '';
  if ($('#filter-category')) $('#filter-category').value = '';
  if ($('#filter-manufacturer')) $('#filter-manufacturer').value = '';
  if ($('#filter-country')) $('#filter-country').value = '';
  if ($('#sort-date')) $('#sort-date').value = 'newest';
  render(true);
});

$('#section-pagination')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;
  currentPage = Number(btn.dataset.page) || 1;
  render(false);
  $('#section-main')?.scrollIntoView({ behavior: 'smooth' });
});

fetch('/api/articles')
  .then(r => r.json())
  .then(data => {
    allPublished = Array.isArray(data) ? data : [];
    deskArticles = allPublished.filter(a => {
      const all = [
        a.title, a.summary, a.excerpt, a.body, a.manufacturer,
        a.category, a.equipmentType, a.country, a.region, a.model,
        ...(a.tags || [])
      ].join(' ').toLowerCase();
      return desk.matcher(a, all);
    });
    populateFilterDropdowns();
    render(false);
  })
  .catch(() => {
    $('#section-empty').hidden = false;
  });
