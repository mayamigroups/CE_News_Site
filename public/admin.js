const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let sessionInfo = null;
let articles = [];
let subscribers = [];
let submissions = [];
let catalog = {};
let backups = [];
let logsData = { jobs: [], auditLogs: [], validationWarnings: [] };
let siteSettings = {};
let collectedItems = [];
let newsroomConfig = null;
let latestNewsroomRun = null;
let workflowSummary = null;
let seoAnalyticsData = null;
let distributionConfigData = null;
let aiOperationsData = null;
let aiSeoTasks = [];

function alertMsg(msg, type = 'error') {
  const el = $('#admin-alert');
  if (!el) return;
  el.hidden = false;
  el.className = 'admin-alert ' + type;
  el.textContent = msg;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearAlert() {
  const el = $('#admin-alert');
  if (el) el.hidden = true;
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Tab switching across the 9 management screens
$$('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.tab;
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== targetId;
    });
  });
});

function resetForm() {
  $('#article-form').reset();
  $('#article-id').value = '';
  $('#author').value = 'Editorial Desk';
  $('#region').value = 'Global';
  $('#editor-title').textContent = 'Create an article';
  $('#save-draft').textContent = 'Save draft';
  if ($('#revision-history-box')) $('#revision-history-box').hidden = true;
  if ($('#duplicate-warning-banner')) $('#duplicate-warning-banner').hidden = true;
}

function parseSpecsInput(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && v) out[k] = v;
    }
  }
  return out;
}

function formatSpecsInput(specs) {
  if (!specs || typeof specs !== 'object') return '';
  return Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join('\n');
}

function formData(statusOverride) {
  const chosenStatus = statusOverride || $('#status').value;
  const summaryVal = $('#excerpt').value;
  return {
    title: $('#title').value,
    slug: $('#slug').value,
    summary: summaryVal,
    excerpt: summaryVal,
    body: $('#body').value,
    category: $('#category').value,
    manufacturer: $('#manufacturer').value,
    equipmentType: $('#equipment-type').value,
    country: $('#country').value,
    region: $('#region').value,
    model: $('#model').value,
    powerType: $('#power-type').value,
    articleType: $('#article-type').value,
    scheduledAt: $('#scheduled-at').value ? new Date($('#scheduled-at').value).toISOString() : '',
    sourceUrls: $('#source-urls').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    specs: parseSpecsInput($('#specs-input').value),
    author: $('#author').value,
    tags: $('#tags').value.split(',').map(x => x.trim()).filter(Boolean),
    image: $('#image').value,
    imageCredit: $('#image-credit').value,
    sourceUrl: $('#source-url').value,
    seo: {
      metaTitle: $('#seo-title').value,
      metaDescription: $('#seo-description').value,
      canonicalUrl: $('#seo-canonical').value,
      keywords: $('#seo-keywords').value.split(',').map(x => x.trim()).filter(Boolean)
    },
    revisionNote: $('#revision-note').value,
    featured: $('#featured').checked,
    status: chosenStatus
  };
}

// Real-time duplicate detection
async function checkDuplicateNow(showCleanNotice = false) {
  const title = $('#title')?.value.trim() || '';
  const slug = $('#slug')?.value.trim() || '';
  const sourceUrl = $('#source-url')?.value.trim() || '';
  const excludeId = $('#article-id')?.value || '';
  const banner = $('#duplicate-warning-banner');
  if (!banner) return;

  if (!title && !slug && !sourceUrl) {
    banner.hidden = true;
    return;
  }

  try {
    const res = await api('/api/admin/articles/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ title, slug, sourceUrl, excludeId })
    });
    if (res.hasDuplicates && res.matches.length) {
      banner.hidden = false;
      banner.innerHTML = `
        <strong>⚠ DUPLICATE DETECTED (${res.matches.length}):</strong>
        <ul>
          ${res.matches.map(m => `<li><strong>${esc(m.title)}</strong> [${esc(m.status)}] — <em>${esc(m.reason)}</em></li>`).join('')}
        </ul>
      `;
    } else if (showCleanNotice) {
      banner.hidden = false;
      banner.innerHTML = `<strong>✓ No duplicate headline, slug, or primary source URL found.</strong>`;
    } else {
      banner.hidden = true;
    }
  } catch {
    banner.hidden = true;
  }
}

$('#title')?.addEventListener('blur', () => checkDuplicateNow(false));
$('#source-url')?.addEventListener('blur', () => checkDuplicateNow(false));
$('#check-duplicate-btn')?.addEventListener('click', () => checkDuplicateNow(true));

