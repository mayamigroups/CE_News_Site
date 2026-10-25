const $ = (s, root = document) => root.querySelector(s);
const {
  esc: escapeHtml,
  formatDate: dateFormat,
  articleUrl,
  categoryUrl,
  renderEditorialImage,
  renderArticleCard,
  renderPagination
} = window.MWComponents;

let allArticles = [];
let currentCategory = '';
let currentQuery = '';
let currentManufacturer = '';
let currentCountry = '';
let currentRegionTab = 'ALL';
let currentPage = 1;
const PAGE_SIZE = 6;

function sectionEmptyMarkup(sectionLabel, deskParam = 'construction-equipment') {
  return `<div class="empty-state" style="grid-column: 1 / -1;">
    <strong>No published reports in ${escapeHtml(sectionLabel)} yet.</strong>
    <p class="muted" style="margin:6px 0 12px;">MACHINEWIRE only displays verified published stories from the database and never fabricates placeholder articles.</p>
    <a class="button button-outline" href="/admin.html">Publish verified report in Admin →</a>
    <a class="button button-outline" href="${categoryUrl(deskParam)}" style="margin-left:8px;">Open Desk ↗</a>
  </div>`;
}

function renderSectionGrid(selector, matcherFn, sectionLabel, deskParam, limit = 3) {
  const el = $(selector);
  if (!el) return;
  const matched = allArticles.filter(matcherFn).slice(0, limit);
  el.innerHTML = matched.length
    ? matched.map(a => renderArticleCard(a, { lazy: true })).join('')
    : sectionEmptyMarkup(sectionLabel, deskParam);
}

function renderBreakingTicker() {
  const tickerEl = $('#ticker-text');
  if (!tickerEl) return;
  if (!allArticles.length) {
    tickerEl.textContent = 'No published stories currently in the database. Publish verified coverage via the Editorial Admin workspace.';
    return;
  }
  const latestItems = allArticles.slice(0, 4).map(a => `${a.category.toUpperCase()}: ${a.title} (${dateFormat(a.publishedAt)})`);
  tickerEl.innerHTML = latestItems
    .map((text, idx) => `<a href="${articleUrl(allArticles[idx].slug)}">${escapeHtml(text)}</a>`)
    .join(' &nbsp;•&nbsp; ');
}

function topStories() {
  const featured = allArticles.find(x => x.featured) || allArticles[0];
  const list = allArticles.filter(a => !featured || a.id !== featured.id).slice(0, 4);
  $('#top-stories').innerHTML = list.length
    ? list.map((a, i) => `<a class="top-story" href="${articleUrl(a.slug)}">
        <span class="top-story-num">0${i + 1}</span>
        <span>
          <small>${escapeHtml(a.category)} · ${dateFormat(a.publishedAt)}</small>
          <strong>${escapeHtml(a.title)}</strong>
          <em>${escapeHtml(a.manufacturer || 'Industry Desk')}${a.equipmentType ? ` · ${escapeHtml(a.equipmentType)}` : ''}</em>
        </span>
        <span class="top-story-arrow" aria-hidden="true">↗</span>
      </a>`).join('')
    : '<p class="muted">No additional published stories in the database yet.</p>';
}

function featuredStory() {
  const a = allArticles.find(x => x.featured) || allArticles[0];
  if (!a) {
    $('#featured-story').innerHTML = `<div class="hero-content">
      <div>
        <span class="eyebrow">AWAITING PUBLISHED COVERAGE</span>
        <h1>THE WORLD OF MACHINES. CONNECTED.</h1>
        <p>No published stories are currently in the content database. Sign in to the Editorial Admin panel to review and publish verified reports.</p>
      </div>
      <a class="hero-cta" href="/admin.html">Open Editorial Admin <span aria-hidden="true">↗</span></a>
    </div>`;
    return;
  }
  const href = articleUrl(a.slug);
  const summaryText = a.summary || a.excerpt || '';
  $('#featured-story').innerHTML = `<a class="hero-image" href="${href}" aria-label="${escapeHtml(a.title)}">
      ${renderEditorialImage({
        url: a.image,
        alt: `${a.title} — ${a.manufacturer || 'MACHINEWIRE'}`,
        credit: a.imageCredit || '',
        aspect: 'hero',
        lazy: false,
        showCreditBadge: true
      })}
    </a>
    <div class="hero-content">
      <div>
        <span class="eyebrow">${escapeHtml(a.category)} <span class="eyebrow-dot"></span> ${escapeHtml(a.manufacturer || 'GLOBAL DESK')} <span class="eyebrow-dot"></span> ${dateFormat(a.publishedAt)}</span>
        <h1><a href="${href}">${escapeHtml(a.title)}</a></h1>
        <p>${escapeHtml(summaryText)}</p>
      </div>
      <a class="hero-cta" href="${href}">Read full intelligence report <span aria-hidden="true">↗</span></a>
    </div>`;
}

