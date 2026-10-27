const crypto = require('node:crypto');

class JsonRepository {
  constructor(store, fileKey) {
    if (!store) throw new Error('Store is required for JsonRepository');
    this.store = store;
    this.fileKey = fileKey;
  }

  getFile() {
    return this.store.files[this.fileKey];
  }

  getAll() {
    const file = this.getFile();
    if (!file) return [];
    return this.store.readJson(file, []);
  }

  saveAll(items) {
    const file = this.getFile();
    if (!file) throw new Error(`Unknown file key: ${this.fileKey}`);
    this.store.writeJson(file, items);
    return items;
  }

  getById(id) {
    if (!id) return null;
    const items = this.getAll();
    return items.find(item => String(item.id) === String(id)) || null;
  }

  getByField(field, value) {
    if (value === undefined || value === null) return null;
    const items = this.getAll();
    return items.find(item => item[field] === value) || null;
  }

  filter(predicate) {
    const items = this.getAll();
    return typeof predicate === 'function' ? items.filter(predicate) : items;
  }

  create(item) {
    const items = this.getAll();
    const toSave = {
      id: item.id || crypto.randomUUID(),
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(toSave);
    this.saveAll(items);
    return toSave;
  }

  update(id, patch) {
    const items = this.getAll();
    const index = items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;

    const updated = {
      ...items[index],
      ...patch,
      id: items[index].id, // preserve id
      updatedAt: new Date().toISOString()
    };
    items[index] = updated;
    this.saveAll(items);
    return updated;
  }

  delete(id) {
    const items = this.getAll();
    const index = items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return false;

    items.splice(index, 1);
    this.saveAll(items);
    return true;
  }
}

module.exports = { JsonRepository };
