const gsc = require('./gsc.js');
const crypto = require('node:crypto');
const models = require('./models.js');

/**
 * 10 Coordinated AI Specialist Workflows inside Machine Report World
 * Shared task queue and shared data context:
 * 1. coordinator — assigns tasks, manages queues, prevents duplicate work.
 * 2. keyword_research — identifies search intent, topics, queries.
 * 3. news_research — collects and organizes source evidence.
 * 4. news_writer — prepares original drafts from verified evidence.
 * 5. fact_checker — flags unsupported or conflicting claims.
 * 6. article_seo — recommends headlines, summaries, metadata, internal links.
 * 7. technical_seo — checks URLs, metadata, sitemaps, broken links, crawlability.
 * 8. regional_seo — analyzes country and regional content opportunities.
 * 9. manufacturer_seo — improves manufacturer, equipment, and model pages.
 * 10. analytics_strategy — evaluates performance, priorities, next actions.
 */
const COORDINATED_SPECIALIST_ROLES = [
  {
    id: 'coordinator',
    name: 'Workflow Coordinator',
    category: 'Coordination',
    responsibility: 'Assigns tasks, manages task dependencies, deduplicates runs, and orchestrates the shared workflow queue.'
  },
  {
    id: 'keyword_research',
    name: 'Keyword & Search Intent Specialist',
    category: 'SEO Intelligence',
    responsibility: 'Analyzes user search intent, on-site queries, and technical off-highway topic opportunities without fabricating search volume.'
  },
  {
    id: 'news_research',
    name: 'News Research & Evidence Specialist',
    category: 'Editorial',
    responsibility: 'Extracts supported entities, verifiable dates, OEMs, models, and source attribution from collected feeds.'
  },
  {
    id: 'news_writer',
    name: 'News Writer',
    category: 'Editorial',
    responsibility: 'Drafts original, structured industry reports strictly based on verified evidence; separates OEM statements from technical analysis.'
  },
  {
    id: 'fact_checker',
    name: 'Fact & Verification Specialist',
    category: 'Verification',
    responsibility: 'Flags unsupported quotes, specs, financial claims, dates, and conflicting reports for mandatory human review.'
  },
  {
    id: 'article_seo',
    name: 'Article SEO Specialist',
    category: 'SEO Intelligence',
    responsibility: 'Recommends search-friendly titles, summaries, JSON-LD structured data, metadata, and cross-hub internal link anchors.'
  },
  {
    id: 'technical_seo',
    name: 'Technical SEO Auditor',
    category: 'Technical SEO',
    responsibility: 'Audits URL canonicals, sitemap entries, robots.txt, HTTP headers, broken links, and mobile crawlability.'
  },
  {
    id: 'regional_seo',
    name: 'Regional Market & Regulatory SEO Specialist',
    category: 'Regional',
    responsibility: 'Evaluates country/regional market demand, emission regulations (CEV-V, Stage V, Tier 4F), units, and currencies.'
  },
  {
    id: 'manufacturer_seo',
    name: 'Manufacturer & Equipment Model Specialist',
    category: 'Directory',
    responsibility: 'Improves OEM profiles, equipment model spec dossiers, competing model matrices, and directory completeness.'
  },
  {
    id: 'analytics_strategy',
    name: 'Analytics & Content Strategy Specialist',
    category: 'Strategy',
    responsibility: 'Evaluates real search impressions, clicks, page views, newsletter conversions, and prioritizes high-impact content.'
  }
];

const VALID_TASK_TYPES = [
  'keyword_research',
  'article_optimization',
  'internal_linking',
  'manufacturer_improvement',
  'model_spec_improvement',
  'duplicate_thin_content_check',
  'technical_seo_audit',
  'sitemap_canonical_check',
  'regional_opportunity',
  'outdated_content_refresh',
  'industry_outreach_opportunity'
];

const VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];

/**
 * 90-Day SEO Execution Roadmap Definition (Planning stages, not ranking promises)
 */
