(() => {
  const {
    esc,
    categoryUrl,
    regionUrl,
    manufacturerUrl,
    modelUrl,
    safeHttpUrl,
    renderEditorialImage,
    renderArticleCard,
    setJsonLd
  } = window.MWComponents;

  const $ = id => document.getElementById(id);

  const menuToggle = $('menu-toggle');
  const siteNav = $('site-nav');
  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  function detectModelSlug() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slug')) return params.get('slug').trim().toLowerCase();
    const pathMatch = window.location.pathname.match(/^\/(models|equipment-models|equipment)\/([a-z0-9-_]+)\/?$/i);
    return pathMatch ? pathMatch[2].toLowerCase() : '';
  }

  function renderMissingLabel(text = 'Not yet confirmed in editorial database') {
    return `<span class="missing-data-badge">${esc(text)}</span>`;
  }

  function renderModelCard(em) {
    const href = modelUrl(em.slug);
    const mfgHref = manufacturerUrl(em.manufacturerSlug || em.manufacturer);
    const specEntries = Object.entries(em.specs || {}).slice(0, 3);
    const imgHtml = renderEditorialImage({
      src: em.image,
      alt: `${em.manufacturer} ${em.name} — ${em.equipmentType}`,
      credit: em.imageCredit || 'Editorial Reference',
      aspect: '4:3',
      lazy: true,
      category: em.category || em.equipmentType,
      manufacturer: em.manufacturer
    });

    return `
      <article class="news-card model-dir-card">
        <a href="${esc(href)}" class="card-image-link" aria-label="${esc(em.name)}">${imgHtml}</a>
        <div class="card-body">
          <div class="meta-line">
            <span class="badge">${esc(em.category || em.equipmentType || 'Equipment')}</span>
            <span class="meta-dot">•</span>
            <a href="${esc(mfgHref)}"><strong>${esc(em.manufacturer)}</strong></a>
            <span class="meta-dot">•</span>
            <span>${esc(em.country || 'Global')}</span>
          </div>
          <h3><a href="${esc(href)}">${esc(em.name)}</a></h3>
          <p>${esc(em.summary || `${em.equipmentType} platform manufactured by ${em.manufacturer}.`)}</p>
          ${specEntries.length
            ? `<dl class="mini-spec-list">
                ${specEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
               </dl>`
            : `<p class="muted">${renderMissingLabel('Detailed specification table pending official brochure verification')}</p>`}
          <div class="card-read">
            <span class="type-pill">${esc(em.powerType || 'Powertrain TBD')}</span>
            <a href="${esc(href)}">Full Model Dossier →</a>
          </div>
        </div>
      </article>
    `;
  }

  async function initDirectoryMode() {
    $('model-directory-view').hidden = false;
    $('model-detail-view').hidden = true;

    const res = await fetch('/api/models');
    const data = await res.json();
    const allModels = data.models || [];

    const mfgSelect = $('model-filter-manufacturer');
    const typeSelect = $('model-filter-type');
    const modelSelect = $('model-filter-model');
    const countrySelect = $('model-filter-country');
    const catSelect = $('model-filter-category');
    const searchInput = $('model-search');
    const resetBtn = $('model-reset-btn');

    const manufacturers = new Set();
    const eqTypes = new Set();
    const countries = new Set();
    const categories = new Set();

    allModels.forEach(m => {
      if (m.manufacturer) manufacturers.add(m.manufacturer);
      if (m.equipmentType) eqTypes.add(m.equipmentType);
      if (m.country) countries.add(m.country);
      if (m.category) categories.add(m.category);
    });

    mfgSelect.innerHTML = `<option value="">All Manufacturers</option>` +
      [...manufacturers].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

    typeSelect.innerHTML = `<option value="">All Equipment Types</option>` +
      [...eqTypes].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

    modelSelect.innerHTML = `<option value="">All Models (${allModels.length})</option>` +
      allModels.map(x => `<option value="${esc(x.slug)}">${esc(x.manufacturer)} — ${esc(x.name)}</option>`).join('');

    countrySelect.innerHTML = `<option value="">All Countries</option>` +
      [...countries].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

    catSelect.innerHTML = `<option value="">All Categories</option>` +
      [...categories].sort().map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');

    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) searchInput.value = params.get('q');
    if (params.get('manufacturer')) mfgSelect.value = params.get('manufacturer');
    if (params.get('equipmentType')) typeSelect.value = params.get('equipmentType');
    if (params.get('model')) modelSelect.value = params.get('model');
    if (params.get('country')) countrySelect.value = params.get('country');
    if (params.get('category')) catSelect.value = params.get('category');

    function applyFilters() {
      const q = searchInput.value.trim().toLowerCase();
      const mfgVal = mfgSelect.value.trim().toLowerCase();
      const typeVal = typeSelect.value.trim().toLowerCase();
      const modVal = modelSelect.value.trim().toLowerCase();
      const ctyVal = countrySelect.value.trim().toLowerCase();
      const catVal = catSelect.value.trim().toLowerCase();

      const hasFilters = Boolean(q || mfgVal || typeVal || modVal || ctyVal || catVal);
      resetBtn.hidden = !hasFilters;

      const filtered = allModels.filter(m => {
        if (mfgVal && (m.manufacturer || '').toLowerCase() !== mfgVal && (m.manufacturerSlug || '').toLowerCase() !== mfgVal) return false;
        if (typeVal && (m.equipmentType || '').toLowerCase() !== typeVal) return false;
        if (modVal && m.slug.toLowerCase() !== modVal && m.name.toLowerCase() !== modVal) return false;
        if (ctyVal && (m.country || '').toLowerCase() !== ctyVal) return false;
        if (catVal && (m.category || '').toLowerCase() !== catVal) return false;
        if (q) {
          const hay = [
            m.name,
            m.manufacturer,
            m.equipmentType,
            m.category,
            m.country,
            m.powerType,
            m.summary,
            ...(m.applications || []),
            ...(m.features || []),
            ...Object.entries(m.specs || {}).map(([k, v]) => `${k} ${v}`)
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      $('model-results-count').textContent = `Showing ${filtered.length} of ${allModels.length} verified equipment & vehicle platforms`;

      const grid = $('model-directory-grid');
      if (!filtered.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p>No equipment or vehicle models match your current filter selection. Reset filters to view all ${allModels.length} verified platforms.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = filtered.map(renderModelCard).join('');
    }

    [searchInput, mfgSelect, typeSelect, modelSelect, countrySelect, catSelect].forEach(el => {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    });

    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      mfgSelect.value = '';
      typeSelect.value = '';
      modelSelect.value = '';
      countrySelect.value = '';
      catSelect.value = '';
      applyFilters();
    });

    applyFilters();

    setJsonLd('model-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Equipment & Commercial Vehicle Model Directory | MACHINEWIRE',
      description: 'Searchable specification and application directory of global construction equipment and commercial vehicle models.',
      url: `${window.location.origin}/models`
    });
  }

  async function initDetailMode(slug) {
    $('model-directory-view').hidden = true;
    $('model-detail-view').hidden = false;

    const res = await fetch(`/api/models/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      $('model-detail-view').innerHTML = `
        <div class="empty-state">
          <h2>Equipment model page not found</h2>
          <p>We do not yet have a verified equipment record matching <code>${esc(slug)}</code>. MachineWire never fabricates unverified model pages.</p>
          <p><a class="button button-dark" href="/models">← Return to Equipment Model Directory</a></p>
        </div>
      `;
      return;
    }

    const em = await res.json();
    document.title = `${em.manufacturer} ${em.name} — Specifications, Applications & Competing Models | MACHINEWIRE`;
    const metaDesc = $('meta-description');
    if (metaDesc) metaDesc.setAttribute('content', em.summary || `${em.manufacturer} ${em.name} specifications and applications.`);
    const canon = $('canonical-link');
    if (canon) canon.setAttribute('href', `${window.location.origin}/models/${em.slug}`);

    const mfgHref = manufacturerUrl(em.manufacturerSlug || em.manufacturer);

    $('model-breadcrumb').innerHTML = `
      <a href="/">Home</a> <span>/</span>
      <a href="/models">Equipment Models</a> <span>/</span>
      <a href="${esc(mfgHref)}">${esc(em.manufacturer)}</a> <span>/</span>
      <strong>${esc(em.name)}</strong>
    `;

    $('detail-eyebrow').textContent = `${(em.manufacturer || 'OEM').toUpperCase()} • ${(em.equipmentType || 'EQUIPMENT PLATFORM').toUpperCase()}`;
    $('detail-name').textContent = `${em.manufacturer} ${em.name}`;
    $('detail-summary').textContent = em.summary || 'Verified equipment platform overview.';

    const mfgBtn = $('detail-mfg-btn');
    mfgBtn.href = mfgHref;
    mfgBtn.textContent = `${em.manufacturer} Profile →`;

    const srcBtn = $('detail-source-btn');
    const cleanSource = safeHttpUrl(em.officialSourceUrl);
    if (cleanSource) {
      srcBtn.href = cleanSource;
      srcBtn.hidden = false;
    } else {
      srcBtn.hidden = true;
    }

    $('detail-facts-grid').innerHTML = `
      <div class="region-context-card">
        <small>Verified Model Name</small>
        <strong>${esc(em.name)}</strong>
      </div>
      <div class="region-context-card">
        <small>Manufacturer / OEM</small>
        <strong><a href="${esc(mfgHref)}">${esc(em.manufacturer)} →</a></strong>
      </div>
      <div class="region-context-card">
        <small>Equipment Type &amp; Category</small>
        <strong><a href="${esc(categoryUrl((em.category || 'construction-equipment').toLowerCase().replace(/[^a-z0-9]+/g, '-')))}">${esc(em.equipmentType)} (${esc(em.category || 'Construction Equipment')})</a></strong>
      </div>
      <div class="region-context-card">
        <small>Powertrain Architecture</small>
        <strong>${em.powerType ? esc(em.powerType) : renderMissingLabel('Powertrain not confirmed')}</strong>
      </div>
      <div class="region-context-card">
        <small>Country of Origin / Hub</small>
        <strong><a href="${esc(regionUrl(em.country))}">${esc(em.country || 'Global')}</a></strong>
      </div>
      <div class="region-context-card">
        <small>Pricing &amp; Commercial Availability</small>
        <strong>${renderMissingLabel('List price & dealer stock not published — request official OEM quote')}</strong>
      </div>
    `;

    $('detail-image-box').innerHTML = renderEditorialImage({
      src: em.image,
      alt: `${em.manufacturer} ${em.name}`,
      credit: em.imageCredit || 'Editorial Reference / Official OEM Handout',
      aspect: '16:9',
      lazy: false,
      category: em.category || em.equipmentType,
      manufacturer: em.manufacturer
    });

    $('detail-spec-note').innerHTML = `
      <strong>Official Source &amp; Specification Verification Note:</strong>
      <p>${esc(em.specSourceNote || 'Consult official manufacturer documentation for serial-specific specifications.')}</p>
      ${cleanSource ? `<p><a href="${esc(cleanSource)}" target="_blank" rel="noopener noreferrer">Verify on Official ${esc(em.manufacturer)} Website (${esc(cleanSource)}) ↗</a></p>` : ''}
    `;

    // Specifications Table with explicit missing-info labels for unconfirmed fields
    const specsEntries = Object.entries(em.specs || {});
    const specsHtml = specsEntries.length
      ? specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')
      : `<div><dt>Official Specifications</dt><dd>${renderMissingLabel('Detailed brochure figures not yet confirmed in database')}</dd></div>`;

    $('detail-specs-table').innerHTML = specsHtml + `
      <div>
        <dt> Commercial List Price</dt>
        <dd>${renderMissingLabel('Not published — varies by regional dealer, attachment package, and tax regime')}</dd>
      </div>
    `;

    // Applications
    const apps = em.applications || [];
    $('detail-applications-list').innerHTML = apps.length
      ? apps.map(a => `<li>${esc(a)}</li>`).join('')
      : `<li>${renderMissingLabel('Specific worksite applications not yet confirmed')}</li>`;

    // Features
    const feats = em.features || [];
    $('detail-features-list').innerHTML = feats.length
      ? feats.map(f => `<li>${esc(f)}</li>`).join('')
      : `<li>${renderMissingLabel('Specific engineering features pending official brochure verification')}</li>`;

    // Competing Models
    const comps = em.competingModelsResolved || [];
    const compGrid = $('detail-competing-grid');
    if (comps.length) {
      compGrid.innerHTML = comps.map(c => `
        <article class="news-card model-dir-card">
          <div class="card-body">
            <div class="meta-line">
              <span class="badge">${esc(c.category || c.equipmentType)}</span>
              <span class="meta-dot">•</span>
              <a href="${esc(manufacturerUrl(c.manufacturerSlug || c.manufacturer))}"><strong>${esc(c.manufacturer)}</strong></a>
            </div>
            <h3><a href="${esc(modelUrl(c.slug))}">${esc(c.manufacturer)} ${esc(c.name)}</a></h3>
            <p>Competing ${esc(c.equipmentType)} platform from ${esc(c.manufacturer)} (${esc(c.country || 'Global')}).</p>
            <div class="card-read">
              <span class="type-pill">${esc(c.powerType || 'Diesel')}</span>
              <a href="${esc(modelUrl(c.slug))}">Compare Model →</a>
            </div>
          </div>
        </article>
      `).join('');
    } else {
      compGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>${renderMissingLabel('No direct competing models with verified cross-reference data are linked to this platform yet.')}</p>
        </div>
      `;
    }

    // Related News
    const news = em.relatedArticles || [];
    const newsGrid = $('detail-news-grid');
    if (news.length) {
      newsGrid.innerHTML = news.map(a => renderArticleCard(a)).join('');
    } else {
      newsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p><strong>No published news reports specifically tag ${esc(em.name)} yet.</strong> View the <a href="${esc(mfgHref)}">${esc(em.manufacturer)} Manufacturer Profile</a> for full OEM coverage.</p>
        </div>
      `;
    }

    setJsonLd('model-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${em.manufacturer} ${em.name}`,
      description: em.summary,
      brand: {
        '@type': 'Brand',
        name: em.manufacturer
      },
      category: em.category || em.equipmentType,
      url: `${window.location.origin}/models/${em.slug}`
    });
  }

  const slug = detectModelSlug();
  if (slug) {
    initDetailMode(slug);
  } else {
    initDirectoryMode();
  }
})();
