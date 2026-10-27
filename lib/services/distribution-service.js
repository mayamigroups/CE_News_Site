const crypto = require('crypto');
const distribution = require('../distribution.js');
const models = require('../models.js');
const seoLib = require('../seo.js');

function validHttpUrl(string) {
  if (!string) return true;
  try {
    const parsed = new URL(string);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

class DistributionService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/json/subscriber-repository')} dependencies.subscriberRepository
   * @param {import('../repositories/json/editorial-repository')} dependencies.editorialRepository
   * @param {Object} dependencies.store
   */
  constructor({ subscriberRepository, editorialRepository, store }) {
    this.subscriberRepo = subscriberRepository;
    this.editorialRepo = editorialRepository;
    this.store = store;
  }

  getNewsletterConfig() {
    const distCfg = distribution.getDistributionConfig(this.store);
    const allSubs = this.subscriberRepo.getSubscribers();
    return {
      count: allSubs.filter(x => x.status !== 'unsubscribed').length,
      verifiedCount: allSubs.filter(x => x.status !== 'unsubscribed' && x.verified).length,
      providerConnected: distCfg.emailService.connected,
      emailService: distCfg.emailService,
      interestOptions: distCfg.interestOptions,
      privacyCompliance: distCfg.privacyCompliance
    };
  }

  subscribe(body, reqOrigin = '') {
    const emailNorm = String(body.email || '').trim().toLowerCase();
    const existing = this.subscriberRepo.getSubscriberByEmail(emailNorm);
    const sub = models.createNewsletterModel(
      {
        ...body,
        verified: body.verified !== undefined ? Boolean(body.verified) : (existing?.verified ?? false)
      },
      existing || {}
    );

    this.subscriberRepo.addSubscriber(sub);
    seoLib.recordTelemetryEvent(this.store, { type: 'newsletter_conversion', slug: sub.segment });

    const distCfg = distribution.getDistributionConfig(this.store);
    const verificationUrl = `${reqOrigin}/api/newsletter/verify?token=${encodeURIComponent(sub.verificationToken)}&email=${encodeURIComponent(sub.email)}`;
    const unsubscribeUrl = `${reqOrigin}/api/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken)}&email=${encodeURIComponent(sub.email)}`;

    distribution.appendDistributionLog(this.store, {
      kind: 'verification_email',
      channel: distCfg.emailService.provider,
      targetId: sub.id,
      targetTitle: `Confirm Machine Report World subscription (${sub.email})`,
      fingerprint: `verify:${sub.id}`,
      status: distCfg.emailService.connected ? 'delivered' : 'provider_not_configured',
      recipientCount: 1,
      actor: 'visitor',
      details: distCfg.emailService.connected
        ? `Sent double opt-in verification link to ${sub.email}.`
        : `Email provider not yet connected; saved subscriber ${sub.email} with local verification & unsubscribe links.`
    });

    const activeCount = this.subscriberRepo.getSubscribers().filter(x => x.status !== 'unsubscribed').length;

    return {
      ok: true,
      count: activeCount,
      providerConnected: distCfg.emailService.connected,
      providerNotice: distCfg.emailService.publicNotice,
      subscriber: {
        id: sub.id,
        email: sub.email,
        interests: sub.interests,
        frequency: sub.frequency,
        status: sub.status,
        verified: sub.verified,
        consent: sub.consent,
        consentTimestamp: sub.consentTimestamp
      },
      verificationUrl,
      unsubscribeUrl
    };
  }

  verify({ token = '', email = '' }) {
    const rows = this.subscriberRepo.getSubscribers();
    const targetEmail = String(email || '').trim().toLowerCase();
    const targetToken = String(token || '').trim();

    const idx = rows.findIndex(x =>
      (targetToken && x.verificationToken === targetToken) ||
      (targetEmail && x.email === targetEmail && (!targetToken || x.verificationToken === targetToken))
    );

    if (idx < 0) {
      const err = new Error('Invalid or expired verification link.');
      err.statusCode = 404;
      throw err;
    }

    const sub = rows[idx];
    const updated = this.subscriberRepo.updateSubscriber(sub.id, {
      verified: true,
      verifiedAt: new Date().toISOString(),
      status: 'active'
    });

    return updated;
  }

  unsubscribe({ token = '', email = '' }) {
    const rows = this.subscriberRepo.getSubscribers();
    const targetEmail = String(email || '').trim().toLowerCase();
    const targetToken = String(token || '').trim();

    const idx = rows.findIndex(x =>
      (targetToken && x.unsubscribeToken === targetToken) ||
      (targetEmail && x.email === targetEmail)
    );

    if (idx < 0) {
      const err = new Error('Subscriber not found for unsubscribe request.');
      err.statusCode = 404;
      throw err;
    }

    const sub = rows[idx];
    const updated = this.subscriberRepo.updateSubscriber(sub.id, {
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString()
    });

    return updated;
  }

  submitTip(body) {
    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const organization = String(body.organization || '').trim().slice(0, 120);
    const submissionType = ['press-release', 'news-tip', 'correction', 'event'].includes(body.submissionType)
      ? body.submissionType
      : 'news-tip';
    const subject = String(body.subject || '').trim().slice(0, 180);
    const sourceUrl = String(body.sourceUrl || '').trim().slice(0, 1500);
    const message = String(body.message || '').trim().slice(0, 5000);

    if (!subject || message.length < 15) {
      const err = new Error('Please include a subject and detailed message (at least 15 characters).');
      err.statusCode = 400;
      throw err;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('Please provide a valid contact email address.');
      err.statusCode = 400;
      throw err;
    }
    if (!validHttpUrl(sourceUrl)) {
      const err = new Error('Source link must be a valid http or https URL.');
      err.statusCode = 400;
      throw err;
    }

    const rows = this.subscriberRepo.getSubmissions();
    const isDup = rows.some(r => r.subject.toLowerCase() === subject.toLowerCase() && r.message === message);

    if (!isDup) {
      const item = {
        id: crypto.randomUUID(),
        name: name || 'Anonymous Tip',
        email,
        organization,
        submissionType,
        subject,
        sourceUrl,
        message,
        status: 'unread',
        createdAt: new Date().toISOString()
      };
      this.subscriberRepo.addSubmission(item);
    }

    return { ok: true };
  }

  getSubmissions() {
    return this.subscriberRepo.getSubmissions();
  }

  updateSubmission(id, { status }) {
    if (!status || !['unread', 'reviewed', 'archived'].includes(status)) {
      const err = new Error('Invalid status.');
      err.statusCode = 400;
      throw err;
    }
    const updated = this.subscriberRepo.updateSubmission(id, { status });
    if (!updated) {
      const err = new Error('Submission not found');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  }

  deleteSubmission(id) {
    const ok = this.subscriberRepo.deleteSubmission(id);
    return { ok };
  }

  generateNewsletterTemplate({ editionType = 'weekly', interests = [] } = {}) {
    return distribution.generateNewsletterTemplate(this.store, { editionType, interests });
  }

  async sendNewsletter({ editionType = 'weekly', interests = [], simulateDeliveryError = '', actor = '' }) {
    return distribution.sendNewsletterEdition(this.store, {
      editionType,
      interests,
      simulateDeliveryError,
      actor
    });
  }

  async distributeSocial({ articleId, channel = 'linkedin', simulateDeliveryError = '', actor = '' }) {
    return distribution.distributeArticleToSocial(this.store, {
      articleId,
      channel,
      simulateDeliveryError,
      actor
    });
  }
}

module.exports = DistributionService;