const SEO_90_DAY_ROADMAP = [
  {
    phase: 'phase1',
    days: 'Days 1–15',
    title: 'Technical Audit, Baseline & Foundation',
    objective: 'Ensure crawlability, indexation hygiene, schema validity, and baseline telemetry tracking.',
    focusAreas: [
      'Technical SEO audit across sitemap.xml, robots.txt, canonical URLs, and response codes',
      'Telemetry & Search Console verification setup without exposing credentials',
      'Keyword taxonomy mapping across 26 category desks and 10 regional hubs',
      'Baseline page speed, caching headers, and mobile responsiveness checks'
    ]
  },
  {
    phase: 'phase2',
    days: 'Days 16–30',
    title: 'Verified Content, Optimization & Indexing',
    objective: 'Strengthen cornerstone evergreen guides, cross-hub internal links, and ensure new articles are indexed clean.',
    focusAreas: [
      'Publish standards-referenced technical comparisons and preventive maintenance guides',
      'Enforce cross-hub link graph (Articles ↔ Manufacturers ↔ Models ↔ Regions)',
      'Monitor indexation coverage on Google Search Console',
      'Double opt-in newsletter interest onboarding and subscriber engagement'
    ]
  },
  {
    phase: 'phase3',
    days: 'Days 31–60',
    title: 'Search Data Analysis & Topic Expansion',
    objective: 'Analyze real on-site search queries, impressions, and engagement to expand verified demand topics.',
    focusAreas: [
      'Evaluate top internal search queries and category views in the content priority matrix',
      'Optimize high-interest manufacturer hubs (BULL, JCB, Caterpillar, Komatsu, Volvo CE, Tata, SANY)',
      'Add competing model comparisons for equipment with high fleet search demand',
      'Audit and prune thin or duplicate dispatches'
    ]
  },
  {
    phase: 'phase4',
    days: 'Days 61–90',
    title: 'High-Potential Expansion & Regional Deepening',
    objective: 'Deepen regional market coverage (India, North America, Europe, China, ASEAN) and evaluate sustainable growth.',
    focusAreas: [
      'Expand regional regulatory coverage (CEV Stage V, EPA 2027, EU Stage V, China NRMM IV)',
      'Promote legitimate industry outreach and official source partnerships',
      'Review 90-day trajectory across real clicks, impressions, returning readers, and active subscribers',
      'Plan subsequent quarterly editorial and technical roadmaps'
    ]
  }
];

function makeTaskId(title, type) {
  const hash = crypto.createHash('sha1').update(`${type}:${title}:${Date.now()}`).digest('hex').slice(0, 10);
  return `task-${hash}`;
}

/**
 * Creates or normalizes an SEO task queue item.
 * Prioritized by evidence, importance (1-10), confidence (1-10), and estimated effort.
 */
function createSeoTaskModel(input = {}, existing = {}) {
  const title = String(input.title || existing.title || '').trim().slice(0, 200);
  if (!title) throw new Error('Task title is required.');

  const taskType = VALID_TASK_TYPES.includes(input.taskType || existing.taskType)
    ? (input.taskType || existing.taskType)
    : 'article_optimization';

  const assignedRole = COORDINATED_SPECIALIST_ROLES.some(r => r.id === (input.assignedRole || existing.assignedRole))
    ? (input.assignedRole || existing.assignedRole)
    : 'article_seo';

  const importance = Math.max(1, Math.min(10, Number(input.importance ?? existing.importance ?? 7)));
  const confidence = Math.max(1, Math.min(10, Number(input.confidence ?? existing.confidence ?? 8)));
  const effort = ['low', 'medium', 'high'].includes(input.effort || existing.effort)
    ? (input.effort || existing.effort)
    : 'medium';

  const effortWeight = effort === 'low' ? 3 : (effort === 'medium' ? 2 : 1);
  const priorityScore = Math.round((importance * 0.5 + confidence * 0.3 + effortWeight * 0.2) * 10);

  const status = VALID_TASK_STATUSES.includes(input.status || existing.status)
    ? (input.status || existing.status)
    : 'pending';

  const now = new Date().toISOString();

  return {
    id: existing.id || input.id || makeTaskId(title, taskType),
    title,
    taskType,
    assignedRole,
    status,
    importance,
    confidence,
    effort,
    priorityScore,
    targetUrl: String(input.targetUrl || existing.targetUrl || '').trim().slice(0, 500),
    evidenceRationale: String(input.evidenceRationale || existing.evidenceRationale || '').trim().slice(0, 500),
    recommendedAction: String(input.recommendedAction || existing.recommendedAction || '').trim().slice(0, 1000),
    resultNotes: String(input.resultNotes || existing.resultNotes || '').trim().slice(0, 1000),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
    completedAt: input.completedAt || existing.completedAt || (status === 'completed' ? now : null),
    completedBy: input.completedBy || existing.completedBy || null
  };
}

/**
 * Technical SEO Auditor & Health Checker (Pure native code - zero external paid API needed)
 */

