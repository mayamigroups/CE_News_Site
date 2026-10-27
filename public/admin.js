
window.__loginSubmitting = false;

window.__handleAdminLogin = async function(e) {
  if (e) e.preventDefault();
  if (window.__loginSubmitting) return;

  const submitBtn = $('#admin-login-btn') || $('#login-form button[type="submit"]') || $('#login-form button');
  const originalText = submitBtn ? submitBtn.textContent : 'Sign in to desk →';
  const username = $('#admin-username')?.value?.trim();
  const password = $('#admin-password')?.value;

  if (!username || !password) {
    alertMsg('Please enter both username and password.', 'error');
    return;
  }

  window.__loginSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
  }
  clearAlert();

  try {
    const res = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      sessionStorage.setItem('bm_token', res.token);
    }
    sessionInfo = res;
    if ($('#admin-password')) $('#admin-password').value = '';
    alertMsg('Authenticated successfully as ' + res.username + '. Opening desk...', 'success');
    await showDashboard(true);
  } catch (err) {
    alertMsg(err.message || 'Login failed. Please verify your credentials.', 'error');
  } finally {
    window.__loginSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
};

function switchStudio(target) {
  const manualCard = $('#studio-card-manual');
  const aiCard = $('#studio-card-ai');

  if (target === 'manual') {
    if (manualCard) manualCard.classList.add('active');
    if (aiCard) aiCard.classList.remove('active');
    // Switch to tab-articles
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tab-articles'));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== 'tab-articles';
    });
    $('#article-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (target === 'ai') {
    if (aiCard) aiCard.classList.add('active');
    if (manualCard) manualCard.classList.remove('active');
    // Switch to tab-ai-seo
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tab-ai-seo'));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== 'tab-ai-seo';
    });
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
}

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
  if (window.location.protocol === 'file:') {
    throw new Error('You are viewing admin.html via file:///. Please navigate to http://localhost:3000/admin.html in your browser.');
  }
  const token = sessionStorage.getItem('bm_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  let r;
  try {
    r = await fetch(url, {
      credentials: 'same-origin',
      ...opts,
      headers
    });
  } catch (netErr) {
    throw new Error('Backend unavailable: Unable to reach server. Please check your network connection and verify the server is running on port 3000.');
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || 'Request failed (' + r.status + ' ' + r.statusText + ')');
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

function collectSpecsFromBuilder() {
  const specs = {};
  const rows = $('#spec-rows-container .spec-row');
  for (const row of rows) {
    const k = row.querySelector('.spec-key')?.value.trim();
    const v = row.querySelector('.spec-val')?.value.trim();
    if (k && v) specs[k] = v;
  }
  return specs;
}

function formData(statusOverride) {
  const chosenStatus = statusOverride || $('#status').value;
  const summaryVal = $('#excerpt').value;
  const builderSpecs = collectSpecsFromBuilder();
  const inputSpecs = parseSpecsInput($('#specs-input')?.value || '');
  const combinedSpecs = { ...inputSpecs, ...builderSpecs };

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
    specs: combinedSpecs,
    author: $('#author').value,
    tags: $('#tags').value.split(',').map(x => x.trim()).filter(Boolean),
    image: $('#image').value,
    imageCredit: $('#image-credit').value,
    mediaRights: {
      licenseType: $('#image-license')?.value || 'OEM Press Kit / Editorial Fair Use',
      credit: $('#image-credit')?.value || '',
      altText: $('#image-alt')?.value || $('#title')?.value || '',
      verified: $('#image-rights-verified') ? $('#image-rights-verified').checked : true
    },
    origin: $('#article-id')?.value ? (articles.find(a => a.id === $('#article-id').value)?.origin || 'manual') : 'manual',
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

// Pre-Publish Article Preview Modal with Actionable SEO Audit
$('#preview-article-btn')?.addEventListener('click', async () => {
  const data = formData();
  const modal = $('#preview-modal');
  const body = $('#preview-modal-body');
  if (!modal || !body) return;

  const currentArtId = $('#article-id')?.value || data.id;
  const targetArt = articles.find(x => x.id === currentArtId) || data;

  // Fetch or evaluate article SEO audit
  let audit = targetArt.seoAudit || null;
  if (currentArtId) {
    try {
      const res = await api(`/api/admin/articles/${encodeURIComponent(currentArtId)}/seo-audit`);
      audit = res.seoAudit;
    } catch {}
  }

  const specsEntries = Object.entries(data.specs || {});
  const paragraphs = esc(data.body || 'No body content entered yet.').split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  const auditScore = audit?.score ?? 'N/A';
  const auditStatus = audit?.status || 'unverified';
  const auditErrors = audit?.errors || [];
  const auditWarnings = audit?.warnings || [];

  body.innerHTML = `
    <div class="preview-meta-strip">
      <span class="status-pill status-${esc(data.status)}">Status: ${esc(data.status)}</span>
      <span>Category: <strong>${esc(data.category)}</strong></span>
      <span>OEM: <strong>${esc(data.manufacturer || 'Not specified')}</strong></span>
      <span>Model: <strong>${esc(data.model || 'N/A')}</strong></span>
      <span>Market: <strong>${esc(data.country || 'Global')} (${esc(data.region || 'Global')})</strong></span>
      ${data.scheduledAt ? `<span>Scheduled: <strong>${new Date(data.scheduledAt).toLocaleString()}</strong></span>` : ''}
    </div>

    <!-- PRE-PUBLICATION SEO AUDIT STRIP -->
    <div style="margin:16px 0;padding:14px;background:var(--bg-light,#f8f9fa);border-radius:8px;border:1px solid var(--border,#e1e4e8);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <strong>Pre-Publication SEO Audit</strong>
          <span class="badge ${auditScore >= 85 ? 'badge-published' : (auditScore >= 65 ? 'badge-review' : 'badge-rejected')}">
            Score: ${auditScore}/100 (${esc(auditStatus.toUpperCase())})
          </span>
          <small class="muted">${audit?.checksCount || 10} Checks · ${auditErrors.length} Errors · ${auditWarnings.length} Warnings</small>
        </div>
        ${currentArtId ? `<button id="rerun-preview-seo-audit-btn" data-id="${esc(currentArtId)}" class="button button-outline" type="button" style="padding:4px 10px;font-size:12px;">🔄 Rerun SEO Audit</button>` : ''}
      </div>

      ${auditErrors.length ? `
        <div style="margin:8px 0;padding:8px;background:#FEE4E2;border-left:4px solid #D92D20;border-radius:4px;color:#7A271A;font-size:12px;">
          <strong>Critical Pre-Publish SEO Errors (${auditErrors.length}):</strong>
          <ul style="margin:4px 0 0 16px;padding:0;">
            ${auditErrors.map(e => `<li><strong>${esc(e.name)}:</strong> ${esc(e.details)} <em>Fix: ${esc(e.recommendedFix)}</em></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${auditWarnings.length ? `
        <div style="margin:8px 0;padding:8px;background:#FEF0C7;border-left:4px solid #DC6803;border-radius:4px;color:#7A2E0E;font-size:12px;">
          <strong>Actionable SEO Recommendations (${auditWarnings.length}):</strong>
          <ul style="margin:4px 0 0 16px;padding:0;">
            ${auditWarnings.map(w => `<li><strong>${esc(w.name)}:</strong> ${esc(w.details)} <em>Fix: ${esc(w.recommendedFix)}</em></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${!auditErrors.length && !auditWarnings.length && audit ? `
        <p style="margin:0;color:#027A48;font-size:12px;">✓ All pre-publication SEO and metadata checks passed with high quality score.</p>
      ` : ''}
    </div>

    <h3>${esc(data.title || 'Untitled Draft')}</h3>
    <p class="lead">${esc(data.summary || 'No summary entered yet.')}</p>
    <p><small>By <strong>${esc(data.author || 'Editorial Desk')}</strong> · Primary Source Evidence: ${data.sourceUrl ? `<a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener">${esc(data.sourceUrl)} ↗</a>` : '<strong style="color:#B42318;">Missing Primary Source URL</strong>'}</small></p>
    ${data.image ? `<figure style="margin:12px 0;"><img src="${esc(data.image)}" alt="${esc(data.title)}" style="max-height:280px;width:100%;object-fit:cover;border-radius:8px;"><figcaption><small>Credit: ${esc(data.imageCredit || 'Missing image credit')}</small></figcaption></figure>` : ''}
    ${specsEntries.length ? `<dl class="mini-spec-list">${specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <div class="preview-body-copy">${paragraphs}</div>
  `;
  modal.hidden = false;

  $('#rerun-preview-seo-audit-btn')?.addEventListener('click', async (e) => {
    const artId = e.currentTarget.dataset.id;
    if (!artId) return;
    try {
      const res = await api(`/api/admin/articles/${encodeURIComponent(artId)}/seo-audit`, { method: 'POST' });
      alertMsg(`SEO Audit rerun completed. Score: ${res.seoAudit.score}/100 (${res.seoAudit.status}).`, 'success');
      await refresh();
      $('#preview-article-btn')?.click();
    } catch (err) {
      alertMsg(err.message);
    }
  });
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
  const originFilter = $('#admin-origin-filter')?.value || '';

  const filtered = articles.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false;
    const itemOrigin = a.origin || (a.newsroomDossier ? 'ai' : 'manual');
    if (originFilter && itemOrigin !== originFilter) return false;
    if (q && ![a.title, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, a.sourceUrl].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  $('#admin-story-list').innerHTML = filtered.length
    ? filtered.map(a => {
      const hasSource = Boolean(a.sourceUrl || (a.sourceUrls && a.sourceUrls.length));
      const itemOrigin = a.origin || (a.newsroomDossier ? 'ai' : 'manual');
      const updatedStr = a.updatedAt ? new Date(a.updatedAt).toLocaleString() : 'N/A';
      const schedStr = a.scheduledAt ? ` · ⏰ Scheduled: ${new Date(a.scheduledAt).toLocaleString()}` : '';
      return `<div class="admin-story">
        <div>
          <div class="story-badges-line">
            <span class="status-pill ${itemOrigin === 'manual' ? 'status-published' : 'status-draft'}">${itemOrigin === 'manual' ? '✍️ Manual' : '🤖 AI Newsroom'}</span>
            <span class="status-pill status-${esc(a.status)}">${esc(a.status)}</span>
            <span class="status-pill status-draft">Stage: ${esc(a.pipelineStage || a.status.toUpperCase())}</span>
            ${a.featured ? '<span class="status-pill status-featured">Featured</span>' : ''}
            <span class="source-evidence-pill ${hasSource ? 'evidence-ok' : 'evidence-missing'}">
              ${hasSource ? '✓ Source Verified' : '⚠ Missing Source URL'}
            </span>
            ${a.seoAudit ? `<span class="status-pill ${a.seoAudit.passed ? 'status-published' : (a.seoAudit.errorsCount > 0 ? 'status-rejected' : 'status-review')}">SEO: ${a.seoAudit.score}/100</span>` : ''}
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
          <button data-seo-audit="${esc(a.id)}" type="button" title="Rerun pre-publication SEO audit">SEO Audit</button>
          ${itemOrigin === 'ai' ? `<button data-transfer-manual="${esc(a.id)}" type="button" title="Transfer from AI Newsroom to Manual Studio">Transfer to Manual ✍️</button>` : ''}
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

function loadArticleIntoEditor(articleId) {
  const a = articles.find(x => x.id === articleId);
  if (!a) return;
  $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tab-articles'));
  $$('.admin-tab-pane').forEach(pane => {
    pane.hidden = pane.id !== 'tab-articles';
  });
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
  if ($('#image-alt')) $('#image-alt').value = a.mediaRights?.altText || a.seo?.metaDescription || '';
  if ($('#image-license')) $('#image-license').value = a.mediaRights?.licenseType || 'OEM Press Kit / Editorial Fair Use';
  if ($('#image-rights-verified')) $('#image-rights-verified').checked = a.mediaRights ? a.mediaRights.verified !== false : true;

  const specContainer = $('#spec-rows-container');
  if (specContainer) {
    specContainer.innerHTML = '';
    const specsObj = (a.specs && typeof a.specs === 'object') ? a.specs : parseSpecsInput(a.specs);
    const specEntries = Object.entries(specsObj);
    if (specEntries.length) {
      for (const [k, v] of specEntries) {
        addSpecRow(k, v);
      }
    } else {
      addSpecRow('Operating Weight', '');
      addSpecRow('Engine Power', '');
      addSpecRow('Bucket Capacity', '');
      addSpecRow('Emission Standard', '');
    }
  }
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
  $('#editor-title').textContent = 'Edit article: ' + a.title;
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

  $('#article-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openArticlePreview(art) {
  const modal = $('#preview-modal');
  const body = $('#preview-modal-body');
  if (!modal || !body || !art) return;

  const currentArtId = art.id;
  const audit = art.seoAudit || null;
  const specsEntries = Object.entries(art.specs || {});
  const paragraphs = esc(art.body || 'No body content entered yet.').split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

  const auditScore = audit?.score ?? 'N/A';
  const auditStatus = audit?.status || 'unverified';
  const auditErrors = audit?.errors || [];
  const auditWarnings = audit?.warnings || [];

  body.innerHTML = `
    <div class="preview-meta-strip">
      <span class="status-pill status-${esc(art.status)}">Status: ${esc(art.status)}</span>
      <span>Category: <strong>${esc(art.category)}</strong></span>
      <span>OEM: <strong>${esc(art.manufacturer || 'Not specified')}</strong></span>
      <span>Model: <strong>${esc(art.model || 'N/A')}</strong></span>
      <span>Market: <strong>${esc(art.country || 'Global')} (${esc(art.region || 'Global')})</strong></span>
      ${art.scheduledAt ? `<span>Scheduled: <strong>${new Date(art.scheduledAt).toLocaleString()}</strong></span>` : ''}
    </div>

    <div style="margin:16px 0;padding:14px;background:var(--bg-light,#f8f9fa);border-radius:8px;border:1px solid var(--border,#e1e4e8);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <strong>Pre-Publication SEO Audit</strong>
          <span class="badge ${auditScore >= 85 ? 'badge-published' : (auditScore >= 65 ? 'badge-review' : 'badge-rejected')}">
            Score: ${auditScore}/100 (${esc(auditStatus.toUpperCase())})
          </span>
          <small class="muted">${audit?.checksCount || 10} Checks · ${auditErrors.length} Errors · ${auditWarnings.length} Warnings</small>
        </div>
      </div>
      ${auditErrors.length ? `
        <div style="margin-top:8px;">
          <strong style="color:#B42318;font-size:12px;">Blocking SEO Errors:</strong>
          <ul style="margin:4px 0 0;padding-left:20px;font-size:12px;color:#B42318;">
            ${auditErrors.map(e => `<li><strong>${esc(e.check)}:</strong> ${esc(e.message)} <em>(${esc(e.fix)})</em></li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${!auditErrors.length && !auditWarnings.length && audit ? `
        <p style="margin:0;color:#027A48;font-size:12px;">✓ All pre-publication SEO and metadata checks passed with high quality score.</p>
      ` : ''}
    </div>

    <h3>${esc(art.title || 'Untitled Draft')}</h3>
    <p class="lead">${esc(art.summary || art.excerpt || 'No summary entered yet.')}</p>
    <p><small>By <strong>${esc(art.author || 'Editorial Desk')}</strong> · Primary Source: ${art.sourceUrl ? `<a href="${esc(art.sourceUrl)}" target="_blank" rel="noopener">${esc(art.sourceUrl)} ↗</a>` : '<strong style="color:#B42318;">Missing Primary Source URL</strong>'}</small></p>
    ${art.image ? `<figure style="margin:12px 0;"><img src="${esc(art.image)}" alt="${esc(art.title)}" style="max-height:280px;width:100%;object-fit:cover;border-radius:8px;"><figcaption><small>Credit: ${esc(art.imageCredit || 'Missing image credit')}</small></figcaption></figure>` : ''}
    ${specsEntries.length ? `<dl class="mini-spec-list">${specsEntries.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    <div class="preview-body-copy">${paragraphs}</div>
  `;
  modal.hidden = false;
}

function renderNewsInbox() {
  const tbody = $('#inbox-table-body');
  if (!tbody) return;
  const q = ($('#inbox-search')?.value || '').trim().toLowerCase();
  const filter = $('#inbox-filter-status')?.value || 'unpromoted';

  let items = (collectedItems || []).filter(c => {
    if (filter === 'unpromoted' && c.reviewStatus === 'promoted_to_draft') return false;
    if (filter === 'promoted_to_draft' && c.reviewStatus !== 'promoted_to_draft') return false;
    if (q) {
      const match = [c.headline, c.title, c.sourceName, c.manufacturer, c.summary, c.excerpt].join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  if ($('#inbox-count-badge')) {
    $('#inbox-count-badge').textContent = `${items.length} Items`;
  }

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:24px;text-align:center;color:#64748b;">No collected news items in inbox. Click "Manual URL Intake" to intake a press release or "Run Collection Now" to poll verified feeds.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(c => {
    const title = c.headline || c.title || 'Untitled Story';
    const excerpt = c.sourceExcerpt || c.excerpt || c.summary || '';
    const itemUrl = c.canonicalUrl || c.originalUrl || c.url || '#';
    const method = c.collectionMethod || 'manual_url';
    const dupStatus = c.duplicateStatus || 'unique';
    const isDup = c.duplicateWarning || (dupStatus && dupStatus.startsWith('duplicate')) || (articles || []).some(a => {
      if (a.title && title && a.title.trim().toLowerCase() === title.trim().toLowerCase()) return true;
      if (a.sourceUrl && itemUrl && a.sourceUrl === itemUrl) return true;
      return false;
    });

    const methodLabels = {
      rss: 'RSS Feed',
      atom: 'Atom Feed',
      sitemap: 'XML Sitemap',
      manual_url: 'Manual URL',
      newsroom_page: 'Newsroom Page'
    };
    const methodBadge = `<span class="status-pill status-draft" style="font-size:11px;font-weight:600;">${esc(methodLabels[method] || method)}</span>`;

    const dupBadge = isDup
      ? `<span class="status-pill status-rejected" style="font-size:11px;">⚠️ ${esc((dupStatus || 'duplicate').replace('_', ' '))}</span>`
      : `<span class="status-pill status-published" style="font-size:11px;">✓ Unique</span>`;

    const rightsStatus = c.imageRightsStatus || 'unverified_editorial_fair_use_only_no_image_rights';
    const rightsBadge = rightsStatus.includes('verified')
      ? `<span class="status-pill status-published" style="font-size:11px;">✓ Verified Rights</span>`
      : `<span class="status-pill status-draft" style="font-size:11px;color:#92400e;background:#fef3c7;border:1px solid #fde68a;">⚠️ No Image Rights (Fair Use Only)</span>`;

    const relScore = c.relevanceScore !== undefined
      ? `${Math.round(c.relevanceScore * 100)}%`
      : (c.relevance ? `${c.relevance}%` : '85%');

    const dateStr = c.originalPublicationDate || c.publishedAt || c.collectionDate || c.collectedAt;
    const dtFormatted = dateStr ? new Date(dateStr).toLocaleDateString() : 'Recent';

    return `<tr>
      <td><strong>${esc(c.sourceName || c.publisher || 'Official Source')}</strong></td>
      <td>
        <a href="${esc(itemUrl)}" target="_blank" rel="noopener" class="inline-link" style="font-weight:600;font-size:14px;">${esc(title)} ↗</a>
        ${excerpt ? `<small style="display:block;color:#64748b;margin-top:3px;line-height:1.4;">${esc(excerpt.slice(0, 160))}...</small>` : ''}
      </td>
      <td><span class="status-pill status-draft">${esc(c.manufacturer || 'Various')}</span></td>
      <td style="white-space:nowrap;color:#64748b;font-size:12px;">${esc(dtFormatted)}</td>
      <td><strong>${esc(relScore)}</strong></td>
      <td>${dupBadge}</td>
      <td>${methodBadge}</td>
      <td>${rightsBadge}</td>
      <td style="text-align:right;">
        <div class="action-btn-group" style="display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="btn-success" data-inbox-draft="${esc(c.id)}" style="font-size:12px;padding:4px 8px;">Create Draft ✍️</button>
          <a href="${esc(itemUrl)}" target="_blank" rel="noopener" class="button button-outline" style="font-size:12px;padding:4px 8px;text-decoration:none;display:inline-block;">Open Source ↗</a>
          <button type="button" class="btn-danger" data-inbox-ignore="${esc(c.id)}" style="font-size:12px;padding:4px 8px;">Ignore</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderReviewQueue() {
  const tbody = $('#review-table-body');
  if (!tbody) return;

  const reviewArticles = (articles || []).filter(a => a.status === 'review');
  if ($('#review-count-badge')) {
    $('#review-count-badge').textContent = `${reviewArticles.length} Articles Awaiting Review`;
  }

  if (!reviewArticles.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:24px;text-align:center;color:#64748b;">Review queue is clear! No articles currently require editorial review.</td></tr>`;
    return;
  }

  tbody.innerHTML = reviewArticles.map(a => {
    let riskLevel = 'Low';
    let riskPill = 'status-published';
    const highRiskClaims = a.newsroomDossier?.highRiskClaims || [];
    if (highRiskClaims.length > 0) {
      riskLevel = `High (${highRiskClaims.length} claims)`;
      riskPill = 'status-rejected';
    } else if (a.riskLevel === 'high') {
      riskLevel = 'High';
      riskPill = 'status-rejected';
    } else if (a.riskLevel === 'medium' || !a.sourceUrl) {
      riskLevel = 'Medium';
      riskPill = 'status-review';
    }

    let missingInfo = 'None detected';
    if (a.newsroomDossier?.missingInformation?.length) {
      missingInfo = a.newsroomDossier.missingInformation.slice(0, 2).join('; ');
    } else if (!a.sourceUrl && (!a.sourceUrls || !a.sourceUrls.length)) {
      missingInfo = 'Missing primary source link';
    }

    const srcCount = (a.sourceUrls && a.sourceUrls.length) || (a.sourceUrl ? 1 : 0);

    let seoStatus = 'Needs Review';
    let seoPill = 'status-draft';
    if (a.seoAudit) {
      if (a.seoAudit.passed) {
        seoStatus = `Optimized (${a.seoAudit.score}/100)`;
        seoPill = 'status-published';
      } else if (a.seoAudit.errorsCount > 0) {
        seoStatus = `Issues (${a.seoAudit.score}/100)`;
        seoPill = 'status-rejected';
      } else {
        seoStatus = `Needs Review (${a.seoAudit.score}/100)`;
        seoPill = 'status-review';
      }
    }

    return `<tr>
      <td>
        <strong>${esc(a.title)}</strong>
        <small style="display:block;color:#64748b;margin-top:2px;">By ${esc(a.author || 'Staff')} · ${esc(a.category)}</small>
      </td>
      <td><span class="status-pill status-draft">${esc(a.manufacturer || 'Unassigned')}</span></td>
      <td><span class="status-pill status-draft">${esc(a.articleType || a.category || 'News')}</span></td>
      <td><span class="status-pill ${riskPill}">${esc(riskLevel)}</span></td>
      <td style="max-width:200px;font-size:12px;color:#64748b;">${esc(missingInfo)}</td>
      <td><strong>${srcCount}</strong></td>
      <td><span class="status-pill ${seoPill}">${esc(seoStatus)}</span></td>
      <td style="text-align:right;">
        <div class="action-btn-group">
          <button type="button" data-review-read="${esc(a.id)}">Read 👁</button>
          <button type="button" data-edit="${esc(a.id)}">Edit ✍️</button>
          <button type="button" class="btn-success" data-review-approve="${esc(a.id)}">Approve &amp; Schedule ✓</button>
          <button type="button" class="btn-danger" data-review-reject="${esc(a.id)}">Reject ✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderScheduledQueue() {
  const tbody = $('#scheduled-table-body');
  if (!tbody) return;

  const scheduled = (articles || []).filter(a => a.status === 'scheduled');
  if ($('#scheduled-count-badge')) {
    $('#scheduled-count-badge').textContent = `${scheduled.length} Scheduled`;
  }

  if (!scheduled.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:24px;text-align:center;color:#64748b;">No scheduled articles in queue.</td></tr>`;
    return;
  }

  tbody.innerHTML = scheduled.map(a => {
    const schedDate = a.scheduledAt ? new Date(a.scheduledAt) : null;
    const schedStr = schedDate ? schedDate.toLocaleString() : 'Not Set';
    const isPastDue = schedDate && Date.now() >= schedDate.getTime();

    return `<tr>
      <td>
        <strong>${esc(a.title)}</strong>
        <small style="display:block;color:#64748b;margin-top:2px;">${esc(a.category)} · By ${esc(a.author || 'Editorial Desk')}</small>
      </td>
      <td><span class="status-pill status-draft">${esc(a.manufacturer || 'Various')}</span></td>
      <td>
        <strong style="color:${isPastDue ? '#dc2626' : '#166534'};">⏰ ${esc(schedStr)}</strong>
        ${isPastDue ? `<span class="status-pill status-rejected" style="margin-left:6px;">Due for release</span>` : ''}
      </td>
      <td style="text-align:right;">
        <div class="action-btn-group">
          <button type="button" class="btn-success" data-scheduled-publish="${esc(a.id)}">Publish Now 🚀</button>
          <button type="button" data-scheduled-reschedule="${esc(a.id)}">Change Time ⏰</button>
          <button type="button" data-scheduled-return="${esc(a.id)}">Return to Review ↩</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPublishedDesk() {
  const tbody = $('#published-table-body');
  if (!tbody) return;

  const published = (articles || []).filter(a => a.status === 'published');
  if ($('#published-count-badge')) {
    $('#published-count-badge').textContent = `${published.length} Live`;
  }

  if (!published.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;">No published articles found.</td></tr>`;
    return;
  }

  tbody.innerHTML = published.map(a => {
    const pubDate = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'Published';
    const views = a.views || (a.analytics && a.analytics.views) || '—';

    const gsc = siteSettings.googleSearchConsole;
    let gscMetric = '<span style="color:#94a3b8;font-size:12px;">Not Connected</span>';
    if (gsc && gsc.status === 'connected' && a.searchConsole) {
      gscMetric = `<span style="font-size:12px;color:#166534;">${a.searchConsole.impressions || 0} impr · ${a.searchConsole.clicks || 0} clicks · pos ${a.searchConsole.position || '—'}</span>`;
    }

    return `<tr>
      <td>
        <a href="/news/${encodeURIComponent(a.slug)}" target="_blank" rel="noopener" class="inline-link" style="font-weight:600;">${esc(a.title)} ↗</a>
        <small style="display:block;color:#64748b;margin-top:2px;">${esc(a.category)} · By ${esc(a.author || 'Editorial Desk')}</small>
      </td>
      <td><span class="status-pill status-draft">${esc(a.manufacturer || 'Various')}</span></td>
      <td style="white-space:nowrap;color:#64748b;">${esc(pubDate)}</td>
      <td><strong>${esc(views)}</strong></td>
      <td>${gscMetric}</td>
      <td style="text-align:right;">
        <div class="action-btn-group">
          <button type="button" data-edit="${esc(a.id)}">Edit ✍️</button>
          <button type="button" data-published-update-note="${esc(a.id)}">Update Note 📝</button>
          <button type="button" class="btn-danger" data-published-unpublish="${esc(a.id)}">Unpublish ↩</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderAutomationDashboard() {
  const sources = catalog.sources || [];
  const enabledSources = sources.filter(s => s.enabled !== false && s.collectionMode !== 'disabled');
  const feedSources = sources.filter(s => s.collectionMode === 'rss' || s.collectionMode === 'atom');
  const manualSources = sources.filter(s => s.collectionMode === 'manual_url' || s.collectionMode === 'newsroom_page');
  const disabledSources = sources.filter(s => s.enabled === false || s.collectionMode === 'disabled');
  const validFeeds = sources.filter(s => s.lastValidationStatus === 'valid' || s.lastCheckStatus === 'success');
  const failedSources = sources.filter(s => (s.consecutiveFailureCount && s.consecutiveFailureCount > 0) || s.lastCheckStatus === 'error');

  if ($('#auto-metric-total')) $('#auto-metric-total').textContent = sources.length;
  if ($('#auto-metric-feeds')) $('#auto-metric-feeds').textContent = feedSources.length;
  if ($('#auto-metric-manual')) $('#auto-metric-manual').textContent = manualSources.length;
  if ($('#auto-metric-disabled')) $('#auto-metric-disabled').textContent = disabledSources.length;
  if ($('#auto-metric-valid')) $('#auto-metric-valid').textContent = validFeeds.length;
  if ($('#auto-metric-failed')) $('#auto-metric-failed').textContent = failedSources.length;

  if ($('#auto-enabled-sources')) {
    $('#auto-enabled-sources').textContent = `${enabledSources.length} of ${sources.length} sources enabled`;
  }

  const rssJob = (logsData.jobs || []).find(j => j.id === 'job-rss-collector');
  const lastRunTime = rssJob?.lastRunAt || newsroomConfig?.lastRun?.timestamp;
  const lastSuccessTime = rssJob?.lastSuccessAt || (rssJob?.status === 'success' ? rssJob.lastRunAt : null);

  if ($('#auto-last-run')) {
    $('#auto-last-run').textContent = lastRunTime ? new Date(lastRunTime).toLocaleString() : 'Never';
  }
  if ($('#auto-last-success')) {
    $('#auto-last-success').textContent = lastSuccessTime ? new Date(lastSuccessTime).toLocaleString() : (lastRunTime ? 'Same as last run' : 'Never');
  }

  const errorLogs = (logsData.auditLogs || []).filter(l => l.level === 'error' || l.action?.includes('error') || l.action?.includes('fail'));
  if ($('#auto-error-count')) {
    $('#auto-error-count').textContent = errorLogs.length;
  }

  if ($('#auto-frequency')) {
    $('#auto-frequency').textContent = `Every ${siteSettings.rssIntervalMinutes || 60} minutes`;
  }
  if ($('#auto-daily-limit')) {
    $('#auto-daily-limit').textContent = `${siteSettings.dailyArticleLimit || 12} articles / day`;
  }

  const aiStatusEl = $('#auto-ai-status');
  const aiDescEl = $('#auto-ai-desc');
  if (aiStatusEl && aiDescEl) {
    if (newsroomConfig?.keyConfigured) {
      aiStatusEl.className = 'status-pill status-published';
      aiStatusEl.textContent = `Connected (${newsroomConfig.provider} / ${newsroomConfig.model})`;
      aiDescEl.textContent = `Active single-call consolidated JSON newsroom coordinator with strict number-grounding guardrails.`;
    } else {
      aiStatusEl.className = 'status-pill status-draft';
      aiStatusEl.textContent = `Not Connected — Zero-Cost Deterministic Mode`;
      aiDescEl.textContent = `Zero-Cost Deterministic Specialist Pipeline active. Works 100% locally with 0 external API keys required. All entity extraction, duplicate detection, and risk scoring operate offline.`;
    }
  }

  const emailStatusEl = $('#auto-email-status');
  const emailDescEl = $('#auto-email-desc');
  if (emailStatusEl && emailDescEl) {
    const isConnected = distributionConfigData?.providerConnected || distributionConfigData?.emailService?.connected;
    const providerName = distributionConfigData?.emailService?.provider || 'none';
    if (isConnected && providerName !== 'none') {
      emailStatusEl.className = 'status-pill status-published';
      emailStatusEl.textContent = `Connected (${providerName})`;
      emailDescEl.textContent = `Active transactional email delivery configured.`;
    } else {
      emailStatusEl.className = 'status-pill status-draft';
      emailStatusEl.textContent = `Not Configured — Email Delivery Inactive`;
      emailDescEl.textContent = `No external email service (Mailgun / SendGrid) configured. Newsletter subscribers are saved safely to database, but automated sending is offline.`;
    }
  }

  renderSourcesRegistryTable();
}

function renderSourcesRegistryTable() {
  const tbody = $('#sources-table-body');
  if (!tbody) return;

  const sources = catalog.sources || [];
  const q = ($('#sources-search')?.value || '').trim().toLowerCase();
  const modeFilter = $('#sources-filter-mode')?.value || '';

  const filtered = sources.filter(s => {
    if (modeFilter && s.collectionMode !== modeFilter) return false;
    if (q) {
      const match = [s.name, s.publisher, s.domain, s.manufacturer, s.category, s.collectionMode].join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b;">No sources match search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isEnabled = s.enabled !== false && s.collectionMode !== 'disabled';
    const statusPill = isEnabled
      ? `<span class="status-pill status-published" style="font-size:11px;">Enabled</span>`
      : `<span class="status-pill status-rejected" style="font-size:11px;">Disabled</span>`;

    const modeLabels = {
      rss: 'RSS Feed',
      atom: 'Atom Feed',
      sitemap: 'XML Sitemap',
      manual_url: 'Manual URL Intake',
      newsroom_page: 'Newsroom Page',
      api: 'API Endpoint',
      disabled: 'Disabled (Pending)'
    };
    const modeLabel = modeLabels[s.collectionMode] || s.collectionMode || 'Manual';

    let validationBadge = `<span class="status-pill status-draft" style="font-size:11px;">Untested</span>`;
    if (s.lastValidationStatus === 'valid' || s.lastCheckStatus === 'success') {
      validationBadge = `<span class="status-pill status-published" style="font-size:11px;">✓ Validated</span>`;
    } else if (s.lastValidationStatus === 'invalid' || s.lastCheckStatus === 'error' || s.consecutiveFailureCount > 0) {
      validationBadge = `<span class="status-pill status-rejected" style="font-size:11px;">⚠️ Error</span>`;
    }

    const lastChecked = s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleDateString() : 'Never';
    const itemCount = s.itemCount || (collectedItems || []).filter(c => c.sourceId === s.id).length;
    const targetUrl = s.feedUrl || s.website || s.url || '';

    return `<tr>
      <td>
        <strong>${esc(s.name)}</strong>
        <small style="display:block;color:#64748b;font-size:11px;">${esc(s.domain || '')}</small>
      </td>
      <td>
        <span>${esc(s.manufacturer || 'Various')}</span>
        <small style="display:block;color:#64748b;font-size:11px;">${esc(s.category || 'Machinery')}</small>
      </td>
      <td><span class="status-pill status-draft" style="font-size:11px;font-weight:600;">${esc(modeLabel)}</span></td>
      <td>${statusPill}</td>
      <td>${validationBadge}</td>
      <td style="font-size:12px;color:#64748b;">${esc(lastChecked)} (${itemCount} items)</td>
      <td style="text-align:right;">
        <div style="display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="button button-outline" data-source-test="${esc(s.id)}" data-source-url="${esc(targetUrl)}" style="padding:3px 7px;font-size:11px;background:#fff;">Test Source</button>
          <button type="button" class="button button-outline" data-source-toggle="${esc(s.id)}" data-source-enabled="${isEnabled ? 'true' : 'false'}" style="padding:3px 7px;font-size:11px;background:#fff;">${isEnabled ? 'Disable' : 'Enable'}</button>
          ${targetUrl ? `<a href="${esc(targetUrl)}" target="_blank" rel="noopener" class="button button-outline" style="padding:3px 7px;font-size:11px;text-decoration:none;">Open ↗</a>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderDailyWorkflows() {
  renderNewsInbox();
  renderReviewQueue();
  renderScheduledQueue();
  renderPublishedDesk();
  renderAutomationDashboard();
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
    if ($('#header-user-display')) $('#header-user-display').textContent = sessionInfo.username;
  if ($('#header-role-display')) $('#header-role-display').textContent = sessionInfo.role;
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
  renderDailyWorkflows();
}

async function showDashboard(fromLogin = false) {
  try {
    await refresh();
    $('#login-panel').hidden = true;
    $('#dashboard').hidden = false;
    $('#manual-refresh').hidden = false;
    $('#create-backup').hidden = false;
    $('#logout').hidden = false;
    clearAlert();
  } catch (err) {
    console.error('showDashboard error:', err);
    if (fromLogin) {
      alertMsg('Dashboard load error: ' + (err.message || 'Request failed'));
    }
    if (!sessionInfo?.username && !sessionStorage.getItem('bm_token')) {
      $('#login-panel').hidden = false;
      $('#dashboard').hidden = true;
      $('#manual-refresh').hidden = true;
      $('#create-backup').hidden = true;
      $('#logout').hidden = true;
    } else {
      // Even if one secondary panel had a soft error, show dashboard!
      $('#login-panel').hidden = true;
      $('#dashboard').hidden = false;
      $('#manual-refresh').hidden = false;
      $('#create-backup').hidden = false;
      $('#logout').hidden = false;
    }
  }
}

$('#fill-dev-credentials-btn')?.addEventListener('click', () => {
  if ($('#admin-username')) $('#admin-username').value = 'editorial-admin';
  if ($('#admin-password')) $('#admin-password').value = 'Admin#2026!LocalSec';
});

$('#login-form')?.addEventListener('submit', window.__handleAdminLogin);
$('#admin-login-btn')?.addEventListener('click', window.__handleAdminLogin);

$('#enter-manual-studio-btn')?.addEventListener('click', () => switchStudio('manual'));
$('#studio-card-manual')?.addEventListener('click', (e) => {
  if (!e.target.closest('button')) switchStudio('manual');
});
$('#enter-ai-studio-btn')?.addEventListener('click', () => switchStudio('ai'));
$('#studio-card-ai')?.addEventListener('click', (e) => {
  if (!e.target.closest('button')) switchStudio('ai');
});

$('#logout').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    sessionStorage.removeItem('bm_token');
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
$('#admin-origin-filter')?.addEventListener('change', renderStories);

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

  const transferBtn = e.target.closest('[data-transfer-manual]');
  if (transferBtn) {
    const targetId = transferBtn.dataset.transferManual;
    try {
      const res = await api(`/api/admin/articles/${encodeURIComponent(targetId)}/transfer-to-manual`, { method: 'POST' });
      alertMsg(`Article "${res.article.title}" transferred to Manual Studio. AI newsroom runs will no longer overwrite it.`, 'success');
      await refresh();
      switchStudio('manual');
      const editBtn = $(`[data-edit="${res.article.id}"]`);
      if (editBtn) editBtn.click();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  const seoAuditBtn = e.target.closest('[data-seo-audit]');
  if (seoAuditBtn) {
    const targetId = seoAuditBtn.dataset.seoAudit;
    try {
      const res = await api(`/api/admin/articles/${encodeURIComponent(targetId)}/seo-audit`, { method: 'POST' });
      alertMsg(`Pre-Publication SEO Audit for "${res.title}": Score ${res.seoAudit.score}/100 (${res.seoAudit.status}). ${res.seoAudit.errorsCount} errors, ${res.seoAudit.warningsCount} warnings.`, res.seoAudit.errorsCount > 0 ? 'warning' : 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

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
    loadArticleIntoEditor(edit.dataset.edit);
    return;
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


// Spec builder dynamic rows
function addSpecRow(key = '', val = '') {
  const container = $('#spec-rows-container');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.innerHTML = `
    <input class="spec-key" value="${esc(key)}" placeholder="Specification name">
    <input class="spec-val" value="${esc(val)}" placeholder="e.g. 21,500 kg">
    <button type="button" class="button button-outline delete-spec-btn" style="padding:2px 6px;">×</button>
  `;
  container.appendChild(row);
}

$('#add-spec-row-btn')?.addEventListener('click', () => addSpecRow());

$('#spec-rows-container')?.addEventListener('click', e => {
  if (e.target.classList.contains('delete-spec-btn')) {
    e.target.closest('.spec-row')?.remove();
    triggerDirty();
  }
});

// Rich formatting toolbar
$('#editor-formatting-toolbar')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-format]');
  const textarea = $('#body');
  if (!btn || !textarea) return;
  const format = btn.dataset.format;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const sel = textarea.value.substring(start, end);

  let rep = '';
  if (format === 'h2') rep = `\n\n## ${sel || 'Section Heading'}\n\n`;
  else if (format === 'h3') rep = `\n\n### ${sel || 'Subheading'}\n\n`;
  else if (format === 'bold') rep = `**${sel || 'bold text'}**`;
  else if (format === 'italic') rep = `*${sel || 'italic text'}*`;
  else if (format === 'quote') rep = `\n\n> "${sel || 'Executive or official statement'}"\n\n`;
  else if (format === 'ul') rep = `\n\n- ${sel || 'Key operational feature'}\n- Verified capability\n- Regional availability\n\n`;
  else if (format === 'ol') rep = `\n\n1. ${sel || 'First milestone'}\n2. Second milestone\n3. Fleet rollout\n\n`;
  else if (format === 'spec-table') rep = `\n\n| Specification | Verified Metric |\n| :--- | :--- |\n| Operating Weight | 21,500 kg |\n| Engine Rated Power | 129 kW (173 hp) |\n| Bucket Capacity | 1.2 m³ |\n| Emission Standard | US EPA Tier 4 Final / EU Stage V |\n\n`;
  else if (format === 'callout') rep = `\n\n> [!NOTE]\n> **Industry Context:** ${sel || 'Important commercial machinery development and fleet deployment context.'}\n\n`;

  textarea.setRangeText(rep, start, end, 'end');
  textarea.focus();
  triggerDirty();
});

// Optional AI Writing Assistant
$('#ai-assist-container')?.addEventListener('click', async e => {
  const btn = e.target.closest('[data-ai-task]');
  if (!btn) return;
  const task = btn.dataset.aiTask;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const text = $('#body')?.value || '';
  const title = $('#title')?.value || '';

  try {
    const res = await api('/api/admin/ai/assist', {
      method: 'POST',
      body: JSON.stringify({ text, title, task })
    });

    if (task === 'grammar') {
      if (confirm('Apply grammar and clarity refinements to the article body? (Verified facts are preserved)')) {
        $('#body').value = res.result;
        alertMsg(`Grammar and tone refined using ${res.provider}.`, 'success');
      }
    } else if (task === 'headline') {
      if (confirm(`Apply suggested headline: "${res.result}"?`)) {
        $('#title').value = res.result;
        alertMsg('Suggested headline applied.', 'success');
      }
    } else if (task === 'summary') {
      if (confirm(`Apply 2-sentence summary to excerpt: "${res.result}"?`)) {
        $('#excerpt').value = res.result;
        alertMsg('Executive summary applied.', 'success');
      }
    } else if (task === 'structure') {
      if (confirm('Append structured technical subheadings and bullet points to article body?')) {
        $('#body').value = ($('#body').value + '\n\n' + res.result).trim();
        alertMsg('Structured headings added.', 'success');
      }
    } else if (task === 'seo') {
      if (res.result?.metaTitle) $('#seo-title').value = res.result.metaTitle;
      if (res.result?.metaDescription) $('#seo-description').value = res.result.metaDescription;
      if (res.result?.keywords) $('#seo-keywords').value = res.result.keywords.join(', ');
      alertMsg('Optimized SEO metadata applied.', 'success');
    }
    triggerDirty();
  } catch (err) {
    alertMsg('AI Assistant error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});

// Autosave system
let isFormDirty = false;
function triggerDirty() {
  isFormDirty = true;
  const pill = $('#autosave-status');
  if (pill) {
    pill.className = 'autosave-pill saving';
    pill.textContent = 'Unsaved changes';
  }
}
$('#article-form')?.addEventListener('input', triggerDirty);

setInterval(async () => {
  if (!isFormDirty) return;
  const title = $('#title')?.value?.trim();
  const body = $('#body')?.value?.trim();
  if (!title || title.length < 8 || !body || body.length < 20) return;

  const pill = $('#autosave-status');
  if (pill) {
    pill.className = 'autosave-pill saving';
    pill.textContent = 'Autosaving draft...';
  }

  try {
    const data = formData('draft');
    const id = $('#article-id')?.value;
    let saved;
    if (id) {
      saved = await api('/api/admin/articles/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } else {
      saved = await api('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (saved?.id) $('#article-id').value = saved.id;
    }
    isFormDirty = false;
    const nowTime = new Date().toLocaleTimeString();
    if (pill) {
      pill.className = 'autosave-pill saved';
      pill.textContent = `Draft saved at ${nowTime}`;
    }
  } catch (err) {
    if (pill) {
      pill.className = 'autosave-pill';
      pill.textContent = 'Autosave paused';
    }
  }
}, 30000);

// ============================================================================
// DAILY EDITORIAL WORKFLOW ACTION LISTENERS
// ============================================================================

// Search and filter for News Inbox
$('#inbox-search')?.addEventListener('input', renderNewsInbox);
$('#inbox-filter-status')?.addEventListener('change', renderNewsInbox);

// Manual URL Intake UI
$('#inbox-manual-intake-btn')?.addEventListener('click', () => {
  const card = $('#inbox-intake-card');
  if (card) {
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
    if (card.style.display === 'block') $('#intake-url')?.focus();
  }
});

$('#inbox-intake-close')?.addEventListener('click', () => {
  const card = $('#inbox-intake-card');
  if (card) card.style.display = 'none';
});

$('#inbox-intake-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = ($('#intake-url')?.value || '').trim();
  const manufacturer = $('#intake-manufacturer')?.value || '';
  const statusEl = $('#intake-status-msg');
  const submitBtn = $('#intake-submit-btn');

  if (!url) return;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Intaking...';
  }
  if (statusEl) {
    statusEl.style.color = '#0284c7';
    statusEl.textContent = 'Fetching and extracting metadata from approved newsroom...';
  }

  try {
    const res = await api('/api/admin/collected/intake-url', {
      method: 'POST',
      body: JSON.stringify({ url, manufacturer: manufacturer || undefined })
    });
    if (statusEl) {
      statusEl.style.color = '#16a34a';
      statusEl.textContent = `✓ Ingested: "${res.item?.headline || 'Press Release'}". Duplicate check: ${res.duplicateStatus || 'unique'}.`;
    }
    alertMsg(`Successfully placed into News Inbox: "${res.item?.headline || 'Story'}"`, 'success');
    $('#intake-url').value = '';
    const updated = await api('/api/admin/collected').catch(() => []);
    collectedItems = updated;
    renderNewsInbox();
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = '#dc2626';
      statusEl.textContent = `Intake failed: ${err.message}`;
    }
    alertMsg(err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Intake URL into Inbox';
    }
  }
});

// Sources registry search and filter listeners
$('#sources-search')?.addEventListener('input', renderSourcesRegistryTable);
$('#sources-filter-mode')?.addEventListener('change', renderSourcesRegistryTable);

// Candidate Registry Import
$('#auto-import-candidates-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Importing...';
  }
  try {
    const res = await api('/api/admin/sources/import-candidates', { method: 'POST', body: '{}' });
    alertMsg(`Import complete! Total sources: ${res.totalSources}, Updated: ${res.updatedCount}, Inserted: ${res.insertedCount}`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(`Import error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📥 Import Candidate Registry';
    }
  }
});

$('#check-all-sources-live-btn')?.addEventListener('click', e => triggerNewsCollection(e.currentTarget));
$('#check-all-sources-test-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Testing...';
  }
  try {
    const res = await api('/api/admin/sources/check-all', {
      method: 'POST',
      body: JSON.stringify({ mode: 'test' })
    });
    alertMsg(`Test collection finished. Checked ${res.sourcesChecked || 0} feeds, inserted ${res.totalInserted || 0} sample items.`, 'success');
    await refresh();
  } catch (err) {
    alertMsg(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Test Mode';
    }
  }
});

// Manual Collection Buttons
async function triggerNewsCollection(btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Collecting...';
  }
  try {
    const res = await api('/api/admin/sources/check-all', {
      method: 'POST',
      body: JSON.stringify({ mode: 'live' })
    });
    alertMsg(`RSS news collection finished. Detected ${res.newArticlesCount || res.collectedCount || 0} items.`, 'success');
    await refresh();
  } catch (err) {
    alertMsg('Collection error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Run Collection Now';
    }
  }
}

$('#inbox-collect-btn')?.addEventListener('click', e => triggerNewsCollection(e.currentTarget));
$('#automation-collect-btn')?.addEventListener('click', e => triggerNewsCollection(e.currentTarget));

// Delegated click handler for workflow tables, advanced navigation, and action buttons
document.addEventListener('click', async e => {
  // Advanced subtab jumping
  const advBtn = e.target.closest('[data-adv-target]');
  if (advBtn) {
    const targetTab = advBtn.dataset.advTarget;
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === targetTab));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== targetTab;
    });
    return;
  }

  // Switch tab links
  const switchLink = e.target.closest('[data-switch-tab]');
  if (switchLink) {
    e.preventDefault();
    const targetTab = switchLink.dataset.switchTab;
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === targetTab));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== targetTab;
    });
    return;
  }

  // Inbox: Create Draft
  const inboxDraftBtn = e.target.closest('[data-inbox-draft]');
  if (inboxDraftBtn) {
    const id = inboxDraftBtn.dataset.inboxDraft;
    const c = collectedItems.find(x => x.id === id);
    if (!c) return;
    $$('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tab-articles'));
    $$('.admin-tab-pane').forEach(pane => {
      pane.hidden = pane.id !== 'tab-articles';
    });
    resetForm();
    $('#article-id').value = '';
    $('#title').value = c.title || '';
    $('#excerpt').value = (c.summary || c.title || '').slice(0, 300);
    $('#body').value = c.content || c.summary || c.title || '';
    $('#source-url').value = c.url || '';
    if (c.manufacturer && $('#manufacturer')) $('#manufacturer').value = c.manufacturer;
    if (c.category && $('#category')) $('#category').value = c.category;
    $('#status').value = 'draft';
    $('#editor-title').textContent = 'Create draft from collected intelligence: ' + (c.title || '');
    alertMsg(`Draft prefilled from "${c.sourceName}". Please review, format, and save.`, 'success');
    try {
      await api(`/api/admin/collected/${encodeURIComponent(c.id)}/promote`, { method: 'POST' });
    } catch {}
    $('#article-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Inbox: Ignore
  const inboxIgnoreBtn = e.target.closest('[data-inbox-ignore]');
  if (inboxIgnoreBtn) {
    const id = inboxIgnoreBtn.dataset.inboxIgnore;
    try {
      await api(`/api/admin/collected/${encodeURIComponent(id)}`, { method: 'DELETE' });
      collectedItems = collectedItems.filter(x => x.id !== id);
      renderNewsInbox();
      alertMsg('Collected item removed from active inbox.', 'info');
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Source: Test Endpoint
  const srcTestBtn = e.target.closest('[data-source-test]');
  if (srcTestBtn) {
    const testUrl = srcTestBtn.dataset.sourceUrl;
    const banner = $('#source-test-result-box');
    if (!testUrl) {
      alertMsg('No endpoint URL configured for this source.');
      return;
    }
    srcTestBtn.disabled = true;
    srcTestBtn.textContent = 'Testing...';
    if (banner) {
      banner.style.display = 'block';
      banner.style.background = '#f0f9ff';
      banner.style.border = '1px solid #bae6fd';
      banner.style.color = '#0369a1';
      banner.textContent = `Validating endpoint "${testUrl}" (testing HTTP status, redirects, format, dates, SSRF safe)...`;
    }
    try {
      const res = await api('/api/admin/sources/validate', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl })
      });
      if (banner) {
        if (res.valid) {
          banner.style.background = '#f0fdf4';
          banner.style.border = '1px solid #bbf7d0';
          banner.style.color = '#15803d';
          banner.innerHTML = `<strong>✓ Valid machine endpoint:</strong> ${esc(res.notes || 'OK')} | HTTP ${res.httpStatus} | Format: ${esc(res.detectedFormat)} | Sample items: ${res.itemCount} | Dates extractable: ${res.canExtractDates ? 'Yes' : 'No'}`;
        } else {
          banner.style.background = '#fef2f2';
          banner.style.border = '1px solid #fecaca';
          banner.style.color = '#b91c1c';
          banner.innerHTML = `<strong>⚠️ Verification Failed:</strong> ${esc(res.notes || res.error || 'Endpoint invalid')} | HTTP ${res.httpStatus || 'N/A'}`;
        }
      }
    } catch (err) {
      if (banner) {
        banner.style.background = '#fef2f2';
        banner.style.border = '1px solid #fecaca';
        banner.style.color = '#b91c1c';
        banner.textContent = `Endpoint test error: ${err.message}`;
      }
    } finally {
      srcTestBtn.disabled = false;
      srcTestBtn.textContent = 'Test Source';
    }
    return;
  }

  // Source: Toggle Enabled
  const srcToggleBtn = e.target.closest('[data-source-toggle]');
  if (srcToggleBtn) {
    const sourceId = srcToggleBtn.dataset.sourceToggle;
    const currentlyEnabled = srcToggleBtn.dataset.sourceEnabled === 'true';
    srcToggleBtn.disabled = true;
    try {
      const res = await api(`/api/admin/sources/${encodeURIComponent(sourceId)}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !currentlyEnabled })
      });
      alertMsg(`Source "${res.source?.name}" is now ${res.source?.enabled ? 'enabled' : 'disabled'}.`, 'success');
      if (catalog.sources) {
        const idx = catalog.sources.findIndex(s => s.id === sourceId);
        if (idx >= 0) catalog.sources[idx] = res.source;
      }
      renderAutomationDashboard();
    } catch (err) {
      alertMsg(err.message);
    } finally {
      srcToggleBtn.disabled = false;
    }
    return;
  }

  // Review Queue: Read Preview
  const reviewReadBtn = e.target.closest('[data-review-read]');
  if (reviewReadBtn) {
    const id = reviewReadBtn.dataset.reviewRead;
    const a = articles.find(x => x.id === id);
    if (a) openArticlePreview(a);
    return;
  }

  // Review Queue: Approve & Schedule
  const reviewApproveBtn = e.target.closest('[data-review-approve]');
  if (reviewApproveBtn) {
    const id = reviewApproveBtn.dataset.reviewApprove;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    const defaultTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const dtInput = prompt(`Approve & Schedule publication for "${a.title}".\nEnter scheduled publication time (YYYY-MM-DDTHH:MM, or type 'now' to publish immediately):`, defaultTime);
    if (!dtInput) return;
    const isNow = dtInput.trim().toLowerCase() === 'now';
    const scheduledAt = isNow ? null : new Date(dtInput).toISOString();
    const nextStatus = isNow ? 'published' : 'scheduled';
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          scheduledAt,
          publishedAt: isNow ? new Date().toISOString() : undefined,
          revisionNote: isNow ? 'Approved and published immediately by editor' : `Approved and scheduled for publication at ${scheduledAt}`
        })
      });
      alertMsg(`Article "${a.title}" ${isNow ? 'published live' : 'scheduled for release'}.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Review Queue: Reject
  const reviewRejectBtn = e.target.closest('[data-review-reject]');
  if (reviewRejectBtn) {
    const id = reviewRejectBtn.dataset.reviewReject;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    const note = prompt(`Enter reason for rejection (returns article to draft with note):`, 'Requires additional primary source fact verification');
    if (note === null) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'draft',
          revisionNote: `Rejected in Review Queue: ${note}`
        })
      });
      alertMsg(`Article "${a.title}" returned to draft status.`, 'info');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Scheduled: Publish Now
  const schedPubBtn = e.target.closest('[data-scheduled-publish]');
  if (schedPubBtn) {
    const id = schedPubBtn.dataset.scheduledPublish;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Publish "${a.title}" live right now?`)) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'published',
          publishedAt: new Date().toISOString(),
          revisionNote: 'Published manually from Scheduled Queue'
        })
      });
      alertMsg(`Article "${a.title}" is now published live!`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Scheduled: Change Time
  const schedReschedBtn = e.target.closest('[data-scheduled-reschedule]');
  if (schedReschedBtn) {
    const id = schedReschedBtn.dataset.scheduledReschedule;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    const curTime = a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 16) : new Date(Date.now() + 3600000).toISOString().slice(0, 16);
    const newTime = prompt(`Change scheduled publication time for "${a.title}":`, curTime);
    if (!newTime) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: new Date(newTime).toISOString(),
          revisionNote: `Publication rescheduled to ${newTime}`
        })
      });
      alertMsg(`Article "${a.title}" rescheduled.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Scheduled: Return to Review
  const schedReturnBtn = e.target.closest('[data-scheduled-return]');
  if (schedReturnBtn) {
    const id = schedReturnBtn.dataset.scheduledReturn;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Return "${a.title}" to Review Queue?`)) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'review',
          revisionNote: 'Returned to Review Queue from Scheduled'
        })
      });
      alertMsg(`Article "${a.title}" returned to Review Queue.`, 'info');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Published: Update Note
  const pubNoteBtn = e.target.closest('[data-published-update-note]');
  if (pubNoteBtn) {
    const id = pubNoteBtn.dataset.publishedUpdateNote;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    const note = prompt(`Enter update note to append to live article "${a.title}":`);
    if (!note || !note.trim()) return;
    const timestamp = new Date().toLocaleString();
    const updateFormatted = `\n\n**UPDATE (${timestamp}):** ${note.trim()}\n`;
    const newBody = (a.body || '') + updateFormatted;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          body: newBody,
          updatedAt: new Date().toISOString(),
          revisionNote: `Editorial update note: ${note.trim().slice(0, 80)}`
        })
      });
      alertMsg(`Live article updated with editorial note.`, 'success');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Published: Unpublish
  const pubUnpublishBtn = e.target.closest('[data-published-unpublish]');
  if (pubUnpublishBtn) {
    const id = pubUnpublishBtn.dataset.publishedUnpublish;
    const a = articles.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Unpublish live article "${a.title}" and return it to draft?`)) return;
    try {
      await api(`/api/admin/articles/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'draft',
          revisionNote: 'Unpublished by editor from Published Desk'
        })
      });
      alertMsg(`Article "${a.title}" unpublished and moved to draft.`, 'info');
      await refresh();
    } catch (err) {
      alertMsg(err.message);
    }
    return;
  }

  // Any other data-edit button outside of #admin-story-list
  const anyEdit = e.target.closest('[data-edit]');
  if (anyEdit && !e.target.closest('#admin-story-list')) {
    loadArticleIntoEditor(anyEdit.dataset.edit);
  }
});
