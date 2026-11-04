const crypto = require('node:crypto');
const models = require('../models.js');
const aiSeo = require('../ai_seo.js');
const seoLib = require('../seo.js');
const distribution = require('../distribution.js');
const { renderArticleBody, countWords } = require('../article-render.js');

function publicArticle(a) {
  if (!a) return null;
  const { status, verificationNotes, rejectionReason, ...rest } = a;
  return rest;
}

/**
 * Evaluate Task 5 Publishing Standards:
 * Block moving an article to "published" if:
 * - guide / review / analysis under 600 words
 * - news (or company-announcement / opinion) under 250 words
 * - missing sourceUrl
 * - missing imageCredit or altText
 */
function evaluatePublishStandards(article = {}, rawInput = {}) {
  const missing = [];
  const type = String(article.articleType || rawInput.articleType || 'news').toLowerCase();
  const bodyText = String(article.body ?? rawInput.body ?? '').trim();
  const words = countWords(bodyText);
  const minWords = ['guide', 'review', 'analysis'].includes(type) ? 600 : 250;

  if (words < minWords) {
    missing.push(`Minimum word count not met for "${type}": requires at least ${minWords} words (currently ${words} words).`);
  }

  const sourceUrl = String(article.sourceUrl || rawInput.sourceUrl || '').trim();
  if (!sourceUrl || !models.validHttpUrl(sourceUrl)) {
    missing.push('Missing primary source URL (sourceUrl).');
  }

  const imageCredit = String(
    rawInput.imageCredit !== undefined
      ? rawInput.imageCredit
      : (article.imageCredit || article.mediaRights?.credit || '')
  ).trim();
  if (!imageCredit) {
    missing.push('Missing image credit (imageCredit).');
  }

  const altText = String(
    rawInput.mediaRights?.altText !== undefined
      ? rawInput.mediaRights.altText
      : (rawInput.imageAlt !== undefined ? rawInput.imageAlt : (article.mediaRights?.altText || article.imageAlt || ''))
  ).trim();
  if (!altText) {
    missing.push('Missing image alt text (altText).');
  }

  return {
    passed: missing.length === 0,
    wordCount: words,
    minWordsRequired: minWords,
    missing
  };
}

function enforcePublishStandardsOrOverride({ article, rawInput = {}, session = {}, editorialRepo = null, store = null }) {
  const evalRes = evaluatePublishStandards(article, rawInput);
  if (evalRes.passed) {
    return { overridden: false, evaluation: evalRes };
  }

  const role = session?.role || rawInput.role || 'author';
  const canOverride = ['managing_editor', 'super_admin'].includes(role);
  const overrideReason = String(rawInput.overrideReason || rawInput.why || '').trim();
  const overrideRequested = Boolean(rawInput.overridePublishStandards || rawInput.why);

  if (canOverride && overrideRequested && overrideReason.length >= 5) {
    const logEntry = {
      actor: session?.username || rawInput.actor || 'managing_editor',
      role,
      action: 'article.publish_override',
      target: `${article.title} (${article.slug || article.id})`,
      level: 'warn',
      details: `Publishing standards override reason: ${overrideReason} | Bypassed checks: ${evalRes.missing.join(' ; ')}`
    };
    if (editorialRepo && typeof editorialRepo.appendAuditLog === 'function') {
      editorialRepo.appendAuditLog(logEntry);
    } else if (store && typeof store.appendAuditLog === 'function') {
      store.appendAuditLog(logEntry);
    }
    return { overridden: true, overrideReason, evaluation: evalRes };
  }

  const err = new Error(`Publishing standards not met: ${evalRes.missing.join(' ')}`);
  err.statusCode = 400;
  err.missingStandards = evalRes.missing;
  err.wordCount = evalRes.wordCount;
  err.minWordsRequired = evalRes.minWordsRequired;
  throw err;
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
      const remappedCat = models.remapCategoryName(category);
      articles = articles.filter(a =>
        (a.category || '').toLowerCase() === category.toLowerCase() ||
        (a.category || '').toLowerCase() === remappedCat.toLowerCase()
      );
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
    const allPublished = this.articleRepo.getAll().filter(a => a.status === 'published');
    const article = allPublished.find(a => a.slug === slug);
    if (!article) return null;

    const internalLinks = this.store ? seoLib.buildInternalLinkGraphForArticle(article, this.store) : [];
    const shareLinks = this.store ? distribution.buildShareableLinksForArticle(article, this.store) : {};

    const catalog = this.store ? this.store.getCatalogSummary() : {};
    const rendered = renderArticleBody(article, catalog);

    // Resolve author profile from data/authors.json (never invent a bio if empty)
    const authorName = article.author || 'Editorial Desk';
    const authorSlug = models.makeSlug(authorName, 80) || 'editorial-desk';
    const matchedAuthor = (catalog.authors || []).find(
      au => au.slug === authorSlug || (au.name || '').toLowerCase() === authorName.toLowerCase()
    );
    const authorProfile = {
      name: matchedAuthor?.name || authorName,
      slug: matchedAuthor?.slug || authorSlug,
      role: matchedAuthor?.role || 'Editorial Desk',
      bio: matchedAuthor?.bio ? String(matchedAuthor.bio).trim() : '',
      url: `/authors/${matchedAuthor?.slug || authorSlug}`
    };

    // Up to 3 related stories (same desk/category or brand first)
    const others = allPublished
      .filter(a => a.slug !== article.slug)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    const articleDeskSlug = models.CATEGORY_PARENT_MAP[models.makeSlug(article.category || '', 80)] || models.makeSlug(article.category || '', 80);
    const isRealMfg = article.manufacturer && !['Various', 'All Manufacturers', 'Editorial Desk'].includes(article.manufacturer);

    const sameBrandOrDesk = others.filter(x => {
      const xCatSlug = models.makeSlug(x.category || '', 80);
      const xDeskSlug = models.CATEGORY_PARENT_MAP[xCatSlug] || xCatSlug;
      const brandMatch = isRealMfg && x.manufacturer && x.manufacturer.toLowerCase() === article.manufacturer.toLowerCase();
      const deskMatch = xCatSlug === models.makeSlug(article.category || '', 80) || (articleDeskSlug && xDeskSlug === articleDeskSlug);
      return brandMatch || deskMatch;
    });
    const fallbackOthers = others.filter(x => !sameBrandOrDesk.some(s => s.slug === x.slug));
    const relatedStories = [...sameBrandOrDesk, ...fallbackOthers].slice(0, 3).map(publicArticle);

    return {
      ...publicArticle(article),
      internalLinks,
      shareLinks,
      bodyHtml: rendered.bodyHtml,
      takeaways: rendered.takeaways,
      wordCount: rendered.wordCount,
      toc: rendered.toc,
      tocHtml: rendered.tocHtml,
      brandsMentioned: rendered.brandsMentioned,
      hasRealUpdate: rendered.hasRealUpdate,
      authorProfile,
      relatedStories
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

    if (article.status === 'published') {
      enforcePublishStandardsOrOverride({
        article,
        rawInput: rawBody,
        session,
        editorialRepo: this.editorialRepo,
        store: this.store
      });
    }

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

    if (updated.status === 'published') {
      enforcePublishStandardsOrOverride({
        article: updated,
        rawInput: { ...articles[index], ...patch },
        session,
        editorialRepo: this.editorialRepo,
        store: this.store
      });
    }

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

module.exports = {
  ArticleService,
  publicArticle,
  evaluatePublishStandards,
  enforcePublishStandardsOrOverride
};
