const distribution = require('../distribution.js');
const models = require('../models.js');

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Newsletter, submissions, and distribution routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleDistributionRoutes(ctx) {
  const { req, res, pathname, url, method, services, repositories, store, send, sendText, readBody, session, hasMinRole, checkRateLimit, siteUrl } = ctx;

  // 1. Public newsletter info
  if (method === 'GET' && pathname === '/api/newsletter') {
    send(res, 200, services.distribution.getNewsletterConfig());
    return true;
  }

  // 2. Public newsletter subscribe
  if (method === 'POST' && pathname === '/api/newsletter') {
    const ip = req.socket?.remoteAddress || 'local';
    if (checkRateLimit && !checkRateLimit(ip, 'newsletter', 30)) {
      send(res, 429, { error: 'Too many subscription requests. Please wait a few minutes and try again.' });
      return true;
    }
    const body = await readBody(req);
    const reqOrigin = req.headers.host ? `http://${req.headers.host}` : siteUrl;
    const result = services.distribution.subscribe(body, reqOrigin);
    send(res, 201, result);
    return true;
  }

  // 3. Public newsletter verify
  if (method === 'GET' && pathname === '/api/newsletter/verify') {
    const token = String(url.searchParams.get('token') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    const format = String(url.searchParams.get('format') || '').toLowerCase();
    const isJson = format === 'json' || (req.headers.accept || '').includes('application/json');

    try {
      const sub = services.distribution.verify({ token, email });
      if (isJson) {
        send(res, 200, {
          ok: true,
          verified: true,
          email: sub.email,
          verifiedAt: sub.verifiedAt,
          interests: sub.interests
        });
      } else {
        sendText(
          res,
          200,
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Subscription Verified | Machine Report World</title><link rel="stylesheet" href="/styles.css"></head><body style="padding:48px 24px;max-width:640px;margin:0 auto;"><h1>Email Verified ✓</h1><p>Your subscription for <strong>${escapeXml(sub.email)}</strong> is now verified for Machine Report World industry briefings (${escapeXml((sub.interests || []).join(', '))}).</p><p><a class="button button-dark" href="/">Return to Machine Report World</a></p></body></html>`,
          'text/html; charset=utf-8'
        );
      }
    } catch (err) {
      if (isJson) {
        send(res, 404, { error: 'Invalid or expired verification link.' });
      } else {
        sendText(res, 404, '<h1>Verification link not found</h1><p><a href="/">Return to Machine Report World</a></p>', 'text/html; charset=utf-8');
      }
    }
    return true;
  }

  // 4. Public newsletter unsubscribe
  if ((method === 'GET' || method === 'POST') && pathname === '/api/newsletter/unsubscribe') {
    const body = method === 'POST' ? await readBody(req).catch(() => ({})) : {};
    const token = String(url.searchParams.get('token') || body.token || '').trim();
    const email = String(url.searchParams.get('email') || body.email || '').trim().toLowerCase();
    const format = String(url.searchParams.get('format') || body.format || '').toLowerCase();
    const isJson = format === 'json' || method === 'POST' || (req.headers.accept || '').includes('application/json');

    try {
      const sub = services.distribution.unsubscribe({ token, email });
      if (isJson) {
        send(res, 200, {
          ok: true,
          status: 'unsubscribed',
          email: sub.email,
          unsubscribedAt: sub.unsubscribedAt
        });
      } else {
        sendText(
          res,
          200,
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribed | Machine Report World</title><link rel="stylesheet" href="/styles.css"></head><body style="padding:48px 24px;max-width:640px;margin:0 auto;"><h1>Unsubscribed ✓</h1><p><strong>${escapeXml(sub.email)}</strong> has been unsubscribed from Machine Report World briefings.</p><p><a class="button button-dark" href="/">Return to Machine Report World</a></p></body></html>`,
          'text/html; charset=utf-8'
        );
      }
    } catch (err) {
      if (isJson) {
        send(res, 404, { error: 'Subscriber not found for unsubscribe request.' });
      } else {
        sendText(res, 404, '<h1>Subscriber not found</h1><p><a href="/">Return to Machine Report World</a></p>', 'text/html; charset=utf-8');
      }
    }
    return true;
  }

  // 5. Public tip submissions
  if (method === 'POST' && pathname === '/api/submissions') {
    const ip = req.socket?.remoteAddress || 'local';
    if (checkRateLimit && !checkRateLimit(ip, 'submissions', 25)) {
      send(res, 429, { error: 'Too many tip submissions. Please wait a few minutes and try again.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const result = services.distribution.submitTip(body);
      send(res, 201, result);
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  // 6. Admin newsletter list
  if (pathname === '/api/admin/newsletter' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, repositories.subscribers.getSubscribers());
    return true;
  }

  // 7. Admin update / delete subscriber
  const newsMatch = pathname.match(/^\/api\/admin\/newsletter\/([a-z0-9-_]+)$/i);
  if (newsMatch && method === 'PATCH') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const rows = repositories.subscribers.getSubscribers();
    const idx = rows.findIndex(x => x.id === newsMatch[1]);
    if (idx < 0) {
      send(res, 404, { error: 'Subscriber not found' });
      return true;
    }
    const body = await readBody(req);
    const patch = {};
    if (body.status && ['pending_verification', 'active', 'unsubscribed', 'bounced'].includes(body.status)) {
      patch.status = body.status;
    }
    if (body.verified !== undefined) {
      patch.verified = Boolean(body.verified);
      if (patch.verified && !rows[idx].verifiedAt) patch.verifiedAt = new Date().toISOString();
    }
    if (Array.isArray(body.interests)) {
      patch.interests = body.interests.filter(x => models.VALID_NEWSLETTER_INTERESTS.includes(x));
    }
    if (body.frequency && ['daily', 'weekly'].includes(body.frequency)) {
      patch.frequency = body.frequency;
    }
    if (body.segment) patch.segment = String(body.segment).trim().slice(0, 80);

    const updated = repositories.subscribers.updateSubscriber(newsMatch[1], patch);
    repositories.editorial.appendAuditLog({
      actor: session.username,
      role: session.role,
      action: 'newsletter.update',
      target: updated.email,
      level: 'info',
      details: `Updated subscriber status to "${updated.status}" (${updated.segment}).`
    });
    send(res, 200, updated);
    return true;
  }

  if (newsMatch && method === 'DELETE') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Only managing_editor or super_admin can delete subscribers.' });
      return true;
    }
    const target = repositories.subscribers.getSubscriberById(newsMatch[1]);
    if (!target) {
      send(res, 404, { error: 'Subscriber not found' });
      return true;
    }
    try { store.createBackup(`pre-delete-subscriber-${target.id}`); } catch {}
    repositories.subscribers.deleteSubscriber(newsMatch[1]);
    repositories.editorial.appendAuditLog({
      actor: session.username,
      role: session.role,
      action: 'newsletter.delete',
      target: target.email,
      level: 'warn',
      details: `Removed subscriber ${target.email}.`
    });
    send(res, 200, { ok: true });
    return true;
  }

  // 8. Admin submissions
  if (pathname === '/api/admin/submissions' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, services.distribution.getSubmissions());
    return true;
  }

  const subMatch = pathname.match(/^\/api\/admin\/submissions\/([a-z0-9-_]+)$/i);
  if (subMatch && method === 'PATCH') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    try {
      const updated = services.distribution.updateSubmission(subMatch[1], { status: body.status });
      send(res, 200, updated);
    } catch (err) {
      send(res, err.statusCode || 400, { error: err.message });
    }
    return true;
  }

  if (subMatch && method === 'DELETE') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    services.distribution.deleteSubmission(subMatch[1]);
    send(res, 200, { ok: true });
    return true;
  }

  // 9. Admin distribution config
  if (pathname === '/api/admin/distribution/config' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, {
      ...distribution.getDistributionConfig(store),
      logs: store.readJson(store.files.distributionLogs, []).slice(0, 50)
    });
    return true;
  }

  // 10. Admin newsletter template
  if (pathname === '/api/admin/distribution/template' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const editionType = url.searchParams.get('edition') === 'daily' ? 'daily' : 'weekly';
    const interestsParam = url.searchParams.get('interests') || '';
    const interests = interestsParam
      ? interestsParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    send(res, 200, services.distribution.generateNewsletterTemplate({ editionType, interests }));
    return true;
  }

  // 11. Admin dispatch newsletter
  if (pathname === '/api/admin/distribution/send-newsletter' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'managing_editor')) {
      send(res, 403, { error: 'Requires managing_editor or super_admin role to dispatch newsletters.' });
      return true;
    }
    const body = await readBody(req);
    const resDispatch = await services.distribution.sendNewsletter({
      editionType: body.editionType || 'weekly',
      interests: body.interests || [],
      simulateDeliveryError: body.simulateDeliveryError || '',
      actor: session.username
    });
    const statusHttp = resDispatch.duplicatePrevented ? 409 : 200;
    send(res, statusHttp, resDispatch);
    return true;
  }

  // 12. Admin social distribution
  if (pathname === '/api/admin/distribution/social' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'reviewer')) {
      send(res, 403, { error: 'Requires reviewer, managing_editor, or super_admin role to distribute articles.' });
      return true;
    }
    const body = await readBody(req);
    const resSocial = await services.distribution.distributeSocial({
      articleId: body.articleId,
      channel: body.channel || 'linkedin',
      simulateDeliveryError: body.simulateDeliveryError || '',
      actor: session.username
    });
    const statusHttp = resSocial.duplicatePrevented ? 409 : 200;
    send(res, statusHttp, resSocial);
    return true;
  }

  return false;
}

module.exports = handleDistributionRoutes;