// Pre-Publish Article Preview Modal
$('#preview-article-btn')?.addEventListener('click', () => {
  const data = formData();
  const modal = $('#preview-modal');
  const body = $('#preview-modal-body');
  if (!modal || !body) return;

  const specsEntries = Object.entries(data.specs || {});
  const paragraphs = esc(data.body || 'No body content entered yet.').split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  body.innerHTML = `
    <div class="preview-meta-strip">
      <span class="status-pill status-${esc(data.status)}">Status: ${esc(data.status)}</span>
      <span>Category: <strong>${esc(data.category)}</strong></span>
      <span>OEM: <strong>${esc(data.manufacturer || 'Not specified')}</strong></span>
      <span>Model: <strong>${esc(data.model || 'N/A')}</strong></span>
      <span>Market: <strong>${esc(data.country || 'Global')} (${esc(data.region || 'Global')})</strong></span>
      ${data.scheduledAt ? `<span>Scheduled: <strong>${new Date(data.scheduledAt).toLocaleString()}</strong></span>` : ''}
    </div>
    <h3>${esc(data.title || 'Untitled Draft')}</h3>
    <p class="lead">${esc(data.summary || 'No summary entered yet.')}</p>
    <p><small>By <strong>${esc(data.author || 'Editorial Desk')}</strong> · Primary Source Evidence: ${data.sourceUrl ? `<a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener">${esc(data.sourceUrl)} ↗</a>` : '<strong style="color:#B42318;">Missing Primary Source URL</strong>'}</small></p>
    ${data.image ? `<figure style="margin:12px 0;"><img src="${esc(data.image)}" alt="${esc(data.title)}" style="max-height:280px;width:100%;object-fit:cover;border-radius:8px;"><figcaption><small>Credit: ${esc(data.imageCredit || 'Missing image credit')}</small></figcaption></figure>` : ''}
    ${specsEntries.length ? `<dl class="mini-spec-list">${specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <div class="preview-body-copy">${paragraphs}</div>
  `;
  modal.hidden = false;
});

$('#close-preview-btn')?.addEventListener('click', () => {
  $('#preview-modal').hidden = true;
});

function renderStories() {
  const published = articles.filter(a => a.status === 'published').length;
  $('#stat-total').textContent = articles.length;
  $('#stat-published').textContent = published;
  $('#stat-drafts').textContent = articles.filter(a => a.status !== 'published').length;
  if ($('#stat-oems')) {
    const mCount = (catalog.manufacturers || []).filter(m => !['all-manufacturers', 'various'].includes(m.slug)).length;
    const modCount = (catalog.equipmentModels || []).length;
    $('#stat-oems').textContent = `${mCount} / ${modCount}`;
  }
  if ($('#stat-sources')) $('#stat-sources').textContent = (catalog.sources || []).length;
  if ($('#stat-subscribers')) $('#stat-subscribers').textContent = subscribers.length;
  if ($('#stat-tips')) $('#stat-tips').textContent = submissions.length;

  const q = ($('#admin-search')?.value || '').trim().toLowerCase();
  const statusFilter = $('#admin-status-filter')?.value || '';

  const filtered = articles.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (q && ![a.title, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, a.sourceUrl].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  $('#admin-story-list').innerHTML = filtered.length
    ? filtered.map(a => {
      const hasSource = Boolean(a.sourceUrl || (a.sourceUrls && a.sourceUrls.length));
      const updatedStr = a.updatedAt ? new Date(a.updatedAt).toLocaleString() : 'N/A';
      const schedStr = a.scheduledAt ? ` · ⏰ Scheduled: ${new Date(a.scheduledAt).toLocaleString()}` : '';
      return `<div class="admin-story">
        <div>
          <div class="story-badges-line">
            <span class="status-pill status-${esc(a.status)}">${esc(a.status)}</span>
            <span class="status-pill status-draft">Stage: ${esc(a.pipelineStage || a.status.toUpperCase())}</span>
            ${a.featured ? '<span class="status-pill status-featured">Featured</span>' : ''}
            <span class="source-evidence-pill ${hasSource ? 'evidence-ok' : 'evidence-missing'}">
              ${hasSource ? '✓ Source Verified' : '⚠ Missing Source URL'}
            </span>
          </div>
          <strong>${esc(a.title)}</strong>
          <small>
            ${esc(a.manufacturer || 'Various')} · ${esc(a.category)} · ${esc(a.country || 'Global')}
            · Last Update: ${esc(updatedStr)}${esc(schedStr)} · Revisions: ${(a.updateHistory || []).length}
          </small>
          ${a.sourceUrl ? `<small style="display:block;"><a class="inline-link" href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">Source Evidence: ${esc(a.sourceUrl)} ↗</a></small>` : ''}
          ${a.publicationRecord ? `<small style="display:block;color:#0F5132;"><strong>Publication Record:</strong> [${esc(a.publicationRecord.publicationMode)}] ${esc(a.publicationRecord.whyPublishedOrChanged)}</small>` : ''}
        </div>
        <div class="story-actions">
          ${a.status === 'published' ? `<a class="story-link-btn" href="/news/${encodeURIComponent(a.slug)}" target="_blank">View ↗</a>` : ''}
          <button data-edit="${esc(a.id)}" type="button">Edit</button>
          ${a.status === 'review' || a.status === 'draft' ? `<button data-wf-transition="approve" data-id="${esc(a.id)}" type="button" title="Approve after verification">Approve ✓</button>` : ''}
          ${a.status !== 'published' ? `<button data-wf-transition="publish_now" data-id="${esc(a.id)}" type="button" title="Publish now">Publish</button>` : ''}
          ${a.status === 'published' || a.status === 'scheduled' ? `<button data-wf-transition="rollback" data-id="${esc(a.id)}" type="button" title="Rollback / Unpublish to Review Queue">Rollback / Unpublish ↩</button>` : ''}
          ${a.status !== 'review' && a.status !== 'published' ? `<button data-quick-status="review" data-id="${esc(a.id)}" type="button">Review</button>` : ''}
          ${a.status !== 'rejected' ? `<button data-quick-status="rejected" data-id="${esc(a.id)}" type="button">Reject</button>` : ''}
          ${a.status !== 'archived' ? `<button data-quick-status="archived" data-id="${esc(a.id)}" type="button">Archive</button>` : ''}
          <button data-delete="${esc(a.id)}" type="button">Delete</button>
        </div>
      </div>`;
    }).join('')
    : '<p class="muted">No matching stories.</p>';
}

function renderCatalogScreens() {
  // Datalists for Article Editor
  const mfgList = $('#manufacturer-datalist');
  if (mfgList && Array.isArray(catalog.manufacturers)) {
    mfgList.innerHTML = catalog.manufacturers.map(m => `<option value="${esc(m.name)}">`).join('');
  }
  const ctyList = $('#country-datalist');
  if (ctyList && Array.isArray(catalog.countries)) {
    ctyList.innerHTML = catalog.countries.map(c => `<option value="${esc(c.name)}">`).join('');
  }
  const autList = $('#author-datalist');
  if (autList && Array.isArray(catalog.authors)) {
    autList.innerHTML = catalog.authors.map(a => `<option value="${esc(a.name)}">`).join('');
  }

  // Screen 1B: Authors list
  const autEl = $('#admin-authors-list');
  if (autEl) {
    const rows = catalog.authors || [];
    autEl.innerHTML = rows.length
      ? rows.map(a => `<div class="admin-story">
          <div><strong>${esc(a.name)}</strong><small>${esc(a.role || 'Editorial Desk')} ${a.email ? `· ${esc(a.email)}` : ''}</small></div>
          <div class="story-actions"><button type="button" data-del-entity="authors" data-key="${esc(a.slug)}">Remove</button></div>
        </div>`).join('')
      : '<p class="muted">No authors registered.</p>';
  }

  // Screen 2: Categories & Tags
  const catListEl = $('#admin-categories-list');
  if (catListEl) {
    const rows = catalog.categories || [];
    catListEl.innerHTML = rows.map(c => `<div class="admin-story">
      <div><strong>${esc(c.name)}</strong><small>Slug: /category/${esc(c.slug)} · Section: ${esc(c.section || 'industry')}</small><small style="display:block;">${esc(c.description || '')}</small></div>
      <div class="story-actions"><button type="button" data-del-entity="categories" data-key="${esc(c.slug)}">Delete</button></div>
    </div>`).join('');
  }

  const tagListEl = $('#admin-tags-list');
  if (tagListEl) {
    const rows = catalog.tags || [];
    tagListEl.innerHTML = rows.length
      ? rows.map(t => `<div class="admin-story">
          <div><strong>#${esc(t.name)}</strong><small>Slug: ${esc(t.slug)}</small></div>
          <div class="story-actions"><button type="button" data-del-entity="tags" data-key="${esc(t.slug)}">Delete</button></div>
        </div>`).join('')
      : '<p class="muted">No tags indexed yet.</p>';
  }

  // Screen 3: Manufacturers & Equipment Models
  const mfgsEl = $('#admin-mfgs-list');
  if (mfgsEl) {
    const rows = (catalog.manufacturers || []).filter(m => !['all-manufacturers', 'various'].includes(m.slug));
    mfgsEl.innerHTML = rows.map(m => `<div class="admin-story">
      <div>
        <strong>${esc(m.name)}</strong>
        <small>${esc(m.country || 'Global')} · HQ: ${esc(m.headquarters || 'Unconfirmed')} · <a class="inline-link" href="/manufacturers/${esc(m.slug)}" target="_blank">Profile ↗</a></small>
        <small style="display:block;">${esc(m.focus || '')}</small>
      </div>
      <div class="story-actions"><button type="button" data-del-entity="manufacturers" data-key="${esc(m.slug)}">Delete</button></div>
    </div>`).join('');
  }

  const modelsEl = $('#admin-models-list');
  if (modelsEl) {
    const rows = catalog.equipmentModels || [];
    modelsEl.innerHTML = rows.map(em => `<div class="admin-story">
      <div>
        <strong>${esc(em.manufacturer)} — ${esc(em.name)}</strong>
        <small>${esc(em.equipmentType)} (${esc(em.category || 'Equipment')}) · ${esc(em.powerType || 'Diesel')} · <a class="inline-link" href="/models/${esc(em.slug)}" target="_blank">Model Page ↗</a></small>
      </div>
      <div class="story-actions"><button type="button" data-del-entity="equipmentModels" data-key="${esc(em.slug)}">Delete</button></div>
    </div>`).join('');
  }

  // Screen 4: Regions & Countries
  const regsEl = $('#admin-regions-list');
  if (regsEl) {
    const rows = catalog.regions || [];
    regsEl.innerHTML = rows.map(r => `<div class="admin-story">
      <div><strong>${esc(r.name)}</strong><small>Slug: /${esc(r.slug)}/ · ${esc(r.description || '')}</small></div>
      <div class="story-actions"><button type="button" data-del-entity="regions" data-key="${esc(r.slug)}">Delete</button></div>
    </div>`).join('');
  }

  const ctysEl = $('#admin-countries-list');
  if (ctysEl) {
    const rows = catalog.countries || [];
    ctysEl.innerHTML = rows.map(c => `<div class="admin-story">
      <div><strong>${esc(c.name)} (${esc(c.isoCode || 'N/A')})</strong><small>Region: ${esc(c.region)}</small></div>
      <div class="story-actions"><button type="button" data-del-entity="countries" data-key="${esc(c.slug)}">Delete</button></div>
    </div>`).join('');
  }

  // Screen 5: Approved News Sources & Collected Queue
  const srcsEl = $('#admin-sources-list');
  if (srcsEl) {
    const rows = catalog.sources || [];
    srcsEl.innerHTML = rows.length
      ? rows.map(s => {
        const recentErr = (s.recentErrors && s.recentErrors[0]) ? s.recentErrors[0] : null;
        return `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill ${s.enabled !== false ? 'status-published' : 'status-archived'}">${s.enabled !== false ? 'Enabled' : 'Disabled'}</span>
              <span class="status-pill status-draft">${esc(s.sourceType || 'rss-feed')}</span>
              ${s.requiresApiKey ? `<span class="status-pill status-review">Key: ${esc(s.apiKeyEnvVar || 'API_KEY')}</span>` : '<span class="source-evidence-pill evidence-ok">No Key Required</span>'}
            </div>
            <strong>${esc(s.name || s.title || s.domain)}</strong>
            <small>
              OEM: ${esc(s.manufacturer || 'Various')} · Category: ${esc(s.category || 'Industry')} · Market: ${esc(s.country || 'Global')} (${esc(s.region || 'Global')}) · Poll: ${esc(s.pollingIntervalMinutes || 60)}m
            </small>
            <small style="display:block;">
              Website: <a class="inline-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)} ↗</a>
              ${s.feedUrl ? ` · Feed: <a class="inline-link" href="${esc(s.feedUrl)}" target="_blank" rel="noopener">${esc(s.feedUrl)} ↗</a>` : ''}
            </small>
            <small style="display:block;">
              Last Success: <strong>${s.lastSuccessAt ? new Date(s.lastSuccessAt).toLocaleString() : 'Not checked yet'}</strong>
              ${s.lastCheckedAt ? ` · Last Check: ${new Date(s.lastCheckedAt).toLocaleString()} (${s.lastItemCount || 0} items)` : ''}
            </small>
            ${recentErr ? `<small style="color:#B42318;display:block;">⚠ Recent Error (${new Date(recentErr.at).toLocaleTimeString()}): ${esc(recentErr.message)}</small>` : ''}
          </div>
          <div class="story-actions">
            <button type="button" data-check-source="${esc(s.id)}" data-mode="live">Check Source Now ↻</button>
            <button type="button" data-check-source="${esc(s.id)}" data-mode="test">Test Sample</button>
            <button type="button" data-del-entity="sources" data-key="${esc(s.id)}">Remove</button>
          </div>
        </div>`;
      }).join('')
      : '<p class="muted">No approved sources registered yet.</p>';
  }

  const colEl = $('#admin-collected-list');
  if (colEl) {
    colEl.innerHTML = collectedItems.length
      ? collectedItems.map(c => `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill ${c.reviewStatus === 'promoted_to_draft' ? 'status-published' : 'status-review'}">${esc(c.reviewStatus)}</span>
              <span class="status-pill status-draft">${esc(c.collectionMode)} mode</span>
              <span class="source-evidence-pill evidence-ok">FP: ${esc((c.titleFingerprint || '').slice(0, 8))}</span>
            </div>
            <strong>${esc(c.title)}</strong>
            <small>
              Source: <strong>${esc(c.sourceName)}</strong> · Published: ${c.publishedAt ? new Date(c.publishedAt).toLocaleString() : 'Unconfirmed'}
              · Retrieved: ${new Date(c.retrievedAt).toLocaleString()}
            </small>
            <p class="tip-body">${esc(c.excerpt)}</p>
            <small style="display:block;">
              Canonical URL: <a class="inline-link" href="${esc(c.canonicalUrl)}" target="_blank" rel="noopener">${esc(c.canonicalUrl)} ↗</a>
              · Evidence: HTTP ${esc(c.verificationEvidence?.httpStatus || 200)} · robots.txt respected: ${c.verificationEvidence?.robotsTxtRespected !== false ? 'Yes' : 'No'}
            </small>
          </div>
          <div class="story-actions">
            <button type="button" data-newsroom-analyze="${esc(c.id)}">AI Newsroom Analyze → Review Queue</button>
            ${c.reviewStatus !== 'promoted_to_draft' && c.reviewStatus !== 'in_review_queue' ? `<button type="button" data-promote-collected="${esc(c.id)}">Promote to Draft →</button>` : `<span class="muted">${c.reviewStatus === 'in_review_queue' ? 'In Review Queue' : 'Draft Created'}</span>`}
            ${c.promotedArticleId ? `<button type="button" data-open-review-article="${esc(c.promotedArticleId)}">Open in Editor ↗</button>` : ''}
            <button type="button" data-dismiss-collected="${esc(c.id)}">Dismiss</button>
          </div>
        </div>`).join('')
      : '<p class="muted">No collected dispatches in queue. Click "Check Source Now" on any approved source.</p>';
  }

  // Screen 6: Images & Image Credits
  const imgsEl = $('#admin-images-list');
  if (imgsEl) {
    const rows = catalog.images || [];
    imgsEl.innerHTML = rows.length
      ? rows.map(img => `<div class="admin-story">
          <div>
            <strong>${esc(img.alt || 'Editorial Image')}</strong>
            <small>Credit: <strong>${esc(img.credit)}</strong> · License: ${esc(img.license || 'Editorial Use')}</small>
            <small style="display:block;"><a class="inline-link" href="${esc(img.url)}" target="_blank" rel="noopener">${esc(img.url)} ↗</a></small>
          </div>
          <div class="story-actions"><button type="button" data-del-entity="images" data-key="${esc(img.id)}">Remove</button></div>
        </div>`).join('')
      : '<p class="muted">No images registered yet.</p>';
  }

  // Screen 8: Catalog Summary & Backups
  const catEl = $('#admin-catalog-summary');
  if (catEl && catalog.manufacturers) {
    const items = [
      ['Manufacturers', catalog.manufacturers.length],
      ['Equipment Models', (catalog.equipmentModels || []).length],
      ['Categories', (catalog.categories || []).length],
      ['Countries & Regions', `${(catalog.countries || []).length} / ${(catalog.regions || []).length}`],
      ['Approved Sources', (catalog.sources || []).length],
      ['Tags & Media', `${(catalog.tags || []).length} / ${(catalog.images || []).length}`]
    ];
    catEl.innerHTML = items.map(([label, val]) => `<div class="catalog-stat-card"><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`).join('');
  }

  const bkpEl = $('#admin-backups-list');
  if (bkpEl) {
    bkpEl.innerHTML = backups.length
      ? backups.slice(0, 6).map(b => `<div class="admin-story"><div><strong>${esc(b.id)}</strong><small>${esc(b.reason)} · ${new Date(b.createdAt).toLocaleString()} (${Math.round((b.sizeBytes || 0) / 1024)} KB)</small></div></div>`).join('')
      : '<p class="muted">No backup snapshots yet. Click "Backup Snapshot" above before bulk changes.</p>';
  }

  // Screen 9: Admin Users
  const usrsEl = $('#admin-users-list');
  if (usrsEl) {
    const rows = catalog.adminUsers || [];
    usrsEl.innerHTML = rows.map(u => `<div class="admin-story">
      <div>
        <span class="status-pill status-published">${esc(u.role)}</span>
        <strong>${esc(u.username)}</strong>
        <small>${esc(u.email)} · Last Login: ${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</small>
      </div>
      <div class="story-actions">
        ${u.username !== 'editorial-admin' ? `<button type="button" data-del-entity="adminUsers" data-key="${esc(u.username)}">Remove</button>` : ''}
      </div>
    </div>`).join('');
  }
}

function renderJobsAndLogs() {
  const jobsEl = $('#admin-jobs-list');
  if (jobsEl) {
    const jobs = logsData.jobs || [];
    jobsEl.innerHTML = jobs.map(j => `<div class="admin-story">
      <div>
        <span class="status-pill ${j.lastStatus === 'healthy' ? 'status-published' : 'status-review'}">${esc(j.lastStatus)}</span>
        <strong>${esc(j.name)}</strong>
        <small>Target: ${esc(j.target)} · Last Run: ${j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : 'Never'} · Processed: ${j.itemsProcessed || 0}</small>
        <small style="display:block;">${esc(j.description)}</small>
        ${j.lastError ? `<small style="color:#B42318;display:block;">⚠ Warning/Error: ${esc(j.lastError)}</small>` : ''}
      </div>
      <div class="story-actions">
        <button type="button" data-run-job="${esc(j.id)}">Run Job ↻</button>
      </div>
    </div>`).join('');
  }

  const warnEl = $('#admin-warnings-list');
  if (warnEl) {
    const warns = logsData.validationWarnings || [];
    warnEl.innerHTML = warns.length
      ? warns.map(w => `<div class="admin-story">
          <div>
            <span class="status-pill status-rejected">Validation Warning</span>
            <strong>${esc(w.title)}</strong>
            <small>${esc(w.issue)} (${esc(w.slug)})</small>
          </div>
        </div>`).join('')
      : '<p class="muted">✓ Zero validation warnings across published articles.</p>';
  }

  const auditEl = $('#admin-audit-list');
  if (auditEl) {
    const logs = logsData.auditLogs || [];
    auditEl.innerHTML = logs.length
      ? logs.slice(0, 40).map(l => `<div class="admin-story">
          <div>
            <span class="status-pill ${l.level === 'warn' || l.level === 'error' ? 'status-rejected' : 'status-draft'}">${esc(l.action)}</span>
            <strong>${esc(l.target || 'system')}</strong>
            <small>By <strong>${esc(l.actor)}</strong> (${esc(l.role)}) · ${new Date(l.at).toLocaleString()}</small>
            <small style="display:block;">${esc(l.details)}</small>
          </div>
        </div>`).join('')
      : '<p class="muted">No audit events recorded yet.</p>';
  }
}

function renderSettingsForm() {
  if (!siteSettings || !$('#set-site-name')) return;
  $('#set-site-name').value = siteSettings.siteName || 'MACHINEWIRE';
  $('#set-tagline').value = siteSettings.tagline || 'THE WORLD OF MACHINES. CONNECTED.';
  $('#set-meta-title').value = siteSettings.defaultMetaTitle || '';
  $('#set-meta-desc').value = siteSettings.defaultMetaDescription || '';
  $('#set-canonical').value = siteSettings.canonicalBaseUrl || '';
  $('#set-contact-email').value = siteSettings.editorialContactEmail || '';
  if ($('#set-ga-id')) $('#set-ga-id').value = siteSettings.gaMeasurementId || '';
  if ($('#set-plausible-domain')) $('#set-plausible-domain').value = siteSettings.plausibleDomain || '';
  if ($('#set-gsc-code')) $('#set-gsc-code').value = siteSettings.gscVerificationCode || '';
  if ($('#set-gsc-url')) $('#set-gsc-url').value = siteSettings.gscPropertyUrl || '';
  $('#set-require-source').checked = siteSettings.requireSourceForPublish !== false;

  const summaryEl = $('#admin-seo-analytics-summary');
  const prioEl = $('#admin-content-priority-list');
  if (!seoAnalyticsData) return;

  const p = seoAnalyticsData.prioritization || {};
  const tot = p.totals || {};
  const cfg = seoAnalyticsData.config || {};

  if (summaryEl) {
    const topCats = (p.popularCategories || []).slice(0, 3).map(x => `${x.key} (${x.count})`).join(', ') || 'None yet';
    const topRegs = (p.countryRegionInterest || []).slice(0, 3).map(x => `${x.key} (${x.count})`).join(', ') || 'None yet';
    const topSearch = (p.topSearchQueries || []).slice(0, 3).map(x => `"${x.key}" (${x.count})`).join(', ') || 'None yet';
    summaryEl.innerHTML = `
      <div class="catalog-stat-card"><small>Article Views</small><strong>${esc(tot.totalArticleViews ?? 0)}</strong></div>
      <div class="catalog-stat-card"><small>Category Views</small><strong>${esc(tot.totalCategoryViews ?? 0)}</strong></div>
      <div class="catalog-stat-card"><small>Region Views</small><strong>${esc(tot.totalRegionViews ?? 0)}</strong></div>
      <div class="catalog-stat-card"><small>Newsletter Conversions</small><strong>${esc(tot.newsletterConversions ?? 0)}</strong></div>
      <div class="catalog-stat-card"><small>Share / Source Clicks</small><strong>${esc((tot.shareClicks ?? 0) + (tot.sourceLinkClicks ?? 0))}</strong></div>
      <div class="catalog-stat-card"><small>GA4 / GSC Status</small><strong>${cfg.googleAnalytics?.enabled || cfg.googleSearchConsole?.enabled ? 'Configured' : 'Internal Telemetry'}</strong></div>
      <div class="catalog-stat-card" style="grid-column:span 2;"><small>Top Categories</small><strong style="font-size:13px;">${esc(topCats)}</strong></div>
      <div class="catalog-stat-card" style="grid-column:span 2;"><small>Top Regions</small><strong style="font-size:13px;">${esc(topRegs)}</strong></div>
      <div class="catalog-stat-card" style="grid-column:span 2;"><small>Top Search Queries</small><strong style="font-size:13px;">${esc(topSearch)}</strong></div>
    `;
  }

  if (prioEl) {
    const list = p.prioritizedArticles || [];
    prioEl.innerHTML = list.length
      ? list.slice(0, 12).map((item, idx) => `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill status-published">Priority #${idx + 1} (Score: ${esc(item.priorityScore)})</span>
              <span class="status-pill status-draft">${esc(item.articleType)}</span>
              <span class="source-evidence-pill evidence-ok">Source Score: ${esc(item.breakdown?.sourceQualityScore ?? 0)}</span>
              <span class="source-evidence-pill evidence-ok">Views: ${esc(item.views ?? 0)}</span>
            </div>
            <strong><a class="inline-link" href="/news/${encodeURIComponent(item.slug)}" target="_blank">${esc(item.title)} ↗</a></strong>
            <small>${esc(item.manufacturer)} · ${esc(item.category)} · ${esc(item.country)} (${esc(item.region)})</small>
            <small style="display:block;margin-top:4px;"><strong>Prioritization Rationale:</strong> ${esc(item.recommendationReason)}</small>
          </div>
        </div>`).join('')
      : '<p class="muted">No published articles available for prioritization.</p>';
  }
}

function renderNewsroomPanel() {
  const badgeEl = $('#newsroom-mode-badge');
  const cfgEl = $('#newsroom-config-summary');
  const dosEl = $('#newsroom-dossier-output');
  if (!newsroomConfig) return;

  if (badgeEl) {
    badgeEl.innerHTML = newsroomConfig.keyConfigured
      ? `<i></i> External AI Configured (${esc(newsroomConfig.provider)} · ${esc(newsroomConfig.model)})`
      : `<i></i> Deterministic Local Specialist Mode (No API Key Required · $0.00 Cost)`;
  }

  if (cfgEl) {
    const rolesHtml = (newsroomConfig.specialistRoles || []).map(r => `<div class="admin-story">
      <div>
        <span class="status-pill status-published">${esc(r.id)}</span>
        <strong>${esc(r.name)}</strong>
        <small style="display:block;">${esc(r.responsibility)}</small>
      </div>
    </div>`).join('');

    const disc = newsroomConfig.costAndLimitationsDisclosure || {};
    cfgEl.innerHTML = `
      <div class="admin-story">
        <div>
          <span class="status-pill ${newsroomConfig.keyConfigured ? 'status-published' : 'status-review'}">${newsroomConfig.keyConfigured ? 'External API Key Set' : 'Offline Fallback Active'}</span>
          <strong>Provider Mode: ${esc(newsroomConfig.activeMode)}</strong>
          <small style="display:block;margin-top:4px;"><strong>Cost Disclosure:</strong> ${esc(disc.apiCostNotice || '')}</small>
          <small style="display:block;margin-top:4px;color:#B42318;"><strong>Limitation Warning:</strong> ${esc(disc.accuracyWarning || '')}</small>
        </div>
      </div>
      ${rolesHtml}
    `;
  }

  if (dosEl && latestNewsroomRun && latestNewsroomRun.steps) {
    const s = latestNewsroomRun.steps;
    const s1 = s.step1_sourceAnalysis || {};
    const s2 = s.step2_extractedEntitiesAndFacts || {};
    const s3 = s.step3_duplicatesAndRelated || {};
    const s4 = s.step4_missingAndRiskAnalysis || {};
    const s6 = s.step6_suggestionsAndSeo || {};
    const s7 = s.step7_qualityChecks || {};
    const s8 = s.step8_reviewQueueRouting || {};

    const risksHtml = (s4.highRiskClaims || []).length
      ? s4.highRiskClaims.map(r => `<li><strong style="color:#B42318;">[${esc(r.riskType)}]</strong> ${esc(r.excerpt)} — <em>${esc(r.instruction)}</em></li>`).join('')
      : '<li>Zero high-risk numerical or quote claims detected in excerpt.</li>';

    const missingHtml = (s4.missingInformation || []).map(m => `<li>${esc(m)}</li>`).join('');
    const factsHtml = (s2.supportedFacts || []).map(f => `<li>${esc(f.statement)} <small>(Source: ${esc(f.sourceName)})</small></li>`).join('');
    const linksHtml = (s6.internalLinks || []).map(l => `<a class="inline-link" href="${esc(l.url)}" target="_blank">${esc(l.anchorText)} (${esc(l.url)})</a>`).join(' · ');

    dosEl.innerHTML = `
      <div class="admin-story">
        <div>
          <div class="story-badges-line">
            <span class="status-pill status-review">Step 8: Routed to Review Queue (${esc(s8.status || 'review')})</span>
            <span class="status-pill status-draft">Type: ${esc(s1.articleType || 'news')}</span>
            <span class="source-evidence-pill evidence-ok">Source Check: ${esc(s7.sourceCheck?.score || 0)}%</span>
            <span class="source-evidence-pill evidence-ok">Factual Check: ${esc(s7.factualCheck?.score || 0)}%</span>
            <span class="source-evidence-pill evidence-ok">Originality: ${esc(s7.originalityCheck?.score || 0)}%</span>
          </div>
          <strong>Suggested Headline: ${esc(s6.suggestedHeadline || '')}</strong>
          <small style="display:block;color:#B42318;font-weight:600;margin-top:4px;">⚠ ${esc(s4.aiAgreementDisclaimer || 'AI agreement is not proof of accuracy.')}</small>
          <p class="tip-body" style="margin-top:6px;"><strong>Suggested Summary:</strong> ${esc(s6.summary || '')}</p>
          <small style="display:block;margin-top:6px;">
            <strong>Step 2 Entities:</strong> OEM: <strong>${esc(s2.manufacturer)}</strong> · Model: <strong>${esc(s2.model || 'Unconfirmed')}</strong> · Category: <strong>${esc(s2.category)}</strong> · Market: <strong>${esc(s2.country)} (${esc(s2.region)})</strong>
          </small>
          <small style="display:block;margin-top:4px;">
            <strong>Extracted Dates:</strong> ${esc((s2.extractedDates || []).join(' | ') || 'None in excerpt')}
          </small>
          <small style="display:block;margin-top:6px;"><strong>Step 2 Supported Facts:</strong></small>
          <ul style="margin:4px 0 8px 18px;font-size:13px;">${factsHtml}</ul>
          <small style="display:block;margin-top:6px;"><strong>Step 3 Duplicate &amp; Related Check:</strong> ${s3.hasExactDuplicate ? `<span style="color:#B42318;">${s3.duplicateArticles.length} exact duplicate(s) flagged</span>` : 'No exact duplicate article'} · ${(s3.relatedArticles || []).length} related story match(es).</small>
          <small style="display:block;margin-top:6px;"><strong>Step 4 High-Risk Claims Flagged for Human Verification:</strong></small>
          <ul style="margin:4px 0 8px 18px;font-size:13px;">${risksHtml}</ul>
          <small style="display:block;margin-top:6px;"><strong>Step 4 Missing / Unverified Details:</strong></small>
          <ul style="margin:4px 0 8px 18px;font-size:13px;">${missingHtml}</ul>
          <small style="display:block;margin-top:6px;"><strong>Step 6 Internal Links Suggested:</strong> ${linksHtml}</small>
          <small style="display:block;margin-top:6px;"><strong>Step 7 Quality Checks:</strong> Source: ${esc(s7.sourceCheck?.details)} | Factual: ${esc(s7.factualCheck?.details)} | Grammar: ${esc(s7.grammarCheck?.details)}</small>
        </div>
        <div class="story-actions">
          ${latestNewsroomRun.reviewArticleId ? `<button type="button" data-open-review-article="${esc(latestNewsroomRun.reviewArticleId)}">Inspect &amp; Edit Review Draft →</button>` : ''}
        </div>
      </div>
    `;
  }
}

function renderWorkflowPipeline() {
  if (!workflowSummary) return;
  const stageBarEl = $('#pipeline-stage-bar');
  if (stageBarEl && workflowSummary.stageCounts) {
    const sc = workflowSummary.stageCounts;
    const stages = workflowSummary.stages || ['DISCOVERED', 'COLLECTED', 'DEDUPLICATED', 'DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
    stageBarEl.innerHTML = stages.map(stg => `<div class="catalog-stat-card">
      <small>${esc(stg)}</small>
      <strong>${esc(sc[stg] ?? 0)}</strong>
    </div>`).join('');
  }

  const cfg = workflowSummary.config || {};
  if ($('#wf-sched-interval')) $('#wf-sched-interval').value = cfg.schedulerIntervalSeconds || 60;
  if ($('#wf-max-retries')) $('#wf-max-retries').value = cfg.maxJobRetries || 3;
  if ($('#wf-auto-publish-toggle')) $('#wf-auto-publish-toggle').checked = Boolean(cfg.autoPublishEnabled);

  const rulesEl = $('#wf-rules-tested-summary');
  if (rulesEl) {
    const rt = cfg.rulesTestedStatus || {};
    const allTested = rt.sourceRuleTested && rt.factualEvidenceRuleTested && rt.originalityRuleTested && rt.imageRightsRuleTested && rt.qualityRuleTested;
    rulesEl.innerHTML = allTested
      ? `<span class="source-evidence-pill evidence-ok">✓ All 5 Gates Tested (${new Date(rt.allRulesVerifiedAt).toLocaleString()} by ${esc(rt.verifiedBy || 'admin')})</span>`
      : `<span class="source-evidence-pill evidence-missing">⚠ Gates Not Tested Yet — Automatic publication is locked in disabled mode until the 5-Gate Verification Suite is executed.</span>`;
  }

  const alertsEl = $('#admin-failure-alerts-list');
  if (alertsEl) {
    const alerts = workflowSummary.failureAlerts || [];
    alertsEl.innerHTML = alerts.length
      ? alerts.map(a => `<div class="admin-story">
          <div>
            <span class="status-pill ${a.acknowledged ? 'status-archived' : 'status-rejected'}">${a.acknowledged ? 'Acknowledged' : esc(a.severity)}</span>
            <strong>${esc(a.title)}</strong>
            <small>Job: ${esc(a.jobId)} · Attempts: ${esc(a.attempts)} · ${new Date(a.createdAt).toLocaleString()}</small>
            <small style="display:block;color:#B42318;">${esc(a.message)}</small>
          </div>
          <div class="story-actions">
            ${!a.acknowledged ? `<button type="button" data-ack-alert="${esc(a.id)}">Acknowledge</button>` : ''}
          </div>
        </div>`).join('')
      : '<p class="muted">✓ Zero job failure alerts.</p>';
  }

  const ledgerEl = $('#admin-publication-ledger-list');
  if (ledgerEl) {
    const ledger = workflowSummary.publicationLedger || [];
    ledgerEl.innerHTML = ledger.length
      ? ledger.slice(0, 20).map(l => `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill status-${esc(l.status || 'published')}">${esc(l.pipelineStage)}</span>
              <span class="status-pill status-draft">${esc(l.publicationMode)}</span>
            </div>
            <strong>${esc(l.title)}</strong>
            <small>By <strong>${esc(l.actor)}</strong> (${esc(l.role)}) · ${new Date(l.at).toLocaleString()}</small>
            <small style="display:block;margin-top:4px;"><strong>Why:</strong> ${esc(l.whyPublishedOrChanged)}</small>
            ${l.sourceUrl ? `<small style="display:block;">Source: <a class="inline-link" href="${esc(l.sourceUrl)}" target="_blank" rel="noopener">${esc(l.sourceUrl)} ↗</a></small>` : ''}
          </div>
        </div>`).join('')
      : '<p class="muted">No publication or rollback ledger entries recorded yet.</p>';
  }
}

function renderAiOperationsPanel() {
  if (!aiOperationsData) return;
  const d = aiOperationsData;

  // 1. KPI Stats
  const statSrc = $('#ai-stat-sources');
  const statDisc = $('#ai-stat-discovered');
  const statDrafts = $('#ai-stat-drafts');
  const statPub = $('#ai-stat-published');
  const statTasks = $('#ai-stat-tasks');
  const statHealth = $('#ai-stat-health');
  const statCost = $('#ai-stat-cost');

  const src = d.sourcesMonitoring || {};
  const pipe = d.contentPipeline || {};
  const tq = d.seoTaskQueue || {};
  const audit = d.technicalSeoAudit || {};
  const ai = d.aiProvider || {};

  if (statSrc) statSrc.textContent = `${src.activeMonitored || 0} / ${src.totalRegistered || 0}`;
  if (statDisc) statDisc.textContent = `${pipe.discoveredFeedItems || 0} (${pipe.duplicatesFiltered || 0} dupes)`;
  if (statDrafts) statDrafts.textContent = String(pipe.inReviewQueue || 0);
  if (statPub) statPub.textContent = String(pipe.livePublished || 0);
  if (statTasks) statTasks.textContent = `${tq.pendingCount || 0} / ${tq.totalTasks || 0}`;
  if (statHealth) statHealth.textContent = `${audit.overallHealthScore ?? 100}/100`;
  if (statCost) statCost.textContent = `${ai.estimatedCostUsd || '$0.00'} (${esc(ai.activeMode ? 'active' : 'local')})`;

  // 2. 10 Coordinated Specialist Roles Grid
  const rolesGrid = $('#ai-specialist-roles-grid');
  if (rolesGrid && Array.isArray(d.coordinatedRoles)) {
    rolesGrid.innerHTML = d.coordinatedRoles.map(r => `
      <div class="catalog-stat-card">
        <span class="status-pill status-published" style="margin-bottom:6px;display:inline-block;">${esc(r.id)}</span>
        <strong style="font-size:14px;">${esc(r.name)}</strong>
        <small style="display:block;margin-top:6px;line-height:1.4;">${esc(r.mission)}</small>
        <small style="display:block;margin-top:6px;color:var(--text-light,#666);">Output: <em>${esc(r.output)}</em></small>
      </div>
    `).join('');
  }

  // 3. Technical SEO Audit Summary
  const auditBox = $('#tech-audit-summary-box');
  const auditBadge = $('#audit-status-badge');
  const auditIssues = $('#tech-audit-issues-list');
  const score = audit.overallHealthScore ?? 100;
  if (auditBadge) {
    auditBadge.className = `badge ${score >= 90 ? 'badge-published' : (score >= 70 ? 'badge-review' : 'badge-rejected')}`;
    auditBadge.textContent = `Score: ${score}/100`;
  }
  if (auditBox) {
    const stats = audit.stats || {};
    auditBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:0.9rem;">
        <div><strong>Total Articles Audited:</strong> ${stats.totalArticles ?? 0}</div>
        <div><strong>Published / Indexed:</strong> ${stats.publishedArticles ?? 0} / ${stats.indexedArticles ?? 0}</div>
        <div><strong>Manufacturers / Models:</strong> ${stats.manufacturersCount ?? 0} / ${stats.equipmentModelsCount ?? 0}</div>
        <div><strong>Monitored Sources:</strong> ${stats.sourcesCount ?? 0}</div>
      </div>
    `;
  }
  if (auditIssues) {
    const issues = audit.issuesFound || [];
    auditIssues.innerHTML = issues.length
      ? issues.map(iss => `
        <div class="admin-story">
          <div>
            <span class="status-pill ${iss.severity === 'high' ? 'status-rejected' : 'status-review'}">${esc(iss.severity)}</span>
            <strong>${esc(iss.check)}</strong>
            <small style="display:block;margin-top:2px;">${esc(iss.details)}</small>
            <small style="display:block;color:var(--text-light,#666);margin-top:4px;">Action: ${esc(iss.recommendedFix)}</small>
          </div>
        </div>
      `).join('')
      : '<p class="muted">✓ Zero technical SEO blockers detected across canonical routes, meta tags, and feeds.</p>';
  }

  // 4. Real Search Telemetry Box
  const teleBox = $('#search-telemetry-box');
  if (teleBox && d.searchPerformanceData) {
    const sp = d.searchPerformanceData;
    const fpt = sp.firstPartyTelemetry || {};
    teleBox.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;font-size:0.88rem;">
        <div><strong>Search Console:</strong> <span class="status-pill ${sp.googleSearchConsoleConnected ? 'status-published' : 'status-review'}">${esc(sp.statusLabel)}</span></div>
        <small class="muted">${esc(sp.message)}</small>
        <div style="margin-top:6px;border-top:1px solid var(--border,#eee);padding-top:6px;">
          <strong>Internal Engine Telemetry:</strong>
          <div>Measured Article Reads: <strong>${fpt.totalArticleViews ?? 0}</strong></div>
          <div>Audience Region Views: <strong>${fpt.totalRegionViews ?? 0}</strong></div>
          <div>Category Navigation Views: <strong>${fpt.totalCategoryViews ?? 0}</strong></div>
        </div>
      </div>
    `;
  }

  // Content Pipeline Health Box
  const pipeBox = $('#content-pipeline-health-box');
  if (pipeBox) {
    pipeBox.innerHTML = `
      <div class="admin-story" style="margin-top:8px;">
        <div>
          <div class="story-badges-line">
            <span class="status-pill status-published">Active Monitored Sources: ${src.activeMonitored || 0}</span>
            <span class="status-pill status-draft">5 Quality Gates Enforced</span>
          </div>
          <small style="display:block;margin-top:4px;">Collected Dispatches: <strong>${pipe.discoveredFeedItems || 0}</strong> · Duplicates Prevented: <strong>${pipe.duplicatesFiltered || 0}</strong></small>
          <small style="display:block;">Editorial Review Queue: <strong>${pipe.inReviewQueue || 0}</strong> · Published Catalog: <strong>${pipe.livePublished || 0}</strong></small>
        </div>
      </div>
    `;
  }

  // 5. 90-Day Roadmap Render
  const roadmapContainer = $('#roadmap-phases-container');
  if (roadmapContainer && Array.isArray(d.roadmap90Day)) {
    roadmapContainer.innerHTML = d.roadmap90Day.map(phase => `
      <div class="admin-panel" style="background:#fff;border:1px solid var(--border,#e1e4e8);padding:14px;border-radius:4px;">
        <span class="status-pill status-published">${esc(phase.phase)}</span>
        <h4 style="margin:8px 0 6px 0;">${esc(phase.title)}</h4>
        <p class="muted" style="font-size:0.85rem;margin-bottom:10px;">${esc(phase.focus)}</p>
        <ul style="padding-left:18px;font-size:0.85rem;line-height:1.45;margin-bottom:10px;">
          ${(phase.keyDeliverables || []).map(del => `<li>${esc(del)}</li>`).join('')}
        </ul>
        <div style="font-size:0.8rem;border-top:1px solid var(--border,#eee);padding-top:6px;color:var(--text-light,#555);">
          <strong>KPI Metric:</strong> ${esc(phase.successMetric)}
        </div>
      </div>
    `).join('');
  }

  // 6. Interactive Task Queue Table
  renderSeoTasksTable();
}

  // 5. 90-Day Roadmap Render
  const roadmapContainer = $('#roadmap-phases-container');
  if (roadmapContainer && Array.isArray(d.ninetyDayExecutionRoadmap)) {
    roadmapContainer.innerHTML = d.ninetyDayExecutionRoadmap.map(phase => `
      <div class="admin-panel" style="background:#fff;border:1px solid var(--border,#e1e4e8);padding:14px;border-radius:4px;">
        <span class="status-pill status-published">${esc(phase.phase)}</span>
        <h4 style="margin:8px 0 6px 0;">${esc(phase.title)}</h4>
        <p class="muted" style="font-size:0.85rem;margin-bottom:10px;">${esc(phase.focus)}</p>
        <ul style="padding-left:18px;font-size:0.85rem;line-height:1.45;margin-bottom:10px;">
          ${(phase.keyDeliverables || []).map(del => `<li>${esc(del)}</li>`).join('')}
        </ul>
        <div style="font-size:0.8rem;border-top:1px solid var(--border,#eee);padding-top:6px;color:var(--text-light,#555);">
          <strong>KPI Metric:</strong> ${esc(phase.successMetric)}
        </div>
      </div>
    `).join('');
  }

  // 6. Interactive Task Queue Table
  renderSeoTasksTable();
}

function renderSeoTasksTable() {
  const container = $('#ai-seo-tasks-table');
  if (!container) return;

  const roleFilter = $('#task-filter-role')?.value || '';
  const statusFilter = $('#task-filter-status')?.value || '';

  let list = Array.isArray(aiSeoTasks) ? aiSeoTasks : [];
  if (roleFilter) list = list.filter(t => t.assignedRole === roleFilter);
  if (statusFilter) list = list.filter(t => t.status === statusFilter);

  if (!list.length) {
    container.innerHTML = '<p class="muted">No SEO tasks matching current filters.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-story-list">
      ${list.map(t => `
        <div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill ${t.status === 'completed' ? 'status-published' : (t.status === 'rejected' ? 'status-rejected' : (t.status === 'in_progress' ? 'status-review' : 'status-draft'))}">${esc(t.status)}</span>
              <span class="status-pill status-published">Priority: ${esc(t.priorityScore)}/100</span>
              <span class="status-pill status-draft">Role: ${esc(t.assignedRole)}</span>
              <span class="status-pill status-draft">${esc(t.category)}</span>
            </div>
            <strong>${esc(t.title)}</strong>
            ${t.target ? `<small style="display:block;">Target: <code>${esc(t.target)}</code></small>` : ''}
            <small style="display:block;margin-top:4px;"><strong>Evidence / Rationale:</strong> ${esc(t.evidence || 'N/A')}</small>
            <small style="display:block;color:var(--accent,#0052cc);"><strong>Recommended Action:</strong> ${esc(t.recommendedAction || 'N/A')}</small>
            <small style="display:block;color:var(--text-light,#666);margin-top:4px;">Importance: ${t.importance}/10 · Confidence: ${t.confidence}/10 · Effort: ${esc(t.effort)} · Created: ${new Date(t.createdAt).toLocaleDateString()}</small>
          </div>
          <div class="story-actions">
            ${t.status !== 'in_progress' && t.status !== 'completed' ? `<button type="button" data-seo-task-action="in_progress" data-task-id="${esc(t.id)}">Start ▶</button>` : ''}
            ${t.status !== 'completed' ? `<button type="button" data-seo-task-action="completed" data-task-id="${esc(t.id)}">Complete ✓</button>` : ''}
            ${t.status !== 'rejected' ? `<button type="button" data-seo-task-action="rejected" data-task-id="${esc(t.id)}">Reject ✗</button>` : ''}
            <button type="button" data-seo-task-delete="${esc(t.id)}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
function renderAuxPanels() {
  const distStatEl = $('#admin-distribution-provider-status');
  if (distStatEl && distributionConfigData) {
    const em = distributionConfigData.emailService || {};
    const sc = distributionConfigData.socialChannels || {};
    distStatEl.innerHTML = `
      <div class="catalog-stat-card" style="grid-column:span 2;"><small>Email Delivery Provider</small><strong style="font-size:13px;">${esc(em.statusBadge || 'Not Configured')}</strong></div>
      <div class="catalog-stat-card"><small>LinkedIn API</small><strong style="font-size:13px;">${sc.linkedin?.connected ? 'Connected' : 'Not Configured'}</strong></div>
      <div class="catalog-stat-card"><small>X / Twitter API</small><strong style="font-size:13px;">${sc.x_twitter?.connected ? 'Connected' : 'Not Configured'}</strong></div>
      <div class="catalog-stat-card"><small>Syndication Webhook</small><strong style="font-size:13px;">${sc.webhook?.connected ? 'Connected' : 'Not Configured'}</strong></div>
      <div class="catalog-stat-card"><small>Active Subscribers</small><strong>${subscribers.filter(s => s.status === 'active').length}</strong></div>
    `;
  }

  const artSelectEl = $('#social-article-select');
  if (artSelectEl) {
    const pubArts = articles.filter(a => a.status === 'published');
    artSelectEl.innerHTML = '<option value="">Select Published Article…</option>' +
      pubArts.map(a => `<option value="${esc(a.id)}">${esc(a.title)} (${esc(a.manufacturer || 'OEM')})</option>`).join('');
  }

  const distLogsEl = $('#admin-distribution-logs-list');
  if (distLogsEl && distributionConfigData) {
    const logs = distributionConfigData.logs || [];
    distLogsEl.innerHTML = logs.length
      ? logs.slice(0, 12).map(l => `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill ${l.status === 'delivered' ? 'status-published' : (l.status === 'delivery_error' ? 'status-rejected' : 'status-review')}">${esc(l.status)}</span>
              <span class="status-pill status-draft">${esc(l.kind)} · ${esc(l.channel)}</span>
            </div>
            <strong>${esc(l.targetTitle || l.targetId)}</strong>
            <small>${new Date(l.at).toLocaleString()} · By ${esc(l.actor)}</small>
            <small style="display:block;margin-top:4px;">${esc(l.details)}</small>
            ${l.error ? `<small style="display:block;color:#B42318;">Error: ${esc(l.error)}</small>` : ''}
          </div>
        </div>`).join('')
      : '<p class="muted">No newsletter or social distribution events logged yet.</p>';
  }

  const subEl = $('#admin-newsletter-list');
  if (subEl) {
    subEl.innerHTML = subscribers.length
      ? subscribers.map(s => `<div class="admin-story">
          <div>
            <div class="story-badges-line">
              <span class="status-pill ${s.status === 'active' ? 'status-published' : 'status-archived'}">${esc(s.status || 'active')}</span>
              <span class="status-pill ${s.verified ? 'status-published' : 'status-review'}">${s.verified ? 'Verified ✓' : 'Unverified'}</span>
              <span class="status-pill status-draft">${esc(s.frequency || 'weekly')}</span>
            </div>
            <strong>${esc(s.email)}</strong>
            <small>Interests: <strong>${esc((s.interests || [s.segment || 'Global Briefing']).join(', '))}</strong></small>
            <small style="display:block;">Consent: ${s.consent ? 'Explicit Consent Recorded' : 'No'} (${s.consentTimestamp ? new Date(s.consentTimestamp).toLocaleDateString() : 'N/A'}) · Joined ${new Date(s.createdAt).toLocaleDateString()}</small>
          </div>
          <div class="story-actions">
            ${!s.verified ? `<button type="button" data-verify-sub="${esc(s.id)}">Mark Verified ✓</button>` : ''}
            <button type="button" data-toggle-sub="${esc(s.id)}" data-status="${s.status === 'active' ? 'unsubscribed' : 'active'}">
              ${s.status === 'active' ? 'Unsubscribe' : 'Reactivate'}
            </button>
            <button type="button" data-del-sub="${esc(s.id)}">Remove</button>
          </div>
        </div>`).join('')
      : '<p class="muted">No newsletter subscribers yet.</p>';
  }
  const tipsEl = $('#admin-submissions-list');
  if (tipsEl) {
    tipsEl.innerHTML = submissions.length
      ? submissions.map(t => `<div class="admin-story">
          <div>
            <span class="status-pill status-${t.status === 'reviewed' ? 'published' : 'draft'}">${esc(t.submissionType || 'tip')}</span>
            <strong>${esc(t.subject)}</strong>
            <small>From ${esc(t.name)} ${t.organization ? `(${esc(t.organization)})` : ''} · ${new Date(t.createdAt).toLocaleDateString()}</small>
            <p class="tip-body">${esc(t.message)}</p>
            ${t.sourceUrl ? `<a class="inline-link" href="${esc(t.sourceUrl)}" target="_blank" rel="noopener">Source link ↗</a>` : ''}
          </div>
          <div class="story-actions">
            <button data-promote-tip="${esc(t.id)}" type="button">Draft story</button>
            <button data-delete-tip="${esc(t.id)}" type="button">Delete</button>
          </div>
        </div>`).join('')
      : '<p class="muted">No tips or corrections submitted yet.</p>';
  }
}

async function refresh() {
  const [sessData, artData, subData, tipData, catData, bkpData, logRes, setRes, colRes, nrRes, wfRes, seoRes, distRes, aiDashRes, aiTasksRes] = await Promise.all([
    api('/api/admin/session'),
    api('/api/admin/articles'),
    api('/api/admin/newsletter').catch(() => []),
    api('/api/admin/submissions').catch(() => []),
    api('/api/admin/catalog').catch(() => ({})),
    api('/api/admin/backups').catch(() => []),
    api('/api/admin/logs').catch(() => ({ jobs: [], auditLogs: [], validationWarnings: [] })),
    api('/api/admin/settings').catch(() => ({})),
    api('/api/admin/collected').catch(() => []),
    api('/api/admin/newsroom/config').catch(() => null),
    api('/api/admin/workflow').catch(() => null),
    api('/api/admin/seo-analytics').catch(() => null),
    api('/api/admin/distribution/config').catch(() => null),
    api('/api/admin/ai-seo/dashboard').catch(() => null),
    api('/api/admin/ai-seo/tasks').catch(() => [])
  ]);
  sessionInfo = sessData;
  articles = artData;
  subscribers = subData;
  submissions = tipData;
  catalog = catData;
  backups = bkpData;
  logsData = logRes;
  siteSettings = setRes;
  collectedItems = colRes;
  newsroomConfig = nrRes;
  workflowSummary = wfRes;
  seoAnalyticsData = seoRes;
  distributionConfigData = distRes;
  aiOperationsData = aiDashRes;
  aiSeoTasks = aiTasksRes;
  if (!latestNewsroomRun && nrRes?.recentRuns?.length) {
    latestNewsroomRun = nrRes.recentRuns[0];
  }

  if ($('#role-badge-pill')) {
    $('#role-badge-pill').innerHTML = `<i></i> ${esc(sessionInfo.username)} (${esc(sessionInfo.role)})`;
  }
  if ($('#admin-session-indicator')) {
    $('#admin-session-indicator').textContent = `SIGNED IN: ${sessionInfo.username.toUpperCase()} [${sessionInfo.role.toUpperCase()}]`;
  }

  renderStories();
  renderCatalogScreens();
  renderNewsroomPanel();
  renderWorkflowPipeline();
  renderAuxPanels();
  renderJobsAndLogs();
  renderSettingsForm();
  renderAiOperationsPanel();
}

async function showDashboard() {
  try {
    await refresh();
    $('#login-panel').hidden = true;
    $('#dashboard').hidden = false;
    $('#manual-refresh').hidden = false;
    $('#create-backup').hidden = false;
    $('#logout').hidden = false;
    clearAlert();
  } catch {
    $('#login-panel').hidden = false;
    $('#dashboard').hidden = true;
    $('#manual-refresh').hidden = true;
    $('#create-backup').hidden = true;
    $('#logout').hidden = true;
  }
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#admin-username')?.value || 'editorial-admin',
        password: $('#admin-password').value
      })
    });
    $('#admin-password').value = '';
    await showDashboard();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    $('#dashboard').hidden = true;
    $('#login-panel').hidden = false;
    $('#manual-refresh').hidden = true;
    $('#create-backup').hidden = true;
    $('#logout').hidden = true;
    resetForm();
    alertMsg('You have signed out.', 'success');
  }
});

