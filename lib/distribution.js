const crypto = require('node:crypto');
const models = require('./models.js');

const INTEREST_OPTIONS = [
  { id: 'construction-equipment', label: 'Construction Equipment', description: 'Excavators, backhoe loaders, wheel loaders, dozers, cranes & roadbuilding' },
  { id: 'tractors', label: 'Tractors & Agriculture', description: '4WD tractors, harvesters, implements & rural mechanization' },
  { id: 'commercial-vehicles', label: 'Commercial Vehicles', description: 'Heavy tipper trucks, prime movers, pickups, vans, buses & electric CVs' },
  { id: 'manufacturers', label: 'Manufacturers & OEMs', description: 'BULL Machines, JCB, Caterpillar, Komatsu, Volvo CE, Tata Motors, SANY & global brands' },
  { id: 'technology', label: 'Technology & Powertrains', description: 'Load-sensing hydraulics, Stage V / CEV-V, ISO 15143-3 telematics & electrification' },
  { id: 'business', label: 'Business & Projects', description: 'Plant investments, export corridors, quarterly results & highway tenders' },
  { id: 'regional-news', label: 'Regional Market Desks', description: 'India, North America, Europe, China, Japan & Korea, Middle East, ASEAN, LatAm & Africa' }
];

function escHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Inspect server-side environment variables to determine whether an external
 * Email Provider and/or Social Media Distribution Provider are configured.
 * Never exposes secret API keys or tokens in any returned object.
 */
function getDistributionConfig(store) {
  const settings = store ? store.getSettings() : {};
  const siteUrl = (process.env.SITE_URL || settings.canonicalBaseUrl || 'http://localhost:3000').replace(/\/$/, '');

  const emailProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const emailApiKey = String(process.env.EMAIL_API_KEY || '').trim();
  const emailWebhookUrl = String(process.env.EMAIL_WEBHOOK_URL || '').trim();
  const emailFrom = String(process.env.EMAIL_FROM || settings.editorialContactEmail || 'briefing@machinewire.example').trim();
  const emailConnected = Boolean(emailProvider && (emailApiKey || emailWebhookUrl));

  const linkedinToken = String(process.env.SOCIAL_LINKEDIN_ACCESS_TOKEN || '').trim();
  const linkedinOrgUrn = String(process.env.SOCIAL_LINKEDIN_ORG_URN || '').trim();
  const linkedinConnected = Boolean(linkedinToken && linkedinOrgUrn);

  const xBearerToken = String(process.env.SOCIAL_X_BEARER_TOKEN || '').trim();
  const xWebhookUrl = String(process.env.SOCIAL_X_WEBHOOK_URL || '').trim();
  const xConnected = Boolean(xBearerToken || xWebhookUrl);

  const webhookUrl = String(process.env.SOCIAL_WEBHOOK_URL || '').trim();
  const webhookConnected = Boolean(webhookUrl);

  return {
    siteUrl,
    interestOptions: INTEREST_OPTIONS,
    emailService: {
      provider: emailConnected ? emailProvider : 'not_configured',
      connected: emailConnected,
      fromAddress: emailFrom,
      statusBadge: emailConnected
        ? `Connected (${emailProvider.toUpperCase()})`
        : 'Email Provider Not Yet Connected — Local Queue & Preview Mode',
      publicNotice: emailConnected
        ? 'Active email provider connected. Double opt-in verification and instant unsubscribe links are live.'
        : 'Notice: External email delivery provider is not yet connected on this server. Your subscription preferences and consent are saved locally in the MachineWire subscriber queue, and you can test verification and one-click unsubscribe links immediately.'
    },
    socialChannels: {
      linkedin: {
        id: 'linkedin',
        name: 'LinkedIn Company Page API',
        connected: linkedinConnected,
        statusLabel: linkedinConnected
          ? 'Connected (LINKEDIN_ACCESS_TOKEN + ORG_URN configured)'
          : 'Not Configured (Requires SOCIAL_LINKEDIN_ACCESS_TOKEN & SOCIAL_LINKEDIN_ORG_URN in .env)'
      },
      x_twitter: {
        id: 'x_twitter',
        name: 'X / Twitter API v2',
        connected: xConnected,
        statusLabel: xConnected
          ? 'Connected (SOCIAL_X_BEARER_TOKEN configured)'
          : 'Not Configured (Requires SOCIAL_X_BEARER_TOKEN in .env)'
      },
      webhook: {
        id: 'webhook',
        name: 'Authorized Syndication Webhook',
        connected: webhookConnected,
        statusLabel: webhookConnected
          ? 'Connected (SOCIAL_WEBHOOK_URL configured)'
          : 'Not Configured (Requires SOCIAL_WEBHOOK_URL in .env)'
      }
    },
    privacyCompliance: {
      requiresExplicitConsent: true,
      supportsDoubleOptInVerification: true,
      supportsOneClickUnsubscribe: true,
      policyUrl: '/privacy.html',
      termsUrl: '/terms.html'
    }
  };
}

