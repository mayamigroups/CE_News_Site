const { JsonRepository } = require('./json-repository.js');

class JsonEquipmentModelRepository extends JsonRepository {
  constructor(store) {
    super(store, 'equipmentModels');
  }

  getBySlug(slug) {
    if (!slug) return null;
    const clean = String(slug).toLowerCase();
    return this.getAll().find(m => (m.slug || '').toLowerCase() === clean) || null;
  }

  getByManufacturerSlug(mfgSlug) {
    if (!mfgSlug) return [];
    const clean = String(mfgSlug).toLowerCase();
    return this.getAll().filter(m => (m.manufacturerSlug || '').toLowerCase() === clean);
  }

  upsert(model) {
    if (typeof this.store.upsertCatalogEntity === 'function') {
      return this.store.upsertCatalogEntity('equipmentModels', model);
    }
    const all = this.getAll();
    const idx = all.findIndex(m => m.id === model.id || m.slug === model.slug);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...model, updatedAt: new Date().toISOString() };
      this.saveAll(all);
      return all[idx];
    }
    return this.create(model);
  }

  deleteBySlug(slug) {
    if (typeof this.store.deleteCatalogEntity === 'function') {
      return this.store.deleteCatalogEntity('equipmentModels', slug);
    }
    const all = this.getAll();
    const filtered = all.filter(m => (m.slug || '').toLowerCase() !== String(slug).toLowerCase());
    const changed = filtered.length !== all.length;
    if (changed) this.saveAll(filtered);
    return changed;
  }
}

module.exports = { JsonEquipmentModelRepository };
