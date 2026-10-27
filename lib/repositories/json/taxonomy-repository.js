class JsonTaxonomyRepository {
  constructor(store) {
    if (!store) throw new Error('Store is required for JsonTaxonomyRepository');
    this.store = store;
  }

  getCategories() {
    return this.store.readJson(this.store.files.categories, []);
  }

  getTags() {
    return this.store.readJson(this.store.files.tags, []);
  }

  getRegions() {
    return this.store.readJson(this.store.files.regions, []);
  }

  getCountries() {
    return this.store.readJson(this.store.files.countries, []);
  }

  getAuthors() {
    return this.store.readJson(this.store.files.authors, []);
  }

  getImages() {
    return this.store.readJson(this.store.files.images, []);
  }

  getCatalogSummary() {
    return this.store.getCatalogSummary();
  }

  upsertEntity(entityType, entityData) {
    return this.store.upsertCatalogEntity(entityType, entityData);
  }

  deleteEntity(entityType, key) {
    return this.store.deleteCatalogEntity(entityType, key);
  }
}

module.exports = { JsonTaxonomyRepository };
