const fs = require('node:fs');
const path = require('node:path');
const appConfig = require('./config.js');
const models = require('./models.js');

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSsrArticleCard(a, lazy = true) {
  const href = `/news/${encodeURIComponent(a.slug)}`;
  const altText = a.mediaRights?.altText || `${a.title} — ${a.manufacturer || 'Machine Report World'}`;
  const credit = a.imageCredit || (a.image ? 'Editorial / OEM Handout' : '');
  const imgHtml = a.image
    ? `<img src="${escapeHtml(a.image)}" width="640" height="360" alt="${escapeHtml(altText)}" ${lazy ? 'loading="lazy" decoding="async"' : 'loading="eager" fetchpriority="high" decoding="async"'}>${credit ? `<span class="card-image-credit">${escapeHtml(credit)}</span>` : ''}`
    : `<div class="image-placeholder" role="img" aria-label="Machine Report World editorial placeholder"><span>MACHINE REPORT <span>WORLD</span></span><small>THE WORLD OF MACHINES. CONNECTED.</small></div>`;
  const locationMeta = a.country && a.country !== 'Global' ? ` · ${escapeHtml(a.country)}` : '';
  const pubDate = formatShortDate(a.publishedAt);

  return `<article class="article-card">
    <a class="card-image" href="${href}" aria-label="${escapeHtml(a.title)}">
      ${imgHtml}
      <span class="image-category">${escapeHtml(a.category || 'Industry News')}</span>
    </a>
    <div class="card-copy">
      <div class="card-meta">
        <span>${escapeHtml(a.manufacturer || 'Industry Desk')}${locationMeta}</span>
        ${pubDate ? `<time datetime="${escapeHtml(a.publishedAt)}">${escapeHtml(pubDate)}</time>` : ''}
      </div>
      <h3><a href="${href}">${escapeHtml(a.title)}</a></h3>
      <p>${escapeHtml(a.summary || a.excerpt || '')}</p>
      <div class="card-read">
        <span class="type-pill">${escapeHtml(a.articleType || 'news')}</span>
        <a href="${href}">Read report <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </article>`;
}

/**
 * Crawler- and no-JS-friendly article markup.
 */
