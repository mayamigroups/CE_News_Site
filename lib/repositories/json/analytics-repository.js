class JsonAnalyticsRepository {
  constructor(store) {
    if (!store) throw new Error('Store is required for JsonAnalyticsRepository');
    this.store = store;
  }

  getAnalytics() {
    return this.store.getAnalytics ? this.store.getAnalytics() : this.store.readJson(this.store.files.analytics, {});
  }

  recordView(payload) {
    return this.store.recordAnalyticsView(payload);
  }

  getSeoTasks() {
    return this.store.getSeoTasks ? this.store.getSeoTasks() : this.store.readJson(this.store.files.seoTasks, []);
  }

  saveSeoTask(task) {
    return this.store.saveSeoTask(task);
  }

  deleteSeoTask(id) {
    return this.store.deleteSeoTask(id);
  }
}

module.exports = { JsonAnalyticsRepository };
