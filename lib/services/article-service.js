const crypto = require('node:crypto');
const models = require('../models.js');
const aiSeo = require('../ai_seo.js');
const seoLib = require('../seo.js');
const distribution = require('../distribution.js');

function publicArticle(a) {
  if (!a) return null;
  const { status, verificationNotes, rejectionReason, ...rest } = a;
  return rest;
}

class ArticleService {
  constructor({ articleRepository, taxonomyRepository, editorialRepository, store }) {
    this.articleRepo = articleRepository;
    this.taxonomyRepo = taxonomyRepository;
    this.editorialRepo = editorialRepository;
    this.store = store;
  }

  getPublicArticleView(a) {
    return publicArticle(a);
  }

  getPublicArticles({
    q = '',
    category = '',
    manufacturer = '',
    equipment = '',
    modelParam = '',
    country = '',
    region = '',
    articleType = '',
    tag = ''
  } = {}) {
    let articles = this.articleRepo.getAll().filter(a => a.status === 'published');

    if (q) {
      if (q.length >= 2 && this.store) {
        try { seoLib.recordTelemetryEvent(this.store, { type: 'search', query: q }); } catch {}
      }
      articles = articles.filter(a =>
        [a.title, a.summary, a.excerpt, a.body, a.manufacturer, a.category, a.equipmentType, a.country, a.region, a.model, ...(a.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())
      );
    }
    if (category) {
      articles = articles.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
    }
    if (manufacturer) {
      articles = articles.filter(a => (a.manufacturer || '').toLowerCase().includes(manufacturer.toLowerCase()));
    }
    if (equipment) {
      articles = articles.filter(a => (a.equipmentType || '').toLowerCase().includes(equipment.toLowerCase()));
    }
    if (modelParam) {
      articles = articles.filter(a => (a.model || '').toLowerCase().includes(modelParam.toLowerCase()));
    }
    if (country) {
      articles = articles.filter(a =>
        (a.country || '').toLowerCase() === country.toLowerCase() ||
        (a.region || '').toLowerCase() === country.toLowerCase()
      );
    }
    if (region) {
      articles = articles.filter(a => (a.region || '').toLowerCase() === region.toLowerCase());
    }
    if (articleType) {
      articles = articles.filter(a => (a.articleType || 'news') === articleType);
    }
    if (tag) {
      articles = articles.filter(a => (a.tags || []).some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    articles.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return articles.map(publicArticle);
  }

  getPublishedArticles(filters = {}) {
    return this.getPublicArticles(filters);
  }

  getPublicArticleBySlug(slug) {
    const article = this.articleRepo.getAll().find(a => a.slug === slug && a.status === 'published');
    if (!article) return null;

    const internalLinks = this.store ? seoLib.buildInternalLinkGraphForArticle(article, this.store) : [];
    const shareLinks = this.store ? distribution.buildShareableLinksForArticle(article, this.store) : {};

    return {
      ...publicArticle(article),
      internalLinks,
      shareLinks
    };
  }

  getPublishedArticleBySlug(slug) {
    return this.getPublicArticleBySlug(slug);
  }

  getArticleById(id) {
    return this.articleRepo.getById(id);
  }

  getAllArticlesForAdmin(filters = {}) {
    return this.articleRepo.find(filters);
  }

  checkDuplicate(criteria = {}) {
    const excludeId = String(criteria.excludeId || '');
    const checkTitle = String(criteria.title || '').trim().toLowerCase();
    const checkSlug = models.makeSlug(criteria.slug || criteria.title || '');
    const checkSource = String(criteria.sourceUrl || '').trim().toLowerCase();
    const all = this.articleRepo.getAll().filter(a => a.id !== excludeId);

    const matches = all.filter(a =>
      (checkTitle && (a.title || '').toLowerCase() === checkTitle) ||
      (checkSlug && a.slug === checkSlug) ||
      (checkSource && (a.sourceUrl || '').toLowerCase() === checkSource)
    ).map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      status: a.status,
      reason: checkTitle && (a.title || '').toLowerCase() === checkTitle
        ? 'Exact headline match'
        : (checkSlug && a.slug === checkSlug ? 'Identical URL slug' : 'Shared primary source URL')
    }));

    return { hasDuplicates: matches.length > 0, matches };
  }