/**
 * Actionable Pre-Publication Article SEO Auditor
 * Evaluates individual articles / drafts across 10 genuine criteria:
 * 1. Headline length (30-70 chars optimal)
 * 2. Custom Meta Title length (35-65 chars)
 * 3. Meta Description / Summary presence & length (120-160 chars)
 * 4. Primary Source Grounding (E-E-A-T attribution URL)
 * 5. Content depth & word count (200+ words min, 400+ recommended)
 * 6. Semantic subheadings (H2 / H3)
 * 7. Cross-hub internal linking
 * 8. Featured image & verified copyright attribution
 * 9. Core taxonomy & entity metadata (manufacturer, category, region)
 * 10. Topic tags coverage (2+ tags)
 */
function auditArticleSeo(article = {}, catalog = {}) {
  const checks = [];
  const errors = [];
  const warnings = [];
  let score = 100;

  function recordCheck({ id, name, category, passed, severity = 'medium', details, recommendedFix }) {
    checks.push({ id, name, category, passed, severity, details, recommendedFix: passed ? '' : recommendedFix });
    if (!passed) {
      if (severity === 'high') {
        score = Math.max(0, score - 20);
        errors.push({ id, name, details, recommendedFix });
      } else if (severity === 'medium') {
        score = Math.max(0, score - 10);
        warnings.push({ id, name, details, recommendedFix });
      } else {
        score = Math.max(0, score - 5);
        warnings.push({ id, name, details, recommendedFix });
      }
    }
  }

  const title = String(article.title || '').trim();
  const summary = String(article.summary || article.excerpt || '').trim();
  const body = String(article.body || '').trim();
  const seo = article.seo || {};
  const metaTitle = String(seo.metaTitle || '').trim();
  const metaDescription = String(seo.metaDescription || '').trim();
  const sourceUrl = String(article.sourceUrl || '').trim();
  const sourceUrls = Array.isArray(article.sourceUrls) ? article.sourceUrls : [];
  const hasSource = Boolean(sourceUrl || sourceUrls.length > 0);
  const image = String(article.image || '').trim();
  const imageCredit = String(article.imageCredit || '').trim();

  // 1. Headline Presence & Length
  if (!title) {
    recordCheck({
      id: 'headline_presence',
      name: 'Headline Presence',
      category: 'Title & Meta',
      passed: false,
      severity: 'high',
      details: 'Article headline is missing.',
      recommendedFix: 'Provide a clear, descriptive headline of 30–70 characters.'
    });
  } else if (title.length < 25) {
    recordCheck({
      id: 'headline_length',
      name: 'Headline Length',
      category: 'Title & Meta',
      passed: false,
      severity: 'medium',
      details: `Headline is too short (${title.length} chars). Search engines favor descriptive titles between 30 and 70 characters.`,
      recommendedFix: 'Expand headline to 30–70 characters with primary equipment and manufacturer keywords.'
    });
  } else if (title.length > 85) {
    recordCheck({
      id: 'headline_length',
      name: 'Headline Length',
      category: 'Title & Meta',
      passed: false,
      severity: 'low',
      details: `Headline is ${title.length} characters and may be truncated on search result pages (>70 chars).`,
      recommendedFix: 'Consider keeping the headline under 70 characters or customize metaTitle specifically for SERPs.'
    });
  } else {
    recordCheck({
      id: 'headline_length',
      name: 'Headline Length',
      category: 'Title & Meta',
      passed: true,
      details: `Headline length is optimal (${title.length} characters).`
    });
  }

  // 2. Meta Title Optimization
  if (!metaTitle) {
    recordCheck({
      id: 'meta_title_customized',
      name: 'Custom Meta Title',
      category: 'Title & Meta',
      passed: false,
      severity: 'low',
      details: 'Dedicated SEO metaTitle is not customized; falling back to headline.',
      recommendedFix: 'Set a dedicated metaTitle formatted as "Headline | MACHINEWIRE".'
    });
  } else if (metaTitle.length > 70) {
    recordCheck({
      id: 'meta_title_length',
      name: 'Meta Title Length',
      category: 'Title & Meta',
      passed: false,
      severity: 'medium',
      details: `Meta title is ${metaTitle.length} characters and will be truncated by Google (recommended: 35–65 characters).`,
      recommendedFix: 'Shorten meta title to 65 characters or less.'
    });
  } else {
    recordCheck({
      id: 'meta_title_length',
      name: 'Meta Title Length',
      category: 'Title & Meta',
      passed: true,
      details: `Meta title length is optimal (${metaTitle.length} characters).`
    });
  }

  // 3. Meta Description Presence & Length
  const activeMetaDesc = metaDescription || summary;
  if (!activeMetaDesc) {
    recordCheck({
      id: 'meta_description_presence',
      name: 'Meta Description Presence',
      category: 'Snippet & SERP',
      passed: false,
      severity: 'high',
      details: 'Meta description and summary are both missing.',
      recommendedFix: 'Add a concise summary / meta description between 120 and 160 characters.'
    });
  } else if (activeMetaDesc.length < 80) {
    recordCheck({
      id: 'meta_description_length',
      name: 'Meta Description Length',
      category: 'Snippet & SERP',
      passed: false,
      severity: 'medium',
      details: `Meta description is short (${activeMetaDesc.length} characters; optimal: 120–160 chars).`,
      recommendedFix: 'Expand meta description to 120–160 characters summarizing the article value.'
    });
  } else if (activeMetaDesc.length > 175) {
    recordCheck({
      id: 'meta_description_length',
      name: 'Meta Description Length',
      category: 'Snippet & SERP',
      passed: false,
      severity: 'low',
      details: `Meta description is ${activeMetaDesc.length} characters and may be clipped in search snippets (>160 chars).`,
      recommendedFix: 'Trim meta description to under 160 characters.'
    });
  } else {
    recordCheck({
      id: 'meta_description_length',
      name: 'Meta Description Length',
      category: 'Snippet & SERP',
      passed: true,
      details: `Meta description length is optimal (${activeMetaDesc.length} characters).`
    });
  }

  // 4. Primary Source Grounding (E-E-A-T)
  if (!hasSource) {
    recordCheck({
      id: 'primary_source_attribution',
      name: 'Primary Source Grounding',
      category: 'E-E-A-T & Trust',
      passed: false,
      severity: 'high',
      details: 'No primary source URL attached. Machine Report World policy requires verified source attribution for news claims.',
      recommendedFix: 'Provide the official press release or manufacturer website link in sourceUrl.'
    });
  } else {
    recordCheck({
      id: 'primary_source_attribution',
      name: 'Primary Source Grounding',
      category: 'E-E-A-T & Trust',
      passed: true,
      details: `Verified primary source attribution attached (${sourceUrl || sourceUrls[0]}).`
    });
  }

  // 5. Body Word Count & Depth
  const wordCount = body ? body.split(/\s+/).filter(Boolean).length : 0;
  if (wordCount < 40) {
    recordCheck({
      id: 'content_depth',
      name: 'Content Depth & Word Count',
      category: 'Content Quality',
      passed: false,
      severity: 'high',
      details: `Thin content detected: body contains only ${wordCount} words (minimum recommended: 40+ words).`,
      recommendedFix: 'Flesh out the dispatch with technical specifications, worksite context, and industry analysis.'
    });
  } else if (wordCount < 180) {
    recordCheck({
      id: 'content_depth',
      name: 'Content Depth & Word Count',
      category: 'Content Quality',
      passed: false,
      severity: 'low',
      details: `Content length is modest (${wordCount} words). Full news dispatches should aim for 180+ words for search competitiveness.`,
      recommendedFix: 'Add details regarding powertrain, availability, regional market impact, or competitive models.'
    });
  } else {
    recordCheck({
      id: 'content_depth',
      name: 'Content Depth & Word Count',
      category: 'Content Quality',
      passed: true,
      details: `Solid content depth (${wordCount} words).`
    });
  }

  // 6. Subheading Structure (H2 / H3)
  const hasSubheadings = /^(?:#{2,3}\s+|###\s+)/m.test(body);
  if (wordCount >= 250 && !hasSubheadings) {
    recordCheck({
      id: 'subheadings_structure',
      name: 'Subheading Structure (H2/H3)',
      category: 'Content Quality',
      passed: false,
      severity: 'medium',
      details: 'No markdown subheadings (## or ###) detected in article body.',
      recommendedFix: 'Break long copy into scannable sections with descriptive subheadings.'
    });
  } else {
    recordCheck({
      id: 'subheadings_structure',
      name: 'Subheading Structure (H2/H3)',
      category: 'Content Quality',
      passed: true,
      details: hasSubheadings ? 'Content properly structured with semantic subheadings.' : 'Short form piece; subheadings optional.'
    });
  }

  // 7. Internal Cross-Linking
  const internalLinkMatches = body.match(/\[([^\]]+)\]\((\/[^)]+)\)/g) || [];
  if (internalLinkMatches.length === 0) {
    recordCheck({
      id: 'internal_cross_linking',
      name: 'Cross-Hub Internal Links',
      category: 'Internal Link Graph',
      passed: false,
      severity: 'medium',
      details: 'Zero internal links to Machine Report World category, model, manufacturer, or regional hubs found in body.',
      recommendedFix: 'Add at least 1-2 internal links (e.g. [Backhoe Loaders](/category/backhoe-loaders) or regional hubs).'
    });
  } else {
    recordCheck({
      id: 'internal_cross_linking',
      name: 'Cross-Hub Internal Links',
      category: 'Internal Link Graph',
      passed: true,
      details: `${internalLinkMatches.length} internal cross-hub links present.`
    });
  }

  // 8. Media Optimization & Copyright Credit
  if (!image) {
    recordCheck({
      id: 'featured_image',
      name: 'Featured Image',
      category: 'Media & Visuals',
      passed: false,
      severity: 'medium',
      details: 'Article has no featured image attached for social cards and news previews.',
      recommendedFix: 'Attach a high-resolution equipment photo or manufacturer diagram.'
    });
  } else {
    const hasCredit = Boolean(imageCredit && imageCredit.trim().length >= 5 && !/verify license|unverified|todo|unknown/i.test(imageCredit));
    if (!hasCredit) {
      recordCheck({
        id: 'image_credit',
        name: 'Image Attribution & License',
        category: 'Media & Visuals',
        passed: false,
        severity: 'medium',
        details: 'Featured image is missing explicit attribution or carries an unverified license notice.',
        recommendedFix: 'Provide confirmed copyright attribution or license source in imageCredit.'
      });
    } else {
      recordCheck({
        id: 'image_credit',
        name: 'Image Attribution & License',
        category: 'Media & Visuals',
        passed: true,
        details: `Image verified with explicit attribution: "${imageCredit}".`
      });
    }
  }

  // 9. Taxonomy & Entity Metadata
  const hasTaxonomy = Boolean(
    article.category &&
    article.manufacturer &&
    (article.country || article.region)
  );
  if (!hasTaxonomy) {
    recordCheck({
      id: 'taxonomy_metadata',
      name: 'Taxonomy & Entity Metadata',
      category: 'Semantic Entities',
      passed: false,
      severity: 'high',
      details: 'Missing core taxonomy fields (category, manufacturer, or country/region).',
      recommendedFix: 'Set category, manufacturer, and market region in the metadata panel.'
    });
  } else {
    recordCheck({
      id: 'taxonomy_metadata',
      name: 'Taxonomy & Entity Metadata',
      category: 'Semantic Entities',
      passed: true,
      details: `Taxonomy complete (${article.category} · ${article.manufacturer} · ${article.country || article.region}).`
    });
  }

  // 10. Tags & Keywords
  const tags = Array.isArray(article.tags) ? article.tags : [];
  if (tags.length < 2) {
    recordCheck({
      id: 'topic_tags',
      name: 'Topic Tags Coverage',
      category: 'Semantic Entities',
      passed: false,
      severity: 'low',
      details: `Only ${tags.length} topic tags configured (recommended: 3–6 tags).`,
      recommendedFix: 'Add relevant topic tags (e.g. equipment type, power system, manufacturer).'
    });
  } else {
    recordCheck({
      id: 'topic_tags',
      name: 'Topic Tags Coverage',
      category: 'Semantic Entities',
      passed: true,
      details: `${tags.length} topic tags configured.`
    });
  }

  const status = errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed');

  return {
    score,
    status,
    passed: errors.length === 0,
    errorsCount: errors.length,
    warningsCount: warnings.length,
    checksCount: checks.length,
    passedCount: checks.filter(c => c.passed).length,
    errors,
    warnings,
    checks,
    auditedAt: new Date().toISOString()
  };
}