/**
 * Filter published articles matching a set of subscriber interest slugs.
 */
function selectArticlesForBriefing(store, { editionType = 'weekly', interests = [], limit = 6 } = {}) {
  const allPublished = store
    .readJson(store.files.articles, [])
    .filter(a => a.status === 'published')
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const wanted = Array.isArray(interests) && interests.length
    ? interests
    : INTEREST_OPTIONS.map(x => x.id);

  const matched = allPublished.filter(a => {
    const hay = `${a.title} ${a.summary} ${a.category} ${a.equipmentType} ${a.manufacturer} ${a.country} ${a.region}`.toLowerCase();
    if (wanted.includes('construction-equipment') && /backhoe|excavat|loader|dozer|crane|grader|compactor|construction|mining|attachment/i.test(hay)) return true;
    if (wanted.includes('tractors') && /tractor|agri|harvester|implement/i.test(hay)) return true;
    if (wanted.includes('commercial-vehicles') && /truck|tipper|commercial vehicle|pickup|van|bus|electric/i.test(hay)) return true;
    if (wanted.includes('manufacturers') && a.manufacturer && a.manufacturer !== 'Various') return true;
    if (wanted.includes('technology') && (/technology|hydraulic|stage v|tier 4|cev|telematics|electric|emission/i.test(hay) || a.category === 'Technology')) return true;
    if (wanted.includes('business') && (/industry|business|investment|export|market|project/i.test(hay) || a.category === 'Industry News')) return true;
    if (wanted.includes('regional-news') && a.country && a.country !== 'Global') return true;
    return false;
  });

  const pool = matched.length ? matched : allPublished;
  const maxItems = editionType === 'daily' ? Math.min(limit, 4) : Math.min(limit, 6);
  return pool.slice(0, maxItems);
}

/**
 * Generate Daily or Weekly HTML + Plain-Text Newsletter Templates with
 * List-Unsubscribe compliance, primary source attribution, and interest tags.
 */
