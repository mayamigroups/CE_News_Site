const workflow = require('../workflow.js');

class EditorialService {
  constructor({ editorialRepository, articleRepository, store }) {
    this.editorialRepo = editorialRepository;
    this.articleRepo = articleRepository;
    this.store = store;
  }

  getPipelineSummary() {
    return workflow.getEditorialPipelineSummary(this.store);
  }

  getWorkflowConfig() {
    return workflow.getWorkflowConfig(this.store);
  }

  saveWorkflowConfig(patch, actor = 'super_admin') {
    return workflow.saveWorkflowConfig(this.store, patch, actor);
  }

  runPublicationRulesTestSuite(actor = 'managing_editor') {
    return workflow.runPublicationRulesTestSuite(this.store, actor);
  }

  evaluateArticleGates(articleId) {
    const targetArt = this.articleRepo.getById(articleId);
    if (!targetArt) {
      const err = new Error('Article not found');
      err.statusCode = 404;
      throw err;
    }
    return workflow.evaluateStoryPublicationGates(targetArt, this.store);
  }

  transitionArticle(articleId, action, body = {}, session = {}) {
    return workflow.transitionArticleStage(this.store, articleId, action, body, session);
  }

  acknowledgeAlert(alertId, actor = 'super_admin') {
    const alerts = this.editorialRepo.getFailureAlerts();
    const idx = alerts.findIndex(a => a.id === alertId);
    if (idx < 0) {
      const err = new Error('Failure alert not found');
      err.statusCode = 404;
      throw err;
    }
    alerts[idx].acknowledged = true;
    alerts[idx].acknowledgedBy = actor;
    alerts[idx].acknowledgedAt = new Date().toISOString();
    this.editorialRepo.saveFailureAlerts(alerts);
    return alerts[idx];
  }

  getLogs() {
    const jobs = this.editorialRepo.getJobs();
    const auditLogs = this.editorialRepo.getAuditLogs(100);
    const articles = this.articleRepo.getAll();
    const validationWarnings = articles
      .filter(a => a.status === 'published' && (!a.sourceUrl || !a.imageCredit))
      .map(a => ({
        articleId: a.id,
        title: a.title,
        slug: a.slug,
        issue: !a.sourceUrl ? 'Missing primary source URL' : 'Missing image credit attribution'
      }));
    return { jobs, auditLogs, validationWarnings };
  }

  async runJobWithLock(jobId, body = {}, session = {}) {
    const actor = session.username || 'system';
    return workflow.executeJobWithLockAndRetry(
      this.store,
      jobId,
      async () => {
        if (body.simulateFailure) {
          throw new Error(String(body.simulateFailure));
        }
        if (jobId === 'job-scheduled-publisher') {
          const publishedDue = workflow.processDueScheduledArticles(this.store, actor);
          const r = this.editorialRepo.runJob(jobId, actor);
          return { ...r, itemsProcessed: publishedDue.length + (r.itemsProcessed || 0) };
        }
        return this.editorialRepo.runJob(jobId, actor);
      },
      {
        actor,
        maxRetries: body.maxRetries ? Number(body.maxRetries) : undefined,
        retryDelayMs: body.retryDelayMs !== undefined ? Number(body.retryDelayMs) : undefined,
        holdLockForTest: Boolean(body.holdLockForTest)
      }
    );
  }

  getSettings() {
    return this.editorialRepo.getSettings();
  }

  updateSettings(patch, actor = 'super_admin') {
    const updated = this.editorialRepo.updateSettings(patch);
    this.editorialRepo.appendAuditLog({
      actor,
      role: 'super_admin',
      action: 'settings.update',
      target: 'settings.json',
      level: 'info',
      details: 'Updated global site and SEO settings.'
    });
    return updated;
  }

  listBackups() {
    return this.editorialRepo.getBackups();
  }

  createBackup(reason = 'manual-admin-snapshot', actor = 'super_admin') {
    const snapshot = this.editorialRepo.createBackup(reason);
    this.editorialRepo.appendAuditLog({
      actor,
      role: 'super_admin',
      action: 'backup.create',
      target: snapshot.id,
      level: 'info',
      details: `Created snapshot with ${snapshot.recordCount} records.`
    });
    return snapshot;
  }
}

module.exports = { EditorialService };