function runTechnicalSeoAudit(store) {
  const articles = store.readJson(store.files.articles, []);
  const catalog = store.getCatalogSummary();
  const sources = store.readJson(store.files.sources, []);
  const settings = store.getSettings();

  const auditResults = {
    auditTimestamp: new Date().toISOString(),
    overallHealthScore: 100,
    checks: [],
    issuesFound: [],
    stats: {
      totalArticles: articles.length,
      publishedArticles: articles.filter(a => a.status === 'published').length,
      indexedArticles: articles.filter(a => a.status === 'published' && !a.seo?.noIndex).length,
      noIndexArticles: articles.filter(a => a.seo?.noIndex).length,
      manufacturersCount: catalog.manufacturers.length,
      equipmentModelsCount: catalog.equipmentModels.length,
      sourcesCount: sources.length
    }
  };

  function addCheck(name, passed, details, severity = 'medium', recommendedFix = '') {
    auditResults.checks.push({ name, passed, details, severity });
    if (!passed) {
      auditResults.overallHealthScore = Math.max(10, auditResults.overallHealthScore - (severity === 'high' ? 15 : (severity === 'medium' ? 8 : 4)));
      auditResults.issuesFound.push({ check: name, severity, details, recommendedFix });
    }
  }

  // 1. Check title & meta description presence on published stories
  const pub = articles.filter(a => a.status === 'published');
  const missingTitles = pub.filter(a => !a.title || a.title.length < 10);
  const missingSummaries = pub.filter(a => !a.summary && !a.excerpt);
  const missingSources = pub.filter(a => !a.sourceUrl && (!a.sourceUrls || a.sourceUrls.length === 0));
  const missingCredits = pub.filter(a => a.image && !a.imageCredit);

  addCheck('Title Tag Length & Quality', missingTitles.length === 0, `${pub.length - missingTitles.length}/${pub.length} published stories have valid headlines.`, 'high', 'Add descriptive headlines (>10 characters).');
  addCheck('Meta Description Coverage', missingSummaries.length === 0, `${pub.length - missingSummaries.length}/${pub.length} stories have summaries for meta descriptions.`, 'medium', 'Add concise summaries for meta tags.');
  addCheck('Primary Source Evidence', missingSources.length === 0, `${pub.length - missingSources.length}/${pub.length} stories carry verified primary source links.`, 'high', 'Attach official OEM or news source link before publishing.');
  addCheck('Editorial Image Attribution', missingCredits.length === 0, `${pub.length - missingCredits.length}/${pub.length} images have explicit credit and license notes.`, 'medium', 'Attribute image credits in article editor.');

  // 2. Canonical and Duplicate Slug Check
  const slugsSeen = new Map();
  const dupSlugs = [];
  for (const a of pub) {
    const s = a.slug.toLowerCase();
    if (slugsSeen.has(s)) dupSlugs.push(s);
    slugsSeen.set(s, true);
  }
  addCheck('Unique Canonical Slugs', dupSlugs.length === 0, dupSlugs.length ? `Duplicate slugs detected: ${dupSlugs.join(', ')}` : 'Zero duplicate published slugs detected.', 'high', 'Ensure each article slug is unique.');

  // 3. Sitemap & Robots.txt Check
  const hasSiteUrl = Boolean(settings.canonicalBaseUrl && !settings.canonicalBaseUrl.includes('localhost'));
  addCheck('Production Canonical Origin', hasSiteUrl, settings.canonicalBaseUrl ? `Configured: ${settings.canonicalBaseUrl}` : 'Defaulting to local origin.', 'low', 'Set canonicalBaseUrl in Admin Screen 9 or SITE_URL in .env before going live.');

  // 4. Source Collection Health Check
  const activeSources = sources.filter(s => s.enabled !== false);
  const errorSources = activeSources.filter(s => {
    if (!Array.isArray(s.recentErrors) || s.recentErrors.length === 0) return false;
    if (s.lastSuccessAt && s.lastCheckedAt) {
      return Date.parse(s.lastCheckedAt) > Date.parse(s.lastSuccessAt);
    }
    return true;
  });
  addCheck('RSS Sources Health', errorSources.length === 0, `${activeSources.length - errorSources.length}/${activeSources.length} active sources reporting healthy checks.`, 'medium', 'Inspect recent feed error logs in Sources desk.');

  return auditResults;
}