  createArticle(rawBody, session = {}) {
    const requestedStatus = rawBody.status || 'draft';
    const roleRanks = { author: 1, reviewer: 2, managing_editor: 3, super_admin: 4 };
    const userRoleRank = roleRanks[session.role] || 0;

    if (['published', 'scheduled', 'archived'].includes(requestedStatus) && userRoleRank < roleRanks.managing_editor) {
      const err = new Error(`Your role (${session.role}) can create drafts or submit for review, but only managing_editor or super_admin can set status to "${requestedStatus}".`);
      err.statusCode = 403;
      throw err;
    }
    if (requestedStatus === 'rejected' && userRoleRank < roleRanks.reviewer) {
      const err = new Error(`Your role (${session.role}) cannot reject articles.`);
      err.statusCode = 403;
      throw err;
    }

    const articles = this.articleRepo.getAll();
    const cleanTitle = String(rawBody.title || '').trim().toLowerCase();

    if (!rawBody.allowDuplicateTitle && articles.some(a => (a.title || '').toLowerCase() === cleanTitle)) {
      if (this.editorialRepo) {
        this.editorialRepo.appendAuditLog({
          actor: session.username || 'unknown',
          role: session.role || 'author',
          action: 'article.duplicate_blocked',
          target: rawBody.title || 'Untitled',
          level: 'warn',
          details: 'Blocked duplicate headline creation.'
        });
      }
      const err = new Error('An article with this exact headline already exists. Edit the existing article or modify the headline.');
      err.statusCode = 409;
      throw err;
    }

    const { slugInput, ...article } = models.validateAndNormalizeArticle(rawBody, null, {
      actor: session.username || rawBody.author || 'Editorial Desk',
      note: rawBody.revisionNote || ''
    });

    if (article.featured) {
      for (const a of articles) {
        if (a.featured) {
          this.articleRepo.update(a.id, { featured: false });
        }
      }
    }

    let baseSlug = slugInput || models.makeSlug(article.title) || 'news-story';
    let candidate = baseSlug;
    let n = 2;
    while (articles.some(a => a.slug === candidate)) {
      candidate = `${baseSlug}-${n++}`;
    }
    article.slug = candidate;

    const saved = this.articleRepo.create(article);
    this.articleRepo.syncEntities(saved);

    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor: session.username || 'unknown',
        role: session.role || 'author',
        action: `article.create.${saved.status}`,
        target: `${saved.title} (${saved.slug})`,
        level: 'info',
        details: `Created article with status "${saved.status}".`
      });
    }

    return saved;
  }

  updateArticle(id, patch, session = {}) {
    const articles = this.articleRepo.getAll();
    const index = articles.findIndex(a => a.id === id);
    if (index < 0) {
      const err = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    const roleRanks = { author: 1, reviewer: 2, managing_editor: 3, super_admin: 4 };
    const userRoleRank = roleRanks[session.role] || 0;
    const nextStatus = patch.status || articles[index].status;

    if (['published', 'scheduled', 'archived'].includes(nextStatus) && userRoleRank < roleRanks.managing_editor) {
      const err = new Error(`Role "${session.role}" cannot transition an article to "${nextStatus}". Requires managing_editor or super_admin.`);
      err.statusCode = 403;
      throw err;
    }
    if (nextStatus === 'rejected' && userRoleRank < roleRanks.reviewer) {
      const err = new Error(`Role "${session.role}" cannot reject articles. Requires reviewer or higher.`);
      err.statusCode = 403;
      throw err;
    }

    if (patch.title) {
      const cleanTitle = String(patch.title).trim().toLowerCase();
      if (articles.some((a, i) => i !== index && (a.title || '').toLowerCase() === cleanTitle)) {
        const err = new Error('Another article already uses this exact headline.');
        err.statusCode = 409;
        throw err;
      }
    }

    const { slugInput, ...updated } = models.validateAndNormalizeArticle(patch, articles[index], {
      actor: patch.updatedBy || session.username || patch.author || articles[index].author || 'Editorial Desk',
      note: patch.revisionNote || ''
    });

    if (updated.featured) {
      for (let i = 0; i < articles.length; i++) {
        if (i !== index && articles[i].featured) {
          this.articleRepo.update(articles[i].id, { featured: false });
        }
      }
    }

    if (patch.slug && slugInput && slugInput !== articles[index].slug) {
      let candidate = slugInput;
      let n = 2;
      while (articles.some((a, i) => i !== index && a.slug === candidate)) {
        candidate = `${slugInput}-${n++}`;
      }
      updated.slug = candidate;
    } else if (patch.title && patch.title !== articles[index].title && !patch.slug) {
      const base = models.makeSlug(updated.title) || 'news-story';
      let slug = base;
      let n = 2;
      while (articles.some((a, i) => i !== index && a.slug === slug)) {
        slug = `${base}-${n++}`;
      }
      updated.slug = slug;
    }

    const saved = this.articleRepo.update(id, updated);
    this.articleRepo.syncEntities(saved);

    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor: session.username || 'unknown',
        role: session.role || 'author',
        action: `article.update.${saved.status}`,
        target: `${saved.title} (${saved.slug})`,
        level: 'info',
        details: patch.revisionNote || `Updated article (status: ${saved.status}).`
      });
    }

    return saved;
  }

  deleteArticle(id, session = {}) {
    const roleRanks = { author: 1, reviewer: 2, managing_editor: 3, super_admin: 4 };
    const userRoleRank = roleRanks[session.role] || 0;
    if (userRoleRank < roleRanks.managing_editor) {
      const err = new Error('Only managing_editor or super_admin can permanently delete articles.');
      err.statusCode = 403;
      throw err;
    }

    const targetArt = this.articleRepo.getById(id);
    if (!targetArt) {
      const err = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    if (this.store) {
      try { this.store.createBackup(`pre-delete-article-${targetArt.slug}`); } catch {}
    }

    const success = this.articleRepo.delete(id);

    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor: session.username || 'unknown',
        role: session.role || 'managing_editor',
        action: 'article.delete',
        target: `${targetArt.title} (${targetArt.id})`,
        level: 'warn',
        details: 'Permanently deleted article.'
      });
    }

    return success;
  }

  auditArticle(id, session = {}, isPost = false) {
    const targetArt = this.articleRepo.getById(id);
    if (!targetArt) {
      const err = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    const catalog = this.taxonomyRepo ? this.taxonomyRepo.getCatalogSummary() : {};
    const auditResult = aiSeo.auditArticleSeo(targetArt, catalog);

    if (isPost) {
      targetArt.seoAudit = auditResult;
      targetArt.updatedAt = new Date().toISOString();
      this.articleRepo.update(id, {
        seoAudit: auditResult,
        updatedAt: targetArt.updatedAt
      });

      if (this.editorialRepo) {
        this.editorialRepo.appendAuditLog({
          actor: session.username || 'editor',
          role: session.role || 'reviewer',
          action: 'article.seo_audit_rerun',
          target: `${targetArt.title} (${targetArt.id})`,
          level: 'info',
          details: `Pre-publication SEO audit rerun: score ${auditResult.score}/100, ${auditResult.errorsCount} error(s), ${auditResult.warningsCount} warning(s).`
        });
      }
    }

    return {
      ok: true,
      articleId: targetArt.id,
      title: targetArt.title,
      seoAudit: auditResult
    };
  }

  transferToManual(id, session = {}) {
    const targetArt = this.articleRepo.getById(id);
    if (!targetArt) {
      const err = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }

    const history = Array.isArray(targetArt.updateHistory) ? [...targetArt.updateHistory] : [];
    history.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: session.username || 'editor',
      action: 'transfer_to_manual',
      status: targetArt.status,
      changedFields: ['origin'],
      note: 'Transferred from AI Newsroom to Manual Editorial Studio for human editing.'
    });

    const updated = this.articleRepo.update(id, {
      origin: 'manual',
      updateHistory: history,
      updatedAt: new Date().toISOString()
    });

    if (this.editorialRepo) {
      this.editorialRepo.appendAuditLog({
        actor: session.username || 'editor',
        role: session.role || 'editor',
        action: 'article.transfer_to_manual',
        target: `${updated.title} (${updated.id})`,
        level: 'info',
        details: 'Transferred article from AI newsroom to Manual Editorial Studio.'
      });
    }

    return { ok: true, article: updated };
  }
}

module.exports = { ArticleService, publicArticle };
