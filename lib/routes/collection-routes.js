/**
 * News Collection routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleCollectionRoutes(ctx) {
  const { req, res, pathname, method, services, send, readBody, session, hasMinRole } = ctx;

  // 1. Manual "Check Source Now" for a single approved source
  const checkSourceMatch = pathname.match(/^\/api\/admin\/sources\/([a-z0-9-_]+)\/check$/i);
  if (checkSourceMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to poll news sources.' });
      return true;
    }
    const sourceId = checkSourceMatch[1];
    const body = await readBody(req);
    const mode = body.mode === 'test' ? 'test' : 'live';
    const result = await services.collection.checkSource(sourceId, {
      mode,
      actor: session.username,
      sampleXml: body.sampleXml
    });
    send(res, 200, result);
    return true;
  }

  // 2. Check all enabled sources
  if (pathname === '/api/admin/sources/check-all' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to run collection.' });
      return true;
    }
    const body = await readBody(req);
    const mode = body.mode === 'test' ? 'test' : 'live';
    const result = await services.collection.checkAllSources({
      mode,
      actor: session.username
    });
    send(res, 200, result);
    return true;
  }

  // 3. List collected items
  if (pathname === '/api/admin/collected' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const items = services.collection.getCollectedItems();
    send(res, 200, items);
    return true;
  }

  // 4. Promote collected item to draft
  const colPromoteMatch = pathname.match(/^\/api\/admin\/collected\/([a-z0-9-_]+)\/promote$/i);
  if (colPromoteMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    try {
      const result = services.collection.promoteCollectedItem(colPromoteMatch[1], session.username, {
        role: session.role
      });
      send(res, 201, result);
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  // 5. Delete collected item
  const colItemMatch = pathname.match(/^\/api\/admin\/collected\/([a-z0-9-_]+)$/i);
  if (colItemMatch && method === 'DELETE') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    services.collection.deleteCollectedItem(colItemMatch[1]);
    send(res, 200, { ok: true });
    return true;
  }

  // 6. Test / Validate Source Endpoint
  if (pathname === '/api/admin/sources/validate' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    if (!body.url) {
      send(res, 400, { error: 'url is required to validate endpoint.' });
      return true;
    }
    try {
      const result = await services.collection.validateEndpoint(body.url, body);
      send(res, 200, result);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
    return true;
  }

  // 7. Toggle Source Enabled State
  const toggleSourceMatch = pathname.match(/^\/api\/admin\/sources\/([a-z0-9-_]+)\/toggle$/i);
  if (toggleSourceMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Requires managing_editor or super_admin role to toggle sources.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const updated = services.collection.toggleSource(toggleSourceMatch[1], body.enabled, session.username);
      send(res, 200, { ok: true, source: updated });
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  // 8. Import Candidate Registry into Sources
  if (pathname === '/api/admin/sources/import-candidates' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Requires managing_editor or super_admin role to import sources.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const candidates = body.candidates || null;
      const result = services.collection.importCandidates(candidates, session.username);
      send(res, 200, result);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
    return true;
  }

  // 9. Manual URL Intake into News Inbox
  if (pathname === '/api/admin/collected/intake-url' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    if (!body.url) {
      send(res, 400, { error: 'url parameter is required.' });
      return true;
    }
    try {
      const result = await services.collection.intakeManualUrl(body.url, {
        ...body,
        actor: session.username
      });
      send(res, 201, result);
    } catch (err) {
      send(res, 400, { error: err.message });
    }
    return true;
  }

  return false;
}

module.exports = handleCollectionRoutes;
