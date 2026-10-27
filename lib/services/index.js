const { ArticleService } = require('./article-service');
const { CatalogService } = require('./catalog-service');
const { CollectionService } = require('./collection-service');
const { NewsroomService } = require('./newsroom-service');
const { EditorialService } = require('./editorial-service');
const SeoService = require('./seo-service');
const DistributionService = require('./distribution-service');

function createServices({ repositories, store }) {
  const articleService = new ArticleService({
    articleRepository: repositories.articles,
    taxonomyRepository: repositories.taxonomies,
    editorialRepository: repositories.editorial,
    store
  });

  const catalogService = new CatalogService({
    taxonomyRepository: repositories.taxonomies,
    manufacturerRepository: repositories.manufacturers,
    equipmentModelRepository: repositories.equipmentModels,
    articleRepository: repositories.articles,
    analyticsRepository: repositories.analytics,
    store
  });

  const collectionService = new CollectionService({
    sourceRepository: repositories.sources,
    articleRepository: repositories.articles,
    editorialRepository: repositories.editorial,
    store
  });

  const newsroomService = new NewsroomService({
    sourceRepository: repositories.sources,
    articleRepository: repositories.articles,
    editorialRepository: repositories.editorial,
    store
  });

  const editorialService = new EditorialService({
    articleRepository: repositories.articles,
    sourceRepository: repositories.sources,
    editorialRepository: repositories.editorial,
    store
  });

  const seoService = new SeoService({
    articleRepository: repositories.articles,
    taxonomyRepository: repositories.taxonomies,
    analyticsRepository: repositories.analytics,
    editorialRepository: repositories.editorial,
    catalogService,
    store
  });

  const distributionService = new DistributionService({
    subscriberRepository: repositories.subscribers,
    editorialRepository: repositories.editorial,
    store
  });

  return {
    articles: articleService,
    catalog: catalogService,
    collection: collectionService,
    newsroom: newsroomService,
    editorial: editorialService,
    seo: seoService,
    distribution: distributionService
  };
}

module.exports = {
  createServices,
  ArticleService,
  CatalogService,
  CollectionService,
  NewsroomService,
  EditorialService,
  SeoService,
  DistributionService
};