$('#manual-refresh')?.addEventListener('click', async () => {
  try {
    await refresh();
    alertMsg('All articles, catalogs, jobs, and audit logs refreshed.', 'success');
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#create-backup')?.addEventListener('click', async () => {
  try {
    const snap = await api('/api/admin/backups', {
      method: 'POST',
      body: JSON.stringify({ reason: 'manual-admin-snapshot' })
    });
    alertMsg(`Backup snapshot created: ${snap.id}`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#article-form').addEventListener('submit', async e => {
  e.preventDefault();
  await saveArticle($('#status').value);
});
$('#save-draft').addEventListener('click', () => saveArticle('draft'));
$('#submit-review-btn')?.addEventListener('click', () => saveArticle('review'));
$('#reset-form').addEventListener('click', () => {
  resetForm();
  clearAlert();
});
$('#admin-search')?.addEventListener('input', renderStories);
$('#admin-status-filter')?.addEventListener('change', renderStories);

async function saveArticle(status) {
  try {
    const id = $('#article-id').value;
    const data = formData(status || $('#status').value);
    if (id) {
      await api('/api/admin/articles/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } else {
      await api('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    alertMsg(
      data.status === 'published'
        ? 'Article saved and published. It is now live on the website.'
        : `Article saved with status "${data.status}". It is not publicly visible until published.`,
      'success'
    );
    resetForm();
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
}

$('#admin-story-list').addEventListener('click', async e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  const quickStatus = e.target.closest('[data-quick-status]');
  const wfTransition = e.target.closest('[data-wf-transition]');

  if (wfTransition) {
    const targetId = wfTransition.dataset.id;
    const action = wfTransition.dataset.wfTransition;
    const art = articles.find(x => x.id === targetId);
    if (!art) return;
    if (action === 'rollback' && !confirm(`Rollback / Unpublish "${art.title}" and return it to the Review Queue?`)) return;
    try {
      const res = await api(`/api/admin/articles/${encodeURIComponent(targetId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      alertMsg(`Pipeline transition [${res.article.pipelineStage}] completed for "${res.article.title}".`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  if (quickStatus) {
    const targetId = quickStatus.dataset.id;
    const nextStatus = quickStatus.dataset.quickStatus;
    const art = articles.find(x => x.id === targetId);
    if (!art) return;
    if (['rejected', 'archived'].includes(nextStatus) && !confirm(`Set status of "${art.title}" to "${nextStatus}"?`)) return;
    try {
      await api('/api/admin/articles/' + encodeURIComponent(targetId), {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, revisionNote: `Quick status transition to ${nextStatus}` })
      });
      alertMsg(`Updated "${art.title}" status to "${nextStatus}".`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  if (edit) {
    const a = articles.find(x => x.id === edit.dataset.edit);
    if (!a) return;
    $('#article-id').value = a.id;
    const fieldMap = {
      title: '#title',
      slug: '#slug',
      body: '#body',
      category: '#category',
      manufacturer: '#manufacturer',
      author: '#author',
      image: '#image',
      imageCredit: '#image-credit',
      equipmentType: '#equipment-type',
      country: '#country',
      region: '#region',
      model: '#model',
      powerType: '#power-type',
      articleType: '#article-type',
      status: '#status'
    };
    for (const [key, selector] of Object.entries(fieldMap)) {
      const field = $(selector);
      if (field) field.value = a[key] || '';
    }
    $('#excerpt').value = a.summary || a.excerpt || '';
    $('#tags').value = (a.tags || []).join(', ');
    $('#source-url').value = a.sourceUrl || '';
    $('#source-urls').value = (a.sourceUrls || []).join('\n');
    $('#specs-input').value = formatSpecsInput(a.specs);
    $('#seo-title').value = a.seo?.metaTitle || '';
    $('#seo-description').value = a.seo?.metaDescription || '';
    $('#seo-canonical').value = a.seo?.canonicalUrl || '';
    $('#seo-keywords').value = (a.seo?.keywords || []).join(', ');
    $('#revision-note').value = '';
    $('#scheduled-at').value = a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 16) : '';
    $('#featured').checked = !!a.featured;
    $('#editor-title').textContent = 'Edit article';
    $('#save-draft').textContent = 'Save changes as draft';

    const revBox = $('#revision-history-box');
    const revList = $('#revision-history-list');
    if (revBox && revList && Array.isArray(a.updateHistory) && a.updateHistory.length) {
      revBox.hidden = false;
      revList.innerHTML = a.updateHistory
        .slice()
        .reverse()
        .map(h => `<li><strong>${esc(h.action)}</strong> by ${esc(h.by)} on ${new Date(h.at).toLocaleString()} — <em>${esc(h.note || '')}</em></li>`)
        .join('');
    } else if (revBox) {
      revBox.hidden = true;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (del) {
    const targetArt = articles.find(x => x.id === del.dataset.delete);
    if (!confirm(`Permanently delete article "${targetArt?.title || del.dataset.delete}"? This action is audit-logged and cannot be undone.`)) return;
    try {
      await api('/api/admin/articles/' + encodeURIComponent(del.dataset.delete), { method: 'DELETE' });
      alertMsg('Article deleted.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
  }
});

// Entity CRUD Forms across all management screens
async function handleEntitySubmit(entityType, payload, successMsg, formSelector) {
  try {
    await api(`/api/admin/catalog/${entityType}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (formSelector && $(formSelector)) $(formSelector).reset();
    alertMsg(successMsg, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
}

$('#author-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('authors', {
    name: $('#aut-name').value,
    role: $('#aut-role').value,
    email: $('#aut-email').value
  }, 'Author / editorial desk saved.', '#author-mgr-form');
});

$('#category-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('categories', {
    name: $('#cat-name').value,
    section: $('#cat-section').value,
    description: $('#cat-desc').value
  }, 'Category saved.', '#category-mgr-form');
});

$('#tag-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('tags', {
    name: $('#tag-name').value
  }, 'Tag added.', '#tag-mgr-form');
});

$('#mfg-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('manufacturers', {
    name: $('#mfg-name').value,
    country: $('#mfg-country').value,
    headquarters: $('#mfg-hq').value,
    website: $('#mfg-website').value,
    focus: $('#mfg-focus').value,
    overview: $('#mfg-overview').value
  }, 'Manufacturer profile saved.', '#mfg-mgr-form');
});

