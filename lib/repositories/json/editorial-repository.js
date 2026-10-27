class JsonEditorialRepository {
  constructor(store) {
    if (!store) throw new Error('Store is required for JsonEditorialRepository');
    this.store = store;
  }

  getWorkflowConfig() {
    return this.store.readJson(this.store.files.workflowConfig, {});
  }

  saveWorkflowConfig(cfg) {
    this.store.writeJson(this.store.files.workflowConfig, cfg);
    return cfg;
  }

  getNewsroomRuns() {
    return this.store.readJson(this.store.files.newsroomRuns, []);
  }

  saveNewsroomRun(run) {
    const runs = this.getNewsroomRuns();
    runs.unshift(run);
    const trimmed = runs.slice(0, 50);
    this.store.writeJson(this.store.files.newsroomRuns, trimmed);
    return run;
  }

  getFailureAlerts() {
    return this.store.readJson(this.store.files.failureAlerts, []);
  }

  saveFailureAlerts(alerts) {
    this.store.writeJson(this.store.files.failureAlerts, alerts);
    return alerts;
  }

  getPublicationLedger() {
    return this.store.readJson(this.store.files.publicationLedger, []);
  }

  appendPublicationLedger(entry) {
    const ledger = this.getPublicationLedger();
    ledger.push(entry);
    this.store.writeJson(this.store.files.publicationLedger, ledger);
    return entry;
  }

  getAuditLogs() {
    return this.store.getAuditLogs ? this.store.getAuditLogs() : this.store.readJson(this.store.files.auditLogs, []);
  }

  appendAuditLog(entry) {
    return this.store.appendAuditLog(entry);
  }

  getAdminUsers() {
    return this.store.readJson(this.store.files.adminUsers, []);
  }

  getSettings() {
    return this.store.getSettings();
  }

  updateSettings(patch) {
    return this.store.updateSettings(patch);
  }

  getJobs() {
    return this.store.getJobs ? this.store.getJobs() : this.store.readJson(this.store.files.jobs, []);
  }

  runJob(jobId) {
    return this.store.runJob(jobId);
  }

  getBackups() {
    return this.store.listBackups ? this.store.listBackups() : [];
  }

  createBackup(reason) {
    return this.store.createBackup(reason);
  }
}

module.exports = { JsonEditorialRepository };