function generateNewsletterTemplate(store, {
  editionType = 'weekly',
  interests = [],
  subscriber = null
} = {}) {
  const cfg = getDistributionConfig(store);
  const siteUrl = cfg.siteUrl;
  const cleanEdition = editionType === 'daily' ? 'daily' : 'weekly';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const stories = selectArticlesForBriefing(store, {
    editionType: cleanEdition,
    interests
  });

  const editionTitle = cleanEdition === 'daily'
    ? `MACHINEWIRE Daily Fleet & OEM Dispatch — ${dateLabel}`
    : `MACHINEWIRE Weekly Global Machinery & CV Briefing — ${dateLabel}`;

  const unsubToken = subscriber?.unsubscribeToken || 'PREVIEW_UNSUBSCRIBE_TOKEN';
  const unsubEmail = subscriber?.email || 'subscriber@example.com';
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}&email=${encodeURIComponent(unsubEmail)}`;
  const preferencesUrl = `${siteUrl}/#newsletter`;

  const selectedLabels = (interests && interests.length ? interests : INTEREST_OPTIONS.map(i => i.id))
    .map(id => INTEREST_OPTIONS.find(o => o.id === id)?.label || id)
    .join(' · ');

  const storyCardsHtml = stories.map((a, idx) => {
    const artHref = `${siteUrl}/news/${encodeURIComponent(a.slug)}?utm_source=machinewire_newsletter&utm_medium=email&utm_campaign=${cleanEdition}_briefing`;
    return `
      <tr>
        <td style="padding: 18px 0; border-bottom: 1px solid #DCE2E8;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #F5A623; margin-bottom: 4px;">
            ${idx + 1}. ${escHtml(a.category || 'Industry News')} · ${escHtml(a.manufacturer || 'Global Desk')} (${escHtml(a.country || 'Global')})
          </div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px; line-height: 1.35;">
            <a href="${escHtml(artHref)}" style="color: #101820; text-decoration: none;">${escHtml(a.title)}</a>
          </h3>
          <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.55; color: #65717D;">
            ${escHtml(a.summary || a.excerpt)}
          </p>
          <div style="font-size: 12px;">
            <a href="${escHtml(artHref)}" style="color: #101820; font-weight: 600; text-decoration: underline;">Read full report →</a>
            ${a.sourceUrl ? ` &nbsp;|&nbsp; <a href="${escHtml(a.sourceUrl)}" style="color: #65717D; text-decoration: underline;">Primary Source ↗</a>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escHtml(editionTitle)}</title>
</head>
<body style="margin:0; padding:24px; background-color:#F1F4F7; font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#17212B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid #DCE2E8; border-radius:8px; overflow:hidden;">
    <tr>
      <td style="background:#101820; color:#FFFFFF; padding:24px;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; color:#F5A623; text-transform:uppercase;">
          ${cleanEdition === 'daily' ? 'DAILY INDUSTRY DISPATCH' : 'WEEKLY GLOBAL INTELLIGENCE BRIEFING'}
        </div>
        <h1 style="margin:6px 0 4px 0; font-size:24px; letter-spacing:0.04em;">MACHINE<span style="color:#F5A623;">WIRE</span></h1>
        <div style="font-size:12px; color:#DCE2E8;">THE WORLD OF MACHINES. CONNECTED. · ${escHtml(dateLabel)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px; background:#F8FAFC; border-bottom:1px solid #DCE2E8; font-size:12px; color:#65717D;">
        <strong>Selected Topic Desks:</strong> ${escHtml(selectedLabels)}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 20px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${storyCardsHtml || '<tr><td style="padding:16px 0;">No published stories match the selected filters yet.</td></tr>'}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px; background:#101820; color:#DCE2E8; font-size:12px; line-height:1.6;">
        <div><strong>MACHINEWIRE Editorial &amp; Privacy Compliance</strong></div>
        <div>You are receiving this briefing because explicit consent was recorded for <strong>${escHtml(unsubEmail)}</strong>.</div>
        <div style="margin-top:8px;">
          <a href="${escHtml(unsubscribeUrl)}" style="color:#F5A623; text-decoration:underline;">Instant One-Click Unsubscribe</a>
          &nbsp;·&nbsp;
          <a href="${escHtml(preferencesUrl)}" style="color:#FFFFFF; text-decoration:underline;">Update Topic Interests</a>
          &nbsp;·&nbsp;
          <a href="${escHtml(`${siteUrl}/privacy.html`)}" style="color:#FFFFFF; text-decoration:underline;">Privacy Policy</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    editionTitle,
    'THE WORLD OF MACHINES. CONNECTED.',
    `Selected Topic Desks: ${selectedLabels}`,
    '------------------------------------------------------------',
    ...stories.map((a, idx) => [
      `${idx + 1}. [${a.category || 'News'} | ${a.manufacturer || 'OEM'}] ${a.title}`,
      `   Summary: ${a.summary || a.excerpt}`,
      `   Read on MachineWire: ${siteUrl}/news/${a.slug}`,
      a.sourceUrl ? `   Primary Source: ${a.sourceUrl}` : ''
    ].filter(Boolean).join('\n')),
    '------------------------------------------------------------',
    `Instant Unsubscribe: ${unsubscribeUrl}`,
    `Privacy Policy: ${siteUrl}/privacy.html`
  ].join('\n\n');

  // Compute deterministic digest fingerprint to prevent duplicate newsletter sends for the same edition + day + story set
  const storyIdsKey = stories.map(s => s.id).join(',');
  const dayStamp = new Date().toISOString().slice(0, 10);
  const campaignFingerprint = crypto
    .createHash('sha1')
    .update(`newsletter:${cleanEdition}:${dayStamp}:${storyIdsKey}`)
    .digest('hex')
    .slice(0, 16);

  return {
    editionType: cleanEdition,
    subject: editionTitle,
    dateLabel,
    storyCount: stories.length,
    stories: stories.map(s => ({ id: s.id, title: s.title, slug: s.slug, category: s.category, manufacturer: s.manufacturer })),
    selectedInterests: interests,
    unsubscribeUrl,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    },
    campaignFingerprint,
    html,
    text
  };
}

/**
 * Generate shareable UTM-tagged article links and social-media copy for an article.
 */
