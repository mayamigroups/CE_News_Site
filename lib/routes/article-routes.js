/**
 * Article routes (public & admin)
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleArticleRoutes(ctx) {
  const { req, res, pathname, url, method, services, repositories, send, readBody, session, hasMinRole } = ctx;

  // 1. Public articles list
  if (method === 'GET' && pathname === '/api/articles') {
    const q = (url.searchParams.get('q') || '').toLowerCase().slice(0, 100);
    const category = url.searchParams.get('category') || '';
    const manufacturer = url.searchParams.get('manufacturer') || '';
    const equipment = url.searchParams.get('equipment') || '';
    const modelParam = url.searchParams.get('model') || '';
    const country = url.searchParams.get('country') || '';
    const region = url.searchParams.get('region') || '';
    const articleType = url.searchParams.get('articleType') || '';
    const tag = url.searchParams.get('tag') || '';

    const results = services.articles.getPublicArticles({
      q,
      category,
      manufacturer,
      equipment,
      modelParam,
      country,
      region,
      articleType,
      tag
    });
    send(res, 200, results);
    return true;
  }

  // 2. Public article by slug
  if (method === 'GET' && pathname.startsWith('/api/articles/')) {
    const slug = pathname.slice('/api/articles/'.length);
    const result = services.articles.getPublicArticleBySlug(slug);
    if (!result) {
      send(res, 404, { error: 'Article not found' });
      return true;
    }
    send(res, 200, result);
    return true;
  }

  // 3. Admin: List articles
  if (pathname === '/api/admin/articles' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const articles = repositories.articles.getAll()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    send(res, 200, articles);
    return true;
  }

  // 4. Admin: Check duplicate
  if (pathname === '/api/admin/articles/check-duplicate' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    const resDup = services.articles.checkDuplicate(body);
    send(res, 200, resDup);
    return true;
  }

  // 5. Admin: Create article
  if (pathname === '/api/admin/articles' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const created = services.articles.createArticle(body, session);
      send(res, 201, created);
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  // 6. Admin: Transfer to manual
  const transferMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/transfer-to-manual$/i);
  if (transferMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    try {
      const resTransfer = services.articles.transferToManual(transferMatch[1], session);
      send(res, 200, resTransfer);
    } catch (err) {
      send(res, err.statusCode || 404, { error: err.message });
    }
    return true;
  }

  // 7. Admin: SEO audit
  const artSeoAuditMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/seo-audit$/i);
  if (artSeoAuditMatch && (method === 'GET' || method === 'POST')) {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    try {
      const auditRes = services.articles.auditArticle(artSeoAuditMatch[1], session, method === 'POST');
      send(res, 200, auditRes);
    } catch (err) {
      send(res, err.statusCode || 404, { error: err.message });
    }
    return true;
  }

  // 8. Admin: Update or Delete article
  const match = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)$/i);
  if (match) {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const articleId = match[1];

    if (method === 'PATCH' || method === 'PUT') {
      const patch = await readBody(req);
      try {
        const updated = services.articles.updateArticle(articleId, patch, session);
        send(res, 200, updated);
      } catch (err) {
        send(res, err.statusCode || 400, { error: err.message });
      }
      return true;
    }

    if (method === 'DELETE') {
      try {
        services.articles.deleteArticle(articleId, session);
        send(res, 200, { ok: true });
      } catch (err) {
        send(res, err.statusCode || 400, { error: err.message });
      }
      return true;
    }
  }

  return false;
}

module.exports = handleArticleRoutes;
