const seoLib = require('../seo.js');

/**
 * SEO & AI-SEO routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleSeoRoutes(ctx) {
  const { req, res, pathname, url, method, services, store, send, readBody, session, hasMinRole } = ctx;

  if (pathname === '/api/admin/seo-analytics' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, seoLib.getContentPrioritizationReport(store));
    return true;
  }

  if (pathname === '/api/admin/ai-seo/dashboard' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const dash = services.seo.getDashboard();
    send(res, 200, dash);
    return true;
  }

  if (pathname === '/api/admin/ai-seo/tasks' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const roleFilter = url.searchParams.get('role');
    const statusFilter = url.searchParams.get('status');
    const filtered = services.seo.getTasks({ role: roleFilter, status: statusFilter });
    send(res, 200, filtered);
    return true;
  }

  if (pathname === '/api/admin/ai-seo/tasks' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Requires reviewer or higher role to create SEO tasks.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const newTask = services.seo.createTask(body, session);
      send(res, 201, newTask);
    } catch (err) {
      send(res, 400, { error: err.message });
    }
    return true;
  }

  const seoTaskMatch = pathname.match(/^\/api\/admin\/ai-seo\/tasks\/([a-z0-9-_]+)$/i);
  if (seoTaskMatch && method === 'PATCH') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Requires reviewer or higher role to update SEO tasks.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const updated = services.seo.updateTask(seoTaskMatch[1], body, session);
      send(res, 200, updated);
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  if (seoTaskMatch && method === 'DELETE') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Requires managing_editor or super_admin role to delete SEO tasks.' });
      return true;
    }
    try {
      services.seo.deleteTask(seoTaskMatch[1], session);
      send(res, 200, { ok: true });
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  if (pathname === '/api/admin/ai-seo/audit' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const audit = services.seo.runTechnicalAudit(session);
    send(res, 200, audit);
    return true;
  }

  return false;
}

module.exports = handleSeoRoutes;