function renderArticleFallbackMain(article, categorySlug) {
  const takeaways = Array.isArray(article.takeaways) ? article.takeaways : [];
  const takeawaysHtml = takeaways.length
    ? `<aside class="article-takeaways" aria-label="Key takeaways"><h2>Key takeaways</h2><ul>${takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></aside>`
    : '';
  const tocHtml = article.tocHtml || '';
  const audienceHtml = article.audience
    ? `<p class="article-audience"><strong>Who this matters to:</strong> ${escapeHtml(article.audience)}</p>`
    : '';
  const sources = [...new Set([article.sourceUrl, ...(article.sourceUrls || [])].filter(u => /^https?:\/\//i.test(u || '')))];
  const sourcesHtml = sources.length
    ? `<section class="article-sources-box"><h3>Sources &amp; Reference Material</h3><ul class="source-list">${sources.map(u => `<li><a class="source-external-link" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.replace(/^https?:\/\/(www\.)?/i, ''))}</a></li>`).join('')}</ul></section>`
    : '';

  const brands = Array.isArray(article.brandsMentioned) ? article.brandsMentioned : [];
  const brandsHtml = brands.length
    ? `<aside class="brands-mentioned-strip" aria-label="Brands mentioned"><h3>Brands mentioned</h3><div class="brands-mentioned-chips">${brands.map(b => `<a class="tag-chip" href="${escapeHtml(b.url)}">${escapeHtml(b.name)}</a>`).join('')}</div></aside>`
    : '';

  const authorProfile = article.authorProfile || {
    name: article.author || 'Editorial Desk',
    slug: models.makeSlug(article.author || 'Editorial Desk', 80) || 'editorial-desk',
    role: 'Editorial Desk',
    bio: ''
  };
  const authorUrl = `/authors/${encodeURIComponent(authorProfile.slug)}`;
  const authorCardHtml = `<section class="author-bio-card" aria-label="About the author">
    <div class="author-bio-header">
      <div>
        <strong class="author-bio-name"><a href="${authorUrl}">${escapeHtml(authorProfile.name)}</a></strong>
        <span class="author-bio-role">${escapeHtml(authorProfile.role || 'Editorial Desk')}</span>
      </div>
      <a class="button button-outline" href="${authorUrl}">View author archive →</a>
    </div>
    ${authorProfile.bio ? `<p class="author-bio-text">${escapeHtml(authorProfile.bio)}</p>` : ''}
  </section>`;

  const related = Array.isArray(article.relatedStories) ? article.relatedStories : [];
  const relatedHtml = related.length
    ? `<div class="article-related-container" id="article-related-wrap"><div class="wrap"><h2 class="article-related-heading">Related Industry Coverage</h2><div id="article-related-grid" class="article-grid">${related.map(r => renderSsrArticleCard(r, true)).join('')}</div></div></div>`
    : `<div class="article-related-container" id="article-related-wrap" hidden><div class="wrap"><h2 class="article-related-heading">Related Industry Coverage</h2><div id="article-related-grid" class="article-grid"></div></div></div>`;

  const published = article.publishedAt ? `<time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(new Date(article.publishedAt).toUTCString().slice(5, 16))}</time>` : '';
  const showUpdated = Boolean(article.hasRealUpdate && article.updatedAt);
  const updatedMarkup = showUpdated
    ? ` <span>•</span> <span class="byline-updated">Updated <time datetime="${escapeHtml(article.updatedAt)}">${escapeHtml(new Date(article.updatedAt).toUTCString().slice(5, 16))}</time></span>`
    : '';

  const heroAlt = article.mediaRights?.altText || `${article.title} — ${article.manufacturer || 'Machine Report World'}`;
  const heroFigure = article.image
    ? `<figure class="article-hero-figure"><img class="article-hero-img" src="${escapeHtml(article.image)}" width="1200" height="675" alt="${escapeHtml(heroAlt)}" loading="eager" fetchpriority="high">${article.imageCredit ? `<figcaption class="article-image-credit">Image credit: ${escapeHtml(article.imageCredit)}</figcaption>` : ''}</figure>`
    : '';

  return `<main class="wrap article-page" id="article-content"><article class="article-detail"><div class="article-reading-container">
<nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/category/${escapeHtml(categorySlug)}">${escapeHtml(article.category || 'News')}</a> <span>/</span> <span aria-current="page">${escapeHtml(article.title)}</span></nav>
<h1 class="article-headline">${escapeHtml(article.title)}</h1>
<p class="article-deck">${escapeHtml(article.summary || article.excerpt || '')}</p>
${audienceHtml}
<div class="article-byline"><span>By <a href="${authorUrl}"><strong>${escapeHtml(authorProfile.name)}</strong></a></span> ${published ? `<span>•</span> <span>Published ${published}</span>` : ''}${updatedMarkup}</div>
${heroFigure}
${takeawaysHtml}
${tocHtml}
<div class="article-body-content">${article.bodyHtml || ''}</div>
${brandsHtml}
${sourcesHtml}
${authorCardHtml}
</div>${relatedHtml}</article></main>`;
}

function renderArticleSsrHtml(templateHtml, article, siteUrl) {
  if (!article) return templateHtml;

  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();
  const canonicalUrl = article.seo?.canonicalUrl || `${cleanOrigin}/news/${encodeURIComponent(article.slug)}`;
  const baseTitle = String(article.seo?.metaTitle || article.title).replace(/\s*\|\s*(MACHINEWIRE|Machine Report World)\s*$/i, '');
  const seoTitle = `${baseTitle} | ${siteName}`;
  const seoDesc = article.seo?.metaDescription || article.summary || article.excerpt || `${siteName.toUpperCase()} — THE WORLD OF MACHINES. CONNECTED.`;
  const featuredImage = article.image || article.seo?.ogImage || '';

  const categorySlug = models.makeSlug(article.category || 'construction-equipment', 80) || 'construction-equipment';
  const authorSlug = article.authorProfile?.slug || models.makeSlug(article.author || 'Editorial Desk', 80) || 'editorial-desk';

  const newsArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': article.title,
    'description': seoDesc,
    'image': featuredImage ? [featuredImage] : [],
    'datePublished': article.publishedAt || article.createdAt,
    'dateModified': article.hasRealUpdate ? (article.updatedAt || article.publishedAt) : (article.publishedAt || article.createdAt),
    'author': [{
      '@type': 'Person',
      'name': article.author || 'Editorial Desk',
      'url': `${cleanOrigin}/authors/${authorSlug}`
    }],
    'publisher': {
      '@type': 'NewsMediaOrganization',
      'name': siteName,
      'slogan': 'THE WORLD OF MACHINES. CONNECTED.',
      'url': cleanOrigin,
      'publishingPrinciples': `${cleanOrigin}/editorial-policy.html`,
      'correctionsPolicy': `${cleanOrigin}/corrections.html`
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': `${cleanOrigin}/`
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': article.category || 'News',
        'item': `${cleanOrigin}/category/${categorySlug}`
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': article.title,
        'item': canonicalUrl
      }
    ]
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(newsArticleSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

  let output = templateHtml;

  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(seoTitle)}</title>`);
  output = output.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(seoDesc)}">`);
  output = output.replace(/<main class="wrap article-page" id="article-content">[\s\S]*?<\/main>/i, () => renderArticleFallbackMain(article, categorySlug));
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  output = output.replace(/<meta id="og-title" property="og:title" content="[^"]*">/i, `<meta id="og-title" property="og:title" content="${escapeHtml(seoTitle)}">`);
  output = output.replace(/<meta id="og-desc" property="og:description" content="[^"]*">/i, `<meta id="og-desc" property="og:description" content="${escapeHtml(seoDesc)}">`);

  const ogExtraTags = [
    `<meta id="og-image" property="og:image" content="${escapeHtml(featuredImage)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(seoTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(seoDesc)}">`,
    featuredImage ? `<meta name="twitter:image" content="${escapeHtml(featuredImage)}">` : '',
    schemaScripts
  ].filter(Boolean).join('\n');

  output = output.replace(/<meta id="og-image" property="og:image" content="[^"]*">/i, ogExtraTags);

  return output;
}

