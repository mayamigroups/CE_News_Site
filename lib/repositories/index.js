const { JsonArticleRepository } = require('./json/article-repository.js');
const { JsonManufacturerRepository } = require('./json/manufacturer-repository.js');
const { JsonEquipmentModelRepository } = require('./json/equipment-model-repository.js');
const { JsonTaxonomyRepository } = require('./json/taxonomy-repository.js');
const { JsonSourceRepository } = require('./json/source-repository.js');
const { JsonEditorialRepository } = require('./json/editorial-repository.js');
const { JsonSubscriberRepository } = require('./json/subscriber-repository.js');
const { JsonAnalyticsRepository } = require('./json/analytics-repository.js');

function createRepositories(store) {
  if (!store) throw new Error('A data store is required to initialize repositories.');

  return {
    articles: new JsonArticleRepository(store),
    manufacturers: new JsonManufacturerRepository(store),
    equipmentModels: new JsonEquipmentModelRepository(store),
    taxonomies: new JsonTaxonomyRepository(store),
    sources: new JsonSourceRepository(store),
    editorial: new JsonEditorialRepository(store),
    subscribers: new JsonSubscriberRepository(store),
    analytics: new JsonAnalyticsRepository(store)
  };
}

module.exports = {
  createRepositories,
  JsonArticleRepository,
  JsonManufacturerRepository,
  JsonEquipmentModelRepository,
  JsonTaxonomyRepository,
  JsonSourceRepository,
  JsonEditorialRepository,
  JsonSubscriberRepository,
  JsonAnalyticsRepository
};