function renderRegionalHighlights() {
  const grid = $('#grid-regions');
  if (!grid) return;
  let localRows = [...allArticles];
  let intlRows = [];
  if (currentRegionTab && currentRegionTab !== 'ALL') {
    const target = currentRegionTab.toLowerCase();
    localRows = allArticles.filter(a =>
      (a.region || '').toLowerCase().includes(target) ||
      (a.country || '').toLowerCase().includes(target) ||
      (target === 'india' && /india|asia-pacific|bull machines|excon/i.test(`${a.country} ${a.region} ${a.manufacturer}`)) ||
      (target === 'north america' && /united states|north america|conexpo/i.test(`${a.country} ${a.region} ${a.body}`)) ||
      (target === 'europe' && /europe|bauma|iaa|stage v/i.test(`${a.country} ${a.region} ${a.body}`))
    );
    const localIds = new Set(localRows.map(x => x.id));
    intlRows = allArticles.filter(a => !localIds.has(a.id) && (a.country === 'Global' || a.region === 'Global'));
  }
  const combined = [...localRows, ...intlRows].slice(0, 3);
  grid.innerHTML = combined.length
    ? combined.map(a => renderArticleCard(a, { lazy: true })).join('')
    : sectionEmptyMarkup(`Region: ${currentRegionTab}`, 'regions');
}

function renderAllHomepageSections() {
  const emptyDbBanner = $('#global-empty-database');
  if (emptyDbBanner) {
    emptyDbBanner.hidden = allArticles.length > 0;
  }

  // 1. Breaking News Ticker
  renderBreakingTicker();

  // 2. Featured Story + Top Stories
  featuredStory();
  topStories();

  // 3. Construction Equipment
  renderSectionGrid(
    '#grid-construction',
    a => /backhoe|excavat|loader|crane|bulldozer|earthmoving|construction/i.test([a.title, a.summary, a.category, a.equipmentType, ...(a.tags || [])].join(' ')),
    'Construction Equipment',
    'construction-equipment'
  );

  // 4. Tractors & Agricultural Machinery
  renderSectionGrid(
    '#grid-tractors',
    a => /tractor|agri|implement|backhoe|attachment|loader/i.test([a.title, a.summary, a.category, a.equipmentType, ...(a.tags || [])].join(' ')),
    'Tractors & Agricultural Machinery',
    'tractors'
  );

  // 5. Trucks & Commercial Vehicles
  renderSectionGrid(
    '#grid-trucks',
    a => /commercial vehicle|truck|tipper|vocational|hauler|pickup|fleet/i.test([a.title, a.summary, a.category, a.equipmentType, ...(a.tags || [])].join(' ')),
    'Trucks & Commercial Vehicles',
    'heavy-trucks'
  );

  // 7. Technology, AI, Electrification & Automation
  renderSectionGrid(
    '#grid-technology',
    a => a.category === 'Technology' || /technology|hydraulic|telematics|electr|automation|powertrain|ai/i.test([a.title, a.summary, a.body, ...(a.tags || [])].join(' ')),
    'Technology, AI & Electrification',
    'technology'
  );

  // 8. Industry Business, Investments, Exports & Market Developments
  renderSectionGrid(
    '#grid-business',
    a => a.category === 'Industry News' || a.category === 'Market Updates' || /industry|market|investment|export|infrastructure|business|fleet/i.test([a.title, a.summary, a.category, ...(a.tags || [])].join(' ')),
    'Industry Business & Market Developments',
    'business'
  );

  // 9. Reviews, Comparisons & Buying Guides
  renderSectionGrid(
    '#grid-reviews-guides',
    a => ['review', 'guide'].includes(a.articleType) || ['Buying Guides', 'Reviews & Comparisons'].includes(a.category) || /compare|guide|review|specification/i.test([a.title, a.summary, ...(a.tags || [])].join(' ')),
    'Reviews, Comparisons & Buying Guides',
    'reviews'
  );

  // 10. Regional News Highlights
  renderRegionalHighlights();

  // 11. Videos, Events & Exhibitions
  renderSectionGrid(
    '#grid-events',
    a => a.category === 'Events & Exhibitions' || /event|exhibition|excon|bauma|conexpo|iaa|show/i.test([a.title, a.summary, a.body, ...(a.tags || [])].join(' ')),
    'Videos, Events & Exhibitions',
    'events'
  );
}