/**
 * Match articles belonging to a desk or sub-category slug.
 */
function matchArticlesForCategorySlug(slug, articles = [], categories = []) {
  const catObj = categories.find(c => c.slug === slug);
  const childCategories = categories.filter(c => c.parentSlug === slug);
  const validCategoryNames = new Set(
    [catObj?.name, ...childCategories.map(c => c.name)].filter(Boolean).map(n => n.toLowerCase())
  );

  return articles.filter(a => {
    const aCat = String(a.category || '').toLowerCase();
    const aCatSlug = models.makeSlug(a.category || '', 80);
    if (aCatSlug === slug || validCategoryNames.has(aCat)) return true;
    const all = [
      a.title, a.summary, a.excerpt, a.body, a.manufacturer,
      a.category, a.equipmentType, a.country, a.region, a.model,
      ...(a.tags || [])
    ].join(' ').toLowerCase();

    if (slug === 'construction-equipment' && /backhoe|excavat|loader|bulldozer|dozer|crane|grader|telehandler|compactor|paver|machinery|construction equipment/i.test(all)) return true;
    if (slug === 'backhoe-loaders' && /backhoe/i.test(all)) return true;
    if (slug === 'excavators' && /excavat/i.test(all)) return true;
    if (slug === 'wheel-loaders' && /wheel loader|loader/i.test(all)) return true;
    if (slug === 'bulldozers' && /bulldozer|dozer/i.test(all)) return true;
    if (slug === 'cranes' && /crane|lifting/i.test(all)) return true;
    if (slug === 'graders' && /grader/i.test(all)) return true;
    if (slug === 'telehandlers' && /telehandler|telescopic/i.test(all)) return true;
    if (slug === 'roadbuilding' && /roadbuilding|paver|compactor|roller|asphalt|highway/i.test(all)) return true;
    if (slug === 'mining-equipment' && /mining|quarry|haulroad|rigid dump/i.test(all)) return true;
    if (slug === 'compact-equipment' && /compact|skid-steer|mini excavat|ctl/i.test(all)) return true;
    if (slug === 'attachments' && /attachment|breaker|bucket|coupler|tiltrotator|auger/i.test(all)) return true;
    if (slug === 'new-launches' && /launch|unveil|new|debut/i.test(all)) return true;
    if (slug === 'agricultural-machinery' && /agricultural|agri|harvester|implement|tractor/i.test(all)) return true;
    if (slug === 'tractors' && /tractor/i.test(all)) return true;
    if (slug === 'commercial-vehicles' && /heavy truck|tipper|vocational|commercial vehicle|6x4|8x4|hauler|truck|pickup|\bvan\b|\bbus\b/i.test(all)) return true;
    if (slug === 'heavy-trucks' && /heavy truck|tipper|vocational|commercial vehicle|6x4|8x4|hauler|truck/i.test(all)) return true;
    if (slug === 'pickups' && /pickup/i.test(all)) return true;
    if (slug === 'vans' && /\bvan\b|\bvans\b/i.test(all)) return true;
    if (slug === 'buses' && /\bbus\b|\bbuses\b|coach/i.test(all)) return true;
    if (slug === 'electric-commercial-vehicles' && /electric|bev|zero-emission|hydrogen/i.test(all) && /truck|van|bus|commercial|vehicle|tipper|loader|excavat/i.test(all)) return true;
    if (slug === 'technology' && /technology|hydraulic|telematics|electr|automation|powertrain|ai/i.test(all)) return true;
    if (slug === 'industry-news' && /industry|market|business|investment|export|infrastructure|project/i.test(all)) return true;
    if (slug === 'market-updates' && /market|export|sales|quarterly|dealer|capacity/i.test(all)) return true;
    if (slug === 'projects' && /project|infrastructure|highway|corridor|contract|worksite/i.test(all)) return true;
    if (slug === 'reviews-comparisons' && (/comparison|review|specification|evaluat|guide/i.test(all) || ['review', 'guide'].includes(a.articleType))) return true;
    if (slug === 'buying-guides' && (/guide|maintenance|buyer|compare|checklist/i.test(all) || a.articleType === 'guide')) return true;
    if (slug === 'events-exhibitions' && /event|exhibition|excon|bauma|conexpo|iaa|show/i.test(all)) return true;
    if (slug === 'videos' && /video|walkaround|demonstration|footage/i.test(all)) return true;
    if (slug === 'bull-machines' && /bull machines/i.test(a.manufacturer || '')) return true;
    return false;
  });
}

