class JsonSourceRepository {
  constructor(store) {
    if (!store) throw new Error('Store is required for JsonSourceRepository');
    this.store = store;
  }

  getSources() {
    return this.store.readJson(this.store.files.sources, []);
  }

  getSourceById(id) {
    if (!id) return null;
    return this.getSources().find(s => s.id === id || s.slug === id) || null;
  }

  upsertSource(source) {
    return this.store.upsertCatalogEntity('sources', source);
  }

  deleteSource(id) {
    return this.store.deleteCatalogEntity('sources', id);
  }

  saveSources(sources) {
    this.store.writeJson(this.store.files.sources, sources);
    return sources;
  }

  getCollectedItems() {
    return this.store.readJson(this.store.files.collectedItems, []);
  }

  getCollectedItemById(id) {
    if (!id) return null;
    return this.getCollectedItems().find(item => item.id === id) || null;
  }

  saveCollectedItem(item) {
    const items = this.getCollectedItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
    } else {
      items.push(item);
    }
    this.store.writeJson(this.store.files.collectedItems, items);
    return idx >= 0 ? items[idx] : item;
  }

  deleteCollectedItem(id) {
    const items = this.getCollectedItems();
    const filtered = items.filter(i => i.id !== id);
    if (filtered.length !== items.length) {
      this.store.writeJson(this.store.files.collectedItems, filtered);
      return true;
    }
    return false;
  }

  saveCollectedItems(items) {
    this.store.writeJson(this.store.files.collectedItems, items);
    return items;
  }
}

module.exports = { JsonSourceRepository };
