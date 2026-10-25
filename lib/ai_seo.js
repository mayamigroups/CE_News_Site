const crypto = require('node:crypto');
const models = require('./models.js');

/**
 * 10 Coordinated AI Specialist Workflows inside MachineWire
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
  const errorSources = sources.filter(s => Array.isArray(s.recentErrors) && s.recentErrors.length > 0);
  addCheck('RSS Sources Health', errorSources.length === 0, `${sources.length - errorSources.length}/${sources.length} active sources reporting healthy checks.`, 'medium', 'Inspect recent feed error logs in Sources desk.');

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

  // Real Search & Analytics status (never fake stats)
  const gscConfigured = Boolean(process.env.GSC_VERIFICATION_CODE || settings.gscVerificationCode || process.env.GSC_PROPERTY_URL || settings.gscPropertyUrl);
  const gaConfigured = Boolean(process.env.GA_MEASUREMENT_ID || settings.gaMeasurementId);

  // Source monitoring stats
  const activeSources = sources.filter(s => s.enabled !== false);
  const checkedSources = sources.filter(s => s.lastCheckedAt);
  const errorSources = sources.filter(s => Array.isArray(s.recentErrors) && s.recentErrors.length > 0);

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
      status: errorSources.length === 0 ? 'healthy' : 'attention_required',
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
      googleSearchConsoleConnected: gscConfigured,
      googleAnalyticsConnected: gaConfigured,
      statusLabel: gscConfigured
        ? 'Connected via Authorized Google Search Console Property'
        : 'Google Search Console Not Connected — Awaiting Credentials',
      message: gscConfigured
        ? 'Real Search Console metrics connected. Tracking real impressions, clicks, and average CTR.'
        : 'Notice: External Google Search Console API is not configured with service-account credentials. MachineWire displays measured first-party telemetry below and never invents search impressions, click volumes, or keyword rankings.',
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
  seedInitialSeoTasks,
  getAiOperationsDashboard
};