/**
 * Server-side render `/category/<slug>` with:
 * - Breadcrumb: Home / Desk / Sub-category
 * - Short intro
 * - Sub-category chips
 * - Plain-link & GET form filters for `?brand=&country=&type=` generated from stories actually in that desk
 * - Active filters + Clear link
 * - Pagination (12 per page, rel=prev/rel=next, canonical to page 1)
 * - Calm empty state with links to other desks (no admin prompt)
 */
function renderCategorySsrHtml(templateHtml, { slug, searchParams, articles = [], categories = [], siteUrl }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();
  const catObj = categories.find(c => c.slug === slug) || {
    slug,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    parentSlug: models.CATEGORY_PARENT_MAP[slug] || null,
    description: 'Verified construction equipment, agricultural machinery, and commercial vehicle intelligence.'
  };
  const parentDesk = catObj.parentSlug
    ? (categories.find(c => c.slug === catObj.parentSlug) || { slug: catObj.parentSlug, name: catObj.parentSlug.replace(/-/g, ' ') })
    : catObj;
  const subCategories = categories.filter(c => c.parentSlug === parentDesk.slug);

  const deskPool = matchArticlesForCategorySlug(slug, articles, categories);

  // Extract filter values from stories actually in this desk
  const brands = [...new Set(deskPool.map(a => a.manufacturer).filter(m => m && !['Various', 'All Manufacturers'].includes(m)))].sort();
  const countries = [...new Set(deskPool.map(a => a.country).filter(Boolean))].sort();
  const types = [...new Set(deskPool.map(a => a.equipmentType).filter(Boolean))].sort();

  const brandFilter = String(searchParams?.get('brand') || searchParams?.get('manufacturer') || '').trim();
  const countryFilter = String(searchParams?.get('country') || '').trim();
  const typeFilter = String(searchParams?.get('type') || searchParams?.get('equipment') || '').trim();
  const qFilter = String(searchParams?.get('q') || '').trim();
  const pageNum = Math.max(1, Number(searchParams?.get('page')) || 1);
  const PAGE_SIZE = 12;

  const filtered = deskPool.filter(a => {
    if (brandFilter && (a.manufacturer || '').toLowerCase() !== brandFilter.toLowerCase()) return false;
    if (countryFilter && (a.country || '').toLowerCase() !== countryFilter.toLowerCase() && (a.region || '').toLowerCase() !== countryFilter.toLowerCase()) return false;
    if (typeFilter && (a.equipmentType || '').toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (qFilter) {
      const hay = [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model].join(' ').toLowerCase();
      if (!hay.includes(qFilter.toLowerCase())) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

  const basePath = `/category/${encodeURIComponent(slug)}`;
  const canonicalUrl = `${cleanOrigin}${basePath}`;
  const pageTitle = `${catObj.name} News & Specifications${pageNum > 1 ? ` — Page ${pageNum}` : ''} | ${siteName}`;
  const pageDesc = `${catObj.name} — ${catObj.description || 'Global machinery and vehicle coverage.'}`;

  // Build Breadcrumb: Home / Desk / Sub-category
  const breadcrumbHtml = catObj.parentSlug
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <a id="crumb-group" href="/category/${escapeHtml(parentDesk.slug)}">${escapeHtml(parentDesk.name)}</a> <span>/</span>
        <span id="crumb" aria-current="page">${escapeHtml(catObj.name)}</span>
      </nav>`
    : `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <span id="crumb-group">Desks</span> <span>/</span>
        <span id="crumb" aria-current="page">${escapeHtml(catObj.name)}</span>
      </nav>`;

  // Sub-category chips
  const chipsList = [
    { slug: parentDesk.slug, name: `All ${parentDesk.name}` },
    ...subCategories.map(sc => ({ slug: sc.slug, name: sc.name }))
  ];
  const subChipsHtml = chipsList.map(ch => {
    const isAct = ch.slug === slug;
    return `<a class="filter ${isAct ? 'active' : ''}" href="/category/${escapeHtml(ch.slug)}" ${isAct ? 'aria-current="page"' : ''}>${escapeHtml(ch.name)}</a>`;
  }).join('');

  // Plain-link filter chips (works 100% without JS)
  const buildFilterHref = (nextParams) => {
    const p = new URLSearchParams();
    const b = nextParams.brand !== undefined ? nextParams.brand : brandFilter;
    const c = nextParams.country !== undefined ? nextParams.country : countryFilter;
    const t = nextParams.type !== undefined ? nextParams.type : typeFilter;
    const q = nextParams.q !== undefined ? nextParams.q : qFilter;
    if (b) p.set('brand', b);
    if (c) p.set('country', c);
    if (t) p.set('type', t);
    if (q) p.set('q', q);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const brandLinksHtml = brands.length
    ? `<div class="desk-filter-group"><strong>Brand:</strong> <a class="tag-chip ${!brandFilter ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ brand: '' }))}">All</a> ${brands.map(b => `<a class="tag-chip ${brandFilter.toLowerCase() === b.toLowerCase() ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ brand: b }))}">${escapeHtml(b)}</a>`).join(' ')}</div>`
    : '';
  const countryLinksHtml = countries.length
    ? `<div class="desk-filter-group"><strong>Country:</strong> <a class="tag-chip ${!countryFilter ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ country: '' }))}">All</a> ${countries.map(c => `<a class="tag-chip ${countryFilter.toLowerCase() === c.toLowerCase() ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ country: c }))}">${escapeHtml(c)}</a>`).join(' ')}</div>`
    : '';
  const typeLinksHtml = types.length
    ? `<div class="desk-filter-group"><strong>Equipment type:</strong> <a class="tag-chip ${!typeFilter ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ type: '' }))}">All</a> ${types.map(t => `<a class="tag-chip ${typeFilter.toLowerCase() === t.toLowerCase() ? 'active' : ''}" href="${escapeHtml(buildFilterHref({ type: t }))}">${escapeHtml(t)}</a>`).join(' ')}</div>`
    : '';

  const activeParts = [];
  if (brandFilter) activeParts.push(`Brand: ${brandFilter}`);
  if (countryFilter) activeParts.push(`Country: ${countryFilter}`);
  if (typeFilter) activeParts.push(`Equipment type: ${typeFilter}`);
  if (qFilter) activeParts.push(`Search: "${qFilter}"`);

  const activeFilterBarHtml = `<div id="section-active-filters" class="active-filter-bar" ${activeParts.length ? '' : 'hidden'}>
    <span id="section-filter-summary">${activeParts.length ? `Active filters: ${escapeHtml(activeParts.join(' · '))} (${filtered.length} matching)` : ''}</span>
    <a id="reset-section-filters" class="clear-filter-btn" href="${escapeHtml(basePath)}">Clear</a>
  </div>`;

  // Pagination links (`rel=prev` / `rel=next`)
  const buildPageHref = (p) => {
    const baseWithFilters = buildFilterHref({});
    if (p <= 1) return baseWithFilters;
    const sep = baseWithFilters.includes('?') ? '&' : '?';
    return `${baseWithFilters}${sep}page=${p}`;
  };

  let paginationHtml = '';
  if (totalPages > 1) {
    const btns = [];
    if (pageNum > 1) {
      btns.push(`<a class="page-btn" rel="prev" href="${escapeHtml(buildPageHref(pageNum - 1))}" data-page="${pageNum - 1}">← Prev</a>`);
    } else {
      btns.push('<button type="button" class="page-btn" disabled>← Prev</button>');
    }
    for (let p = 1; p <= totalPages; p++) {
      btns.push(`<a class="page-btn ${p === pageNum ? 'active' : ''}" href="${escapeHtml(buildPageHref(p))}" data-page="${p}" ${p === pageNum ? 'aria-current="page"' : ''}>${p}</a>`);
    }
    if (pageNum < totalPages) {
      btns.push(`<a class="page-btn" rel="next" href="${escapeHtml(buildPageHref(pageNum + 1))}" data-page="${pageNum + 1}">Next →</a>`);
    } else {
      btns.push('<button type="button" class="page-btn" disabled>Next →</button>');
    }
    paginationHtml = `<nav class="pagination" aria-label="Category pagination">${btns.join('')}</nav>`;
  }

  // Calm empty state with links to other desks (never an admin prompt)
  const emptyHtml = `<div id="section-empty" class="empty-state" ${filtered.length > 0 ? 'hidden' : ''}>
    <strong id="empty-title">No stories match this selection right now.</strong>
    <p class="muted" style="margin: 8px auto 16px; max-width: 580px;">Browse our other active equipment and commercial vehicle desks below.</p>
    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
      <a class="button button-outline" href="/category/construction-equipment">Construction</a>
      <a class="button button-outline" href="/category/agricultural-machinery">Agriculture</a>
      <a class="button button-outline" href="/category/commercial-vehicles">Commercial Vehicles</a>
      <a class="button button-outline" href="/category/technology">Technology</a>
      <a class="button button-outline" href="/category/industry-news">Industry News</a>
      <a class="button button-outline" href="/category/reviews-comparisons">Reviews</a>
    </div>
  </div>`;

  const mainHtml = `<main class="wrap section-page" id="section-main">
  ${breadcrumbHtml}
  <section class="category-directory-bar" aria-label="Sub-categories in desk">
    <div class="directory-scroll" id="category-pills">${subChipsHtml}</div>
  </section>
  <section class="section" style="margin-top: var(--space-3);">
    <div class="section-head">
      <h1 id="section-title">${escapeHtml(catObj.name)}</h1>
      <span class="section-rule"></span>
      <span class="section-note" id="section-count">${filtered.length} ${filtered.length === 1 ? 'STORY' : 'STORIES'}</span>
    </div>
    <p class="section-intro" id="section-intro">${escapeHtml(catObj.description || '')}</p>
    <div id="desk-filter-links" class="desk-filter-links">
      ${brandLinksHtml}
      ${countryLinksHtml}
      ${typeLinksHtml}
    </div>
    <form id="section-filter-form" class="toolbar listing-toolbar" method="get" action="${escapeHtml(basePath)}">
      <div class="listing-filters-grid">
        <div>
          <label class="sr-only" for="filter-manufacturer">Brand filter</label>
          <select id="filter-manufacturer" name="brand" class="region-select" aria-label="Filter by brand">
            <option value="">All Brands</option>
            ${brands.map(b => `<option value="${escapeHtml(b)}" ${brandFilter.toLowerCase() === b.toLowerCase() ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="sr-only" for="filter-country">Country filter</label>
          <select id="filter-country" name="country" class="region-select" aria-label="Filter by country">
            <option value="">All Countries</option>
            ${countries.map(c => `<option value="${escapeHtml(c)}" ${countryFilter.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="sr-only" for="filter-type">Equipment type filter</label>
          <select id="filter-type" name="type" class="region-select" aria-label="Filter by equipment type">
            <option value="">All Equipment Types</option>
            ${types.map(t => `<option value="${escapeHtml(t)}" ${typeFilter.toLowerCase() === t.toLowerCase() ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="search-box">
        <input id="q" name="q" type="search" value="${escapeHtml(qFilter)}" placeholder="Search headline, model, spec…" aria-label="Search this category">
        <button type="submit" aria-label="Apply filters">Filter</button>
      </div>
    </form>
    ${activeFilterBarHtml}
    <div id="section-grid" class="article-grid">${paged.map((a, idx) => renderSsrArticleCard(a, idx > 0)).join('')}</div>
    <div id="section-pagination">${paginationHtml}</div>
    ${emptyHtml}
  </section>
</main>`;

  let output = templateHtml;
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(pageDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, () => {
    const links = [`<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`];
    if (pageNum > 1) {
      const prevHref = pageNum === 2 ? canonicalUrl : `${canonicalUrl}?page=${pageNum - 1}`;
      links.push(`<link id="pagination-prev-link" rel="prev" href="${escapeHtml(prevHref)}">`);
    }
    if (pageNum < totalPages) {
      links.push(`<link id="pagination-next-link" rel="next" href="${escapeHtml(`${canonicalUrl}?page=${pageNum + 1}`)}">`);
    }
    return links.join('\n');
  });
  output = output.replace(/<main class="wrap section-page" id="section-main">[\s\S]*?<\/main>/i, () => mainHtml);
  return output;
}

/**
 * Server-side render `/authors/<slug>`.
 * If author.bio is empty, show only name and role (never generate a bio).
 */
function renderAuthorSsrHtml(templateHtml, { author, siteUrl }) {
  if (!author) return templateHtml;
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();
  const canonicalUrl = `${cleanOrigin}/authors/${encodeURIComponent(author.slug)}`;
  const pageTitle = `${author.name} (${author.role || 'Editorial Desk'}) | ${siteName}`;
  const pageDesc = author.bio || `Articles and industry reports by ${author.name} on ${siteName}.`;
  const articles = Array.isArray(author.articles) ? author.articles : [];

  const mainHtml = `<main class="wrap section-page" id="author-main">
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> <span>/</span>
    <span>Authors</span> <span>/</span>
    <span aria-current="page">${escapeHtml(author.name)}</span>
  </nav>
  <section class="author-profile-header">
    <span class="eyebrow">${escapeHtml(author.role || 'Editorial Desk')}</span>
    <h1 id="author-name">${escapeHtml(author.name)}</h1>
    ${author.bio ? `<p class="author-bio-lead" id="author-bio">${escapeHtml(author.bio)}</p>` : ''}
    <p class="muted" id="author-count">${articles.length} published ${articles.length === 1 ? 'story' : 'stories'}</p>
  </section>
  <section class="section" aria-label="Stories by ${escapeHtml(author.name)}">
    <div id="author-articles-grid" class="article-grid">
      ${articles.length ? articles.map((a, idx) => renderSsrArticleCard(a, idx > 0)).join('') : '<div class="empty-state"><p>No published stories filed under this author yet.</p></div>'}
    </div>
  </section>
</main>`;

  let output = templateHtml;
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(pageDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  output = output.replace(/<main class="wrap section-page" id="author-main">[\s\S]*?<\/main>/i, () => mainHtml);
  return output;
}

module.exports = {
  renderArticleSsrHtml,
  renderCategorySsrHtml,
  renderAuthorSsrHtml,
  matchArticlesForCategorySlug,
  escapeHtml
};
