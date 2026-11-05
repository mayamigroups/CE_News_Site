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

function formatPageTitle(mainTitle) {
  const brand = 'MRW';
  const fullBrand = 'Machine Report World';
  const clean = String(mainTitle || '').trim().replace(/\s*\|\s*(MACHINEWIRE|Machine Report World|MRW)\s*$/i, '');
  const candidateFull = `${clean} | ${fullBrand}`;
  if (candidateFull.length <= 60) return candidateFull;
  const candidateShort = `${clean} | ${brand}`;
  if (candidateShort.length <= 60) return candidateShort;
  const maxChars = 60 - 3 - brand.length; // 54 chars
  const truncated = clean.slice(0, maxChars).trim().replace(/[,\-:;\s]+$/, '');
  return `${truncated}… | ${brand}`;
}

function renderArticleSsrHtml(templateHtml, article, siteUrl) {
  if (!article) return templateHtml;

  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();
  const canonicalUrl = article.seo?.canonicalUrl || `${cleanOrigin}/news/${encodeURIComponent(article.slug)}`;
  const baseTitle = String(article.seo?.metaTitle || article.title).replace(/\s*\|\s*(MACHINEWIRE|Machine Report World)\s*$/i, '');
  const seoTitle = formatPageTitle(baseTitle);
  const seoDesc = article.seo?.metaDescription || article.summary || article.excerpt || `${siteName.toUpperCase()} — THE WORLD OF MACHINES. CONNECTED.`;
  const featuredImage = article.image || article.seo?.ogImage || '';

  const categorySlug = models.makeSlug(article.category || 'construction-equipment', 80) || 'construction-equipment';
  const authorSlug = article.authorProfile?.slug || models.makeSlug(article.author || 'Editorial Desk', 80) || 'editorial-desk';

  const brands = Array.isArray(article.brandsMentioned) ? article.brandsMentioned : [];
  const newsArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': article.title,
    'description': seoDesc,
    'image': featuredImage ? [featuredImage] : [],
    'datePublished': article.publishedAt || article.createdAt,
    'dateModified': article.hasRealUpdate ? (article.updatedAt || article.publishedAt) : (article.publishedAt || article.createdAt),
    'isAccessibleForFree': true,
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

  if (brands.length > 0) {
    newsArticleSchema.about = brands.map(b => ({
      '@type': 'Organization',
      'name': b.name,
      'url': b.url ? (b.url.startsWith('http') ? b.url : `${cleanOrigin}${b.url}`) : undefined
    }));
  }

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

  const scripts = [
    `<script type="application/ld+json" id="article-jsonld">${JSON.stringify(newsArticleSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ];

  if (Array.isArray(article.faq) && article.faq.length >= 2) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': article.faq.map(f => ({
        '@type': 'Question',
        'name': f.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': f.answer
        }
      }))
    };
    scripts.push(`<script type="application/ld+json" id="faq-jsonld">${JSON.stringify(faqSchema, null, 2)}</script>`);
  }

  if ((article.articleType === 'event' || article.category === 'Events & Exhibitions') && article.eventStartDate && article.eventLocation) {
    const eventSchema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      'name': article.title,
      'startDate': article.eventStartDate,
      'endDate': article.eventEndDate || undefined,
      'location': {
        '@type': 'Place',
        'name': article.eventLocation,
        'address': article.eventLocation
      },
      'description': seoDesc,
      'url': canonicalUrl
    };
    scripts.push(`<script type="application/ld+json" id="event-jsonld">${JSON.stringify(eventSchema, null, 2)}</script>`);
  }

  const schemaScripts = scripts.join('\n');

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
  const articleRender = require('./article-render.js');

  // Extract filter values from stories actually in this desk
  const brands = [...new Set(deskPool.flatMap(a => articleRender.getArticleBrands(a)).filter(m => m && !['Various', 'All Manufacturers'].includes(m)))].sort();
  const countries = [...new Set(deskPool.map(a => a.country).filter(Boolean))].sort();
  const types = [...new Set(deskPool.map(a => a.equipmentType).filter(Boolean))].sort();

  const brandFilter = String(searchParams?.get('brand') || searchParams?.get('manufacturer') || '').trim();
  const countryFilter = String(searchParams?.get('country') || '').trim();
  const typeFilter = String(searchParams?.get('type') || searchParams?.get('equipment') || '').trim();
  const qFilter = String(searchParams?.get('q') || '').trim();
  const pageNum = Math.max(1, Number(searchParams?.get('page')) || 1);
  const PAGE_SIZE = 12;

  const filtered = deskPool.filter(a => {
    if (brandFilter && !articleRender.articleMatchesBrand(a, brandFilter)) return false;
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
  const pageTitle = formatPageTitle(`${catObj.name} News${pageNum > 1 ? ` — Page ${pageNum}` : ''}`);
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

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': `${catObj.name} News & Specifications`,
    'url': canonicalUrl,
    'description': pageDesc,
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': paged.map((a, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'url': `${cleanOrigin}/news/${encodeURIComponent(a.slug)}`,
        'name': a.title
      }))
    }
  };

  const categoryBreadcrumbs = [
    { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` }
  ];
  if (catObj.parentSlug) {
    categoryBreadcrumbs.push({
      '@type': 'ListItem',
      'position': 2,
      'name': parentDesk.name,
      'item': `${cleanOrigin}/category/${parentDesk.slug}`
    });
    categoryBreadcrumbs.push({
      '@type': 'ListItem',
      'position': 3,
      'name': catObj.name,
      'item': canonicalUrl
    });
  } else {
    categoryBreadcrumbs.push({
      '@type': 'ListItem',
      'position': 2,
      'name': catObj.name,
      'item': canonicalUrl
    });
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': categoryBreadcrumbs
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="category-jsonld">${JSON.stringify(collectionSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

  let robotsMeta = '';
  if (searchParams && searchParams.has('q') && searchParams.get('q').trim()) {
    robotsMeta = '<meta name="robots" content="noindex, follow">\n';
  }

  let output = templateHtml;
  // Remove any pre-existing static org-jsonld from index.html to prevent duplicate NewsMediaOrganization schemas
  output = output.replace(/<script type="application\/ld\+json" id="org-jsonld">[\s\S]*?<\/script>/i, '');
  output = output.replace(/__SITE_URL__/g, cleanOrigin);
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

  const ogTags = [
    robotsMeta,
    `<meta id="og-title" property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta id="og-desc" property="og:description" content="${escapeHtml(pageDesc)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(pageDesc)}">`,
    schemaScripts
  ].filter(Boolean).join('\n');

  output = output.replace('</head>', `${ogTags}\n</head>`);
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
  const pageTitle = formatPageTitle(`${author.name} Reports`);
  const pageDesc = author.bio || `Articles and industry reports by ${author.name} on ${siteName}.`;
  const safeDesc = pageDesc.slice(0, 155);
  const articles = Array.isArray(author.articles) ? author.articles : [];

  const authorSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': author.name,
    'jobTitle': author.role || 'Editorial Desk',
    'url': canonicalUrl
  };
  if (author.bio) authorSchema.description = author.bio;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Authors', 'item': `${cleanOrigin}/authors/editorial-desk` },
      { '@type': 'ListItem', 'position': 3, 'name': author.name, 'item': canonicalUrl }
    ]
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="author-jsonld">${JSON.stringify(authorSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

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
  // Remove any pre-existing static org-jsonld from index.html to prevent duplicate NewsMediaOrganization schemas
  output = output.replace(/<script type="application\/ld\+json" id="org-jsonld">[\s\S]*?<\/script>/i, '');
  output = output.replace(/__SITE_URL__/g, cleanOrigin);
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(safeDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

  const ogTags = [
    `<meta id="og-title" property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta id="og-desc" property="og:description" content="${escapeHtml(safeDesc)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(safeDesc)}">`,
    schemaScripts
  ].join('\n');

  output = output.replace('</head>', `${ogTags}\n</head>`);
  output = output.replace(/<main class="wrap section-page" id="author-main">[\s\S]*?<\/main>/i, () => mainHtml);
  return output;
}

/**
 * Server-side render Home (`/` or `index.html`) with:
 * - NewsMediaOrganization & WebSite with SearchAction & BreadcrumbList JSON-LD
 * - Canonical & OG/Twitter tags
 */
function renderHomeSsrHtml(templateHtml, { siteUrl, store, articles = [] }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();
  const canonicalUrl = `${cleanOrigin}/`;
  const pageTitle = 'Machine Report World | Equipment & Fleet Intelligence';
  const pageDesc = 'Verified global news, machine specifications, OEM profiles, and commercial vehicle intelligence across construction, mining, and agriculture.';

  const settings = (store && typeof store.getSettings === 'function') ? store.getSettings() : {};
  const sameAs = Array.isArray(settings.sameAs) ? settings.sameAs : [];

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    'name': siteName,
    'url': cleanOrigin,
    'logo': `${cleanOrigin}/assets/logo.png`,
    'sameAs': sameAs,
    'publishingPrinciples': `${cleanOrigin}/editorial-policy.html`,
    'correctionsPolicy': `${cleanOrigin}/corrections.html`
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': siteName,
    'url': cleanOrigin,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${cleanOrigin}/category/construction-equipment?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': canonicalUrl }
    ]
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="organization-jsonld">${JSON.stringify(orgSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="website-jsonld">${JSON.stringify(webSiteSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

  let output = templateHtml;
  // Remove any pre-existing static org-jsonld from index.html to prevent duplicate NewsMediaOrganization schemas
  output = output.replace(/<script type="application\/ld\+json" id="org-jsonld">[\s\S]*?<\/script>/i, '');
  output = output.replace(/__SITE_URL__/g, cleanOrigin);
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(pageDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  if (!output.includes('rel="canonical"')) {
    output = output.replace('</head>', `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">\n</head>`);
  }

  const ogTags = [
    `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(pageDesc)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta property="og:type" content="website">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(pageDesc)}">`,
    schemaScripts
  ].join('\n');

  output = output.replace('</head>', `${ogTags}\n</head>`);
  return output;
}

/**
 * Server-side render Brand (`/manufacturers` or `/manufacturers/:slug`)
 */
function renderBrandSsrHtml(templateHtml, { manufacturer, allManufacturers = [], siteUrl }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();

  let output = templateHtml;

  if (manufacturer) {
    // Single brand view
    const canonicalUrl = `${cleanOrigin}/manufacturers/${encodeURIComponent(manufacturer.slug)}`;
    const pageTitle = formatPageTitle(`${manufacturer.name} Profile`);
    const pageDesc = manufacturer.overview || `${manufacturer.name} company profile, equipment categories, manufacturing footprint, and verified specifications on ${siteName}.`;
    const safeDesc = pageDesc.slice(0, 155);

    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': manufacturer.name,
      'url': manufacturer.website || canonicalUrl,
      'description': safeDesc
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Manufacturers', 'item': `${cleanOrigin}/manufacturers` },
        { '@type': 'ListItem', 'position': 3, 'name': manufacturer.name, 'item': canonicalUrl }
      ]
    };

    const schemaScripts = [
      `<script type="application/ld+json" id="brand-jsonld">${JSON.stringify(orgSchema, null, 2)}</script>`,
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
    ].join('\n');

    const year = new Date().getFullYear();
    const citeText = `${manufacturer.name}: Profile, Equipment Categories & Intelligence. (${year}). Machine Report World. Retrieved from ${canonicalUrl}`;
    const badgeEmbed = `<a href="${canonicalUrl}" target="_blank" rel="noopener"><img src="${cleanOrigin}/badge/${manufacturer.slug}.svg" alt="Featured on Machine Report World" width="240" height="48"></a>`;

    const citeBoxHtml = `
    <div class="cite-page-box" role="region" aria-label="Cite this profile" style="margin: 24px 0; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
      <h3 style="font-size: 15px; margin-bottom: 8px;">Cite This OEM Profile</h3>
      <p id="cite-text" style="font-size: 13px; font-family: monospace; background: var(--bg-card); padding: 8px 12px; border-radius: 4px; word-break: break-all;">${escapeHtml(citeText)}</p>
      <div style="display: flex; gap: 8px; margin-top: 10px; align-items: center; flex-wrap: wrap;">
        <button type="button" class="button button-outline button-sm" onclick="navigator.clipboard.writeText(document.getElementById('cite-text').innerText); this.textContent='Copied!';">Copy APA Citation</button>
        <a class="button button-outline button-sm" href="${escapeHtml(canonicalUrl)}">Permalink</a>
      </div>
    </div>
    <div class="badge-box" role="region" aria-label="Embeddable OEM badge" style="margin: 24px 0; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
      <h3 style="font-size: 15px; margin-bottom: 8px;">Featured OEM Directory Badge</h3>
      <p class="muted" style="font-size: 13px; margin-bottom: 12px;">Display the official Machine Report World directory badge on your website:</p>
      <div style="margin-bottom: 12px;"><img src="/badge/${escapeHtml(manufacturer.slug)}.svg" alt="Featured on Machine Report World" width="240" height="48"></div>
      <label for="badge-code" class="sr-only">Embed HTML</label>
      <textarea id="badge-code" readonly rows="2" style="width: 100%; font-family: monospace; font-size: 12px; padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">${escapeHtml(badgeEmbed)}</textarea>
    </div>`;

    output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(safeDesc)}">`);
    output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(safeDesc)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
      `<meta name="twitter:description" content="${escapeHtml(safeDesc)}">`,
      schemaScripts
    ].join('\n');

    output = output.replace('</head>', `${ogTags}\n</head>`);
    output = output.replace('<!-- CITATION_BOX_PLACEHOLDER -->', citeBoxHtml);
    output = output.replace('<h1 id="profile-name">Manufacturer Name</h1>', `<h1 id="profile-name">${escapeHtml(manufacturer.name)}</h1>`);
    output = output.replace('<h1>Global Manufacturers &amp; Brands</h1>', '<h2 style="display:none;">Global Manufacturers &amp; Brands</h2>');
    output = output.replace('<div id="mfg-directory-view">', '<div id="mfg-directory-view" hidden>');
    output = output.replace('<div id="mfg-profile-view" hidden>', '<div id="mfg-profile-view">');
    return output;
  } else {
    // Directory view
    const canonicalUrl = `${cleanOrigin}/manufacturers`;
    const pageTitle = 'OEM Equipment Directory & Manufacturers | MRW';
    const pageDesc = 'Complete global directory of verified construction equipment, agricultural machinery, and commercial vehicle manufacturers.';

    const validMfgs = (allManufacturers || []).filter(m => !['all-manufacturers', 'various'].includes(m.slug));

    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': pageTitle,
      'url': canonicalUrl,
      'description': pageDesc,
      'mainEntity': {
        '@type': 'ItemList',
        'itemListElement': validMfgs.map((m, i) => ({
          '@type': 'ListItem',
          'position': i + 1,
          'url': `${cleanOrigin}/manufacturers/${encodeURIComponent(m.slug)}`,
          'name': m.name
        }))
      }
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Manufacturers', 'item': canonicalUrl }
      ]
    };

    const schemaScripts = [
      `<script type="application/ld+json" id="brands-jsonld">${JSON.stringify(collectionSchema, null, 2)}</script>`,
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
    ].join('\n');

    output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(pageDesc)}">`);
    output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(pageDesc)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
      `<meta name="twitter:description" content="${escapeHtml(pageDesc)}">`,
      schemaScripts
    ].join('\n');

    output = output.replace('</head>', `${ogTags}\n</head>`);
    output = output.replace('<h1 id="profile-name">Manufacturer Name</h1>', '<h2 id="profile-name" style="display:none;">Manufacturer Name</h2>');
    const mfgListHtml = validMfgs.map(m => `
      <div class="card mfg-card" style="padding:16px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:12px;">
        <h3 style="margin:0 0 6px;"><a href="/manufacturers/${encodeURIComponent(m.slug)}">${escapeHtml(m.name)}</a></h3>
        <p class="muted" style="margin:0;font-size:13px;">${escapeHtml(m.country || '')} &bull; ${escapeHtml(m.headquarters || '')}</p>
      </div>
    `).join('');
    output = output.replace(/<div id="mfg-directory-grid"[^>]*>[\s\S]*?<\/div>/i, `<div id="mfg-directory-grid" class="oem-directory-grid">${mfgListHtml}</div>`);
    return output;
  }
}