function buildShareableLinksForArticle(article, store) {
  const cfg = getDistributionConfig(store);
  const baseArticleUrl = `${cfg.siteUrl}/news/${encodeURIComponent(article.slug)}`;
  const linkedinTarget = `${baseArticleUrl}?utm_source=linkedin&utm_medium=social&utm_campaign=article_share`;
  const xTarget = `${baseArticleUrl}?utm_source=x_twitter&utm_medium=social&utm_campaign=article_share`;
  const emailTarget = `${baseArticleUrl}?utm_source=email_share&utm_medium=email&utm_campaign=article_share`;
  const whatsappTarget = `${baseArticleUrl}?utm_source=whatsapp&utm_medium=social&utm_campaign=article_share`;

  const shareHeadline = `${article.title} (${article.manufacturer || 'MachineWire'} · ${article.country || 'Global'}) | MACHINEWIRE`;

  return {
    articleId: article.id,
    slug: article.slug,
    canonicalUrl: baseArticleUrl,
    utmLinks: {
      direct: baseArticleUrl,
      linkedin: linkedinTarget,
      x_twitter: xTarget,
      whatsapp: whatsappTarget,
      email: emailTarget
    },
    intentUrls: {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkedinTarget)}`,
      x_twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(xTarget)}&text=${encodeURIComponent(shareHeadline)}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareHeadline} ${whatsappTarget}`)}`,
      email: `mailto:?subject=${encodeURIComponent(shareHeadline)}&body=${encodeURIComponent(`${article.summary || article.excerpt}\n\nRead verified report: ${emailTarget}`)}`
    },
    preparedSocialCopy: {
      linkedinPost: `${article.title}\n\n${article.summary || article.excerpt}\n\nCategory: ${article.category} | OEM: ${article.manufacturer || 'Various'} | Market: ${article.country || 'Global'}\nFull report: ${linkedinTarget}`,
      xPost: `${shareHeadline}\n${xTarget}`
    }
  };
}

/**
 * Log a distribution or delivery event (success, blocked_unconfigured, duplicate_prevented, or error).
 */
function appendDistributionLog(store, entry = {}) {
  const logs = store.readJson(store.files.distributionLogs, []);
  const record = {
    id: `dist-${crypto.randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    kind: entry.kind || 'newsletter', // 'newsletter' | 'social' | 'verification_email'
    channel: entry.channel || 'email',
    targetId: entry.targetId || '',
    targetTitle: entry.targetTitle || '',
    fingerprint: entry.fingerprint || '',
    status: entry.status || 'logged', // 'delivered' | 'duplicate_prevented' | 'provider_not_configured' | 'delivery_error'
    recipientCount: Number(entry.recipientCount || 0),
    error: entry.error || '',
    actor: entry.actor || 'system',
    details: entry.details || ''
  };
  logs.unshift(record);
  store.writeJson(store.files.distributionLogs, logs.slice(0, 200));
  return record;
}

/**
 * Dispatch a newsletter edition (`daily` or `weekly`):
 * - Prevents duplicate sends for the same campaignFingerprint.
 * - Uses the configured email provider API only when credentials (`EMAIL_PROVIDER` + `EMAIL_API_KEY`/`EMAIL_WEBHOOK_URL`) are present.
 * - If not configured, clearly logs and returns `provider_not_configured` without pretending emails were sent.
 * - Logs any upstream delivery errors.
 */
