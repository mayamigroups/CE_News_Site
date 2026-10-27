const handlePublicRoutes = require('./public-routes');
const handleArticleRoutes = require('./article-routes');
const handleCatalogRoutes = require('./catalog-routes');
const handleCollectionRoutes = require('./collection-routes');
const handleNewsroomRoutes = require('./newsroom-routes');
const handleEditorialRoutes = require('./editorial-routes');
const handleSeoRoutes = require('./seo-routes');
const handleDistributionRoutes = require('./distribution-routes');
const handleAdminRoutes = require('./admin-routes');

/**
 * Route dispatcher
 * @param {Object} ctx
 * @returns {Promise<boolean>} true if the request was handled, false to fall back to static serving
 */
async function dispatchRoute(ctx) {
  // 1. Core public API & feed routes
  if (await handlePublicRoutes(ctx)) return true;

  // 2. Article routes (both public /api/articles and admin /api/admin/articles)
  if (await handleArticleRoutes(ctx)) return true;

  // 3. Distribution & newsletter & tips
  if (await handleDistributionRoutes(ctx)) return true;

  // 4. Admin auth & system operations
  if (await handleAdminRoutes(ctx)) return true;

  // 5. Catalog management
  if (await handleCatalogRoutes(ctx)) return true;

  // 6. News collection
  if (await handleCollectionRoutes(ctx)) return true;

  // 7. Newsroom & AI assist
  if (await handleNewsroomRoutes(ctx)) return true;

  // 8. Editorial workflow
  if (await handleEditorialRoutes(ctx)) return true;

  // 9. SEO & AI-SEO operations
  if (await handleSeoRoutes(ctx)) return true;

  // If it's an unhandled /api/admin/ route, return 404
  if (ctx.pathname.startsWith('/api/admin/')) {
    if (!ctx.session) {
      ctx.send(ctx.res, 401, { error: 'Please log in to the admin panel.' });
      return true;
    }
    ctx.send(ctx.res, 404, { error: 'Admin endpoint not found' });
    return true;
  }

  return false;
}

module.exports = {
  dispatchRoute,
  handlePublicRoutes,
  handleArticleRoutes,
  handleCatalogRoutes,
  handleCollectionRoutes,
  handleNewsroomRoutes,
  handleEditorialRoutes,
  handleSeoRoutes,
  handleDistributionRoutes,
  handleAdminRoutes
};
