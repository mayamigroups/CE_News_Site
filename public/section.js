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

const pathMatch = location.pathname.match(/^\/(?:category|section)\/([a-z0-9-_]+)\/?$/i);
const params = new URLSearchParams(location.search);
const rawSection = pathMatch ? pathMatch[1] : (params.get('section') || 'construction-equipment');
const activeSlug = resolveDeskSlug(rawSection);
const desk = CATEGORY_DESKS[activeSlug] || CATEGORY_DESKS['construction-equipment'];
const parentSlug = desk.parentSlug || desk.slug;
const parentDesk = CATEGORY_DESKS[parentSlug] || desk;

const initialQuery = params.get('q') || '';
const initialBrand = params.get('brand') || params.get('manufacturer') || '';
const initialCountry = params.get('country') || '';
const initialType = params.get('type') || params.get('equipment') || '';

const siteName = window.MWComponents?.SITE_NAME || 'Machine Report World';
const pageTitle = `${desk.title} News & Specifications | ${siteName}`;
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

if ($('#section-title')) $('#section-title').textContent = desk.title;
if ($('#section-intro')) $('#section-intro').textContent = desk.description;
if ($('#section-filter-form')) $('#section-filter-form').action = categoryUrl(desk.slug);

// Breadcrumb: Home / Desk / Sub-category
const crumbNav = $('.breadcrumbs');
if (crumbNav) {
  if (desk.parentSlug) {
    crumbNav.innerHTML = `<a href="/">Home</a> <span>/</span> <a id="crumb-group" href="${categoryUrl(parentDesk.slug)}">${esc(parentDesk.title)}</a> <span>/</span> <span id="crumb" aria-current="page">${esc(desk.title)}</span>`;
  } else {
    crumbNav.innerHTML = `<a href="/">Home</a> <span>/</span> <span id="crumb-group">Desks</span> <span>/</span> <span id="crumb" aria-current="page">${esc(desk.title)}</span>`;
  }
}

if (initialQuery && $('#q')) $('#q').value = initialQuery;

// Render chips linking to sub-categories of this desk
const subDesks = Object.values(CATEGORY_DESKS).filter(c => c.parentSlug === parentSlug);
const chipsList = [
  { slug: parentDesk.slug, title: `All ${parentDesk.title}` },
  ...subDesks.map(s => ({ slug: s.slug, title: s.title }))
];
const pillsContainer = $('#category-pills');
if (pillsContainer) {
  pillsContainer.innerHTML = chipsList.map(ch => {
    const isAct = ch.slug === activeSlug;
    return `<a class="filter ${isAct ? 'active' : ''}" href="${categoryUrl(ch.slug)}" ${isAct ? 'aria-current="page"' : ''}>${esc(ch.title)}</a>`;
  }).join('');
}

let allPublished = [];
let deskArticles = [];
let currentPage = Math.max(1, Number(params.get('page')) || 1);
const PAGE_SIZE = 12;

if (trackTelemetry) {
  trackTelemetry({ type: 'category', category: desk.slug });
}

function buildFilterUrl(overrides = {}) {
  const nextParams = new URLSearchParams();
  const brand = overrides.brand !== undefined ? overrides.brand : ($('#filter-manufacturer')?.value || '');
  const country = overrides.country !== undefined ? overrides.country : ($('#filter-country')?.value || '');
  const type = overrides.type !== undefined ? overrides.type : ($('#filter-type')?.value || '');
  const q = overrides.q !== undefined ? overrides.q : ($('#q')?.value || '').trim();
  if (brand) nextParams.set('brand', brand);
  if (country) nextParams.set('country', country);
  if (type) nextParams.set('type', type);
  if (q) nextParams.set('q', q);
  const qs = nextParams.toString();
  return qs ? `${categoryUrl(desk.slug)}?${qs}` : categoryUrl(desk.slug);
}