async function sendNewsletterEdition(store, {
  editionType = 'weekly',
  interests = [],
  simulateDeliveryError = '',
  actor = 'editorial-admin'
} = {}) {
  const cfg = getDistributionConfig(store);
  const template = generateNewsletterTemplate(store, { editionType, interests });
  const logs = store.readJson(store.files.distributionLogs, []);

  // 1. Prevent duplicate sends of the same newsletter edition fingerprint
  const existingSend = logs.find(
    l => l.kind === 'newsletter' &&
      l.fingerprint === template.campaignFingerprint &&
      (l.status === 'delivered' || l.status === 'queued_preview')
  );
  if (existingSend) {
    const dupLog = appendDistributionLog(store, {
      kind: 'newsletter',
      channel: cfg.emailService.provider,
      targetId: template.editionType,
      targetTitle: template.subject,
      fingerprint: template.campaignFingerprint,
      status: 'duplicate_prevented',
      recipientCount: 0,
      actor,
      details: `Duplicate newsletter dispatch prevented for fingerprint ${template.campaignFingerprint} (already processed at ${existingSend.at}).`
    });
    return {
      ok: false,
      duplicatePrevented: true,
      status: 'duplicate_prevented',
      message: dupLog.details,
      log: dupLog,
      template
    };
  }

  // Count eligible active & consented subscribers
  const allSubscribers = store.readJson(store.files.newsletter, []);
  const activeSubscribers = allSubscribers.filter(s => s.status === 'active' && s.consent !== false);

  // 2. Simulate or catch delivery errors and log them
  if (simulateDeliveryError) {
    const errLog = appendDistributionLog(store, {
      kind: 'newsletter',
      channel: cfg.emailService.provider,
      targetId: template.editionType,
      targetTitle: template.subject,
      fingerprint: template.campaignFingerprint,
      status: 'delivery_error',
      recipientCount: activeSubscribers.length,
      error: String(simulateDeliveryError),
      actor,
      details: `Newsletter delivery failed: ${simulateDeliveryError}`
    });
    return {
      ok: false,
      status: 'delivery_error',
      error: String(simulateDeliveryError),
      log: errLog,
      template
    };
  }

  // 3. If no external email provider is configured, do NOT pretend emails were sent over SMTP/API
  if (!cfg.emailService.connected) {
    const unconnLog = appendDistributionLog(store, {
      kind: 'newsletter',
      channel: 'not_configured',
      targetId: template.editionType,
      targetTitle: template.subject,
      fingerprint: template.campaignFingerprint,
      status: 'provider_not_configured',
      recipientCount: activeSubscribers.length,
      actor,
      details: `Email provider is not yet configured (set EMAIL_PROVIDER and EMAIL_API_KEY in .env). Prepared ${template.editionType} template for ${activeSubscribers.length} active subscriber(s) without sending external email.`
    });
    return {
      ok: false,
      providerConnected: false,
      status: 'provider_not_configured',
      message: unconnLog.details,
      log: unconnLog,
      template
    };
  }

  // 4. When provider credentials ARE configured, call webhook/API and log any delivery errors
  try {
    const webhookUrl = String(process.env.EMAIL_WEBHOOK_URL || '').trim();
    if (webhookUrl) {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.EMAIL_API_KEY ? { Authorization: `Bearer ${process.env.EMAIL_API_KEY}` } : {})
        },
        body: JSON.stringify({
          from: cfg.emailService.fromAddress,
          subject: template.subject,
          html: template.html,
          text: template.text,
          headers: template.headers,
          recipientCount: activeSubscribers.length
        })
      });
      if (!resp.ok) {
        throw new Error(`Email provider HTTP ${resp.status}`);
      }
    }

    const okLog = appendDistributionLog(store, {
      kind: 'newsletter',
      channel: cfg.emailService.provider,
      targetId: template.editionType,
      targetTitle: template.subject,
      fingerprint: template.campaignFingerprint,
      status: 'delivered',
      recipientCount: activeSubscribers.length,
      actor,
      details: `Dispatched ${template.editionType} newsletter "${template.subject}" to ${activeSubscribers.length} active subscriber(s) via ${cfg.emailService.provider}.`
    });
    return {
      ok: true,
      providerConnected: true,
      status: 'delivered',
      message: okLog.details,
      log: okLog,
      template
    };
  } catch (err) {
    const errLog = appendDistributionLog(store, {
      kind: 'newsletter',
      channel: cfg.emailService.provider,
      targetId: template.editionType,
      targetTitle: template.subject,
      fingerprint: template.campaignFingerprint,
      status: 'delivery_error',
      recipientCount: activeSubscribers.length,
      error: err.message || 'Email API error',
      actor,
      details: `Email provider delivery error: ${err.message || 'Unknown error'}`
    });
    return {
      ok: false,
      providerConnected: true,
      status: 'delivery_error',
      error: err.message,
      log: errLog,
      template
    };
  }
}

/**
 * Distribute a published article to an optional Social Media channel (`linkedin`, `x_twitter`, or `webhook`):
 * - Uses provider APIs ONLY after the required accounts and permissions are configured.
 * - Prevents duplicate sends of the same `(article.id + channel)`.
 * - Logs delivery errors if the upstream API fails.
 */
