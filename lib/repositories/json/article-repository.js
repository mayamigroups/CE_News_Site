const { JsonRepository } = require('./json-repository.js');

class JsonArticleRepository extends JsonRepository {
  constructor(store) {
    super(store, 'articles');
  }

  getAll() {
    try {
      const workflow = require('../../workflow.js');
      workflow.processDueScheduledArticles(this.store, 'On-Request Scheduler');
    } catch {}
    return super.getAll();
  }

  getBySlug(slug) {
    if (!slug) return null;
    const clean = String(slug).toLowerCase();
    return this.getAll().find(a => (a.slug || '').toLowerCase() === clean) || null;
  }

  getPublishedArticles() {
    return this.getAll().filter(a => a.status === 'published' && (!a.seo || !a.seo.noIndex));
  }

  find({ status, category, manufacturer, country, region, model, query, origin, limit, offset } = {}) {
    let list = this.getAll();

    if (status) {
      list = list.filter(a => a.status === status);
    }
    if (origin) {
      list = list.filter(a => (a.origin || (a.newsroomDossier ? 'ai' : 'manual')) === origin);
    }
    if (category) {
      const cat = String(category).toLowerCase();
      list = list.filter(a => (a.category || '').toLowerCase() === cat || (a.categoryId || '').toLowerCase() === cat);
    }
    if (manufacturer) {
      const mfg = String(manufacturer).toLowerCase();
      list = list.filter(a => (a.manufacturer || '').toLowerCase() === mfg || (a.manufacturerId || '').toLowerCase() === mfg);
    }
    if (country) {
      const cty = String(country).toLowerCase();
      list = list.filter(a => (a.country || '').toLowerCase() === cty || (a.countryId || '').toLowerCase() === cty);
    }
    if (region) {
      const reg = String(region).toLowerCase();
      list = list.filter(a => (a.region || '').toLowerCase() === reg || (a.regionId || '').toLowerCase() === reg);
    }
    if (model) {
      const mdl = String(model).toLowerCase();
      list = list.filter(a => (a.model || '').toLowerCase() === mdl || (a.equipmentModelId || '').toLowerCase() === mdl);
    }
    if (query) {
      const q = String(query).toLowerCase();
      list = list.filter(a =>
        [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, a.sourceUrl]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0));

    if (offset !== undefined && offset > 0) {
      list = list.slice(offset);
    }
    if (limit !== undefined && limit > 0) {
      list = list.slice(0, limit);
    }

    return list;
  }

  checkDuplicate({ title, slug, sourceUrl, excludeId }) {
    const articles = this.getAll();
    const cleanTitle = String(title || '').trim().toLowerCase();
    const cleanSlug = String(slug || '').trim().toLowerCase();
    const cleanSource = String(sourceUrl || '').trim().toLowerCase();
    const matches = [];

    for (const a of articles) {
      if (excludeId && a.id === excludeId) continue;

      if (cleanTitle && (a.title || '').trim().toLowerCase() === cleanTitle) {
        matches.push({ id: a.id, title: a.title, slug: a.slug, status: a.status, reason: 'Exact headline match' });
      } else if (cleanSlug && (a.slug || '').trim().toLowerCase() === cleanSlug) {
        matches.push({ id: a.id, title: a.title, slug: a.slug, status: a.status, reason: 'Exact URL slug match' });
      } else if (cleanSource && (a.sourceUrl || '').trim().toLowerCase() === cleanSource) {
        matches.push({ id: a.id, title: a.title, slug: a.slug, status: a.status, reason: 'Exact primary source URL match' });
      }
    }

    return {
      hasDuplicates: matches.length > 0,
      matches
    };
  }

  syncEntities(article) {
    if (typeof this.store.syncEntitiesFromArticle === 'function') {
      this.store.syncEntitiesFromArticle(article);
    }
  }
}

module.exports = { JsonArticleRepository };