$('#model-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('equipmentModels', {
    name: $('#mdl-name').value,
    manufacturer: $('#mdl-mfg').value,
    equipmentType: $('#mdl-type').value,
    category: $('#mdl-category').value,
    powerType: $('#mdl-power').value,
    officialSourceUrl: $('#mdl-source').value,
    summary: $('#mdl-summary').value,
    specs: parseSpecsInput($('#mdl-specs').value)
  }, 'Equipment model saved.', '#model-mgr-form');
});

$('#region-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('regions', {
    name: $('#reg-name').value,
    slug: $('#reg-slug').value,
    description: $('#reg-desc').value
  }, 'Region saved.', '#region-mgr-form');
});

$('#country-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('countries', {
    name: $('#cty-name').value,
    isoCode: $('#cty-iso').value,
    region: $('#cty-region').value
  }, 'Country saved.', '#country-mgr-form');
});

$('#source-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('sources', {
    name: $('#src-title').value,
    title: $('#src-title').value,
    url: $('#src-url').value,
    feedUrl: $('#src-feed-url')?.value || '',
    apiEndpoint: $('#src-api-endpoint')?.value || '',
    manufacturer: $('#src-manufacturer')?.value || 'Various',
    category: $('#src-category')?.value || 'Construction Equipment',
    country: $('#src-country')?.value || 'Global',
    region: $('#src-region')?.value || 'Global',
    sourceType: $('#src-type').value,
    pollingIntervalMinutes: Number($('#src-interval')?.value || 60),
    enabled: $('#src-enabled') ? $('#src-enabled').checked : true
  }, 'Approved news source registered.', '#source-mgr-form');
});

