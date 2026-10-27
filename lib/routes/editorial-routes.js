/**
 * Editorial workflow routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleEditorialRoutes(ctx) {
  const { req, res, pathname, method, services, send, readBody, session, hasMinRole } = ctx;

  if (pathname === '/api/admin/workflow' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, services.editorial.getPipelineSummary());
    return true;
  }

  if (pathname === '/api/admin/workflow/config' && method === 'PATCH') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'super_admin')) {
      send(res, 403, { error: 'Only super_admin can modify editorial workflow & automatic publication settings.' });
      return true;
    }
    const body = await readBody(req);
    const updated = services.editorial.saveWorkflowConfig(body, session.username);
    send(res, 200, updated);
    return true;
  }

  if (pathname === '/api/admin/workflow/test-rules' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Requires managing_editor or super_admin role to run the publication rule verification suite.' });
      return true;
    }
    const suiteRes = services.editorial.runPublicationRulesTestSuite(session.username);
    send(res, 200, suiteRes);
    return true;
  }

  const wfEvalMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/evaluate-gates$/i);
  if (wfEvalMatch && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    try {
      const evaluation = services.editorial.evaluateArticleGates(wfEvalMatch[1]);
      send(res, 200, evaluation);
    } catch (err) {
      send(res, err.statusCode || 404, { error: err.message });
    }
    return true;
  }

  const wfTransMatch = pathname.match(/^\/api\/admin\/articles\/([a-z0-9-_]+)\/transition$/i);
  if (wfTransMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    const action = String(body.action || '');
    const result = services.editorial.transitionArticle(wfTransMatch[1], action, body, session);
    send(res, 200, result);
    return true;
  }

  const ackAlertMatch = pathname.match(/^\/api\/admin\/workflow\/alerts\/([a-z0-9-_]+)\/ack$/i);
  if (ackAlertMatch && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    try {
      const acked = services.editorial.acknowledgeAlert(ackAlertMatch[1], session.username);
      send(res, 200, acked);
    } catch (err) {
      send(res, err.statusCode || 404, { error: err.message });
    }
    return true;
  }

  return false;
}

module.exports = handleEditorialRoutes;