function populateFiltersFromDeskStories() {
  const mfgSelect = $('#filter-manufacturer');
  const ctySelect = $('#filter-country');
  const typeSelect = $('#filter-type');
  const linksBox = $('#desk-filter-links');

  const brands = [...new Set(deskArticles.map(a => a.manufacturer).filter(m => m && !['Various', 'All Manufacturers'].includes(m)))].sort();
  const countries = [...new Set(deskArticles.map(a => a.country).filter(Boolean))].sort();
  const types = [...new Set(deskArticles.map(a => a.equipmentType).filter(Boolean))].sort();

  if (mfgSelect) {
    mfgSelect.innerHTML = '<option value="">All Brands</option>' +
      brands.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    if (initialBrand) mfgSelect.value = initialBrand;
  }
  if (ctySelect) {
    ctySelect.innerHTML = '<option value="">All Countries</option>' +
      countries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (initialCountry) ctySelect.value = initialCountry;
  }
  if (typeSelect) {
    typeSelect.innerHTML = '<option value="">All Equipment Types</option>' +
      types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    if (initialType) typeSelect.value = initialType;
  }

  if (linksBox) {
    const curBrand = mfgSelect?.value || initialBrand;
    const curCountry = ctySelect?.value || initialCountry;
    const curType = typeSelect?.value || initialType;
    const rows = [];
    if (brands.length) {
      rows.push(`<div class="desk-filter-group"><strong>Brand:</strong> <a class="tag-chip ${!curBrand ? 'active' : ''}" href="${esc(buildFilterUrl({ brand: '' }))}">All</a> ${brands.map(b => `<a class="tag-chip ${curBrand.toLowerCase() === b.toLowerCase() ? 'active' : ''}" href="${esc(buildFilterUrl({ brand: b }))}">${esc(b)}</a>`).join(' ')}</div>`);
    }
    if (countries.length) {
      rows.push(`<div class="desk-filter-group"><strong>Country:</strong> <a class="tag-chip ${!curCountry ? 'active' : ''}" href="${esc(buildFilterUrl({ country: '' }))}">All</a> ${countries.map(c => `<a class="tag-chip ${curCountry.toLowerCase() === c.toLowerCase() ? 'active' : ''}" href="${esc(buildFilterUrl({ country: c }))}">${esc(c)}</a>`).join(' ')}</div>`);
    }
    if (types.length) {
      rows.push(`<div class="desk-filter-group"><strong>Equipment type:</strong> <a class="tag-chip ${!curType ? 'active' : ''}" href="${esc(buildFilterUrl({ type: '' }))}">All</a> ${types.map(t => `<a class="tag-chip ${curType.toLowerCase() === t.toLowerCase() ? 'active' : ''}" href="${esc(buildFilterUrl({ type: t }))}">${esc(t)}</a>`).join(' ')}</div>`);
    }
    linksBox.innerHTML = rows.join('');
  }
}

function render(resetPage = false) {
  if (resetPage) currentPage = 1;
  const q = ($('#q')?.value || '').trim().toLowerCase();
  const selectedBrand = $('#filter-manufacturer')?.value || '';
  const selectedCty = $('#filter-country')?.value || '';
  const selectedType = $('#filter-type')?.value || '';

  const filtered = deskArticles.filter(a => {
    if (selectedBrand && (a.manufacturer || '').toLowerCase() !== selectedBrand.toLowerCase()) return false;
    if (selectedCty && (a.country || '').toLowerCase() !== selectedCty.toLowerCase() && (a.region || '').toLowerCase() !== selectedCty.toLowerCase()) return false;
    if (selectedType && (a.equipmentType || '').toLowerCase() !== selectedType.toLowerCase()) return false;
    if (q) {
      const hay = [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const countEl = $('#section-count');
  if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'STORY' : 'STORIES'}`;

  const activeParts = [];
  if (selectedBrand) activeParts.push(`Brand: ${selectedBrand}`);
  if (selectedCty) activeParts.push(`Country: ${selectedCty}`);
  if (selectedType) activeParts.push(`Equipment type: ${selectedType}`);
  if (q) activeParts.push(`Search: "${q}"`);

  const activeBar = $('#section-active-filters');
  const activeSummary = $('#section-filter-summary');
  const clearBtn = $('#reset-section-filters');
  if (clearBtn) clearBtn.href = categoryUrl(desk.slug);
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

  $('#section-grid').innerHTML = paged.map((a, idx) => renderArticleCard(a, { lazy: idx > 0 })).join('');
  $('#section-empty').hidden = filtered.length > 0;

  const pagEl = $('#section-pagination');
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (pagEl) {
    pagEl.innerHTML = renderPagination({
      totalItems: filtered.length,
      pageSize: PAGE_SIZE,
      currentPage,
      baseUrl: buildFilterUrl()
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

  populateFiltersFromDeskStories();

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
        ...(desk.parentSlug ? [{ '@type': 'ListItem', 'position': 2, 'name': parentDesk.title, 'item': `${location.origin}${categoryUrl(parentDesk.slug)}` }] : []),
        { '@type': 'ListItem', 'position': desk.parentSlug ? 3 : 2, 'name': desk.title, 'item': canonicalHref }
      ]
    },
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': filtered.slice(0, 12).map((a, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'url': `${location.origin}${articleUrl(a.slug)}`,
        'name': a.title
      }))
    }
  });
}

$('#section-filter-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const qVal = ($('#q')?.value || '').trim();
  if (qVal && trackTelemetry) trackTelemetry({ type: 'search', query: qVal });
  render(true);
});
$('#q')?.addEventListener('input', () => render(true));
$('#filter-manufacturer')?.addEventListener('change', () => render(true));
$('#filter-country')?.addEventListener('change', () => render(true));
$('#filter-type')?.addEventListener('change', () => render(true));

$('#reset-section-filters')?.addEventListener('click', e => {
  e.preventDefault();
  if ($('#q')) $('#q').value = '';
  if ($('#filter-manufacturer')) $('#filter-manufacturer').value = '';
  if ($('#filter-country')) $('#filter-country').value = '';
  if ($('#filter-type')) $('#filter-type').value = '';
  history.replaceState(null, '', categoryUrl(desk.slug));
  render(true);
});

$('#section-pagination')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;
  e.preventDefault();
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
    populateFiltersFromDeskStories();
    render(false);
  })
  .catch(() => {
    $('#section-empty').hidden = false;
  });