function updateActiveFilterBar(count) {
  const parts = [];
  if (currentCategory) parts.push(`Category: ${currentCategory}`);
  if (currentManufacturer) parts.push(`OEM: ${currentManufacturer}`);
  if (currentCountry) parts.push(`Market: ${currentCountry}`);
  if (currentQuery) parts.push(`Search: "${currentQuery}"`);
  const bar = $('#active-filter-bar');
  const label = $('#active-filter-label');
  const countLabel = $('#results-count');
  if (countLabel) {
    countLabel.textContent = `${count} ${count === 1 ? 'REPORT' : 'REPORTS'} PUBLISHED`;
  }
  if (!bar || !label) return;
  if (parts.length) {
    label.textContent = `Filtering by ${parts.join(' · ')} (${count} ${count === 1 ? 'result' : 'results'})`;
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

function applyFilters(resetPage = true) {
  if (resetPage) currentPage = 1;
  let rows = [...allArticles];
  if (currentCategory) {
    rows = rows.filter(a =>
      a.category === currentCategory ||
      (currentCategory === 'Bull Machines' && /bull machines/i.test(a.manufacturer || '')) ||
      (currentCategory === 'Backhoe Loaders' && /backhoe/i.test([a.title, a.summary, a.excerpt, a.equipmentType, ...(a.tags || [])].join(' '))) ||
      (currentCategory === 'Commercial Vehicles' && /commercial vehicle|truck|tipper|pickup|hauler/i.test([a.category, a.equipmentType, a.title, ...(a.tags || [])].join(' '))) ||
      (currentCategory === 'Reviews & Comparisons' && (a.category === 'Reviews & Comparisons' || a.articleType === 'review')) ||
      (currentCategory === 'Buying Guides' && (a.category === 'Buying Guides' || a.articleType === 'guide'))
    );
  }
  if (currentCountry) {
    rows = rows.filter(a =>
      (a.country || '').toLowerCase() === currentCountry.toLowerCase() ||
      (a.region || '').toLowerCase().includes(currentCountry.toLowerCase())
    );
  }
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    rows = rows.filter(a =>
      [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  if (currentManufacturer) {
    rows = rows.filter(a => (a.manufacturer || '').toLowerCase().includes(currentManufacturer.toLowerCase()));
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  $('#article-grid').innerHTML = paged.length
    ? paged.map(a => renderArticleCard(a, { lazy: true })).join('')
    : '';
  $('#empty-state').hidden = rows.length > 0;

  const pagRoot = $('#pagination-root');
  if (pagRoot) {
    pagRoot.innerHTML = renderPagination({
      totalItems: rows.length,
      pageSize: PAGE_SIZE,
      currentPage
    });
  }

  updateActiveFilterBar(rows.length);
}

async function loadArticles() {
  try {
    const r = await fetch('/api/articles');
    if (!r.ok) throw new Error();
    allArticles = await r.json();
    renderAllHomepageSections();
    applyFilters(true);
  } catch {
    $('#article-grid').innerHTML = '<div class="error-note">Unable to load stories. Start the local server using <code>node server.js</code>.</div>';
  }
}

$('#filters')?.addEventListener('click', e => {
  const b = e.target.closest('[data-category]');
  if (!b) return;
  currentCategory = b.dataset.category;
  currentManufacturer = '';
  $('#filters').querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
  applyFilters(true);
});

$('#region-tabs')?.addEventListener('click', e => {
  const b = e.target.closest('[data-region-tab]');
  if (!b) return;
  currentRegionTab = b.dataset.regionTab;
  $('#region-tabs').querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
  renderRegionalHighlights();
});

$('#country-filter')?.addEventListener('change', e => {
  currentCountry = e.target.value;
  applyFilters(true);
});

function triggerSearchQuery(q) {
  currentQuery = String(q || '').trim();
  if ($('#search-input')) $('#search-input').value = currentQuery;
  if ($('#header-search-input')) $('#header-search-input').value = currentQuery;
  if ($('#mobile-search-input')) $('#mobile-search-input').value = currentQuery;
  applyFilters(true);
  $('#latest')?.scrollIntoView({ behavior: 'smooth' });
}

$('#search-form')?.addEventListener('submit', e => {
  e.preventDefault();
  triggerSearchQuery($('#search-input').value);
});

$('#header-search-form')?.addEventListener('submit', e => {
  e.preventDefault();
  triggerSearchQuery($('#header-search-input').value);
});

$('#mobile-search-form')?.addEventListener('submit', e => {
  e.preventDefault();
  $('#nav-inner')?.classList.remove('nav-open');
  $('#menu-toggle')?.setAttribute('aria-expanded', 'false');
  triggerSearchQuery($('#mobile-search-input').value);
});

$('#pagination-root')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (!btn || btn.disabled) return;
  currentPage = Number(btn.dataset.page) || 1;
  applyFilters(false);
  $('#latest').scrollIntoView({ behavior: 'smooth' });
});

$('#clear-filters')?.addEventListener('click', () => {
  currentCategory = '';
  currentManufacturer = '';
  currentQuery = '';
  currentCountry = '';
  if ($('#search-input')) $('#search-input').value = '';
  if ($('#header-search-input')) $('#header-search-input').value = '';
  if ($('#mobile-search-input')) $('#mobile-search-input').value = '';
  if ($('#country-filter')) $('#country-filter').value = '';
  $('#filters')?.querySelectorAll('.filter').forEach((x, idx) => x.classList.toggle('active', idx === 0));
  applyFilters(true);
});

document.querySelectorAll('[data-manufacturer]').forEach(b => b.addEventListener('click', () => {
  currentManufacturer = b.dataset.manufacturer;
  currentCategory = '';
  currentQuery = '';
  if ($('#search-input')) $('#search-input').value = '';
  $('#filters')?.querySelectorAll('.filter').forEach((x, idx) => x.classList.toggle('active', idx === 0));
  applyFilters(true);
  $('#latest').scrollIntoView({ behavior: 'smooth' });
}));

document.querySelectorAll('[data-search-brand]').forEach(b => b.addEventListener('click', () => {
  currentManufacturer = b.dataset.searchBrand;
  currentCategory = '';
  applyFilters(true);
}));

document.querySelectorAll('[data-search-query]').forEach(b => b.addEventListener('click', () => {
  triggerSearchQuery(b.dataset.searchQuery);
}));

$('#menu-toggle')?.addEventListener('click', () => {
  const nav = $('#nav-inner');
  const open = nav.classList.toggle('nav-open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
});

// Check newsletter provider status on load so visitors see whether an external email provider is connected
fetch('/api/newsletter')
  .then(r => (r.ok ? r.json() : null))
  .then(info => {
    const badgeEl = $('#newsletter-provider-badge');
    if (!badgeEl || !info || !info.emailService) return;
    badgeEl.textContent = info.emailService.statusBadge;
    if ($('#newsletter-message') && !info.providerConnected) {
      $('#newsletter-message').textContent = info.emailService.publicNotice;
    }
  })
  .catch(() => {});

$('#newsletter-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#newsletter-email').value;
  const frequency = $('#newsletter-frequency')?.value || 'weekly';
  const consent = $('#newsletter-consent') ? $('#newsletter-consent').checked : true;
  const interests = Array.from(document.querySelectorAll('input[name="nl-interest"]:checked')).map(el => el.value);
  try {
    const r = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, frequency, interests, consent })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not subscribe');
    $('#newsletter-message').textContent = data.providerConnected
      ? `Subscribed (${frequency}) — please check ${email} to complete email verification.`
      : `Saved to local subscriber queue (${frequency}, ${interests.length} topic(s)). ${data.providerNotice || ''}`;
    const linksBox = $('#newsletter-links-preview');
    if (linksBox && data.verificationUrl && data.unsubscribeUrl) {
      linksBox.hidden = false;
      linksBox.innerHTML = `<strong>Verification &amp; Compliance Links:</strong> <a href="${esc(data.verificationUrl)}" style="color:#F5A623;text-decoration:underline;">Verify Email Now ✓</a> &nbsp;·&nbsp; <a href="${esc(data.unsubscribeUrl)}" style="color:#DCE2E8;text-decoration:underline;">One-Click Unsubscribe</a>`;
    }
    $('#newsletter-email').value = '';
  } catch (err) {
    $('#newsletter-message').textContent = err.message;
  }
});

const todayEl = $('#today-label');
if (todayEl) {
  todayEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}
$('#year').textContent = new Date().getFullYear();
loadArticles();