/**
 * Server-side render Model (`/models` or `/models/:slug`)
 */
function renderModelSsrHtml(templateHtml, { model, allModels = [], siteUrl }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();

  let output = templateHtml;

  if (model) {
    const canonicalUrl = `${cleanOrigin}/models/${encodeURIComponent(model.slug)}`;
    const pageTitle = formatPageTitle(`${model.name} Specs`);
    const pageDesc = model.summary || `Verified technical specifications, equipment class, and engineering details for ${model.name} by ${model.manufacturer}.`;
    const safeDesc = pageDesc.slice(0, 155);

    const hasSpecs = model.specs && typeof model.specs === 'object' && Object.keys(model.specs).length > 0;
    const scripts = [];

    if (hasSpecs) {
      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': model.name,
        'brand': {
          '@type': 'Brand',
          'name': model.manufacturer
        },
        'url': canonicalUrl,
        'description': safeDesc
      };
      scripts.push(`<script type="application/ld+json" id="product-jsonld">${JSON.stringify(productSchema, null, 2)}</script>`);
    }

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Equipment Models', 'item': `${cleanOrigin}/models` },
        { '@type': 'ListItem', 'position': 3, 'name': model.name, 'item': canonicalUrl }
      ]
    };
    scripts.push(`<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`);

    const schemaScripts = scripts.join('\n');
    const year = new Date().getFullYear();
    const citeText = `${model.name} (${model.manufacturer}): Verified Specifications & Technical Analysis. (${year}). Machine Report World. Retrieved from ${canonicalUrl}`;

    const citeBoxHtml = `
    <div class="cite-page-box" role="region" aria-label="Cite this model" style="margin: 24px 0; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
      <h3 style="font-size: 15px; margin-bottom: 8px;">Cite These Specifications</h3>
      <p id="cite-text" style="font-size: 13px; font-family: monospace; background: var(--bg-card); padding: 8px 12px; border-radius: 4px; word-break: break-all;">${escapeHtml(citeText)}</p>
      <div style="display: flex; gap: 8px; margin-top: 10px; align-items: center; flex-wrap: wrap;">
        <button type="button" class="button button-outline button-sm" onclick="navigator.clipboard.writeText(document.getElementById('cite-text').innerText); this.textContent='Copied!';">Copy APA Citation</button>
        <a class="button button-outline button-sm" href="${escapeHtml(canonicalUrl)}">Permalink</a>
      </div>
    </div>`;

    output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(safeDesc)}">`);
    output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(safeDesc)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
      `<meta name="twitter:description" content="${escapeHtml(safeDesc)}">`,
      schemaScripts
    ].join('\n');

    const qualifyingComparisons = (allModels || []).filter(other => {
      if (other.slug === model.slug) return false;
      const otherSpecs = other.specs || {};
      const thisSpecs = model.specs || {};
      const common = Object.keys(thisSpecs).filter(k => Object.prototype.hasOwnProperty.call(otherSpecs, k));
      return common.length >= 5;
    });

    let comparisonsHtml = '';
    if (qualifyingComparisons.length > 0) {
      comparisonsHtml = `
      <div class="comparisons-box" role="region" aria-label="Compare specifications" style="margin: 24px 0; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
        <h3 style="font-size: 15px; margin-bottom: 8px;">Side-by-Side Equipment Comparisons</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
          ${qualifyingComparisons.map(other => `
            <li><a href="/compare/${encodeURIComponent(model.slug)}-vs-${encodeURIComponent(other.slug)}">${escapeHtml(model.name)} vs ${escapeHtml(other.name)}</a></li>
          `).join('')}
        </ul>
      </div>`;
    }

    output = output.replace('</head>', `${ogTags}\n</head>`);
    output = output.replace('<!-- CITATION_BOX_PLACEHOLDER -->', `${citeBoxHtml}\n${comparisonsHtml}`);
    output = output.replace('<h1 id="detail-name">Model Name</h1>', `<h1 id="detail-name">${escapeHtml(model.name)}</h1>`);
    output = output.replace('<h1>Equipment &amp; Commercial Vehicle Models</h1>', '<h2 style="display:none;">Equipment &amp; Commercial Vehicle Models</h2>');
    output = output.replace('<div id="models-directory-view">', '<div id="models-directory-view" hidden>');
    output = output.replace('<div id="model-detail-view" hidden>', '<div id="model-detail-view">');
    return output;
  } else {
    // Directory view
    const canonicalUrl = `${cleanOrigin}/models`;
    const pageTitle = 'Equipment Models & Specifications Database | MRW';
    const pageDesc = 'Technical specifications and equipment model directory across excavators, loaders, tractors, and commercial trucks.';

    const validModels = (allModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      m.slug !== 'bull-machines-full-lineup'
    );

    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': pageTitle,
      'url': canonicalUrl,
      'description': pageDesc,
      'mainEntity': {
        '@type': 'ItemList',
        'itemListElement': validModels.map((m, i) => ({
          '@type': 'ListItem',
          'position': i + 1,
          'url': `${cleanOrigin}/models/${encodeURIComponent(m.slug)}`,
          'name': m.name
        }))
      }
    };

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Equipment Models', 'item': canonicalUrl }
      ]
    };

    const schemaScripts = [
      `<script type="application/ld+json" id="models-jsonld">${JSON.stringify(collectionSchema, null, 2)}</script>`,
      `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
    ].join('\n');

    output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
    output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(pageDesc)}">`);
    output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

    const ogTags = [
      `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
      `<meta property="og:description" content="${escapeHtml(pageDesc)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
      `<meta name="twitter:description" content="${escapeHtml(pageDesc)}">`,
      schemaScripts
    ].join('\n');

    output = output.replace('</head>', `${ogTags}\n</head>`);
    output = output.replace('<h1 id="detail-name">Model Name</h1>', '<h2 id="detail-name" style="display:none;">Model Name</h2>');
    const modelsListHtml = validModels.map(m => `
      <div class="card model-card" style="padding:16px;border:1px solid var(--border-color);border-radius:6px;margin-bottom:12px;">
        <h3 style="margin:0 0 6px;"><a href="/models/${encodeURIComponent(m.slug)}">${escapeHtml(m.name)}</a></h3>
        <p class="muted" style="margin:0;font-size:13px;">${escapeHtml(m.manufacturer || '')} &bull; ${escapeHtml(m.equipmentType || m.category || '')}</p>
      </div>
    `).join('');
    output = output.replace(/<div id="model-directory-grid"[^>]*>[\s\S]*?<\/div>/i, `<div id="model-directory-grid" class="card-grid">${modelsListHtml}</div>`);
    return output;
  }
}

