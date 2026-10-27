const { JsonRepository } = require('./json-repository.js');

class JsonManufacturerRepository extends JsonRepository {
  constructor(store) {
    super(store, 'manufacturers');
  }

  getBySlug(slug) {
    if (!slug) return null;
    const clean = String(slug).toLowerCase();
    return this.getAll().find(m => (m.slug || '').toLowerCase() === clean) || null;
  }

  upsert(manufacturer) {
    if (typeof this.store.upsertCatalogEntity === 'function') {
      return this.store.upsertCatalogEntity('manufacturers', manufacturer);
    }
    const all = this.getAll();
    const idx = all.findIndex(m => m.id === manufacturer.id || m.slug === manufacturer.slug);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...manufacturer, updatedAt: new Date().toISOString() };
      this.saveAll(all);
      return all[idx];
    }
    return this.create(manufacturer);
  }

  deleteBySlug(slug) {
    if (typeof this.store.deleteCatalogEntity === 'function') {
      return this.store.deleteCatalogEntity('manufacturers', slug);
    }
    const all = this.getAll();
    const filtered = all.filter(m => (m.slug || '').toLowerCase() !== String(slug).toLowerCase());
    const changed = filtered.length !== all.length;
    if (changed) this.saveAll(filtered);
    return changed;
  }
}

module.exports = { JsonManufacturerRepository };
