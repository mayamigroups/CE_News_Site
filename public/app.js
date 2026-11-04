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
let currentPage = 1;
const PAGE_SIZE = 6;

// Track stories shown across Featured and Desk blocks so each story is shown once across the desk blocks and not duplicated from Featured.
const shownStoryIds = new Set();

function renderSectionGrid(selector, matcherFn, limit = 3) {
  const el = $(selector);
  if (!el) return;
  const matched = allArticles.filter(a => matcherFn(a) && !shownStoryIds.has(a.id)).slice(0, limit);
  matched.forEach(a => shownStoryIds.add(a.id));
  const wrapper = el.closest('section') || el.parentElement;
  if (!matched.length) {
    if (wrapper) wrapper.hidden = true;
    el.innerHTML = '';
    return;
  }
  if (wrapper) wrapper.hidden = false;
  el.innerHTML = matched.map(a => renderArticleCard(a, { lazy: true })).join('');
}

function topStories() {
  const topEl = $('#top-stories');
  if (!topEl) return;
  const featured = allArticles.find(x => x.featured) || allArticles[0];
  const list = allArticles.filter(a => !featured || a.id !== featured.id).slice(0, 4);
  topEl.innerHTML = list.length
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
    const featSec = $('#featured-section');
    if (featSec) featSec.hidden = true;
    return null;
  }
  const featSec = $('#featured-section');
  if (featSec) featSec.hidden = false;
  const href = articleUrl(a.slug);
  const summaryText = a.summary || a.excerpt || '';
  $('#featured-story').innerHTML = `<a class="hero-image" href="${href}" aria-label="${escapeHtml(a.title)}">
      ${renderEditorialImage({
        url: a.image,
        alt: a.mediaRights?.altText || `${a.title} — ${a.manufacturer || (window.MWComponents?.SITE_NAME || 'Machine Report World')}`,
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
  return a;
}

function renderAllHomepageSections() {
  const emptyDbBanner = $('#global-empty-database');
  if (emptyDbBanner) {
    emptyDbBanner.hidden = allArticles.length > 0;
  }

  shownStoryIds.clear();

  // 1. Featured Story + Live Wire
  const feat = featuredStory();
  if (feat) shownStoryIds.add(feat.id);
  topStories();

  // 3. One block per main desk (only desks with at least 1 story, each story shown once across the page)
  const text = a => [a.title, a.summary, a.category, a.equipmentType, ...(a.tags || [])].join(' ');
  const desks = [
    ['#grid-bull-machines', a => a.category === 'Bull Machines' || /bull machines/i.test(a.manufacturer || '')],
    ['#grid-events', a => a.category === 'Events & Exhibitions' || /\bevents?\b|exhibition|excon|bauma|conexpo|\biaa\b|trade show/i.test(text(a))],
    ['#grid-reviews-guides', a => ['review', 'guide'].includes(a.articleType) || ['Buying Guides', 'Reviews & Comparisons'].includes(a.category)],
    ['#grid-technology', a => a.category === 'Technology' || /technology|telematics|electrification|automation|powertrain|emission/i.test(text(a))],
    ['#grid-business', a => ['Industry News', 'Market Updates', 'Projects'].includes(a.category) || /investment|export|market|business/i.test(text(a))],
    ['#grid-trucks', a => ['Commercial Vehicles', 'Heavy Trucks', 'Pickups', 'Vans', 'Buses', 'Electric Commercial Vehicles'].includes(a.category) || /commercial vehicle|truck|tipper|vocational|hauler|pickup/i.test(text(a))],
    ['#grid-tractors', a => ['Agricultural Machinery', 'Tractors'].includes(a.category) || /tractor|agri|implement/i.test(text(a))],
    ['#grid-construction', a => ['Construction Equipment', 'Backhoe Loaders', 'Excavators', 'Wheel Loaders', 'Bulldozers', 'Cranes', 'Graders', 'Telehandlers', 'Roadbuilding', 'Mining Equipment', 'Compact Equipment', 'Attachments'].includes(a.category) || /backhoe|excavat|loader|crane|bulldozer|earthmoving|construction/i.test(text(a))]
  ];
  desks.forEach(([selector, matcher]) => renderSectionGrid(selector, matcher, 3));
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
  const hasActiveFilter = Boolean(currentCategory || currentCountry || currentQuery || currentManufacturer);
  const feat = allArticles.find(x => x.featured) || allArticles[0];
  let rows = hasActiveFilter ? [...allArticles] : allArticles.filter(a => !feat || a.id !== feat.id);
  if (!rows.length && allArticles.length && !hasActiveFilter) {
    rows = [...allArticles];
  }

  if (currentCategory) {
    rows = rows.filter(a =>
      a.category === currentCategory ||
      (currentCategory === 'Bull Machines' && /bull machines/i.test(a.manufacturer || '')) ||
      (currentCategory === 'Construction Equipment' && /backhoe|excavat|loader|crane|bulldozer|earthmoving|construction/i.test([a.category, a.equipmentType, a.title].join(' '))) ||
      (currentCategory === 'Agricultural Machinery' && /tractor|agri/i.test([a.category, a.equipmentType, a.title].join(' '))) ||
      (currentCategory === 'Commercial Vehicles' && /commercial vehicle|truck|tipper|pickup|hauler/i.test([a.category, a.equipmentType, a.title, ...(a.tags || [])].join(' '))) ||
      (currentCategory === 'Reviews & Comparisons' && (['Reviews & Comparisons', 'Buying Guides'].includes(a.category) || ['review', 'guide'].includes(a.articleType)))
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

document.addEventListener('DOMContentLoaded', () => {
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) {
    currentQuery = urlQ.trim();
    if ($('#search-input')) $('#search-input').value = currentQuery;
  }

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
      linksBox.innerHTML = `<strong>Verification &amp; Compliance Links:</strong> <a href="${escapeHtml(data.verificationUrl)}" style="color:#F5A623;text-decoration:underline;">Verify Email Now ✓</a> &nbsp;·&nbsp; <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:#DCE2E8;text-decoration:underline;">One-Click Unsubscribe</a>`;
    }
    $('#newsletter-email').value = '';
  } catch (err) {
    $('#newsletter-message').textContent = err.message;
  }
});

const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
loadArticles();