$('#check-all-sources-live')?.addEventListener('click', async () => {
  try {
    alertMsg('Polling enabled RSS/Atom feeds in live mode…', 'success');
    const res = await api('/api/admin/sources/check-all', {
      method: 'POST',
      body: JSON.stringify({ mode: 'live' })
    });
    alertMsg(`Checked ${res.sourcesChecked} source(s) (Live): discovered ${res.totalDiscovered} item(s), stored ${res.totalInserted} new, skipped ${res.totalDuplicates} duplicate(s).`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#check-all-sources-test')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/sources/check-all', {
      method: 'POST',
      body: JSON.stringify({ mode: 'test' })
    });
    alertMsg(`Sample Test Mode complete across ${res.sourcesChecked} source(s): stored ${res.totalInserted} new item(s), skipped ${res.totalDuplicates} duplicate(s).`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#image-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('images', {
    url: $('#img-url').value,
    credit: $('#img-credit').value,
    alt: $('#img-alt').value,
    license: $('#img-license').value
  }, 'Image & license credit registered.', '#image-mgr-form');
});

$('#user-mgr-form')?.addEventListener('submit', e => {
  e.preventDefault();
  handleEntitySubmit('adminUsers', {
    username: $('#usr-username').value,
    email: $('#usr-email').value,
    role: $('#usr-role').value,
    password: $('#usr-password').value
  }, 'Admin user account saved with scrypt password hash.', '#user-mgr-form');
});

