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
    renderEditorialImage,
    renderArticleCard,
    setJsonLd,
    renderFormattedBody,
    trackTelemetry
  } = window.MWComponents;

const TYPE_LABELS = {
  'news': 'News Report',
  'company-announcement': 'Company Announcement',
  'analysis': 'Technical Analysis',
  'opinion': 'Editorial Opinion',
  'guide': 'Buyer & Maintenance Guide',
  'review': 'Specification Review'
};

(async () => {
  document.querySelector('#year').textContent = new Date().getFullYear();

  // Support both clean URL `/news/:slug` and legacy `/article.html?slug=:slug`
  const pathMatch = location.pathname.match(/^\/(?:news|articles)\/([a-z0-9-_]+)\/?$/i);
  const slug = pathMatch ? decodeURIComponent(pathMatch[1]) : new URLSearchParams(location.search).get('slug');
  const root = document.querySelector('#article-content');

  if (!slug) {
    root.innerHTML = '<h1>Choose an article</h1><a class="button button-dark" href="/">Return to news desk</a>';
    return;
  }

  try {
    const r = await fetch('/api/articles/' + encodeURIComponent(slug));
    if (!r.ok) throw new Error();
    const a = await r.json();

    fetch('/api/analytics/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'article', slug: a.slug })
    }).catch(() => {});

    const seoTitle = a.seo?.metaTitle || a.title;
    const seoDesc = a.seo?.metaDescription || a.summary || a.excerpt;
    const canonicalHref = a.seo?.canonicalUrl || `${location.origin}${articleUrl(a.slug)}`;

    document.title = seoTitle + ' | MACHINEWIRE';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = seoDesc;
    const ogTitle = document.querySelector('#og-title');
    if (ogTitle) ogTitle.content = seoTitle + ' | MACHINEWIRE';
    const ogDesc = document.querySelector('#og-desc');
    if (ogDesc) ogDesc.content = seoDesc;
    const ogImg = document.querySelector('#og-image');
    if (ogImg && a.image) ogImg.content = a.image;
    const canon = document.querySelector('#canonical-link');
    if (canon) canon.href = canonicalHref;

    const categorySlug = resolveDeskSlug(
      (a.category || 'construction-equipment').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    );

    // Structured Manufacturer, Model, Country, Region, Equipment & Topic Tags
    const structuredChips = [];
    if (a.manufacturer) {
      structuredChips.push(
        `<a class="tag-chip tag-chip-oem" href="${manufacturerUrl(a.manufacturer)}">OEM: ${esc(a.manufacturer)}</a>`
      );
    }
    if (a.model) {
      structuredChips.push(
        `<a class="tag-chip tag-chip-model" href="/models?q=${encodeURIComponent(a.model)}">Model: ${esc(a.model)}</a>`
      );
    }
    if (a.equipmentType) {
      structuredChips.push(
        `<a class="tag-chip" href="${categoryUrl(categorySlug)}?q=${encodeURIComponent(a.equipmentType)}">Type: ${esc(a.equipmentType)}</a>`
      );
    }
    if (a.country) {
      const targetRegSlug = a.country.toLowerCase() === 'global' ? 'india' : (a.region || a.country);
      structuredChips.push(
        `<a class="tag-chip tag-chip-country" href="${regionUrl(targetRegSlug)}">Market: ${esc(a.country)}${a.region && a.region !== a.country ? ` (${esc(a.region)})` : ''}</a>`
      );
    }
    for (const t of a.tags || []) {
      structuredChips.push(
        `<a class="tag-chip" href="${categoryUrl(categorySlug)}?q=${encodeURIComponent(t)}">#${esc(t)}</a>`
      );
    }

    const validImg = safeHttpUrl(a.image);
    const creditText = a.imageCredit || (validImg ? 'Editorial / OEM Press Handout' : '');
    const imageFigure = `<figure class="article-figure">
      <div class="hero-image">
        ${renderEditorialImage({
          url: a.image,
          alt: `${a.title} — ${a.manufacturer || 'MACHINEWIRE'}`,
          credit: creditText,
          aspect: 'hero',
          lazy: false,
          showCreditBadge: false
        })}
      </div>
      ${creditText ? `<figcaption class="image-credit">Image credit: ${esc(creditText)}</figcaption>` : ''}
    </figure>`;

    const paragraphs = renderFormattedBody
      ? renderFormattedBody(a.body)
      : esc(a.body).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    const allSources = [...new Set([a.sourceUrl, ...(a.sourceUrls || [])].filter(Boolean))];
    const sourcesHtml = allSources.length
      ? `<ul class="source-list">${allSources.map(u => `<li><a class="text-link source-external-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)} ↗</a></li>`).join('')}</ul>`
      : '<span class="muted">No primary source URL has been added to this story.</span>';

    const internalGraph = a.internalLinks || {};
    const linkedMfgs = internalGraph.linkedManufacturers || [];
    const linkedModels = internalGraph.linkedModels || [];
    const hubLinks = internalGraph.hubLinks || [];
    const crossHubPanelHtml = (linkedMfgs.length || linkedModels.length || hubLinks.length)
      ? `<div class="spec-sheet" style="margin-top:24px" aria-label="Connected MachineWire Intelligence Hubs">
          <div class="spec-sheet-head"><span class="eyebrow">CONNECTED MACHINEWIRE INTELLIGENCE HUBS (MANUFACTURERS, MODELS, TECHNOLOGY &amp; REGIONS)</span></div>
          <div class="spec-grid">
            ${linkedMfgs.map(m => `<div><dt>OEM Profile (${esc(m.country || 'Global')})</dt><dd><a class="text-link" href="${esc(m.url)}">${esc(m.name)} Hub →</a></dd></div>`).join('')}
            ${linkedModels.map(mod => `<div><dt>${esc(mod.equipmentType || 'Equipment Model')} Spec Sheet</dt><dd><a class="text-link" href="${esc(mod.url)}">${esc(mod.manufacturer ? `${mod.manufacturer} ` : '')}${esc(mod.name)} →</a></dd></div>`).join('')}
            ${hubLinks.map(h => `<div><dt>${esc((h.type || 'Hub').toUpperCase())} Desk</dt><dd><a class="text-link" href="${esc(h.url)}">${esc(h.label)} →</a></dd></div>`).join('')}
          </div>
        </div>`
      : '';

    const specsEntries = a.specs && typeof a.specs === 'object' ? Object.entries(a.specs) : [];
    const specsBox = specsEntries.length
      ? `<div class="spec-sheet">
          <div class="spec-sheet-head"><span class="eyebrow">TECHNICAL DATASHEET &amp; KEY FACTS</span></div>
          <dl class="spec-grid">
            ${specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
        </div>`
      : '';

    const metaRows = [
      ['Manufacturer', a.manufacturer || 'Industry Desk'],
      ['Category', a.category || 'Industry News'],
      a.equipmentType ? ['Equipment / Vehicle', a.equipmentType] : null,
      a.model ? ['Model / Platform', a.model] : null,
      a.powerType ? ['Powertrain', a.powerType] : null,
      a.country ? ['Country', a.country] : null,
      a.region ? ['Region', a.region] : null,
      ['Classification', TYPE_LABELS[a.articleType] || 'News Report'],
      a.publishedAt ? ['Published Date', formatDate(a.publishedAt, true)] : null,
      a.updatedAt ? ['Last Updated', formatDate(a.updatedAt, true)] : null
    ].filter(Boolean);

    const shareUrl = encodeURIComponent(canonicalHref);
    const shareTitle = encodeURIComponent(`${a.title} | MACHINEWIRE`);
    const sl = a.shareLinks?.intentUrls || {};
    const shareBarHtml = `<div class="share-bar" aria-label="Share this article">
      <span class="share-label">SHARE REPORT:</span>
      <a class="share-btn" href="${esc(sl.linkedin || `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
      <a class="share-btn" href="${esc(sl.x_twitter || `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`)}" target="_blank" rel="noopener noreferrer">X / Twitter ↗</a>
      <a class="share-btn" href="${esc(sl.whatsapp || `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
      <a class="share-btn" href="${esc(sl.email || `mailto:?subject=${shareTitle}&body=${shareUrl}`)}">Email ✉</a>
      <button type="button" class="share-btn" id="copy-link-btn" data-url="${esc(a.shareLinks?.utmLinks?.direct || canonicalHref)}">Copy Link ⧉</button>
    </div>`;

    root.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <a href="${categoryUrl(categorySlug)}">${esc(a.category || 'News')}</a> <span>/</span>
        <span aria-current="page">${esc(a.title)}</span>
      </nav>
      <article class="article-detail">
        <div class="article-heading">
          <div class="article-badges">
            <a class="eyebrow" href="${categoryUrl(categorySlug)}">${esc(a.category)} · ${esc(a.manufacturer)}</a>
            <span class="type-pill">${esc(TYPE_LABELS[a.articleType] || 'News Report')}</span>
          </div>
          <h1>${esc(a.title)}</h1>
          <p class="article-deck">${esc(a.summary || a.excerpt)}</p>
          <div class="article-byline">
            <span>By <strong>${esc(a.author || 'Editorial Desk')}</strong></span>
            ${a.publishedAt ? `<span>•</span> <span>Published <time datetime="${esc(a.publishedAt)}">${formatDate(a.publishedAt, true)}</time></span>` : ''}
            ${a.updatedAt ? `<span>•</span> <span>Updated <time datetime="${esc(a.updatedAt)}">${formatDate(a.updatedAt, true)}</time></span>` : ''}
            ${a.country ? `<span>•</span> <span>Market: ${esc(a.country)}${a.region && a.region !== a.country ? ` (${esc(a.region)})` : ''}</span>` : ''}
          </div>
          ${shareBarHtml}
        </div>
        ${imageFigure}
        <div class="article-layout">
          <div class="article-body">
            ${specsBox}
            ${paragraphs}
            <div class="source-note">
              <strong>Primary Source Links &amp; Editorial Verification</strong>
              <p>Check the original source for the manufacturer's exact wording, regional homologation and current specifications. MACHINEWIRE distinguishes confirmed releases from editorial analysis and corrects confirmed errors promptly.</p>
              ${sourcesHtml}
            </div>
            <div class="article-tags" aria-label="Manufacturer, model, country and topic tags">
              ${structuredChips.join('')}
            </div>
            ${crossHubPanelHtml}
          </div>
          <aside class="article-aside" aria-label="Story specification dossier">
            <span class="eyebrow">STORY DOSSIER</span>
            <dl class="dossier-list">
              ${metaRows.map(([label, val]) => `<div class="dossier-item"><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>`).join('')}
            </dl>
            <a href="${categoryUrl(categorySlug)}" class="text-link">Explore ${esc(a.category)} Desk →</a>
          </aside>
        </div>

        <!-- More News from Same Manufacturer or Category -->
        <section id="same-mfg-section" class="section related-section" hidden>
          <div class="section-head">
            <h2 id="same-mfg-heading">MORE FROM THIS MANUFACTURER &amp; CATEGORY</h2>
            <span class="section-rule"></span>
            <a class="section-link" id="same-mfg-link" href="${categoryUrl(categorySlug)}">View Desk →</a>
          </div>
          <div id="same-mfg-grid" class="article-grid"></div>
        </section>

        <!-- General Related Articles -->
        <section id="related-section" class="section related-section" hidden>
          <div class="section-head">
            <h2>RELATED INDUSTRY COVERAGE</h2>
            <span class="section-rule"></span>
          </div>
          <div id="related-grid" class="article-grid"></div>
        </section>
      </article>`;

    // Copy link & share/source engagement telemetry handlers
    document.querySelector('#copy-link-btn')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      const targetUrl = btn.dataset.url || location.href;
      if (trackTelemetry) trackTelemetry({ type: 'share_click', slug: a.slug });
      try {
        await navigator.clipboard.writeText(targetUrl);
        btn.textContent = 'Copied ✓';
      } catch {
        btn.textContent = targetUrl;
      }
    });

    document.querySelectorAll('.share-bar a.share-btn').forEach(link => {
      link.addEventListener('click', () => {
        if (trackTelemetry) trackTelemetry({ type: 'share_click', slug: a.slug });
      });
    });

    document.querySelectorAll('.source-external-link').forEach(link => {
      link.addEventListener('click', () => {
        if (trackTelemetry) trackTelemetry({ type: 'source_click', slug: a.slug });
      });
    });

    // Inject NewsArticle + BreadcrumbList JSON-LD
    setJsonLd('article-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      'headline': a.title,
      'description': seoDesc,
      'image': a.image ? [a.image] : [],
      'datePublished': a.publishedAt || a.createdAt,
      'dateModified': a.updatedAt || a.publishedAt,
      'author': [{ '@type': 'Person', 'name': a.author || 'Editorial Desk' }],
      'publisher': {
        '@type': 'NewsMediaOrganization',
        'name': 'MACHINEWIRE',
        'slogan': 'THE WORLD OF MACHINES. CONNECTED.'
      },
      'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalHref }
    });

    // Populate "More from same manufacturer/category" and scored "Related articles" using server internal link graph + real published articles
    const allRes = await fetch('/api/articles');
    if (allRes.ok) {
      const list = (await allRes.json()).filter(x => x.slug !== a.slug);
      const sameMfgOrCat = list.filter(
        x => (a.manufacturer && x.manufacturer === a.manufacturer) || x.category === a.category
      ).slice(0, 3);

      const usedSlugs = new Set(sameMfgOrCat.map(x => x.slug));
      const scoredRelatedSlugs = (internalGraph.relatedStories || []).map(r => r.slug);
      const scoredRelatedItems = scoredRelatedSlugs
        .map(s => list.find(x => x.slug === s))
        .filter(x => x && !usedSlugs.has(x.slug));
      const fallbackRelated = list.filter(x => !usedSlugs.has(x.slug) && !scoredRelatedSlugs.includes(x.slug));
      const otherRelated = [...scoredRelatedItems, ...fallbackRelated].slice(0, 3);

      if (sameMfgOrCat.length) {
        const mfgSec = document.querySelector('#same-mfg-section');
        const mfgGrid = document.querySelector('#same-mfg-grid');
        const mfgHead = document.querySelector('#same-mfg-heading');
        if (mfgHead) {
          mfgHead.textContent = `MORE IN ${(a.manufacturer && a.manufacturer !== 'Various' ? a.manufacturer : a.category).toUpperCase()} & ${a.category.toUpperCase()}`;
        }
        mfgGrid.innerHTML = sameMfgOrCat.map(item => renderArticleCard(item, { lazy: true })).join('');
        mfgSec.hidden = false;
      }

      if (otherRelated.length) {
        const relGrid = document.querySelector('#related-grid');
        const relSec = document.querySelector('#related-section');
        relGrid.innerHTML = otherRelated.map(item => renderArticleCard(item, { lazy: true })).join('');
        relSec.hidden = false;
      }
    }
  } catch {
    root.innerHTML = '<h1>Story not found</h1><p>This article may be unpublished or the link may be incorrect.</p><a class="button button-dark" href="/">Back to homepage</a>';
  }
})();
