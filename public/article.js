/**
 * Machine Report World — Public Article Reading Experience
 * Clean, professional B2B editorial template prioritizing readability,
 * brand discovery, and verified industry intelligence.
 */

(() => {
  const {
    esc,
    safeHttpUrl,
    formatDate,
    articleUrl,
    categoryUrl,
    regionUrl,
    manufacturerUrl,
    modelUrl,
    resolveDeskSlug,
    resolveRegionSlug,
    renderArticleCard,
    setJsonLd,
    renderFormattedBody,
    trackTelemetry
  } = window.MWComponents || {};

  const TYPE_LABELS = {
    'news': 'News Report',
    'company-announcement': 'Company Announcement',
    'analysis': 'Technical Analysis',
    'opinion': 'Editorial Opinion',
    'guide': 'Buyer & Maintenance Guide',
    'review': 'Specification Review'
  };

  function calculateReadingTime(text = '') {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  }

  function hasMeaningfulUpdate(publishedAt, updatedAt) {
    if (!publishedAt || !updatedAt) return false;
    const pub = new Date(publishedAt).getTime();
    const upd = new Date(updatedAt).getTime();
    if (isNaN(pub) || isNaN(upd)) return false;
    return (upd - pub) > (60 * 60 * 1000); // More than 1 hour difference
  }

  function formatSourceDomain(url = '') {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname.length > 1 ? parsed.pathname.slice(0, 30) : '';
      return `${host}${path ? path + (parsed.pathname.length > 30 ? '…' : '') : ''}`;
    } catch {
      return url;
    }
  }

  function filterMeaningfulSpecs(specs = {}) {
    if (!specs || typeof specs !== 'object') return [];
    const genericPlaceholders = new Set([
      'primary focus',
      'headquarters',
      'coverage scope',
      'comparison scope',
      'reference models',
      'key decision factors',
      'status',
      'overview'
    ]);

    return Object.entries(specs).filter(([k, v]) => {
      const keyNorm = String(k || '').trim().toLowerCase();
      const valNorm = String(v ?? '').trim().toLowerCase();
      if (!keyNorm || !valNorm) return false;
      if (['not disclosed', 'tbd', 'n/a', 'unknown', 'none', '-'].includes(valNorm)) return false;
      // Filter out generic meta keys if they are not engineering specifications
      if (genericPlaceholders.has(keyNorm) && valNorm.length < 5) return false;
      return true;
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const yearEl = document.querySelector('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const pathMatch = location.pathname.match(/^\/(?:news|articles)\/([a-z0-9-_]+)\/?$/i);
    const slug = pathMatch ? decodeURIComponent(pathMatch[1]) : new URLSearchParams(location.search).get('slug');
    const root = document.querySelector('#article-content');
    if (!root) return;

    if (!slug) {
      root.innerHTML = `
        <div class="article-reading-container" style="padding: 48px 0; text-align: center;">
          <h1 style="font-size: 28px; margin-bottom: 16px;">Choose an article</h1>
          <p style="color: #64748b; margin-bottom: 24px;">Please select an article from the news desk to continue reading.</p>
          <a class="button button-dark" href="/">Return to News Desk</a>
        </div>
      `;
      return;
    }

    try {
      const response = await fetch('/api/articles/' + encodeURIComponent(slug));
      if (!response.ok) throw new Error('Article not found');
      const article = await response.json();

      // Record telemetry view event
      fetch('/api/analytics/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'article', slug: article.slug })
      }).catch(() => {});

      const seoTitle = article.seo?.metaTitle || article.title;
      const seoDesc = article.seo?.metaDescription || article.summary || article.excerpt;
      const canonicalHref = article.seo?.canonicalUrl || `${location.origin}${articleUrl ? articleUrl(article.slug) : `/news/${article.slug}`}`;

      // Update meta & open graph tags
      document.title = `${seoTitle} | Machine Report World`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.content = seoDesc;
      const ogTitle = document.querySelector('#og-title');
      if (ogTitle) ogTitle.content = `${seoTitle} | Machine Report World`;
      const ogDesc = document.querySelector('#og-desc');
      if (ogDesc) ogDesc.content = seoDesc;
      const ogImg = document.querySelector('#og-image');
      if (ogImg && article.image) ogImg.content = article.image;
      const canon = document.querySelector('#canonical-link');
      if (canon) canon.href = canonicalHref;

      const categorySlug = resolveDeskSlug
        ? resolveDeskSlug((article.category || 'construction-equipment').toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        : 'construction-equipment';

      const regionSlug = resolveRegionSlug
        ? resolveRegionSlug(article.country || article.region || 'india')
        : 'india';

      // 1. Meta Badges Bar
      const isSponsored = Boolean(article.isSponsored || article.sponsored);
      const isRealMfg = article.manufacturer && !['Various', 'All Manufacturers', 'Editorial Desk'].includes(article.manufacturer);
      const isRealRegion = article.country && article.country.toLowerCase() !== 'global';
      const isNonStandardType = article.articleType && article.articleType !== 'news';

      const badgesHtml = `
        <div class="article-meta-bar" aria-label="Article categories and tags">
          <a class="article-badge badge-category" href="${categoryUrl ? categoryUrl(categorySlug) : `/category/${categorySlug}`}">${esc(article.category || 'Industry News')}</a>
          ${isRealMfg ? `<a class="article-badge badge-manufacturer" href="${manufacturerUrl ? manufacturerUrl(article.manufacturer) : `/manufacturers/${encodeURIComponent(article.manufacturer)}`}">${esc(article.manufacturer)}</a>` : ''}
          ${isRealRegion ? `<a class="article-badge badge-region" href="${regionUrl ? regionUrl(regionSlug) : `/${regionSlug}/`}">${esc(article.country)}${article.region && article.region !== article.country ? ` · ${esc(article.region)}` : ''}</a>` : ''}
          ${isNonStandardType ? `<span class="article-badge badge-type">${esc(TYPE_LABELS[article.articleType] || article.articleType)}</span>` : ''}
          ${isSponsored ? `<span class="article-badge badge-sponsored">Sponsored</span>` : ''}
        </div>
      `;

      // 2. Byline Details
      const showUpdated = hasMeaningfulUpdate(article.publishedAt, article.updatedAt);
      const readingMinutes = calculateReadingTime(article.body);
      const bylineHtml = `
        <div class="article-byline">
          <span>By <strong>${esc(article.author || 'Editorial Desk')}</strong></span>
          ${article.publishedAt ? `<span>•</span> <span>Published <time datetime="${esc(article.publishedAt)}">${formatDate ? formatDate(article.publishedAt, true) : new Date(article.publishedAt).toLocaleDateString()}</time></span>` : ''}
          ${showUpdated ? `<span>•</span> <span class="byline-updated">Updated <time datetime="${esc(article.updatedAt)}">${formatDate ? formatDate(article.updatedAt, true) : new Date(article.updatedAt).toLocaleDateString()}</time></span>` : ''}
          <span>•</span> <span>${readingMinutes} min read</span>
        </div>
      `;

      // 3. Compact Share Controls
      const shareUrl = encodeURIComponent(canonicalHref);
      const shareTitle = encodeURIComponent(`${article.title} | Machine Report World`);
      const sl = article.shareLinks?.intentUrls || {};
      const directShareLink = article.shareLinks?.utmLinks?.direct || canonicalHref;

      const shareControlsHtml = `
        <div class="article-share-bar" aria-label="Share this report">
          <span class="article-share-label">Share:</span>
          <a class="share-btn-compact" href="${esc(sl.linkedin || `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" title="Share on LinkedIn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.81a1.63 1.63 0 0 0-1.63 1.63c0 .9.73 1.63 1.63 1.63.9 0 1.63-.73 1.63-1.63 0-.9-.73-1.63-1.63-1.63Z"/></svg>
            <span>LinkedIn</span>
          </a>
          <a class="share-btn-compact" href="${esc(sl.x_twitter || `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on X (Twitter)" title="Share on X">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>X</span>
          </a>
          <a class="share-btn-compact" href="${esc(sl.whatsapp || `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`)}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="Share on WhatsApp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.23.89 2.41 1.02 2.58.13.17 1.76 2.68 4.26 3.76.6.26 1.06.41 1.42.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z"/></svg>
            <span>WhatsApp</span>
          </a>
          <a class="share-btn-compact" href="${esc(sl.email || `mailto:?subject=${shareTitle}&body=${shareUrl}`)}" aria-label="Share via Email" title="Send email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            <span>Email</span>
          </a>
          <button type="button" class="share-btn-compact" id="copy-link-btn" data-url="${esc(directShareLink)}" aria-label="Copy link to clipboard" title="Copy article link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            <span id="copy-btn-text">Copy Link</span>
          </button>
        </div>
      `;

      // 4. Hero Image Figure
      const validImg = safeHttpUrl ? safeHttpUrl(article.image) : Boolean(article.image);
      const creditText = article.imageCredit || (validImg ? 'Editorial / OEM Archive' : '');
      const heroImageHtml = validImg ? `
        <figure class="article-hero-figure">
          <img class="article-hero-img" src="${esc(article.image)}" alt="${esc(article.title)} — ${esc(article.manufacturer || 'Machine Report World')}" loading="eager" fetchpriority="high">
          ${creditText ? `<figcaption class="article-image-credit">Image credit: ${esc(creditText)}</figcaption>` : ''}
        </figure>
      ` : '';

      // 5. Main Body Typography & Separation of Facts vs. Analysis
      const bodyFormatted = renderFormattedBody
        ? renderFormattedBody(article.body)
        : esc(article.body).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

      const confirmedFactsHtml = Array.isArray(article.confirmedFacts) && article.confirmedFacts.length > 0 ? `
        <div class="confirmed-reporting-card">
          <h3 class="callout-heading">Confirmed Specifications &amp; Announcements</h3>
          <ul>
            ${article.confirmedFacts.map(f => `<li>${esc(f)}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      const analysisHtml = article.analysis && String(article.analysis).trim().length > 20 ? `
        <div class="editorial-analysis-card">
          <h3 class="callout-heading">Editorial &amp; Engineering Analysis</h3>
          <div class="analysis-body">
            ${renderFormattedBody ? renderFormattedBody(article.analysis) : `<p>${esc(article.analysis)}</p>`}
          </div>
        </div>
      ` : '';

      // 6. Conditional Specifications & Key Facts
      const meaningfulSpecs = filterMeaningfulSpecs(article.specs);
      const keyFactsList = Array.isArray(article.keyFacts) ? article.keyFacts.filter(Boolean) : [];

      let specsHtml = '';
      if (meaningfulSpecs.length > 0) {
        specsHtml = `
          <div class="article-specs-card">
            <h3>Technical Datasheet &amp; Reference Specifications</h3>
            <dl class="specs-table">
              ${meaningfulSpecs.map(([k, v]) => `
                <div class="specs-row">
                  <dt>${esc(k)}</dt>
                  <dd>${esc(v)}</dd>
                </div>
              `).join('')}
            </dl>
          </div>
        `;
      } else if (keyFactsList.length > 0) {
        specsHtml = `
          <div class="article-specs-card">
            <h3>Key Takeaways &amp; Fleet Metrics</h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              ${keyFactsList.map(kf => `<li>${esc(kf)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      // 7. Conditional "Why This Matters"
      const whyItMattersHtml = article.whyItMatters && String(article.whyItMatters).trim().length > 15 ? `
        <aside class="why-this-matters" aria-label="Industry impact note">
          <h3>Why This Matters for Fleets &amp; Contractors</h3>
          <p>${esc(article.whyItMatters)}</p>
        </aside>
      ` : '';

      // 8. Sources & References (Only valid HTTP/HTTPS URLs)
      const rawSources = [...new Set([article.sourceUrl, ...(article.sourceUrls || [])].filter(Boolean))];
      const validSources = rawSources.filter(u => safeHttpUrl ? safeHttpUrl(u) : /^https?:\/\//i.test(u));

      const sourcesHtml = validSources.length > 0 ? `
        <section class="article-sources-box" aria-label="Source links and citations">
          <h3>Sources &amp; Reference Material</h3>
          <ul class="source-list">
            ${validSources.map(u => `
              <li>
                <a class="source-external-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">
                  ${esc(formatSourceDomain(u))} <span class="ext-icon" aria-hidden="true">↗</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </section>
      ` : '';

      // 9. Manufacturer Profile Callout
      const mfgCalloutHtml = isRealMfg ? `
        <div class="manufacturer-callout">
          <div class="mfg-callout-info">
            <h4>Explore ${esc(article.manufacturer)}</h4>
            <p>View verified OEM profile, equipment models, dealer network updates, and regional machine lineups.</p>
          </div>
          <a class="button button-dark" href="${manufacturerUrl ? manufacturerUrl(article.manufacturer) : `/manufacturers/${encodeURIComponent(article.manufacturer)}`}">
            View OEM Hub →
          </a>
        </div>
      ` : '';

      // 10. Compact Newsletter Card
      const newsletterCardHtml = `
        <section class="article-newsletter-card" aria-label="Subscribe to Machine Report World briefing">
          <h3>The World of Machines. Connected.</h3>
          <p>Get verified heavy equipment launches, commercial vehicle engineering, and market intelligence delivered to your inbox.</p>
          <form class="article-newsletter-form" id="article-nl-form">
            <input type="email" id="article-nl-email" placeholder="Enter your work email address" required autocomplete="email" aria-label="Work email address">
            <button type="submit" id="article-nl-btn">Subscribe Free →</button>
          </form>
          <div id="article-nl-msg" class="nl-msg" hidden role="status"></div>
        </section>
      `;

      // Assemble the clean editorial template
      root.innerHTML = `
        <article class="article-detail">
          <div class="article-reading-container">
            <!-- Compact Breadcrumbs -->
            <nav class="article-breadcrumb" aria-label="Breadcrumb">
              <a href="/">Home</a> <span>/</span>
              <a href="${categoryUrl ? categoryUrl(categorySlug) : `/category/${categorySlug}`}">${esc(article.category || 'News')}</a> <span>/</span>
              <span aria-current="page">${esc(article.title)}</span>
            </nav>

            <!-- Meta Badges -->
            ${badgesHtml}

            <!-- Headline -->
            <h1 class="article-headline">${esc(article.title)}</h1>

            <!-- Summary / Deck -->
            <p class="article-deck">${esc(article.summary || article.excerpt)}</p>

            <!-- Byline -->
            ${bylineHtml}

            <!-- Share Controls -->
            ${shareControlsHtml}

            <!-- Hero Image -->
            ${heroImageHtml}

            <!-- Dominant Article Body -->
            <div class="article-body-content">
              ${confirmedFactsHtml}
              ${bodyFormatted}
              ${analysisHtml}
            </div>

            <!-- Specifications (when meaningful) -->
            ${specsHtml}

            <!-- Why This Matters -->
            ${whyItMattersHtml}

            <!-- Sources -->
            ${sourcesHtml}

            <!-- Manufacturer Profile Callout -->
            ${mfgCalloutHtml}

            <!-- Compact Newsletter Invitation -->
            ${newsletterCardHtml}
          </div>

          <!-- Up to Three Genuinely Related Articles -->
          <div class="article-related-container" id="article-related-wrap" hidden>
            <div class="wrap">
              <h2 class="article-related-heading">Related Industry Coverage</h2>
              <div id="article-related-grid" class="article-grid"></div>
            </div>
          </div>
        </article>
      `;

      // Copy link button handler
      const copyBtn = document.querySelector('#copy-link-btn');
      const copyText = document.querySelector('#copy-btn-text');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const targetUrl = copyBtn.dataset.url || location.href;
          if (trackTelemetry) trackTelemetry({ type: 'share_click', slug: article.slug });
          try {
            await navigator.clipboard.writeText(targetUrl);
            if (copyText) copyText.textContent = 'Copied ✓';
            setTimeout(() => { if (copyText) copyText.textContent = 'Copy Link'; }, 2500);
          } catch {
            prompt('Copy article link:', targetUrl);
          }
        });
      }

      // Telemetry on share and source clicks
      document.querySelectorAll('.article-share-bar a.share-btn-compact').forEach(link => {
        link.addEventListener('click', () => {
          if (trackTelemetry) trackTelemetry({ type: 'share_click', slug: article.slug });
        });
      });

      document.querySelectorAll('.source-external-link').forEach(link => {
        link.addEventListener('click', () => {
          if (trackTelemetry) trackTelemetry({ type: 'source_click', slug: article.slug });
        });
      });

      // Inline newsletter subscription handler
      const nlForm = document.querySelector('#article-nl-form');
      const nlEmail = document.querySelector('#article-nl-email');
      const nlBtn = document.querySelector('#article-nl-btn');
      const nlMsg = document.querySelector('#article-nl-msg');

      if (nlForm && nlEmail) {
        nlForm.addEventListener('submit', async e => {
          e.preventDefault();
          const emailVal = nlEmail.value.trim();
          if (!emailVal) return;
          nlBtn.disabled = true;
          nlBtn.textContent = 'Joining…';
          try {
            const res = await fetch('/api/newsletter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailVal, segment: article.category || 'General' })
            });
            const data = await res.json();
            if (res.ok) {
              nlMsg.hidden = false;
              nlMsg.style.color = '#86efac';
              nlMsg.textContent = '✓ Subscription confirmed! Check your email for verification.';
              nlForm.reset();
            } else {
              nlMsg.hidden = false;
              nlMsg.style.color = '#fca5a5';
              nlMsg.textContent = data.error || 'Unable to subscribe. Please try again.';
            }
          } catch {
            nlMsg.hidden = false;
            nlMsg.style.color = '#fca5a5';
            nlMsg.textContent = 'Connection error. Please try again later.';
          } finally {
            nlBtn.disabled = false;
            nlBtn.textContent = 'Subscribe Free →';
          }
        });
      }

      // Inject NewsArticle & BreadcrumbList JSON-LD
      if (setJsonLd) {
        setJsonLd('article-jsonld', {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          'headline': article.title,
          'description': seoDesc,
          'image': article.image ? [article.image] : [],
          'datePublished': article.publishedAt || article.createdAt,
          'dateModified': article.updatedAt || article.publishedAt,
          'author': [{ '@type': 'Person', 'name': article.author || 'Editorial Desk' }],
          'publisher': {
            '@type': 'NewsMediaOrganization',
            'name': 'Machine Report World',
            'slogan': 'THE WORLD OF MACHINES. CONNECTED.'
          },
          'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalHref }
        });

        setJsonLd('breadcrumb-jsonld', {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Home',
              'item': location.origin + '/'
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': article.category || 'News',
              'item': `${location.origin}/category/${categorySlug}`
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': article.title,
              'item': canonicalHref
            }
          ]
        });
      }

      // Populate up to 3 genuinely related articles
      try {
        const allRes = await fetch('/api/articles');
        if (allRes.ok) {
          const list = (await allRes.json()).filter(x => x.slug !== article.slug);
          
          // Match same manufacturer first, then same category
          const sameMfg = isRealMfg ? list.filter(x => x.manufacturer && x.manufacturer.toLowerCase() === article.manufacturer.toLowerCase()) : [];
          const sameCat = list.filter(x => x.category && x.category.toLowerCase() === (article.category || '').toLowerCase() && !sameMfg.some(m => m.slug === x.slug));
          
          const relatedItems = [...sameMfg, ...sameCat].slice(0, 3);
          
          if (relatedItems.length > 0 && renderArticleCard) {
            const relWrap = document.querySelector('#article-related-wrap');
            const relGrid = document.querySelector('#article-related-grid');
            if (relWrap && relGrid) {
              relGrid.innerHTML = relatedItems.map(item => renderArticleCard(item, { lazy: true })).join('');
              relWrap.hidden = false;
            }
          }
        }
      } catch (err) {
        console.warn('Could not load related articles:', err);
      }
    } catch {
      root.innerHTML = `
        <div class="article-reading-container" style="padding: 64px 0; text-align: center;">
          <span class="eyebrow" style="color: #ef4444;">404 · NOT FOUND</span>
          <h1 style="font-size: 32px; margin: 12px 0 16px;">Story Not Found</h1>
          <p style="color: #64748b; margin-bottom: 24px; font-size: 16px;">This article may have been unpublished or the link may be incorrect.</p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a class="button button-dark" href="/">Back to Homepage</a>
            <a class="button button-outline" href="/category/construction-equipment">Construction Equipment</a>
            <a class="button button-outline" href="/manufacturers">Browse OEMs</a>
          </div>
        </div>
      `;
    }
  });
})();
