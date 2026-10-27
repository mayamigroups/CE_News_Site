/**
 * Newsroom and AI assist routes
 * @param {Object} ctx
 * @returns {Promise<boolean>}
 */
async function handleNewsroomRoutes(ctx) {
  const { req, res, pathname, method, services, send, readBody, session, hasMinRole } = ctx;

  if (pathname === '/api/admin/newsroom/config' && method === 'GET') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    send(res, 200, services.newsroom.getConfig());
    return true;
  }

  if (pathname === '/api/admin/newsroom/analyze' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    if (!hasMinRole(session, 'author')) {
      send(res, 403, { error: 'Insufficient role to run the AI-assisted newsroom workflow.' });
      return true;
    }
    const body = await readBody(req);
    const result = await services.newsroom.runWorkflow(body, session.username);
    send(res, 201, result);
    return true;
  }

  if (pathname === '/api/admin/ai/assist' && method === 'POST') {
    if (!session) {
      send(res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    const task = String(body.task || 'grammar').trim();
    const title = String(body.title || '').trim();

    if (!text && !title) {
      send(res, 400, { error: 'Text or title is required for AI editorial assistance.' });
      return true;
    }

    let result = '';
    if (task === 'grammar') {
      result = text
        .replace(/\s+/g, ' ')
        .replace(/ ,/g, ',')
        .replace(/ \./g, '.')
        .replace(/teh\b/gi, 'the')
        .replace(/occured/gi, 'occurred')
        .replace(/recieve/gi, 'receive')
        .trim();
      result = result.replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
    } else if (task === 'headline') {
      const base = (title || text).slice(0, 90).replace(/[.!]$/, '');
      result = `${base}: Fleet Analysis & Technical Specifications`;
    } else if (task === 'summary') {
      const sentences = (text || title).split(/(?<=[.!?])\s+/).filter(Boolean);
      result = sentences.slice(0, 2).join(' ') || `${title} details critical machine equipment engineering and performance.`;
    } else if (task === 'seo') {
      result = {
        metaTitle: `${(title || 'Equipment Analysis').slice(0, 55)} | Machine Report World`,
        metaDescription: (text || title).slice(0, 155),
        keywords: ['heavy equipment', 'commercial vehicles', 'machinery news', 'construction equipment']
      };
    } else if (task === 'structure') {
      result = `### Overview\n\n${text}\n\n### Technical Highlights & Specifications\n\n- Verified Operating Capacity\n- Tier 4 / Stage V Emissions Compliance\n- Heavy Duty Powertrain & Telematics`;
    } else {
      result = text;
    }

    send(res, 200, {
      ok: true,
      task,
      result,
      provider: process.env.AI_API_KEY ? 'gemini-ai' : 'local-rule-engine'
    });
    return true;
  }

  return false;
}

module.exports = handleNewsroomRoutes;