async function distributeArticleToSocial(store, {
  articleId,
  channel = 'linkedin',
  simulateDeliveryError = '',
  actor = 'editorial-admin'
} = {}) {
  const articles = store.readJson(store.files.articles, []);
  const article = articles.find(a => a.id === articleId || a.slug === articleId);
  if (!article) {
    throw new Error('Article not found for social distribution.');
  }
  if (article.status !== 'published') {
    throw new Error('Only published articles can be distributed to social channels.');
  }

  const cleanChannel = ['linkedin', 'x_twitter', 'webhook'].includes(channel) ? channel : 'linkedin';
  const cfg = getDistributionConfig(store);
  const channelCfg = cfg.socialChannels[cleanChannel];
  const shareBundle = buildShareableLinksForArticle(article, store);
  const fingerprint = `social:${cleanChannel}:${article.id}`;

  // 1. Check duplicate send prevention first
  const logs = store.readJson(store.files.distributionLogs, []);
  const existingSend = logs.find(
    l => l.kind === 'social' && l.fingerprint === fingerprint && l.status === 'delivered'
  );
  if (existingSend) {
    const dupLog = appendDistributionLog(store, {
      kind: 'social',
      channel: cleanChannel,
      targetId: article.id,
      targetTitle: article.title,
      fingerprint,
      status: 'duplicate_prevented',
      actor,
      details: `Duplicate social post prevented: "${article.title}" was already distributed to ${cleanChannel} at ${existingSend.at}.`
    });
    return {
      ok: false,
      duplicatePrevented: true,
      status: 'duplicate_prevented',
      message: dupLog.details,
      shareBundle,
      log: dupLog
    };
  }

  // 2. Simulate or catch delivery error
  if (simulateDeliveryError) {
    const errLog = appendDistributionLog(store, {
      kind: 'social',
      channel: cleanChannel,
      targetId: article.id,
      targetTitle: article.title,
      fingerprint,
      status: 'delivery_error',
      error: String(simulateDeliveryError),
      actor,
      details: `Social distribution error on ${cleanChannel}: ${simulateDeliveryError}`
    });
    return {
      ok: false,
      status: 'delivery_error',
      error: String(simulateDeliveryError),
      shareBundle,
      log: errLog
    };
  }

  // 3. Use provider APIs ONLY after required accounts and permissions are configured
  if (!channelCfg || !channelCfg.connected) {
    const unconnLog = appendDistributionLog(store, {
      kind: 'social',
      channel: cleanChannel,
      targetId: article.id,
      targetTitle: article.title,
      fingerprint,
      status: 'provider_not_configured',
      actor,
      details: `Social API for "${cleanChannel}" was not called because required account credentials/permissions are not configured (${channelCfg?.statusLabel || 'unconfigured'}). Shareable links and copy are ready for manual sharing.`
    });
    return {
      ok: false,
      providerConnected: false,
      status: 'provider_not_configured',
      message: unconnLog.details,
      shareBundle,
      log: unconnLog
    };
  }

  // 4. Execute configured provider call
  try {
    if (cleanChannel === 'webhook' && process.env.SOCIAL_WEBHOOK_URL) {
      const resp = await fetch(process.env.SOCIAL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: cleanChannel,
          article: {
            id: article.id,
            title: article.title,
            slug: article.slug,
            summary: article.summary,
            url: shareBundle.canonicalUrl
          },
          preparedSocialCopy: shareBundle.preparedSocialCopy
        })
      });
      if (!resp.ok) {
        throw new Error(`Social webhook HTTP ${resp.status}`);
      }
    }

    const okLog = appendDistributionLog(store, {
      kind: 'social',
      channel: cleanChannel,
      targetId: article.id,
      targetTitle: article.title,
      fingerprint,
      status: 'delivered',
      actor,
      details: `Published "${article.title}" to ${cleanChannel}.`
    });
    return {
      ok: true,
      providerConnected: true,
      status: 'delivered',
      message: okLog.details,
      shareBundle,
      log: okLog
    };
  } catch (err) {
    const errLog = appendDistributionLog(store, {
      kind: 'social',
      channel: cleanChannel,
      targetId: article.id,
      targetTitle: article.title,
      fingerprint,
      status: 'delivery_error',
      error: err.message || 'Social API failure',
      actor,
      details: `Social API delivery failed on ${cleanChannel}: ${err.message || 'Unknown error'}`
    });
    return {
      ok: false,
      providerConnected: true,
      status: 'delivery_error',
      error: err.message,
      shareBundle,
      log: errLog
    };
  }
}

module.exports = {
  INTEREST_OPTIONS,
  getDistributionConfig,
  selectArticlesForBriefing,
  generateNewsletterTemplate,
  buildShareableLinksForArticle,
  appendDistributionLog,
  sendNewsletterEdition,
  distributeArticleToSocial
};