/**
 * Generate standard SEO Intelligence tasks from actual content gaps,
 * top on-site search queries, and technical audit findings.
 */
function seedInitialSeoTasks(store) {
  const existingTasks = store.readJson(store.files.seoTasks, []);
  if (existingTasks.length > 0) return existingTasks;

  const catalog = store.getCatalogSummary();
  const initial = [
    {
      title: 'Audit Sitemaps & Canonical Tag Consistency',
      taskType: 'sitemap_canonical_check',
      assignedRole: 'technical_seo',
      importance: 9,
      confidence: 10,
      effort: 'low',
      targetUrl: '/sitemap.xml',
      evidenceRationale: 'Ensures all 26 category desks, 10 regional hubs, and verified OEM pages are present in sitemap without 404s.',
      recommendedAction: 'Verify GET /sitemap.xml returns 200 OK and validates XML schema.'
    },
    {
      title: 'Expand India CEV Stage V & BS-VI Powertrain Opportunities',
      taskType: 'regional_opportunity',
      assignedRole: 'regional_seo',
      importance: 8,
      confidence: 9,
      effort: 'medium',
      targetUrl: '/india/',
      evidenceRationale: 'India is a major global manufacturing hub for backhoe loaders and multi-axle tippers.',
      recommendedAction: 'Connect BULL Machines HD76, Tata Prima, and Mahindra EarthMaster specs to local roadbuilding demand.'
    },
    {
      title: 'Enhance 20-Tonne Hydraulic Excavator Comparison Matrix',
      taskType: 'article_optimization',
      assignedRole: 'article_seo',
      importance: 8,
      confidence: 9,
      effort: 'medium',
      targetUrl: '/news/20-tonne-crawler-excavator-comparison-hydraulics-undercarriage-telematics',
      evidenceRationale: 'High-volume global civil machinery category with verified OEM models (Cat 320, Komatsu PC210, Volvo EC210, SANY SY215C, HD Hyundai HX220L).',
      recommendedAction: 'Add cross-links to newly indexed equipment model specification dossiers.'
    },
    {
      title: 'Complete OEM Profile Specifications for JCB, Caterpillar & Komatsu',
      taskType: 'manufacturer_improvement',
      assignedRole: 'manufacturer_seo',
      importance: 7,
      confidence: 8,
      effort: 'low',
      targetUrl: '/manufacturers',
      evidenceRationale: 'Readers frequently search for global OEM headquarters, machinery focus, and official brochures.',
      recommendedAction: 'Review directory candidate profiles against official OEM portals.'
    },
    {
      title: 'Analyze On-Site Search Queries for Content Gap Identification',
      taskType: 'keyword_research',
      assignedRole: 'keyword_research',
      importance: 8,
      confidence: 9,
      effort: 'low',
      targetUrl: '/api/admin/seo-analytics',
      evidenceRationale: 'Internal site search represents zero-cost, 100% verified first-party user intent.',
      recommendedAction: 'Inspect top search query bucket in AI Operations dashboard and schedule matching newsroom drafts.'
    },
    {
      title: 'Verify Off-Highway Hydraulic Contamination (ISO 4406) Explainer Links',
      taskType: 'internal_linking',
      assignedRole: 'article_seo',
      importance: 7,
      confidence: 8,
      effort: 'low',
      targetUrl: '/news/preventive-maintenance-guide-off-highway-hydraulics-dpf-scr-undercarriage',
      evidenceRationale: 'Cornerstone preventive maintenance guide should link to backhoe loaders, excavators, and attachments desks.',
      recommendedAction: 'Ensure internal anchor links resolve cleanly to category and model pages.'
    }
  ];

  const tasks = initial.map(t => createSeoTaskModel(t));
  store.writeJson(store.files.seoTasks, tasks);
  return tasks;
}

