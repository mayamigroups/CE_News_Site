const collector = require('../collector.js');
const models = require('../models.js');

class CollectionService {
  constructor({ sourceRepository, articleRepository, editorialRepository, store }) {
    this.sourceRepo = sourceRepository;
    this.articleRepo = articleRepository;
    this.editorialRepo = editorialRepository;
    this.store = store;
  }

  getSources() {
    return this.sourceRepo.getSources();
  }

  async checkSource(sourceId, { mode = 'live', actor = 'Editorial Desk', sampleXml } = {}) {
    return collector.checkSourceNow(this.store, sourceId, {
      mode,
      actor,
      sampleXml
    });
  }

  async checkAllSources({ mode = 'live', actor = 'Editorial Desk' } = {}) {
    const allSources = this.getSources();
    const runnable = allSources.filter(s => s.enabled !== false && (mode === 'test' || s.feedUrl || s.apiEndpoint));
    const results = [];
    for (const s of runnable) {
      const resItem = await collector.checkSourceNow(this.store, s.id, { mode, actor });
      results.push(resItem);
    }
    return {
      ok: true,
      mode,
      sourcesChecked: results.length,
      totalDiscovered: results.reduce((sum, r) => sum + (r.discoveredCount || 0), 0),
      totalInserted: results.reduce((sum, r) => sum + (r.insertedCount || 0), 0),
      totalDuplicates: results.reduce((sum, r) => sum + (r.duplicateCount || 0), 0),
      results
    };
  }

  clearSourceErrors(sourceId) {
    return collector.clearSourceErrors(this.store, sourceId);
  }

  getCollectedItems() {
    return this.sourceRepo.getCollectedItems();
  }

  promoteCollectedItem(id, actor = 'Editorial Desk', options = {}) {
    const col = this.sourceRepo.getCollectedItemById(id);
    if (!col) {
      const err = new Error('Collected item not found');
      err.statusCode = 404;
      throw err;
    }

    const articles = this.articleRepo.getAll();
    const { slugInput, ...draftArticle } = models.validateAndNormalizeArticle({
      title: col.title,
      summary: col.excerpt.slice(0, 320),
      excerpt: col.excerpt.slice(0, 320),
      body: `${col.excerpt}\n\n[Editorial Verification Required: Verify facts, regional specifications, and wording directly against the original source (${col.canonicalUrl}) before publishing.]`,
      category: col.category || 'Industry News',
      manufacturer: col.manufacturer || 'Various',
      country: col.country || 'Global',
      region: col.region || 'Global',
      sourceUrl: col.canonicalUrl,
      sourceUrls: [col.canonicalUrl],
      author: actor || 'Editorial Desk',
      status: 'draft',
      revisionNote: `Promoted from collected feed item (${col.sourceName})`
    }, null, {
      actor,
      note: `Promoted from collected feed item (${col.sourceName})`
    });

    let baseSlug = slugInput || models.makeSlug(draftArticle.title) || 'collected-draft';
    let candidate = baseSlug;
    let n = 2;
    while (articles.some(a => a.slug === candidate)) candidate = `${baseSlug}-${n++}`;
    draftArticle.slug = candidate;

    const saved = this.articleRepo.create(draftArticle);
    this.articleRepo.syncEntities(saved);

    const updatedCol = this.sourceRepo.saveCollectedItem({
      ...col,
      reviewStatus: 'promoted_to_draft',
      promotedArticleId: saved.id
    });

    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor,
        role: options.role || 'editor',
        action: 'collector.promote_to_draft',
        target: `${saved.title} (${saved.id})`,
        level: 'info',
        details: `Promoted collected item from "${col.sourceName}" into a draft article (not published).`
      });
    }

    return {
      ok: true,
      article: saved,
      collectedItem: updatedCol
    };
  }

  deleteCollectedItem(id) {
    return this.sourceRepo.deleteCollectedItem(id);
  }

  async validateEndpoint(url, options = {}) {
    return collector.validateSourceEndpoint(url, options);
  }

  async intakeManualUrl(url, options = {}) {
    return collector.intakeManualUrl(this.store, url, options);
  }

  importCandidates(candidates, actor = 'Editorial Desk') {
    return collector.importCandidateRegistry(this.store, candidates, { actor });
  }

  toggleSource(sourceId, enabled, actor = 'Editorial Desk') {
    const sources = this.sourceRepo.getSources();
    const idx = sources.findIndex(s => s.id === sourceId || s.slug === sourceId);
    if (idx < 0) {
      const err = new Error('Source not found');
      err.statusCode = 404;
      throw err;
    }
    const current = sources[idx];
    const updated = {
      ...current,
      enabled: Boolean(enabled),
      updatedAt: new Date().toISOString()
    };
    sources[idx] = updated;
    this.sourceRepo.saveSources(sources);
    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor,
        action: 'collector.toggle_source',
        target: `${updated.name} (${updated.id})`,
        level: 'info',
        details: `Source ${updated.name} set enabled=${updated.enabled}`
      });
    }
    return updated;
  }
}

module.exports = { CollectionService };
