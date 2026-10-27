class JsonSubscriberRepository {
  constructor(store) {
    if (!store) throw new Error('Store is required for JsonSubscriberRepository');
    this.store = store;
  }

  getSubscribers() {
    return this.store.readJson(this.store.files.newsletter, []);
  }

  saveSubscribers(subs) {
    this.store.writeJson(this.store.files.newsletter, subs);
    return subs;
  }

  getSubscriberById(id) {
    if (!id) return null;
    return this.getSubscribers().find(s => s.id === id) || null;
  }

  getSubscriberByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return this.getSubscribers().find(s => (s.email || '').toLowerCase() === clean) || null;
  }

  addSubscriber(sub) {
    const subs = this.getSubscribers();
    const cleanEmail = String(sub.email || '').toLowerCase().trim();
    const idx = subs.findIndex(s => (s.email || '').toLowerCase().trim() === cleanEmail);
    if (idx >= 0) {
      subs[idx] = { ...subs[idx], ...sub, status: 'active', updatedAt: new Date().toISOString() };
      this.saveSubscribers(subs);
      return subs[idx];
    }
    subs.push(sub);
    this.saveSubscribers(subs);
    return sub;
  }

  updateSubscriber(id, patch) {
    const subs = this.getSubscribers();
    const idx = subs.findIndex(s => s.id === id);
    if (idx < 0) return null;
    subs[idx] = { ...subs[idx], ...patch, updatedAt: new Date().toISOString() };
    this.saveSubscribers(subs);
    return subs[idx];
  }

  deleteSubscriber(id) {
    const subs = this.getSubscribers();
    const filtered = subs.filter(s => s.id !== id);
    if (filtered.length !== subs.length) {
      this.saveSubscribers(filtered);
      return true;
    }
    return false;
  }

  getSubmissions() {
    return this.store.readJson(this.store.files.submissions, []);
  }

  saveSubmissions(subs) {
    this.store.writeJson(this.store.files.submissions, subs);
    return subs;
  }

  getSubmissionById(id) {
    if (!id) return null;
    return this.getSubmissions().find(s => s.id === id) || null;
  }

  addSubmission(submission) {
    const subs = this.getSubmissions();
    subs.push(submission);
    this.saveSubmissions(subs);
    return submission;
  }

  updateSubmission(id, patch) {
    const subs = this.getSubmissions();
    const idx = subs.findIndex(s => s.id === id);
    if (idx < 0) return null;
    subs[idx] = { ...subs[idx], ...patch, updatedAt: new Date().toISOString() };
    this.saveSubmissions(subs);
    return subs[idx];
  }

  deleteSubmission(id) {
    const subs = this.getSubmissions();
    const filtered = subs.filter(s => s.id !== id);
    if (filtered.length !== subs.length) {
      this.saveSubmissions(filtered);
      return true;
    }
    return false;
  }
}

module.exports = { JsonSubscriberRepository };