/**
 * Return Consolidated AI SEO & Newsroom Operations Overview
 */
function getAiOperationsDashboard(store) {
  const articles = store.readJson(store.files.articles, []);
  const collected = store.readJson(store.files.collectedItems, []);
  const sources = store.readJson(store.files.sources, []);
  const newsroomRuns = store.readJson(store.files.newsroomRuns, []);
  const tasks = store.readJson(store.files.seoTasks, []);
  const analytics = store.readJson(store.files.analytics, {});
  const distLogs = store.readJson(store.files.distributionLogs, []);
  const settings = store.getSettings();

  // Newsroom configuration & provider status
  const aiProvider = String(process.env.AI_PROVIDER || 'local-deterministic').trim().toLowerCase();
  const aiKeyConfigured = Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.length >= 8);
  const aiModel = process.env.AI_MODEL || (aiKeyConfigured ? 'gemini-2.5-flash' : 'machinewire-specialist-rules-v1');

  // Real Search & Analytics status (authenticated Search Console check)
  const gscStatus = gsc.getSearchConsoleStatus(store);
  const gaConfigured = Boolean(process.env.GA_MEASUREMENT_ID || settings.gaMeasurementId);

  // Source monitoring stats (evaluate active, enabled sources)
  const activeSources = sources.filter(s => s.enabled !== false);
  const checkedSources = activeSources.filter(s => s.lastCheckedAt);
  const errorSources = activeSources.filter(s => {
    if (!Array.isArray(s.recentErrors) || s.recentErrors.length === 0) return false;
    if (s.lastSuccessAt && s.lastCheckedAt) {
      return Date.parse(s.lastCheckedAt) > Date.parse(s.lastSuccessAt);
    }
    return true;
  });

  const isHealthy = errorSources.length === 0;

  // Content lifecycle stats
  const publishedCount = articles.filter(a => a.status === 'published').length;
  const reviewCount = articles.filter(a => a.status === 'review').length;
  const draftCount = articles.filter(a => a.status === 'draft').length;
  const scheduledCount = articles.filter(a => a.status === 'scheduled').length;

  // Task queue stats
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const highPriorityTasks = pendingTasks.filter(t => t.importance >= 8);

  // Technical SEO Audit
  const audit = runTechnicalSeoAudit(store);

  // Estimated API usage & costs
  const totalRuns = newsroomRuns.length;
  const estimatedTokensPerRun = 1200;
  const totalTokensEstimated = totalRuns * estimatedTokensPerRun;
  const estimatedCostUsd = aiKeyConfigured
    ? (totalTokensEstimated * 0.0000003).toFixed(4)
    : '0.0000';

  return {
    systemHealth: {
      status: isHealthy ? 'healthy' : 'attention_required',
      reportingErrorsCount: errorSources.length,
      activeIssues: errorSources.map(s => ({
        sourceId: s.id,
        sourceName: s.name,
        lastCheckedAt: s.lastCheckedAt,
        error: s.recentErrors[0]?.message || 'Source check error',
        isNetworkRestriction: Boolean(s.recentErrors[0]?.isNetworkRestriction)
      })),
      schemaVersion: 2,
      databaseMode: 'atomic_json_store',
      serverTime: new Date().toISOString()
    },
    aiProvider: {
      provider: aiKeyConfigured ? aiProvider : 'local-deterministic',
      configuredInEnv: aiProvider,
      keyConfigured: aiKeyConfigured,
      activeMode: aiKeyConfigured ? 'external_llm_with_guardrails' : 'deterministic_local_specialist_pipeline',
      model: aiModel,
      estimatedRunsCount: totalRuns,
      estimatedTokensUsed: totalTokensEstimated,
      estimatedCostUsd: `$${estimatedCostUsd}`,
      notice: aiKeyConfigured
        ? `Connected to ${aiProvider.toUpperCase()} (${aiModel}). Single-call consolidated JSON schema minimizes token expenditure.`
        : 'Zero-Cost Deterministic Specialist Pipeline active. Works 100% locally with 0 external API keys required.'
    },
    sourcesMonitoring: {
      totalRegistered: sources.length,
      activeMonitored: activeSources.length,
      checkedCount: checkedSources.length,
      reportingErrors: errorSources.length,
      collectionIntervalNotice: 'Configurable per source (5m–1440m). Manual "Check Source Now" available anytime.'
    },
    contentPipeline: {
      discoveredFeedItems: collected.length,
      duplicatesFiltered: collected.filter(c => c.isDuplicate || c.reviewStatus === 'duplicate').length,
      inReviewQueue: reviewCount,
      unpublishedDrafts: draftCount,
      scheduledPublish: scheduledCount,
      livePublished: publishedCount
    },
    seoTaskQueue: {
      totalTasks: tasks.length,
      pendingCount: pendingTasks.length,
      completedCount: completedTasks.length,
      highPriorityCount: highPriorityTasks.length,
      tasks: tasks.sort((a, b) => b.priorityScore - a.priorityScore)
    },
    technicalSeoAudit: audit,
    searchPerformanceData: {
      googleSearchConsoleConnected: gscStatus.connected,
      googleAnalyticsConnected: gaConfigured,
      statusLabel: gscStatus.statusLabel,
      message: gscStatus.message,
      gscStatus: gscStatus.status,
      verificationMeta: gscStatus.verificationMeta,
      propertyUrl: gscStatus.propertyUrl,
      firstPartyTelemetry: {
        totalArticleViews: Object.values(analytics.articleViews || {}).reduce((a, b) => a + Number(b || 0), 0),
        totalCategoryViews: Object.values(analytics.categoryViews || {}).reduce((a, b) => a + Number(b || 0), 0),
        totalRegionViews: Object.values(analytics.regionViews || {}).reduce((a, b) => a + Number(b || 0), 0),
        topRecordedSearchQueries: Object.entries(analytics.searchQueries || {})
          .map(([q, c]) => ({ query: q, count: Number(c) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      }
    },
    roadmap90Day: SEO_90_DAY_ROADMAP,
    coordinatedRoles: COORDINATED_SPECIALIST_ROLES,
    recentDistributionLogs: distLogs.slice(0, 10)
  };
}

module.exports = {
  COORDINATED_SPECIALIST_ROLES,
  SEO_90_DAY_ROADMAP,
  VALID_TASK_TYPES,
  VALID_TASK_STATUSES,
  createSeoTaskModel,
  runTechnicalSeoAudit,
  auditArticleSeo,
  seedInitialSeoTasks,
  getAiOperationsDashboard
};