$('#settings-mgr-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        siteName: $('#set-site-name').value,
        tagline: $('#set-tagline').value,
        defaultMetaTitle: $('#set-meta-title').value,
        defaultMetaDescription: $('#set-meta-desc').value,
        canonicalBaseUrl: $('#set-canonical').value,
        editorialContactEmail: $('#set-contact-email').value,
        gaMeasurementId: $('#set-ga-id')?.value || '',
        plausibleDomain: $('#set-plausible-domain')?.value || '',
        gscVerificationCode: $('#set-gsc-code')?.value || '',
        gscPropertyUrl: $('#set-gsc-url')?.value || '',
        requireSourceForPublish: $('#set-require-source').checked
      })
    });
    alertMsg('Website, SEO & analytics settings updated.', 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

// Delegated delete for catalog entities, jobs runner, newsletter & tips
document.addEventListener('click', async e => {
  const delEntityBtn = e.target.closest('[data-del-entity]');
  if (delEntityBtn) {
    const entityType = delEntityBtn.dataset.delEntity;
    const key = delEntityBtn.dataset.key;
    if (!confirm(`Delete "${key}" from ${entityType}?`)) return;
    try {
      await api(`/api/admin/catalog/${encodeURIComponent(entityType)}/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      alertMsg(`Removed "${key}" from ${entityType}.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const runJobBtn = e.target.closest('[data-run-job]');
  if (runJobBtn) {
    const jobId = runJobBtn.dataset.runJob;
    try {
      const res = await api('/api/admin/jobs/run', {
        method: 'POST',
        body: JSON.stringify({ jobId })
      });
      alertMsg(`Job "${res.name}" executed (${res.itemsProcessed} items processed).`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const verifySubBtn = e.target.closest('[data-verify-sub]');
  if (verifySubBtn) {
    const id = verifySubBtn.dataset.verifySub;
    try {
      await api(`/api/admin/newsletter/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ verified: true, status: 'active' })
      });
      alertMsg('Subscriber email marked as verified.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const toggleSubBtn = e.target.closest('[data-toggle-sub]');
  if (toggleSubBtn) {
    const id = toggleSubBtn.dataset.toggleSub;
    const status = toggleSubBtn.dataset.status;
    try {
      await api(`/api/admin/newsletter/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      alertMsg(`Subscriber status updated to "${status}".`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const delSubBtn = e.target.closest('[data-del-sub]');
  if (delSubBtn) {
    const id = delSubBtn.dataset.delSub;
    if (!confirm('Remove this newsletter subscriber?')) return;
    try {
      await api(`/api/admin/newsletter/${encodeURIComponent(id)}`, { method: 'DELETE' });
      alertMsg('Subscriber removed.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const checkSourceBtn = e.target.closest('[data-check-source]');
  if (checkSourceBtn) {
    const sourceId = checkSourceBtn.dataset.checkSource;
    const mode = checkSourceBtn.dataset.mode || 'live';
    try {
      const res = await api(`/api/admin/sources/${encodeURIComponent(sourceId)}/check`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        alertMsg(`Checked "${res.source.name}" (${mode}): discovered ${res.discoveredCount}, stored ${res.insertedCount} new, skipped ${res.duplicateCount} duplicate(s).`, 'success');
      } else {
        alertMsg(`Source check notice (${res.source?.name || sourceId}): ${res.error}`, 'error');
      }
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const promoteColBtn = e.target.closest('[data-promote-collected]');
  if (promoteColBtn) {
    const colId = promoteColBtn.dataset.promoteCollected;
    try {
      const res = await api(`/api/admin/collected/${encodeURIComponent(colId)}/promote`, {
        method: 'POST',
        body: '{}'
      });
      alertMsg(`Promoted "${res.article.title}" into an unpublished Draft article for editorial review.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const dismissColBtn = e.target.closest('[data-dismiss-collected]');
  if (dismissColBtn) {
    const colId = dismissColBtn.dataset.dismissCollected;
    try {
      await api(`/api/admin/collected/${encodeURIComponent(colId)}`, { method: 'DELETE' });
      alertMsg('Collected item dismissed.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const nrAnalyzeBtn = e.target.closest('[data-newsroom-analyze]');
  if (nrAnalyzeBtn) {
    const colId = nrAnalyzeBtn.dataset.newsroomAnalyze;
    try {
      alertMsg('Running 8-step AI-Assisted Newsroom workflow across 6 specialist roles…', 'success');
      const res = await api('/api/admin/newsroom/analyze', {
        method: 'POST',
        body: JSON.stringify({ collectedItemId: colId, sendToReviewQueue: true })
      });
      latestNewsroomRun = res.run;
      alertMsg(`AI Newsroom analyzed "${res.article.title}" and routed it to the Admin Review Queue (status="review"). Remember: AI agreement is not proof of accuracy.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const openRevBtn = e.target.closest('[data-open-review-article]');
  if (openRevBtn) {
    const artId = openRevBtn.dataset.openReviewArticle;
    $$('.admin-tab')[0]?.click();
    const editBtn = $(`#admin-story-list [data-edit="${CSS.escape(artId)}"]`);
    if (editBtn) {
      editBtn.click();
    }
    return;
  }

  const ackAlertBtn = e.target.closest('[data-ack-alert]');
  if (ackAlertBtn) {
    const alertId = ackAlertBtn.dataset.ackAlert;
    try {
      await api(`/api/admin/workflow/alerts/${encodeURIComponent(alertId)}/ack`, {
        method: 'POST',
        body: '{}'
      });
      alertMsg('Failure alert acknowledged.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }
});

async function previewNewsletterEdition(editionType) {
  try {
    const tpl = await api(`/api/admin/distribution/template?edition=${encodeURIComponent(editionType)}`);
    const box = $('#admin-newsletter-template-preview');
    if (box) {
      box.innerHTML = `<div class="admin-story">
        <div>
          <div class="story-badges-line">
            <span class="status-pill status-published">${esc(tpl.editionType.toUpperCase())} TEMPLATE</span>
            <span class="status-pill status-draft">${esc(tpl.storyCount)} Stories</span>
            <span class="source-evidence-pill evidence-ok">Fingerprint: ${esc(tpl.campaignFingerprint)}</span>
          </div>
          <strong>Subject: ${esc(tpl.subject)}</strong>
          <small style="display:block;margin-top:4px;">List-Unsubscribe Header: <code>${esc(tpl.headers['List-Unsubscribe'])}</code></small>
          <pre style="margin-top:8px;padding:10px;background:#F8FAFC;border:1px solid #DCE2E8;border-radius:6px;font-size:11px;white-space:pre-wrap;max-height:220px;overflow:auto;">${esc(tpl.text)}</pre>
        </div>
      </div>`;
    }
  } catch (err) {
    alertMsg(err.message);
  }
}

$('#preview-daily-newsletter-btn')?.addEventListener('click', () => previewNewsletterEdition('daily'));
$('#preview-weekly-newsletter-btn')?.addEventListener('click', () => previewNewsletterEdition('weekly'));

$('#send-weekly-newsletter-btn')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/distribution/send-newsletter', {
      method: 'POST',
      body: JSON.stringify({ editionType: 'weekly' })
    });
    alertMsg(res.message || `Newsletter status: ${res.status}`, res.ok ? 'success' : 'error');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
    await refresh();
  }
});

$('#social-distribute-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const articleId = $('#social-article-select')?.value;
    const channel = $('#social-channel-select')?.value || 'linkedin';
    if (!articleId) return;
    const res = await api('/api/admin/distribution/social', {
      method: 'POST',
      body: JSON.stringify({ articleId, channel })
    });
    alertMsg(res.message || `Social distribution status: ${res.status}`, res.ok ? 'success' : 'error');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
    await refresh();
  }
});

$('#run-rules-test-suite-btn')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/workflow/test-rules', {
      method: 'POST',
      body: '{}'
    });
    alertMsg('5-Gate & Sensitive-Topic Verification Suite passed! Source, Factual Evidence, Originality, Image Rights, and Quality gates verified.', 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#workflow-config-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const updated = await api('/api/admin/workflow/config', {
      method: 'PATCH',
      body: JSON.stringify({
        schedulerIntervalSeconds: Number($('#wf-sched-interval')?.value || 60),
        maxJobRetries: Number($('#wf-max-retries')?.value || 3),
        autoPublishEnabled: Boolean($('#wf-auto-publish-toggle')?.checked)
      })
    });
    alertMsg(`Workflow configuration saved (autoPublishEnabled: ${updated.autoPublishEnabled}).`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
    await refresh();
  }
});

$('#newsroom-manual-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const res = await api('/api/admin/newsroom/analyze', {
      method: 'POST',
      body: JSON.stringify({
        title: $('#nr-title').value,
        sourceName: $('#nr-source-name').value,
        sourceUrl: $('#nr-source-url').value,
        manufacturer: $('#nr-manufacturer').value || 'Various',
        country: $('#nr-country').value || 'Global',
        excerpt: $('#nr-excerpt').value,
        sendToReviewQueue: true
      })
    });
    latestNewsroomRun = res.run;
    $('#newsroom-manual-form').reset();
    alertMsg(`Newsroom draft "${res.article.title}" created and sent to the Admin Review Queue (status="review").`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#admin-submissions-list')?.addEventListener('click', async e => {
  const promote = e.target.closest('[data-promote-tip]');
  const del = e.target.closest('[data-delete-tip]');
  if (promote) {
    const tip = submissions.find(x => x.id === promote.dataset.promoteTip);
    if (!tip) return;
    // Switch to Screen 1 (Articles)
    $$('.admin-tab')[0]?.click();
    resetForm();
    $('#title').value = tip.subject;
    $('#excerpt').value = tip.message.slice(0, 220);
    $('#body').value = tip.message;
    $('#source-url').value = tip.sourceUrl || '';
    $('#status').value = 'draft';
    $('#editor-title').textContent = 'Create draft from submitted tip';
    await api('/api/admin/submissions/' + encodeURIComponent(tip.id), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' })
    }).catch(() => {});
    await refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (del) {
    if (!confirm('Delete this submission?')) return;
    try {
      await api('/api/admin/submissions/' + encodeURIComponent(del.dataset.deleteTip), { method: 'DELETE' });
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
  }
});

$('#refresh-ai-dash-btn')?.addEventListener('click', async () => {
  try {
    await refresh();
    alertMsg('AI SEO & Newsroom dashboard refreshed.', 'success');
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#run-tech-audit-btn')?.addEventListener('click', async () => {
  try {
    const auditRes = await api('/api/admin/ai-seo/audit', { method: 'POST' });
    alertMsg(`Technical SEO audit complete. Health score: ${auditRes.healthScore}/100. Issues detected: ${auditRes.issues.length}`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#task-filter-role')?.addEventListener('change', () => renderSeoTasksTable());
$('#task-filter-status')?.addEventListener('change', () => renderSeoTasksTable());

$('#create-seo-task-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const title = $('#task-title').value.trim();
    const assignedRole = $('#task-role').value;
    const category = $('#task-category').value;
    const target = $('#task-target').value.trim();
    const evidence = $('#task-evidence').value.trim();
    const recommendedAction = $('#task-action').value.trim();
    const importance = Number($('#task-importance').value || 7);
    const confidence = Number($('#task-confidence').value || 8);
    const effort = $('#task-effort').value;

    await api('/api/admin/ai-seo/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        assignedRole,
        category,
        target,
        evidence,
        recommendedAction,
        importance,
        confidence,
        effort
      })
    });

    $('#create-seo-task-form').reset();
    alertMsg(`SEO task "${title}" queued with role "${assignedRole}".`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  }
});

$('#ai-seo-tasks-table')?.addEventListener('click', async e => {
  const actBtn = e.target.closest('[data-seo-task-action]');
  const delBtn = e.target.closest('[data-seo-task-delete]');

  if (actBtn) {
    const taskId = actBtn.dataset.taskId;
    const nextStatus = actBtn.dataset.seoTaskAction;
    try {
      await api(`/api/admin/ai-seo/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      alertMsg(`SEO task status updated to "${nextStatus}".`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
  }

  if (delBtn) {
    const taskId = delBtn.dataset.seoTaskDelete;
    if (!confirm('Delete this SEO task from the queue?')) return;
    try {
      await api(`/api/admin/ai-seo/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE'
      });
      alertMsg('SEO task deleted.', 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
  }
});

showDashboard();