/**
 * Server-side render Region (`/:region/` or `/region/:slug`)
 */
function renderRegionSsrHtml(templateHtml, { hub, articles = [], siteUrl }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();

  const canonicalUrl = `${cleanOrigin}/${hub.slug}/`;
  const pageTitle = formatPageTitle(`${hub.shortName} Equipment Hub`);
  const pageDesc = `Regional construction equipment, commercial vehicle and machinery intelligence for ${hub.title}.`;
  const safeDesc = pageDesc.slice(0, 155);

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': pageTitle,
    'url': canonicalUrl,
    'description': safeDesc,
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': articles.slice(0, 12).map((a, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'url': `${cleanOrigin}/news/${encodeURIComponent(a.slug)}`,
        'name': a.title
      }))
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Regional Hubs', 'item': `${cleanOrigin}/india/` },
      { '@type': 'ListItem', 'position': 3, 'name': hub.shortName, 'item': canonicalUrl }
    ]
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="region-jsonld">${JSON.stringify(collectionSchema, null, 2)}</script>`,
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

  let output = templateHtml;
  // Remove any pre-existing static org-jsonld from index.html to prevent duplicate NewsMediaOrganization schemas
  output = output.replace(/<script type="application\/ld\+json" id="org-jsonld">[\s\S]*?<\/script>/i, '');
  output = output.replace(/__SITE_URL__/g, cleanOrigin);
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(safeDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

  const ogTags = [
    `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(safeDesc)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(safeDesc)}">`,
    schemaScripts
  ].join('\n');

  output = output.replace('</head>', `${ogTags}\n</head>`);
  return output;
}

