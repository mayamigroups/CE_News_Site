/**
 * Admin catalog management routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleCatalogRoutes(ctx) {
  const { req, res, pathname, method, repositories, store, send, readBody, session, hasMinRole } = ctx;

  if (pathname === '/api/admin/catalog' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, repositories.taxonomies.getCatalogSummary());
    return true;
  }

  const catMatch = pathname.match(/^\/api\/admin\/catalog\/([a-zA-Z]+)$/);
  if (catMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const entityType = catMatch[1];
    if (entityType === 'adminUsers' && !hasMinRole(session, 'super_admin')) {
      send(res, 403, { error: 'Only super_admin can create or modify admin user accounts.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Your role does not have permission to modify catalog records.' });
      return true;
    }
    const payload = await readBody(req);
    const saved = repositories.taxonomies.upsertEntity(entityType, payload);
    const { passwordHash, ...safeSaved } = saved || {};
    repositories.editorial.appendAuditLog({
      actor: session.username,
      role: session.role,
      action: `catalog.upsert.${entityType}`,
      target: safeSaved.name || safeSaved.username || safeSaved.url || safeSaved.id,
      level: 'info',
      details: `Upserted record in ${entityType}.`
    });
    send(res, 201, safeSaved);
    return true;
  }

  const catDelMatch = pathname.match(/^\/api\/admin\/catalog\/([a-zA-Z]+)\/([a-z0-9-_@.:/]+)$/i);
  if (catDelMatch && method === 'DELETE') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const entityType = catDelMatch[1];
    const targetKey = decodeURIComponent(catDelMatch[2]);
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Only managing_editor or super_admin can delete catalog records.' });
      return true;
    }
    const removed = repositories.taxonomies.deleteEntity(entityType, targetKey);
    if (!removed) {
      send(res, 404, { error: 'Catalog record not found' });
      return true;
    }
    repositories.editorial.appendAuditLog({
      actor: session.username,
      role: session.role,
      action: `catalog.delete.${entityType}`,
      target: targetKey,
      level: 'warn',
      details: `Deleted record "${targetKey}" from ${entityType}.`
    });
    send(res, 200, { ok: true });
    return true;
  }

  return false;
}

module.exports = handleCatalogRoutes;
