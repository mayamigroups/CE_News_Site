(() => {
  const {
    esc,
    categoryUrl,
    regionUrl,
    manufacturerUrl,
    modelUrl,
    safeHttpUrl,
    renderArticleCard,
    setJsonLd
  } = window.MWComponents;

  const $ = id => document.getElementById(id);

  // Mobile Menu Toggle
  const menuToggle = $('menu-toggle');
  const siteNav = $('site-nav');
  if (menuToggle && siteNav) {
    menuToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  function detectManufacturerSlug() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slug')) return params.get('slug').trim().toLowerCase();
    const pathMatch = window.location.pathname.match(/^\/(manufacturers|brands)\/([a-z0-9-_]+)\/?$/i);
    return pathMatch ? pathMatch[2].toLowerCase() : '';
  }

  function renderMissingLabel(text = 'Not yet confirmed in editorial database') {
    return `<span class="missing-data-badge">${esc(text)}</span>`;
  }

  function renderModelSummaryCard(em, mfgName) {
    const href = modelUrl(em.slug);
    const specsEntries = Object.entries(em.specs || {}).slice(0, 3);
    return `
      <article class="news-card model-dir-card">
        <div class="card-body">
          <div class="meta-line">
            <span class="badge">${esc(em.category || em.equipmentType || 'Equipment')}</span>
            <span class="meta-dot">•</span>
            <span>${esc(em.manufacturer || mfgName)}</span>
          </div>
          <h3><a href="${esc(href)}">${esc(em.name)}</a></h3>
          <p>${esc(em.summary || `${em.equipmentType || 'Equipment platform'} by ${em.manufacturer || mfgName}.`)}</p>
          ${specsEntries.length
            ? `<dl class="mini-spec-list">
                ${specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
               </dl>`
            : `<p class="muted">${renderMissingLabel('Detailed specification table pending official brochure verification')}</p>`}
          <div class="card-read">
            <span class="type-pill">${esc(em.powerType || 'Powertrain TBD')}</span>
            <a href="${esc(href)}">View Model &amp; Specs →</a>
          </div>
        </div>
      </article>
    `;
  }

  async function initDirectoryMode() {
    $('mfg-directory-view').hidden = false;
    $('mfg-profile-view').hidden = true;

    const res = await fetch('/api/manufacturers');
    const data = await res.json();
    const allManufacturers = data.manufacturers || [];

    // Populate filter dropdowns
    const brandSelect = $('mfg-filter-brand');
    const catSelect = $('mfg-filter-category');
    const eqSelect = $('mfg-filter-equipment');
    const countrySelect = $('mfg-filter-country');
    const searchInput = $('mfg-search');
    const resetBtn = $('mfg-reset-btn');

    const categories = new Set();
    const eqTypes = new Set();
    const countries = new Set();

    allManufacturers.forEach(m => {
      if (m.country) countries.add(m.country);
      (m.equipmentCategories || []).forEach(c => categories.add(c));
      (m.models || []).forEach(mod => {
        if (mod.equipmentType) eqTypes.add(mod.equipmentType);
      });
    });

    brandSelect.innerHTML = `<option value="">All Manufacturers (${allManufacturers.length})</option>` +
      allManufacturers.map(m => `<option value="${esc(m.slug)}">${esc(m.name)}</option>`).join('');

    catSelect.innerHTML = `<option value="">All Categories</option>` +
      [...categories].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

    eqSelect.innerHTML = `<option value="">All Equipment Types</option>` +
      [...eqTypes].sort().map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');

    countrySelect.innerHTML = `<option value="">All Headquarters Countries</option>` +
      [...countries].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

    // Apply URL query parameters if any
    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) searchInput.value = params.get('q');
    if (params.get('manufacturer')) brandSelect.value = params.get('manufacturer');
    if (params.get('category')) catSelect.value = params.get('category');
    if (params.get('equipmentType')) eqSelect.value = params.get('equipmentType');
    if (params.get('country')) countrySelect.value = params.get('country');

    function applyFilters() {
      const q = searchInput.value.trim().toLowerCase();
      const brandVal = brandSelect.value.trim().toLowerCase();
      const catVal = catSelect.value.trim().toLowerCase();
      const eqVal = eqSelect.value.trim().toLowerCase();
      const ctyVal = countrySelect.value.trim().toLowerCase();

      const hasActiveFilters = Boolean(q || brandVal || catVal || eqVal || ctyVal);
      resetBtn.hidden = !hasActiveFilters;

      const filtered = allManufacturers.filter(m => {
        if (brandVal && m.slug.toLowerCase() !== brandVal && m.name.toLowerCase() !== brandVal) return false;
        if (catVal && !(m.equipmentCategories || []).some(c => c.toLowerCase() === catVal)) return false;
        if (eqVal && !(m.models || []).some(mod => (mod.equipmentType || '').toLowerCase() === eqVal) && !m.focus.toLowerCase().includes(eqVal)) return false;
        if (ctyVal && (m.country || '').toLowerCase() !== ctyVal && !(m.regionalFootprint || []).some(r => r.toLowerCase() === ctyVal)) return false;
        if (q) {
          const hay = [
            m.name,
            m.country,
            m.headquarters,
            m.focus,
            m.overview,
            ...(m.equipmentCategories || []),
            ...(m.technologyHighlights || []),
            ...(m.regionalFootprint || []),
            ...(m.models || []).map(mod => `${mod.name} ${mod.equipmentType}`)
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      $('mfg-results-count').textContent = `Showing ${filtered.length} of ${allManufacturers.length} verified OEM directory candidates`;

      const grid = $('mfg-directory-grid');
      if (!filtered.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p>No manufacturers match your current filter combination. Clear filters to view all ${allManufacturers.length} global OEM profiles.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = filtered.map(m => {
        const profileHref = manufacturerUrl(m.slug);
        const siteHref = safeHttpUrl(m.website);
        const cats = (m.equipmentCategories || []).slice(0, 5);
        const modelsList = m.models || [];
        return `
          <article class="oem-directory-card">
            <div class="oem-card-top">
              <div>
                <span class="eyebrow">${esc(m.country || 'Global')} • ${esc(m.headquarters || 'Headquarters not confirmed')}</span>
                <h2><a href="${esc(profileHref)}">${esc(m.name)}</a></h2>
              </div>
              <span class="oem-candidacy-pill" title="${esc(m.verificationStatus || 'Directory Candidate')}">Directory Candidate</span>
            </div>

            <p class="oem-card-overview">${esc(m.overview || m.focus || 'Company overview pending editorial verification.')}</p>

            <div class="oem-card-meta-row">
              <div>
                <small>Primary Focus</small>
                <strong>${esc(m.focus || 'Construction Equipment & Commercial Vehicles')}</strong>
              </div>
              <div>
                <small>Indexed Models &amp; Coverage</small>
                <strong>${modelsList.length} platform(s) • ${m.articleCount || 0} published report(s)</strong>
              </div>
            </div>

            <div class="tag-row">
              ${cats.map(c => `<a class="tag-chip" href="${esc(categoryUrl(c.toLowerCase().replace(/[^a-z0-9]+/g, '-')))}">${esc(c)}</a>`).join('')}
            </div>

            ${modelsList.length ? `
              <div class="oem-card-models">
                <small>Featured Equipment / Vehicle Models:</small>
                <div class="tag-row">
                  ${modelsList.map(mod => `<a class="tag-chip tag-chip-model" href="${esc(modelUrl(mod.slug))}">${esc(mod.name)}</a>`).join('')}
                </div>
              </div>
            ` : ''}

            <div class="card-read">
              ${siteHref ? `<a href="${esc(siteHref)}" target="_blank" rel="noopener noreferrer">Official Website ↗</a>` : renderMissingLabel('Official URL unconfirmed')}
              <a href="${esc(profileHref)}">Full OEM Profile →</a>
            </div>
          </article>
        `;
      }).join('');
    }

    [searchInput, brandSelect, catSelect, eqSelect, countrySelect].forEach(el => {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    });

    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      brandSelect.value = '';
      catSelect.value = '';
      eqSelect.value = '';
      countrySelect.value = '';
      applyFilters();
    });

    applyFilters();

    setJsonLd('mfg-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Global Construction Equipment & Commercial Vehicle Manufacturers | MACHINEWIRE',
      description: 'Independent directory of global construction machinery, agricultural tractor, and commercial vehicle manufacturers.',
      url: `${window.location.origin}/manufacturers`
    });
  }

  async function initProfileMode(slug) {
    $('mfg-directory-view').hidden = true;
    $('mfg-profile-view').hidden = false;

    const res = await fetch(`/api/manufacturers/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      $('mfg-profile-view').innerHTML = `
        <div class="empty-state">
          <h2>Manufacturer profile not found</h2>
          <p>We do not yet have a verified manufacturer record matching <code>${esc(slug)}</code>.</p>
          <p><a class="button button-dark" href="/manufacturers">← Return to Manufacturer Directory</a></p>
        </div>
      `;
      return;
    }

    const mfg = await res.json();
    document.title = `${mfg.name} — Manufacturer Profile, Models & News | MACHINEWIRE`;
    const metaDesc = $('meta-description');
    if (metaDesc) metaDesc.setAttribute('content', mfg.overview || mfg.focus);
    const canon = $('canonical-link');
    if (canon) canon.setAttribute('href', `${window.location.origin}/manufacturers/${mfg.slug}`);

    $('mfg-breadcrumb').innerHTML = `
      <a href="/">Home</a> <span>/</span>
      <a href="/manufacturers">Manufacturers &amp; Brands</a> <span>/</span>
      <strong>${esc(mfg.name)}</strong>
    `;

    $('profile-verification-badge').textContent = mfg.verificationStatus || 'INITIAL DIRECTORY CANDIDATE • INDEPENDENT COVERAGE';
    $('profile-name').textContent = mfg.name;
    $('profile-focus').textContent = mfg.focus || 'Construction equipment & commercial vehicles';

    const siteBtn = $('profile-website-btn');
    const cleanWeb = safeHttpUrl(mfg.website);
    if (cleanWeb) {
      siteBtn.href = cleanWeb;
      siteBtn.hidden = false;
    } else {
      siteBtn.hidden = true;
    }

    $('profile-facts-grid').innerHTML = `
      <div class="region-context-card">
        <small>Confirmed Headquarters</small>
        <strong>${mfg.headquarters ? esc(mfg.headquarters) : renderMissingLabel('Headquarters city not yet confirmed')}</strong>
      </div>
      <div class="region-context-card">
        <small>Country of Origin</small>
        <strong><a href="${esc(regionUrl(mfg.country))}">${esc(mfg.country || 'Global')}</a></strong>
      </div>
      <div class="region-context-card">
        <small>Official Website &amp; Source</small>
        <strong>${cleanWeb ? `<a href="${esc(cleanWeb)}" target="_blank" rel="noopener noreferrer">${esc(cleanWeb)} ↗</a>` : renderMissingLabel('Official URL not confirmed')}</strong>
      </div>
      <div class="region-context-card">
        <small>Indexed Equipment Platforms</small>
        <strong>${(mfg.models || []).length} Verified Model Page(s)</strong>
      </div>
      <div class="region-context-card">
        <small>Published Editorial Reports</small>
        <strong>${(mfg.relatedArticles || []).length} Verified Article(s)</strong>
      </div>
      <div class="region-context-card">
        <small>Commercial Relationship Status</small>
        <strong>Independent Editorial Coverage (No Partnership Claimed)</strong>
      </div>
    `;

    $('profile-overview').innerHTML = mfg.overview
      ? esc(mfg.overview)
      : renderMissingLabel('Detailed corporate overview pending verification from official manufacturer filings.');

    const cats = mfg.equipmentCategories || [];
    $('profile-categories-chips').innerHTML = cats.length
      ? cats.map(c => `<a class="tag-chip" href="${esc(categoryUrl(c.toLowerCase().replace(/[^a-z0-9]+/g, '-')))}">${esc(c)}</a>`).join('')
      : renderMissingLabel('Equipment categories not yet indexed');

    const techs = mfg.technologyHighlights || [];
    $('profile-tech-list').innerHTML = techs.length
      ? techs.map(t => `<li>${esc(t)}</li>`).join('')
      : `<li>${renderMissingLabel('No verified technology or powertrain updates recorded yet.')}</li>`;

    const regions = mfg.regionalFootprint || [mfg.country || 'Global'];
    $('profile-regions-chips').innerHTML = regions
      .map(r => `<a class="tag-chip tag-chip-country" href="${esc(regionUrl(r))}">${esc(r)} Desk →</a>`)
      .join('');

    // Render Product / Equipment Models
    $('profile-models-heading').textContent = `${mfg.name} Equipment & Vehicle Models`;
    const modelsGrid = $('profile-models-grid');
    if ((mfg.models || []).length) {
      modelsGrid.innerHTML = mfg.models.map(em => renderModelSummaryCard(em, mfg.name)).join('');
    } else {
      modelsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>${renderMissingLabel(`No individual equipment model pages have been verified for ${mfg.name} yet.`)} We do not invent model specifications or availability.</p>
        </div>
      `;
    }

    // Render Related News Articles
    $('profile-news-heading').textContent = `Related News & Reports on ${mfg.name}`;
    const newsGrid = $('profile-news-grid');
    if ((mfg.relatedArticles || []).length) {
      newsGrid.innerHTML = mfg.relatedArticles.map(a => renderArticleCard(a)).join('');
    } else {
      newsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p><strong>No dedicated news articles filed for ${esc(mfg.name)} yet.</strong> MachineWire never generates fabricated stories or unverified launch dates. <a href="/contact.html">Submit an official press release or tip →</a></p>
        </div>
      `;
    }

    setJsonLd('mfg-jsonld', {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${mfg.name} Manufacturer Profile | MACHINEWIRE`,
      description: mfg.overview || mfg.focus,
      url: `${window.location.origin}/manufacturers/${mfg.slug}`,
      mainEntity: {
        '@type': 'Organization',
        name: mfg.name,
        url: cleanWeb || undefined,
        location: mfg.headquarters || mfg.country
      }
    });
  }

  const targetSlug = detectManufacturerSlug();
  if (targetSlug) {
    initProfileMode(targetSlug);
  } else {
    initDirectoryMode();
  }
})();