function getModelSpecMap(model) {
  const map = {};
  if (model.manufacturer) map['Manufacturer'] = model.manufacturer;
  if (model.equipmentType) map['Equipment Type'] = model.equipmentType;
  if (model.category) map['Category'] = model.category;
  if (model.country) map['Country of Origin'] = model.country;
  if (model.powerType) map['Powertrain / Fuel'] = model.powerType;
  if (model.specs && typeof model.specs === 'object') {
    for (const [k, v] of Object.entries(model.specs)) {
      map[k] = v;
    }
  }
  return map;
}

/**
 * Server-side render Model Comparison (`/compare/<model-a>-vs-<model-b>`)
 */
function renderCompareSsrHtml(templateHtml, { modelA, modelB, siteUrl }) {
  const rawOrigin = siteUrl || appConfig.getSiteUrl();
  const cleanOrigin = rawOrigin.replace(/\/$/, '');
  const siteName = appConfig.getSiteName();

  const canonicalUrl = `${cleanOrigin}/compare/${encodeURIComponent(modelA.slug)}-vs-${encodeURIComponent(modelB.slug)}`;
  const pageTitle = formatPageTitle(`${modelA.name} vs ${modelB.name}`);
  const pageDesc = `Side-by-side technical comparison of ${modelA.name} vs ${modelB.name}. Verified specifications, equipment class, and powertrain analysis.`;
  const safeDesc = pageDesc.slice(0, 155);

  const mapA = getModelSpecMap(modelA);
  const mapB = getModelSpecMap(modelB);

  const keysA = Object.keys(mapA);
  const keysB = Object.keys(mapB);

  const allLabels = [...new Set([...keysA, ...keysB])];
  const commonLabels = allLabels.filter(k => mapA[k] && mapB[k]);
  const qualifies = commonLabels.length >= 5;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${cleanOrigin}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Equipment Models', 'item': `${cleanOrigin}/models` },
      { '@type': 'ListItem', 'position': 3, 'name': `${modelA.name} vs ${modelB.name}`, 'item': canonicalUrl }
    ]
  };

  const schemaScripts = [
    `<script type="application/ld+json" id="breadcrumb-jsonld">${JSON.stringify(breadcrumbSchema, null, 2)}</script>`
  ].join('\n');

  let tableHtml = '';
  if (qualifies) {
    const rows = allLabels.map(key => {
      const valA = mapA[key] || 'Spec not disclosed by OEM';
      const valB = mapB[key] || 'Spec not disclosed by OEM';
      return `<tr>
        <th scope="row" style="text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border-color); font-weight: 600;">${escapeHtml(key)}</th>
        <td style="padding: 10px 14px; border-bottom: 1px solid var(--border-color);">${escapeHtml(valA)}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid var(--border-color);">${escapeHtml(valB)}</td>
      </tr>`;
    }).join('\n');

    tableHtml = `
    <div style="overflow-x: auto; margin-top: 24px;">
      <table style="width: 100%; border-collapse: collapse; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
        <thead>
          <tr style="background: var(--bg-card); border-bottom: 2px solid var(--border-color);">
            <th scope="col" style="text-align: left; padding: 12px 14px; width: 30%;">Specification</th>
            <th scope="col" style="text-align: left; padding: 12px 14px; width: 35%;"><a href="/models/${escapeHtml(modelA.slug)}">${escapeHtml(modelA.name)}</a></th>
            <th scope="col" style="text-align: left; padding: 12px 14px; width: 35%;"><a href="/models/${escapeHtml(modelB.slug)}">${escapeHtml(modelB.name)}</a></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  } else {
    tableHtml = `
    <div class="empty-state" style="margin-top: 24px; padding: 32px 20px; text-align: center; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
      <h2>Comparison Qualification Notice</h2>
      <p style="max-width: 600px; margin: 12px auto; color: var(--text-muted);">
        A side-by-side comparison requires at least 5 common verified manufacturer specifications. Currently, ${escapeHtml(modelA.name)} and ${escapeHtml(modelB.name)} share ${commonLabels.length} common verified spec field(s). To maintain editorial integrity, Machine Report World never invents unverified specifications.
      </p>
      <div style="margin-top: 18px;">
        <a class="button button-outline" href="/models/${escapeHtml(modelA.slug)}">View ${escapeHtml(modelA.name)} Specs</a>
        <a class="button button-outline" href="/models/${escapeHtml(modelB.slug)}" style="margin-left: 10px;">View ${escapeHtml(modelB.name)} Specs</a>
      </div>
    </div>`;
  }

  const mainHtml = `<main class="wrap section-page" id="compare-main">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span>/</span>
      <a href="/models">Equipment Models</a> <span>/</span>
      <span aria-current="page">${escapeHtml(modelA.name)} vs ${escapeHtml(modelB.name)}</span>
    </nav>
    <section class="section">
      <div class="section-head">
        <h1>${escapeHtml(modelA.name)} vs ${escapeHtml(modelB.name)}</h1>
        <span class="section-rule"></span>
        <span class="section-note">TECHNICAL SPECIFICATION COMPARISON</span>
      </div>
      <p class="section-intro">Direct engineering comparison between the ${escapeHtml(modelA.manufacturer)} ${escapeHtml(modelA.name)} and ${escapeHtml(modelB.manufacturer)} ${escapeHtml(modelB.name)}. Data is compiled strictly from verified manufacturer documentation.</p>
      ${tableHtml}
    </section>
  </main>`;

  let output = templateHtml;
  // Remove any pre-existing static org-jsonld from index.html to prevent duplicate NewsMediaOrganization schemas
  output = output.replace(/<script type="application\/ld\+json" id="org-jsonld">[\s\S]*?<\/script>/i, '');
  output = output.replace(/__SITE_URL__/g, cleanOrigin);
  output = output.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
  output = output.replace(/<meta (id="meta-description" )?name="description" content="[^"]*">/i, `<meta id="meta-description" name="description" content="${escapeHtml(safeDesc)}">`);
  output = output.replace(/<link id="canonical-link" rel="canonical" href="[^"]*">/i, `<link id="canonical-link" rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

  const ogTags = [
    `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(safeDesc)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(safeDesc)}">`,
    schemaScripts
  ].join('\n');

  output = output.replace('</head>', `${ogTags}\n</head>`);
  output = output.replace(/<main[\s\S]*?<\/main>/i, mainHtml);
  return output;
}

module.exports = {
  renderArticleSsrHtml,
  renderCategorySsrHtml,
  renderAuthorSsrHtml,
  renderHomeSsrHtml,
  renderBrandSsrHtml,
  renderModelSsrHtml,
  renderRegionSsrHtml,
  renderCompareSsrHtml,
  matchArticlesForCategorySlug,
  escapeHtml
};
