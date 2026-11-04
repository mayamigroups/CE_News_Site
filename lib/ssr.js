const fs = require('fs');
const path = require('path');
const appConfig = require('./config.js');

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Crawler- and no-JS-friendly article markup. The client script (article.js) replaces it with the
 * full interactive layout, so this only needs headline, body, takeaways and sources.
 */
function renderArticleFallbackMain(article, categorySlug) {
  const takeaways = Array.isArray(article.takeaways) ? article.takeaways : [];
  const takeawaysHtml = takeaways.length
    ? `<aside class="article-takeaways" aria-label="Key takeaways"><h2>Key takeaways</h2><ul>${takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></aside>`
    : '';
  const sources = [...new Set([article.sourceUrl, ...(article.sourceUrls || [])].filter(u => /^https?:\/\//i.test(u || '')))];
  const sourcesHtml = sources.length
    ? `<section class="article-sources-box"><h3>Sources &amp; Reference Material</h3><ul class="source-list">${sources.map(u => `<li><a class="source-external-link" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.replace(/^https?:\/\/(www\.)?/i, ''))}</a></li>`).join('')}</ul></section>`
    : '';
  const published = article.publishedAt ? `<time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(new Date(article.publishedAt).toUTCString().slice(5, 16))}</time>` : '';
  return `<main class="wrap article-page" id="article-content"><article class="article-detail"><div class="article-reading-container">
<nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/category/${escapeHtml(categorySlug)}">${escapeHtml(article.category || 'News')}</a> <span>/</span> <span aria-current="page">${escapeHtml(article.title)}</span></nav>
<h1 class="article-headline">${escapeHtml(article.title)}</h1>
<p class="article-deck">${escapeHtml(article.summary || article.excerpt || '')}</p>
<div class="article-byline"><span>By <strong>${escapeHtml(article.author || 'Editorial Desk')}</strong></span> ${published ? `<span>•</span> <span>Published ${published}</span>` : ''}</div>
${takeawaysHtml}
<div class="article-body-content">${article.bodyHtml || ''}</div>
${sourcesHtml}
</div></article></main>`;
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

  const categorySlug = (article.category || 'construction-equipment')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const newsArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': article.title,
    'description': seoDesc,
    'image': featuredImage ? [featuredImage] : [],
    'datePublished': article.publishedAt || article.createdAt,
    'dateModified': article.updatedAt || article.publishedAt || article.createdAt,
    'author': [{
      '@type': 'Person',
      'name': article.author || 'Editorial Desk'
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

module.exports = {
  renderArticleSsrHtml,
  escapeHtml
};
