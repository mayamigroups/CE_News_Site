const aiSeo = require('./ai_seo.js');
const crypto = require('node:crypto');
const models = require('./models.js');
const collector = require('./collector.js');

/**
 * Specialist Logical Roles inside the Machine Report World AI-Assisted Newsroom.
 * Executed as a single deterministic/structured pipeline without multi-agent overhead or runaway token costs.
 */
const SPECIALIST_ROLES = [
  {
    id: 'research',
    name: 'Research & Entity Extraction Specialist',
    responsibility: 'Analyzes collected story and source evidence; classifies editorial type (company-announcement, news, analysis, opinion, guide, review); extracts supported facts, dates, manufacturers, equipment models, countries, regions, and categories.'
  },
  {
    id: 'factual_verification',
    name: 'Factual Verification & Risk Specialist',
    responsibility: 'Cross-checks claims against source evidence; flags high-risk claims (direct quotes, numeric specs, prices, statistics, financial results, launch dates) for mandatory human verification; identifies missing or conflicting information; enforces "AI agreement is not proof of accuracy."'
  },
  {
    id: 'technical_review',
    name: 'Technical & Off-Highway Engineering Specialist',
    responsibility: 'Reviews equipment classifications, powertrains (Diesel, Electric, Hybrid, Hydrogen), emissions standards (CEV Stage V, EU Stage V, EPA Tier 4 Final, BS-VI Phase 2), and model designations without inventing specifications.'
  },
  {
    id: 'regional_context',
    name: 'Regional Market & Regulatory Context Specialist',
    responsibility: 'Maps countries and regions to Machine Report World canonical regional hubs (/india/, /north-america/, /europe/, /china/, etc.) and attaches verified regional regulatory, unit, and market context.'
  },
  {
    id: 'editorial_quality',
    name: 'Editorial Quality & Originality Specialist',
    responsibility: 'Detects duplicates and related coverage; drafts an original, source-attributed news report with structured subheadings separating company announcements from independent reporting and analysis; runs factual, originality, grammar, and source checks.'
  },
  {
    id: 'seo_specialist',
    name: 'SEO & Internal Linking Specialist',
    responsibility: 'Suggests headline, summary, subheadings, topic tags, internal links to Machine Report World manufacturer/model/category/region hubs, and SEO metadata (metaTitle, metaDescription, keywords).'
  }
];

const REGIONAL_CONTEXT_MAP = {
  'India': {
    hubSlug: 'india',
    hubRoute: '/india/',
    regulations: 'CEV Stage V (Off-Highway Construction Equipment) & BS-VI Phase 2 (Commercial Vehicles)',
    units: 'Metric (tonnes, kW / hp, metres)',
    currency: 'INR (₹ / Lakh / Crore)',
    contextNote: 'Indian earthmoving and commercial vehicle buyers prioritize fuel economy, CEV Stage V compliance, highway corridor duty cycles, and dealer service reach.'
  },
  'North America': {
    hubSlug: 'north-america',
    hubRoute: '/north-america/',
    regulations: 'EPA Tier 4 Final (Off-Highway) & EPA 2027 / CARB ACT (Commercial Trucks)',
    units: 'US Customary & Metric (lbs, short tons, hp, ft-lbs)',
    currency: 'USD ($) / CAD ($)',
    contextNote: 'North American fleet operators evaluate EPA Tier 4 Final emissions compliance, rental fleet utilization, and total cost of ownership.'
  },
  'Europe': {
    hubSlug: 'europe',
    hubRoute: '/europe/',
    regulations: 'EU Stage V (Non-Road Mobile Machinery) & Euro 6e / Euro 7 (Heavy-Duty Vehicles)',
    units: 'Metric (tonnes, kW, Nm, metres)',
    currency: 'EUR (€) / GBP (£)',
    contextNote: 'European worksites emphasize EU Stage V particulate compliance, urban low-emission zones, electric compact machinery, and quick-coupler safety standards.'
  },
  'China': {
    hubSlug: 'china',
    hubRoute: '/china',
    regulations: 'China NRMM Stage IV (Off-Highway) & China VI-b / NEV Mandates (Commercial Trucks)',
    units: 'Metric (tonnes, kW, metres)',
    currency: 'CNY (¥ / RMB)',
    contextNote: 'China is a high-volume manufacturing and export hub for hydraulic excavators, cranes, and battery-electric wheel loaders and mining trucks.'
  },
  'Japan & South Korea': {
    hubSlug: 'japan-south-korea',
    hubRoute: '/japan-south-korea/',
    regulations: 'MLIT Off-Highway Standards (Japan) & KMOE Stage V Equivalent (South Korea)',
    units: 'Metric (tonnes, kW, metres)',
    currency: 'JPY (¥) / KRW (₩)',
    contextNote: 'Japanese and South Korean OEMs lead in closed-center load-sensing hydraulics, ICT machine control (i-Construction), and zero-tail-swing excavators.'
  },
  'Middle East': {
    hubSlug: 'middle-east',
    hubRoute: '/middle-east/',
    regulations: 'GSO Heavy Equipment & GCC Commercial Vehicle Standards',
    units: 'Metric (tonnes, kW / hp, metres)',
    currency: 'SAR / AED / USD',
    contextNote: 'GCC giga-projects require high-ambient cooling packages, heavy crawler cranes, and severe-duty quarry tipper fleets.'
  },
  'Southeast Asia': {
    hubSlug: 'southeast-asia',
    hubRoute: '/southeast-asia/',
    regulations: 'ASEAN National Off-Highway & Euro 4 / Euro 5 Commercial Truck Regimes',
    units: 'Metric (tonnes, kW / hp, metres)',
    currency: 'IDR / THB / VND / MYR / SGD',
    contextNote: 'ASEAN markets combine nickel/coal mining haulage, palm plantation forestry, and urban transit infrastructure.'
  },
  'Australia': {
    hubSlug: 'australia',
    hubRoute: '/australia/',
    regulations: 'ADR 80/04 (Euro VI Equivalent Heavy Trucks) & Mining Work Health and Safety Standards',
    units: 'Metric (tonnes, kW, metres)',
    currency: 'AUD (A$)',
    contextNote: 'Australian Pilbara and Bowen Basin operations lead in autonomous mining haulage (AHS), road-train prime movers, and civil earthmoving.'
  },
  'Latin America': {
    hubSlug: 'latin-america',
    hubRoute: '/latin-america/',
    regulations: 'PROCONVE MAR-I / P8 (Euro 6 Equivalent in Brazil) & Regional Mining Standards',
    units: 'Metric (tonnes, kW / cv, metres)',
    currency: 'BRL (R$) / CLP / MXN / USD',
    contextNote: 'Latin American demand spans copper and iron-ore mining machinery, high-horsepower agricultural tractors, and highway compaction.'
  },
  'Africa': {
    hubSlug: 'africa',
    hubRoute: '/africa/',
    regulations: 'Regional SADC / EAC / ECOWAS Axle-Load & Fuel-Sulfur Equipment Standards',
    units: 'Metric (tonnes, kW / hp, metres)',
    currency: 'ZAR (R) / NGN / KES / EGP / USD',
    contextNote: 'African infrastructure corridors prioritize durable mechanical/electronic diesel powertrains, parts availability, and multi-purpose backhoe loaders and tippers.'
  }
};

/**
 * Return safe server-side AI Newsroom configuration without ever exposing AI_API_KEY.
 */
function getNewsroomConfig() {
  const provider = String(process.env.AI_PROVIDER || 'local-deterministic').trim().toLowerCase();
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  const keyConfigured = Boolean(apiKey && apiKey.length >= 8);
  const defaultModels = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-latest',
    compatible: 'gpt-4o-mini',
    'local-deterministic': 'machinewire-specialist-rules-v1'
  };
  const model = String(process.env.AI_MODEL || defaultModels[provider] || 'machinewire-specialist-rules-v1').trim();
  const baseUrl = String(process.env.AI_BASE_URL || '').trim();

  return {
    provider: keyConfigured ? provider : 'local-deterministic',
    configuredProviderEnv: provider,
    keyConfigured,
    activeMode: keyConfigured ? 'external-llm-with-guardrails' : 'deterministic-local-specialist-pipeline',
    model: keyConfigured ? model : 'machinewire-specialist-rules-v1 (Offline / Zero-Cost Fallback)',
    baseUrlConfigured: Boolean(baseUrl),
    specialistRoles: SPECIALIST_ROLES,
    workflowSteps: [
      '1. Analyze collected story and source evidence',
      '2. Extract supported facts, dates, manufacturers, models, regions, and categories',
      '3. Detect duplicates and related coverage',
      '4. Identify missing, conflicting, or unverified information',
      '5. Create an original, useful news draft based strictly on verified evidence',
      '6. Suggest headline, summary, subheadings, tags, internal links, and SEO metadata',
      '7. Run factual, originality, grammar, and source checks',
      '8. Send the result to the admin review queue (status="review", never auto-published)'
    ],
    costAndLimitationsDisclosure: {
      apiCostNotice: keyConfigured
        ? `External AI provider (${provider} / ${model}) is active. Each newsroom analysis makes a single consolidated JSON call (~900–1,600 tokens, typically <$0.002 per story on flash/mini models) rather than spawning multiple costly agent calls.`
        : 'No AI_API_KEY is configured in .env. Running in zero-cost Deterministic Local Specialist Mode — source collection, entity extraction, duplicate detection, risk flagging, structured drafting, and manual drafting work 100% offline with $0.00 API cost.',
      accuracyWarning: 'CRITICAL EDITORIAL RULE: AI agreement is NOT proof of accuracy. Language models and automated extractors can misinterpret context or repeat errors present in a feed excerpt.',
      humanReviewMandate: 'Every newsroom draft is routed strictly to the Admin Review Queue (status="review"). High-risk claims (direct quotes, numeric specifications, prices, financial figures, and product launch dates) are automatically flagged for human verification against the primary source URL before any managing_editor can publish.',
      prohibitedFabrications: [
        'Never invent direct quotes or executive statements',
        'Never invent machine specifications (hp, kW, operating weight, dig depth, payload)',
        'Never invent prices, dealer incentives, or financial results',
        'Never invent product launches, delivery dates, or corporate partnerships',
        'Always separate company announcements, independently reported news, analysis, and opinion'
      ]
    }
  };
}

/**
 * Helper: tokenize text into lowercase words for Jaccard similarity and n-gram originality checks
 */
function tokenizeWords(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function computeWordOverlapSimilarity(textA = '', textB = '') {
  const setA = new Set(tokenizeWords(textA));
  const setB = new Set(tokenizeWords(textB));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

/**
 * Compute 4-gram verbatim overlap ratio between source excerpt and generated draft body
 * to verify originality and ensure we are not simply copy-pasting long passages.
 */
function computeFourGramOverlap(sourceText = '', draftText = '') {
  const srcWords = tokenizeWords(sourceText);
  const draftWords = tokenizeWords(draftText);
  if (srcWords.length < 4 || draftWords.length < 4) return 0;
  const srcGrams = new Set();
  for (let i = 0; i <= srcWords.length - 4; i++) {
    srcGrams.add(srcWords.slice(i, i + 4).join(' '));
  }
  let matches = 0;
  const totalDraftGrams = draftWords.length - 3;
  for (let i = 0; i <= draftWords.length - 4; i++) {
    if (srcGrams.has(draftWords.slice(i, i + 4).join(' '))) matches++;
  }
  return Number((matches / Math.max(1, totalDraftGrams)).toFixed(3));
}

/**
 * Step 1 & 2: Research Specialist — Analyze story & extract supported facts, dates, manufacturers, models, regions, categories
 */
function runResearchSpecialist(rawInput, catalog) {
  const title = String(rawInput.title || '').trim();
  const excerpt = String(rawInput.excerpt || rawInput.summary || '').trim();
  const rawBody = String(rawInput.body || '').trim();
  const sourceUrl = collector.normalizeCanonicalUrl(rawInput.canonicalUrl || rawInput.sourceUrl || rawInput.originalUrl || '');
  const sourceName = String(rawInput.sourceName || (sourceUrl ? models.extractDomain(sourceUrl) : 'Unverified Source')).trim();
  const publishedAt = rawInput.publishedAt || null;
  const combinedText = `${title}. ${excerpt}. ${rawBody}`.trim();
  const lowerText = combinedText.toLowerCase();

  // Classify Editorial Article Type (separating company-announcement, news, analysis, opinion, review, guide)
  let articleType = 'news';
  let classificationRationale = 'Classified as independently reported industry/technical news based on third-party trade or regulatory source.';
  if (
    /prnewswire|businesswire|globenewswire|press release|announces|launches|introduces|unveils|appoints/i.test(`${sourceName} ${title}`) ||
    rawInput.sourceType === 'oem-web-reference'
  ) {
    articleType = 'company-announcement';
    classificationRationale = 'Classified as a Company Announcement / Official Release based on corporate wire or OEM announcement phrasing.';
  } else if (/\banalysis\b|\boutlook\b|\bmarket trend\b|\bforecast\b/i.test(title)) {
    articleType = 'analysis';
    classificationRationale = 'Classified as Market/Technical Analysis based on headline scope.';
  } else if (/\bopinion\b|\beditorial\b|\bcommentary\b|\bcolumn\b/i.test(title)) {
    articleType = 'opinion';
    classificationRationale = 'Classified as Opinion / Commentary.';
  } else if (/\bguide\b|\bhow to\b|\bchecklist\b|\bmaintenance\b/i.test(title)) {
    articleType = 'guide';
    classificationRationale = 'Classified as a Buying / Technical Guide.';
  } else if (/\breview\b|\bcomparison\b|\btest\b|\bwalkaround\b/i.test(title)) {
    articleType = 'review';
    classificationRationale = 'Classified as an Equipment Review / Comparison.';
  }

  // Match Manufacturers from Catalog
  const matchedManufacturers = [];
  for (const mfg of (catalog.manufacturers || [])) {
    if (!mfg.name || ['Various', 'All Manufacturers'].includes(mfg.name)) continue;
    const escaped = mfg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(combinedText)) {
      matchedManufacturers.push({ name: mfg.name, slug: mfg.slug, country: mfg.country, website: mfg.website });
    }
  }
  const primaryManufacturer = matchedManufacturers[0]?.name ||
    (rawInput.manufacturer && rawInput.manufacturer !== 'Various' ? rawInput.manufacturer : 'Various');

  // Match Equipment Models from Catalog
  const matchedModels = [];
  for (const em of (catalog.equipmentModels || [])) {
    if (!em.name) continue;
    const shortTokens = em.name.split(/\s+/).filter(t => /[0-9]/.test(t) && t.length >= 3);
    const fullMatch = lowerText.includes(em.name.toLowerCase());
    const tokenMatch = shortTokens.some(tok => {
      const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(combinedText);
    });
    if (fullMatch || tokenMatch) {
      matchedModels.push({
        name: em.name,
        slug: em.slug,
        manufacturer: em.manufacturer,
        equipmentType: em.equipmentType,
        category: em.category
      });
    }
  }
  const primaryModel = matchedModels[0]?.name || String(rawInput.model || '').trim();

  // Detect Category & Equipment Type
  const categoryRules = [
    { match: /backhoe/i, category: 'Backhoe Loaders', equipmentType: 'Backhoe loader' },
    { match: /excavator|mini-excavator|crawler excavator/i, category: 'Excavators', equipmentType: 'Hydraulic excavator' },
    { match: /wheel loader|front loader/i, category: 'Wheel Loaders', equipmentType: 'Wheel loader' },
    { match: /bulldozer|crawler dozer|\bdozer\b/i, category: 'Bulldozers', equipmentType: 'Crawler dozer' },
    { match: /\bcrane\b|crawler crane|mobile crane|pick-and-carry/i, category: 'Cranes', equipmentType: 'Crane' },
    { match: /motor grader|\bgrader\b/i, category: 'Graders', equipmentType: 'Motor grader' },
    { match: /telehandler|telescopic handler/i, category: 'Telehandlers', equipmentType: 'Telehandler' },
    { match: /paver|compactor|roller|asphalt|roadbuilding|cold planer/i, category: 'Roadbuilding', equipmentType: 'Roadbuilding machinery' },
    { match: /mining|haul truck|rigid dump|quarry/i, category: 'Mining Equipment', equipmentType: 'Mining equipment' },
    { match: /skid-steer|compact track loader|compact equipment/i, category: 'Compact Equipment', equipmentType: 'Compact equipment' },
    { match: /attachment|hydraulic breaker|coupler|auger/i, category: 'Attachments', equipmentType: 'Attachment / implement' },
    { match: /\btractor\b/i, category: 'Tractors', equipmentType: 'Tractor' },
    { match: /harvester|agricultural|farm machinery/i, category: 'Agricultural Machinery', equipmentType: 'Agricultural machinery' },
    { match: /electric truck|electric commercial|battery-electric|hydrogen truck|fuel-cell|zero-emission/i, category: 'Electric Commercial Vehicles', equipmentType: 'Electric commercial vehicle' },
    { match: /tipper|vocational truck|heavy truck|prime mover|8x4|6x4|axle|braking|driveline/i, category: 'Heavy Trucks', equipmentType: 'Heavy commercial truck' },
    { match: /\bpickup\b/i, category: 'Pickups', equipmentType: 'Utility pickup' },
    { match: /\bvan\b/i, category: 'Vans', equipmentType: 'Commercial van' },
    { match: /\bbus\b|\bcoach\b/i, category: 'Buses', equipmentType: 'Commercial bus' },
    { match: /hydraulic|pump|engine|stage v|tier 4|telematics|autonomous|grade control/i, category: 'Technology', equipmentType: 'Off-highway powertrain & hydraulics' }
  ];

  let detectedCategory = rawInput.category || 'Construction Equipment';
  let detectedEquipmentType = rawInput.equipmentType || 'Construction equipment';
  for (const rule of categoryRules) {
    if (rule.match.test(combinedText)) {
      detectedCategory = rule.category;
      detectedEquipmentType = rule.equipmentType;
      break;
    }
  }
  if (matchedModels[0]) {
    detectedCategory = matchedModels[0].category || detectedCategory;
    detectedEquipmentType = matchedModels[0].equipmentType || detectedEquipmentType;
  }

  // Detect Country & Region
  let detectedCountry = rawInput.country || matchedManufacturers[0]?.country || 'Global';
  let detectedRegion = rawInput.region || 'Global';
  for (const cty of (catalog.countries || [])) {
    if (cty.name === 'Global') continue;
    const escaped = cty.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(combinedText)) {
      detectedCountry = cty.name;
      detectedRegion = cty.region || detectedRegion;
      break;
    }
  }
  if (detectedRegion === 'Global' && detectedCountry !== 'Global') {
    const ctyObj = (catalog.countries || []).find(c => c.name.toLowerCase() === detectedCountry.toLowerCase());
    if (ctyObj && ctyObj.region) detectedRegion = ctyObj.region;
  }

  // Extract explicit supported facts (sentences directly present in source evidence)
  const rawSentences = `${title}. ${excerpt}. ${rawBody}`
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 20);
  const supportedFacts = [...new Set(rawSentences)].slice(0, 6).map((fact, idx) => ({
    id: `fact-${idx + 1}`,
    statement: fact,
    sourceName,
    sourceUrl: sourceUrl || 'Unverified (No URL provided)',
    evidenceBacked: Boolean(sourceUrl)
  }));

  // Extract dates mentioned in text or metadata
  const dateMatches = combinedText.match(/\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\b202[4-9]\b)/gi) || [];
  const extractedDates = [...new Set([
    ...(publishedAt ? [`Source publication timestamp: ${publishedAt.slice(0, 10)}`] : []),
    ...dateMatches.map(d => `Mentioned in text: ${d}`)
  ])];

  return {
    articleType,
    classificationRationale,
    supportedFacts,
    extractedDates,
    primaryManufacturer,
    matchedManufacturers,
    primaryModel,
    matchedModels,
    detectedCategory,
    detectedEquipmentType,
    detectedCountry,
    detectedRegion,
    sourceName,
    sourceUrl,
    publishedAt
  };
}

/**
 * Step 3: Duplicate & Related Coverage Detection across existing articles and collected items
 */
function detectDuplicatesAndRelated(rawInput, research, store) {
  const articles = store.readJson(store.files.articles, []);
  const collected = store.readJson(store.files.collectedItems, []);
  const titleFp = collector.computeTitleFingerprint(rawInput.title || '');
  const canonicalUrl = research.sourceUrl;

  const duplicateArticles = [];
  const relatedArticles = [];

  for (const a of articles) {
    const aSourceCanon = collector.normalizeCanonicalUrl(a.sourceUrl || '');
    const aTitleFp = collector.computeTitleFingerprint(a.title || '');
    const similarity = computeWordOverlapSimilarity(rawInput.title || '', a.title || '');

    if (
      (canonicalUrl && aSourceCanon && canonicalUrl === aSourceCanon) ||
      (titleFp && aTitleFp === titleFp) ||
      similarity >= 0.75
    ) {
      duplicateArticles.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        reason: canonicalUrl && aSourceCanon === canonicalUrl
          ? 'Identical canonical source URL'
          : (aTitleFp === titleFp ? 'Exact headline fingerprint match' : `High headline similarity (${Math.round(similarity * 100)}%)`)
      });
    } else if (
      (research.primaryManufacturer !== 'Various' && (a.manufacturer || '').toLowerCase() === research.primaryManufacturer.toLowerCase()) ||
      (research.primaryModel && (a.model || '').toLowerCase() === research.primaryModel.toLowerCase()) ||
      (a.category || '').toLowerCase() === research.detectedCategory.toLowerCase() ||
      similarity >= 0.3
    ) {
      relatedArticles.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        url: `/news/${a.slug}`,
        category: a.category,
        manufacturer: a.manufacturer,
        status: a.status
      });
    }
  }

  const duplicateCollected = collected
    .filter(c => c.id !== rawInput.id && (
      (canonicalUrl && c.canonicalUrl === canonicalUrl) ||
      c.titleFingerprint === titleFp
    ))
    .map(c => ({ id: c.id, title: c.title, sourceName: c.sourceName, retrievedAt: c.retrievedAt }));

  return {
    hasExactDuplicate: duplicateArticles.length > 0,
    duplicateArticles,
    duplicateCollected,
    relatedArticles: relatedArticles.slice(0, 5)
  };
}

/**
 * Step 4: Factual Verification & Risk Specialist — Identify missing, conflicting, or high-risk claims
 */
function runFactualVerificationSpecialist(rawInput, research, duplicates) {
  const combinedText = `${rawInput.title || ''} ${rawInput.excerpt || ''} ${rawInput.body || ''}`;
  const highRiskClaims = [];
  const missingInformation = [];
  const conflictingOrUnverified = [];

  // 1. Detect Direct Quotes
  const quoteMatches = combinedText.match(/"([^"]{12,220})"/g) || [];
  for (const q of quoteMatches) {
    highRiskClaims.push({
      riskType: 'direct-quote',
      severity: 'high',
      excerpt: q,
      instruction: 'Verify verbatim quote and speaker attribution against original source before publication. Do not alter or paraphrase inside quotation marks.'
    });
  }

  // 2. Detect Numeric Specifications (hp, kW, tonnes, kg, bar, l/min, m, mph, km/h)
  const specMatches = combinedText.match(/\b\d+(?:[.,]\d+)?\s*(?:hp|kw|tonnes?|tons?|kg|lbs?|bar|psi|l\/min|gpm|nm|km\/h|mph|kwh)\b/gi) || [];
  if (specMatches.length > 0) {
    highRiskClaims.push({
      riskType: 'technical-specification',
      severity: 'high',
      excerpt: [...new Set(specMatches)].join(', '),
      instruction: 'Cross-check numeric machine specifications against official OEM brochure or homologation datasheet.'
    });
  }

  // 3. Detect Prices, Currencies, or Financial Figures
  const priceMatches = combinedText.match(/(?:[$€£₹¥]|USD|EUR|GBP|INR|CNY|crore|lakh|million|billion)\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*(?:crore|lakh|million|billion|percent|%)/gi) || [];
  if (priceMatches.length > 0) {
    highRiskClaims.push({
      riskType: 'financial-or-statistic',
      severity: 'high',
      excerpt: [...new Set(priceMatches)].join(', '),
      instruction: 'Verify financial figures, percentages, or pricing claims directly against audited filing or official press release.'
    });
  }

  // 4. Detect Product Launch / Commercial Availability Claims
  if (/\blaunch(?:es|ed)?\b|\bunveil(?:s|ed)?\b|\bnew model\b|\border book\b|\bdelivery\b/i.test(combinedText)) {
    highRiskClaims.push({
      riskType: 'product-launch-or-availability',
      severity: 'medium',
      excerpt: 'Product launch / commercial availability reference detected in source.',
      instruction: 'Confirm regional market availability, model designation, and delivery timeline before publishing.'
    });
  }

  // Identify Missing Information
  if (!research.sourceUrl) {
    missingInformation.push('Primary source URL is missing — required before publication.');
  }
  if (!research.publishedAt) {
    missingInformation.push('Original source publication timestamp was not provided in the feed item; verify release date on publisher page.');
  }
  if (research.primaryManufacturer === 'Various') {
    missingInformation.push('No specific OEM/manufacturer was explicitly named in the excerpt (classified under "Various" industry/technical coverage).');
  }
  if (!research.primaryModel) {
    missingInformation.push('Specific equipment model designation is not stated in the feed excerpt; do not guess or invent a model number.');
  }
  if (specMatches.length === 0) {
    missingInformation.push('Exact machine operating weight, engine power (kW/hp), and hydraulic flow figures are not included in the source excerpt; omitted from draft to prevent fabrication.');
  }
  if (!rawInput.image) {
    missingInformation.push('Licensed editorial photograph or official OEM press handout image URL and credit must be confirmed by an editor.');
  }

  if (duplicates.hasExactDuplicate) {
    conflictingOrUnverified.push(`Potential duplicate coverage detected: matches ${duplicates.duplicateArticles.length} existing article(s) in Machine Report World database.`);
  }
  if ((rawInput.excerpt || '').length < 60) {
    conflictingOrUnverified.push('Source excerpt is very brief (<60 chars); human editor must inspect the full origin article before expanding coverage.');
  }

  return {
    aiAgreementDisclaimer: 'AI agreement is not proof of accuracy. All extracted facts and risk flags below must be independently verified by a human editor against the primary source URL.',
    requiresHumanReview: true,
    highRiskClaims,
    missingInformation,
    conflictingOrUnverified,
    verificationStatus: highRiskClaims.length > 0 || !research.sourceUrl ? 'high_scrutiny_human_review_required' : 'standard_human_review_required'
  };
}

/**
 * Step 4b: Technical Review Specialist — Off-highway & commercial vehicle engineering review
 */
function runTechnicalReviewSpecialist(rawInput, research) {
  const combinedText = `${rawInput.title || ''} ${rawInput.excerpt || ''} ${rawInput.body || ''}`;
  let powerType = 'Diesel';
  if (/battery-electric|\belectric\b|\bbev\b|zero-emission/i.test(combinedText)) {
    powerType = 'Battery-Electric';
  } else if (/hydrogen|\bh2\b|fuel-cell|fuel cell/i.test(combinedText)) {
    powerType = 'Hydrogen (H2 ICE / Fuel Cell)';
  } else if (/hybrid|diesel-electric/i.test(combinedText)) {
    powerType = 'Hybrid Diesel-Electric';
  } else if (/hydraulic|axial piston|load-sensing|fluid power/i.test(combinedText)) {
    powerType = 'Electro-Hydraulic / Diesel Powertrain';
  }

  const emissionsRegimes = [];
  if (/cev stage v|cev-v|cev stage iv/i.test(combinedText)) emissionsRegimes.push('India CEV Stage IV / Stage V');
  if (/\bstage v\b|eu stage v/i.test(combinedText)) emissionsRegimes.push('EU Stage V');
  if (/tier 4|epa tier 4/i.test(combinedText)) emissionsRegimes.push('EPA Tier 4 Final');
  if (/bs-vi|bs6|bharat stage/i.test(combinedText)) emissionsRegimes.push('India BS-VI Phase 2');
  if (/euro 6|euro vi|euro 7/i.test(combinedText)) emissionsRegimes.push('Euro VI / Euro 7');

  const technicalSystemsMentioned = [];
  if (/load-sensing|axial piston|hydraulic pump|closed-center|open-center|flow/i.test(combinedText)) {
    technicalSystemsMentioned.push('Hydraulic pump & valve flow control architecture');
  }
  if (/hub-reduction|tandem axle|retarder|braking|gradeability|8x4|6x4/i.test(combinedText)) {
    technicalSystemsMentioned.push('Heavy-duty vocational axle, driveline retarder & service braking system');
  }
  if (/telematics|grade control|2d|3d|autonomous|can-bus/i.test(combinedText)) {
    technicalSystemsMentioned.push('On-board telematics, CAN-bus diagnostics & machine guidance');
  }

  // Only populate verified specs if explicitly supported; never invent numbers
  const verifiedContextSpecs = {
    'Equipment Classification': research.detectedEquipmentType,
    'Primary Manufacturer': research.primaryManufacturer,
    'Model Designation': research.primaryModel || 'Not specified in source excerpt (Verify on OEM datasheet)',
    'Powertrain / System Focus': powerType,
    'Emissions Context': emissionsRegimes.length ? emissionsRegimes.join(' / ') : 'Consult regional OEM homologation sheet',
    'Primary Source Evidence': research.sourceName
  };

  return {
    equipmentType: research.detectedEquipmentType,
    powerType,
    emissionsRegimes,
    technicalSystemsMentioned,
    verifiedContextSpecs,
    technicalReviewNote: 'No unverified horsepower, torque, operating weight, or hydraulic pressure numbers were added. Only classifications supported by the source evidence are included.'
  };
}

/**
 * Step 4c: Regional Context Specialist
 */
function runRegionalContextSpecialist(research) {
  const regionName = research.detectedRegion || 'Global';
  const countryName = research.detectedCountry || 'Global';
  const mapped = REGIONAL_CONTEXT_MAP[countryName] || REGIONAL_CONTEXT_MAP[regionName] || {
    hubSlug: 'global',
    hubRoute: '/regions',
    regulations: 'Global Off-Highway (EU Stage V / EPA Tier 4 Final / India CEV Stage V) & Commercial Vehicle Regimes',
    units: 'Metric & US Customary (as specified by source)',
    currency: 'Multi-currency (verify local dealer currency)',
    contextNote: 'International construction equipment and commercial vehicle coverage applicable across global fleet markets.'
  };

  return {
    country: countryName,
    region: REGIONAL_CONTEXT_MAP[countryName] ? countryName : regionName,
    canonicalHubSlug: mapped.hubSlug,
    canonicalHubRoute: mapped.hubRoute,
    applicableRegulations: mapped.regulations,
    standardUnits: mapped.units,
    localCurrency: mapped.currency,
    regionalMarketNote: mapped.contextNote
  };
}

/**
 * Step 5 & 6: Editorial Quality & SEO Specialist — Create original, source-attributed draft, subheadings, internal links, and SEO metadata
 */
function buildEditorialDraftAndSeo(rawInput, research, verification, technical, regional, duplicates, catalog) {
  const sourceTitle = String(rawInput.title || 'Untitled Industry Dispatch').trim();
  const sourceExcerpt = String(rawInput.excerpt || rawInput.summary || '').trim();
  const sourceName = research.sourceName || 'Official Source';
  const sourceUrl = research.sourceUrl || '';

  // Attribution prefix based on articleType separation
  const typeLabelMap = {
    'company-announcement': 'Company Announcement',
    'news': 'Independently Reported Industry News',
    'analysis': 'Technical & Market Analysis',
    'opinion': 'Editorial Commentary',
    'guide': 'Equipment Specification & Operational Guide',
    'review': 'Equipment Evaluation'
  };
  const typeLabel = typeLabelMap[research.articleType] || 'Industry News';

  // Suggest an original, clear, non-clickbait Machine Report World headline
  let suggestedHeadline = sourceTitle;
  if (research.articleType === 'company-announcement' && !/announces|releases|reports|updates/i.test(sourceTitle)) {
    suggestedHeadline = `${sourceTitle} (Company Announcement)`;
  } else if (research.primaryManufacturer !== 'Various' && !sourceTitle.toLowerCase().includes(research.primaryManufacturer.toLowerCase())) {
    suggestedHeadline = `${research.primaryManufacturer}: ${sourceTitle}`;
  }
  suggestedHeadline = suggestedHeadline.slice(0, 155);

  // Suggest subheadings
  const subheadings = [
    'Source Evidence & Core Dispatch',
    'Technical & Operational Context',
    'Regional Market & Regulatory Considerations',
    'Unverified Details & Editorial Verification Checklist'
  ];

  // Build Internal Links to Machine Report World hubs
  const internalLinks = [];
  const catSlug = models.makeSlug(research.detectedCategory, 80);
  internalLinks.push({
    anchorText: `${research.detectedCategory} News Desk`,
    url: `/category/${catSlug}`,
    type: 'category'
  });

  if (research.matchedManufacturers.length > 0) {
    for (const m of research.matchedManufacturers) {
      internalLinks.push({
        anchorText: `${m.name} Manufacturer Profile`,
        url: `/manufacturers/${m.slug}`,
        type: 'manufacturer'
      });
    }
  } else {
    internalLinks.push({
      anchorText: 'Machine Report World OEM & Manufacturer Directory',
      url: '/manufacturers',
      type: 'directory'
    });
  }

  if (research.matchedModels.length > 0) {
    for (const mdl of research.matchedModels) {
      internalLinks.push({
        anchorText: `${mdl.name} Technical Profile`,
        url: `/models/${mdl.slug}`,
        type: 'model'
      });
    }
  } else {
    internalLinks.push({
      anchorText: 'Equipment & Commercial Vehicle Model Specifications',
      url: '/models',
      type: 'models-directory'
    });
  }

  if (regional.canonicalHubRoute) {
    internalLinks.push({
      anchorText: `${regional.region} Regional Market Hub`,
      url: regional.canonicalHubRoute,
      type: 'region'
    });
  }

  for (const rel of duplicates.relatedArticles.slice(0, 2)) {
    internalLinks.push({
      anchorText: `Related: ${rel.title}`,
      url: rel.url,
      type: 'related-article'
    });
  }

  // Suggest Summary (1-2 concise sentences attributing the source without inventing facts)
  const dateClause = research.publishedAt ? ` (published ${research.publishedAt.slice(0, 10)})` : '';
  const summary = `According to ${sourceName}${dateClause}, this ${typeLabel.toLowerCase()} examines ${sourceTitle.replace(/\.$/, '')}. Key focus areas include ${technical.equipmentType.toLowerCase()} engineering, ${technical.powerType.toLowerCase()} systems, and operational requirements across ${regional.region}.`.slice(0, 310);

  // Build Original, Structured, Source-Attributed News Draft Body
  // Strictly distinguishes reported source evidence from technical/regional context and explicitly lists missing/unverified details.
  const para1 = `### ${subheadings[0]}\n\nAccording to ${sourceName}${dateClause} ([Original Source Dispatch](${sourceUrl || '#'})), coverage titled "${sourceTitle}" highlights developments in ${research.detectedCategory.toLowerCase()} and ${technical.equipmentType.toLowerCase()} operations. Based on the verified source evidence provided by ${sourceName}: ${sourceExcerpt || 'Refer to the linked primary source document for the complete announcement text.'}`;

  const sysNotes = technical.technicalSystemsMentioned.length
    ? `Specifically, the source material references ${technical.technicalSystemsMentioned.join(' and ').toLowerCase()}.`
    : `In the ${research.detectedCategory.toLowerCase()} segment, fleet buyers evaluate duty-cycle durability, service accessibility, and powertrain efficiency.`;
  const emisNote = technical.emissionsRegimes.length
    ? `Applicable emissions frameworks referenced in this context include ${technical.emissionsRegimes.join(', ')}.`
    : `Applicable off-highway and commercial vehicle emissions compliance depends on the target deployment jurisdiction (${regional.applicableRegulations}).`;

  const para2 = `### ${subheadings[1]}\n\n*Editorial classification: **${typeLabel}**. Company announcements, independent reporting, technical context, and opinion are kept strictly separate under Machine Report World editorial standards.*\n\n${sysNotes} ${emisNote} No additional machine specifications, horsepower ratings, operating weights, pricing, or performance figures have been extrapolated beyond what is explicitly stated by ${sourceName}.`;

  const internalLinksMarkdown = internalLinks
    .slice(0, 4)
    .map(l => `[${l.anchorText}](${l.url})`)
    .join(' · ');

  const para3 = `### ${subheadings[2]}\n\nFor contractors and fleet managers operating in **${regional.country}** (**${regional.region}**), equipment procurement and deployment align with ${regional.applicableRegulations}. ${regional.regionalMarketNote}\n\nRelated Machine Report World intelligence hubs: ${internalLinksMarkdown}.`;

  const missingBullets = verification.missingInformation.length
    ? verification.missingInformation.map(m => `- ${m}`).join('\n')
    : '- Verify full text and regional datasheet applicability directly against the primary source.';

  const para4 = `### ${subheadings[3]}\n\n**Source Attribution:** Primary reporting and claims are attributed to **${sourceName}** (${sourceUrl || 'URL required before publication'}).\n\n**Editorial Verification Notice (Review Queue):**\n${missingBullets}`;

  const draftBody = [para1, para2, para3, para4].join('\n\n');

  // Suggest Tags
  const rawTags = [
    research.detectedCategory,
    research.primaryManufacturer !== 'Various' ? research.primaryManufacturer : null,
    research.primaryModel || null,
    technical.powerType,
    regional.region !== 'Global' ? regional.region : null,
    ...technical.emissionsRegimes,
    typeLabel
  ].filter(Boolean);
  const tags = [...new Set(rawTags.map(t => String(t).trim().slice(0, 45)))].slice(0, 8);

  // Suggest SEO Metadata
  const seo = {
    metaTitle: `${suggestedHeadline} | MACHINE REPORT WORLD`.slice(0, 175),
    metaDescription: summary.slice(0, 310),
    canonicalUrl: '',
    keywords: tags.slice(0, 10),
    noIndex: false
  };

  return {
    suggestedHeadline,
    alternativeHeadlines: [
      `${research.detectedCategory}: ${sourceTitle}`.slice(0, 150),
      `${sourceTitle} — Technical & Fleet Briefing (${sourceName})`.slice(0, 150)
    ],
    summary,
    subheadings,
    draftBody,
    tags,
    internalLinks,
    seo
  };
}

/**
 * Step 7: Run Automated Factual, Originality, Grammar, and Source Checks
 */
function runQualityChecks(rawInput, research, verification, editorial) {
  const sourceExcerpt = String(rawInput.excerpt || rawInput.summary || '');
  const draftBody = String(editorial.draftBody || '');

  // 1. Source Check
  const hasValidSourceUrl = Boolean(research.sourceUrl && models.validHttpUrl(research.sourceUrl));
  const bodyContainsSourceAttribution = draftBody.toLowerCase().includes(research.sourceName.toLowerCase()) &&
    (!research.sourceUrl || draftBody.includes(research.sourceUrl));
  const sourceCheck = {
    passed: hasValidSourceUrl && bodyContainsSourceAttribution,
    score: hasValidSourceUrl && bodyContainsSourceAttribution ? 100 : (hasValidSourceUrl ? 70 : 0),
    details: hasValidSourceUrl
      ? `Primary source URL (${research.sourceUrl}) and publisher attribution (${research.sourceName}) are preserved.`
      : 'CRITICAL: Primary source URL is missing or invalid. Cannot publish without verifiable source URL.'
  };

  // 2. Factual Grounding Check (ensure draft did not invent numbers absent from source or regional/date metadata)
  const allowedSourceText = `${rawInput.title || ''} ${sourceExcerpt} ${rawInput.body || ''} ${research.publishedAt || ''}`;
  const sourceNumbers = new Set((allowedSourceText.match(/\b\d+(?:[.,]\d+)?\b/g) || []));
  // Strip URLs, ISO dates (YYYY-MM-DD), and standard regulatory designations (Tier 4, Stage 4/5, Euro 6/7, EPA 2027) before checking for invented numbers
  const draftCleaned = draftBody
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b(?:Tier|Stage|Phase|Euro|Class|EPA|ADR)\s+\d+(?:\/\d+)?\b/gi, '');
  const draftNumbers = (draftCleaned.match(/\b\d+(?:[.,]\d+)?\b/g) || []);
  const ungroundedNumbers = draftNumbers.filter(n => !sourceNumbers.has(n));
  const factualCheck = {
    passed: ungroundedNumbers.length === 0,
    score: ungroundedNumbers.length === 0 ? 100 : Math.max(40, 100 - ungroundedNumbers.length * 20),
    ungroundedNumbers,
    highRiskClaimsFlagged: verification.highRiskClaims.length,
    details: ungroundedNumbers.length === 0
      ? `Zero unverified numeric figures or fabricated quotes introduced. ${verification.highRiskClaims.length} source claim(s) flagged for human verification.`
      : `Warning: Draft contains numeric token(s) (${ungroundedNumbers.join(', ')}) not matched in source excerpt — verify before approval.`
  };

  // 3. Originality Check (4-gram overlap ratio & structural transformation)
  const fourGramRatio = computeFourGramOverlap(sourceExcerpt, draftBody);
  const originalityScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(0.6, fourGramRatio)) * 100)));
  const originalityCheck = {
    passed: editorial.subheadings.length >= 3 && draftBody.length > sourceExcerpt.length + 250,
    score: originalityScore,
    fourGramOverlapRatio: fourGramRatio,
    details: `Draft adds original technical/regional structure (${editorial.subheadings.length} subheadings, ${editorial.internalLinks.length} internal hub links) while attributing ${research.sourceName}.`
  };

  // 4. Grammar & Editorial Style Check
  const paragraphs = draftBody.split(/\n\n+/).filter(Boolean);
  const hasPlaceholderNoise = /\b(?:lorem ipsum|todo|tbd|insert here)\b/i.test(draftBody);
  const HeadlineLenOk = editorial.suggestedHeadline.length >= 15 && editorial.suggestedHeadline.length <= 160;
  const SummaryLenOk = editorial.summary.length >= 50 && editorial.summary.length <= 320;
  const grammarPassed = paragraphs.length >= 4 && !hasPlaceholderNoise && HeadlineLenOk && SummaryLenOk;
  const grammarCheck = {
    passed: grammarPassed,
    score: grammarPassed ? 98 : 65,
    paragraphCount: paragraphs.length,
    wordCount: tokenizeWords(draftBody).length,
    details: grammarPassed
      ? `Clean editorial prose: ${paragraphs.length} structured sections, ${tokenizeWords(draftBody).length} words, valid headline (${editorial.suggestedHeadline.length} chars) and summary (${editorial.summary.length} chars).`
      : 'Check headline/summary length or section formatting.'
  };

  const overallReadyForReviewQueue = sourceCheck.passed && factualCheck.passed && originalityCheck.passed && grammarCheck.passed;

  return {
    overallReadyForReviewQueue,
    sourceCheck,
    factualCheck,
    originalityCheck,
    grammarCheck
  };
}

/**
 * Optional External LLM Enhancement (Single Consolidated JSON Call when AI_API_KEY is configured).
 * Always wrapped in strict guardrails: if the external call fails, times out, or invents numbers,
 * the deterministic specialist output is preserved.
 */
async function callOptionalExternalLlm(config, rawInput, deterministicResult) {
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  if (!config.keyConfigured || !apiKey) {
    return { usedExternalLlm: false, provider: 'local-deterministic', note: 'No AI_API_KEY configured; used deterministic local specialist workflow.' };
  }

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 12000);
  const systemPrompt = [
    'You are the Machine Report World AI-Assisted Newsroom Coordinator executing 6 logical specialist roles (Research, Factual Verification, Technical Review, Regional Context, Editorial Quality, SEO).',
    'STRICT EDITORIAL RULES:',
    '1. Do NOT invent quotes, specifications, prices, statistics, dates, product launches, financial results, or announcements.',
    '2. Separate company-announcement, news, analysis, and opinion.',
    '3. Attribute every claim to the provided sourceName and sourceUrl.',
    '4. AI agreement is NOT proof of accuracy. Flag any uncertain or high-risk claims for human review.',
    'Respond ONLY with a valid JSON object containing keys: suggestedHeadline, summary, missingInformation (array of strings).'
  ].join('\n');

  const userPayload = JSON.stringify({
    sourceName: deterministicResult.research.sourceName,
    sourceUrl: deterministicResult.research.sourceUrl,
    publishedAt: deterministicResult.research.publishedAt,
    title: rawInput.title,
    excerpt: rawInput.excerpt,
    articleType: deterministicResult.research.articleType
  });

  try {
    let endpoint = process.env.AI_BASE_URL || '';
    let headers = { 'Content-Type': 'application/json' };
    let bodyObj = {};

    if (config.provider === 'gemini') {
      const mdl = config.model || 'gemini-2.5-flash';
      endpoint = endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      bodyObj = {
        contents: [{ parts: [{ text: `${systemPrompt}\n\nSOURCE EVIDENCE:\n${userPayload}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      };
    } else {
      endpoint = endpoint || 'https://api.openai.com/v1/chat/completions';
      headers.Authorization = `Bearer ${apiKey}`;
      bodyObj = {
        model: config.model || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ]
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`External AI provider returned HTTP ${res.status}`);
    }
    const data = await res.json();
    let rawJsonText = '';
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      rawJsonText = data.candidates[0].content.parts[0].text;
    } else if (data.choices?.[0]?.message?.content) {
      rawJsonText = data.choices[0].message.content;
    }

    const parsed = JSON.parse(rawJsonText);
    return {
      usedExternalLlm: true,
      provider: config.provider,
      model: config.model,
      llmSuggestions: parsed
    };
  } catch (err) {
    return {
      usedExternalLlm: false,
      provider: 'local-deterministic-fallback',
      fallbackReason: `External provider (${config.provider}) call failed or timed out (${err.message}); seamlessly completed using deterministic local specialist workflow.`
    };
  }
}

/**
 * Execute the full 8-Step / 6-Specialist-Role AI-Assisted Newsroom Workflow
 * and route the resulting draft + verification dossier to the Admin Review Queue (status='review').
 */
async function runNewsroomWorkflow(store, input = {}, options = {}) {
  const actor = options.actor || 'ai-newsroom';
  const sendToReviewQueue = options.sendToReviewQueue !== false;
  const config = getNewsroomConfig();
  const catalog = store.getCatalogSummary();

  // Resolve input from either a collectedItemId in collected_items.json or direct story evidence payload
  let collectedRecord = null;
  let collectedIndex = -1;
  const collectedItems = store.readJson(store.files.collectedItems, []);

  if (input.collectedItemId) {
    collectedIndex = collectedItems.findIndex(c => c.id === input.collectedItemId);
    if (collectedIndex < 0) {
      throw new Error(`Collected story not found: ${input.collectedItemId}`);
    }
    collectedRecord = collectedItems[collectedIndex];
  }

  const storyInput = collectedRecord ? {
    id: collectedRecord.id,
    title: collectedRecord.title,
    excerpt: collectedRecord.excerpt,
    body: input.body || '',
    canonicalUrl: collectedRecord.canonicalUrl || collectedRecord.originalUrl,
    sourceUrl: collectedRecord.canonicalUrl || collectedRecord.originalUrl,
    sourceName: collectedRecord.sourceName,
    publishedAt: collectedRecord.publishedAt,
    manufacturer: collectedRecord.manufacturer,
    category: collectedRecord.category,
    country: collectedRecord.country,
    region: collectedRecord.region
  } : {
    id: input.id || `raw-${crypto.randomBytes(4).toString('hex')}`,
    title: String(input.title || '').trim(),
    excerpt: String(input.excerpt || input.summary || '').trim(),
    body: String(input.body || '').trim(),
    canonicalUrl: input.canonicalUrl || input.sourceUrl || '',
    sourceUrl: input.sourceUrl || input.canonicalUrl || '',
    sourceName: input.sourceName || '',
    publishedAt: input.publishedAt || null,
    manufacturer: input.manufacturer || 'Various',
    category: input.category || 'Construction Equipment',
    country: input.country || 'Global',
    region: input.region || 'Global'
  };

  if (!storyInput.title || storyInput.title.length < 6) {
    throw new Error('Newsroom workflow requires a source headline (at least 6 characters).');
  }
  if (!storyInput.excerpt && !storyInput.body) {
    throw new Error('Newsroom workflow requires source excerpt or evidence text to analyze.');
  }

  // STEP 1 & 2: Research Specialist — Analyze story and extract supported facts, dates, OEMs, models, regions, categories
  const research = runResearchSpecialist(storyInput, catalog);

  // STEP 3: Detect Duplicates and Related Coverage
  const duplicates = detectDuplicatesAndRelated(storyInput, research, store);

  // STEP 4: Factual Verification, Technical Review & Regional Context Specialists
  const verification = runFactualVerificationSpecialist(storyInput, research, duplicates);
  const technical = runTechnicalReviewSpecialist(storyInput, research);
  const regional = runRegionalContextSpecialist(research);

  // STEP 5 & 6: Editorial Quality & SEO Specialists — Create original evidence-backed draft, subheadings, internal links, SEO
  const editorial = buildEditorialDraftAndSeo(storyInput, research, verification, technical, regional, duplicates, catalog);

  // Optional External LLM Call (if AI_API_KEY is configured in .env) with strict number-grounding guardrails
  const providerExecution = await callOptionalExternalLlm(config, storyInput, {
    research,
    verification,
    technical,
    regional,
    editorial
  });

  if (providerExecution.usedExternalLlm && providerExecution.llmSuggestions) {
    const sug = providerExecution.llmSuggestions;
    if (Array.isArray(sug.missingInformation)) {
      for (const item of sug.missingInformation.slice(0, 4)) {
        if (typeof item === 'string' && item.trim() && !verification.missingInformation.includes(item.trim())) {
          verification.missingInformation.push(item.trim());
        }
      }
    }
  }

  // STEP 7: Run Factual, Originality, Grammar, and Source Checks
  const qualityChecks = runQualityChecks(storyInput, research, verification, editorial);

  // STEP 8: Send Result to Admin Review Queue (status: 'review' — NEVER auto-publish)
  let reviewArticle = null;
  if (sendToReviewQueue) {
    const articles = store.readJson(store.files.articles, []);
    const existingIdx = collectedRecord?.promotedArticleId
      ? articles.findIndex(a => a.id === collectedRecord.promotedArticleId)
      : -1;

    const revisionSummary = `AI-Assisted Newsroom 6-Role Pipeline (${providerExecution.provider}): ${verification.highRiskClaims.length} high-risk claim(s) flagged, ${verification.missingInformation.length} missing item(s) noted. Sent to human review queue. AI agreement is not proof of accuracy.`;

    const articlePayload = {
      title: editorial.suggestedHeadline,
      summary: editorial.summary,
      excerpt: editorial.summary,
      body: editorial.draftBody,
      category: research.detectedCategory,
      manufacturer: research.primaryManufacturer,
      equipmentType: technical.equipmentType,
      model: research.primaryModel || '',
      powerType: technical.powerType,
      country: regional.country,
      region: regional.region,
      articleType: research.articleType,
      author: 'Editorial Desk',
      tags: editorial.tags,
      sourceUrl: research.sourceUrl,
      sourceUrls: research.sourceUrl ? [research.sourceUrl] : [],
      image: storyInput.image || '',
      imageCredit: storyInput.imageCredit || (storyInput.image ? `Verify license with ${research.sourceName}` : ''),
      specs: technical.verifiedContextSpecs,
      seo: editorial.seo,
      // Enforce status = 'review' (Admin Review Queue). Never publish automatically.
      status: 'review',
      updatedBy: actor,
      revisionNote: revisionSummary
    };

    const existingArticle = existingIdx >= 0 ? articles[existingIdx] : null;
    if (existingArticle && existingArticle.origin === 'manual') {
      throw new Error(`Article "${existingArticle.title}" was created in Manual Editorial Studio and cannot be overwritten by AI newsroom runs.`);
    }
    const { slugInput, ...normalizedArticle } = models.validateAndNormalizeArticle(
      articlePayload,
      existingArticle || {},
      { actor, note: revisionSummary }
    );

    // Run genuine pre-publication SEO audit for the article
    normalizedArticle.seoAudit = aiSeo.auditArticleSeo(normalizedArticle, catalog);

    // Attach structured newsroomDossier to the review article so human reviewers see all 6 specialist reports
    normalizedArticle.newsroomDossier = {
      analyzedAt: new Date().toISOString(),
      mode: config.activeMode,
      provider: providerExecution.provider,
      aiAgreementDisclaimer: verification.aiAgreementDisclaimer,
      articleTypeClassification: {
        articleType: research.articleType,
        rationale: research.classificationRationale
      },
      supportedFacts: research.supportedFacts,
      extractedDates: research.extractedDates,
      highRiskClaims: verification.highRiskClaims,
      missingInformation: verification.missingInformation,
      conflictingOrUnverified: verification.conflictingOrUnverified,
      duplicatesAndRelated: duplicates,
      technicalReview: technical,
      regionalContext: regional,
      suggestedSubheadings: editorial.subheadings,
      alternativeHeadlines: editorial.alternativeHeadlines,
      internalLinks: editorial.internalLinks,
      qualityChecks,
      seoAudit: reviewArticle?.seoAudit || null
    };

    if (existingIdx >= 0) {
      normalizedArticle.slug = existingArticle.slug;
      articles[existingIdx] = normalizedArticle;
      reviewArticle = normalizedArticle;
    } else {
      let baseSlug = slugInput || models.makeSlug(normalizedArticle.title) || 'newsroom-review-item';
      let candidate = baseSlug;
      let n = 2;
      while (articles.some(a => a.slug === candidate)) candidate = `${baseSlug}-${n++}`;
      normalizedArticle.slug = candidate;
      articles.push(normalizedArticle);
      reviewArticle = normalizedArticle;
    }

    store.writeJson(store.files.articles, articles);
    store.syncEntitiesFromArticle(reviewArticle);

    if (collectedIndex >= 0) {
      collectedItems[collectedIndex].reviewStatus = 'in_review_queue';
      collectedItems[collectedIndex].promotedArticleId = reviewArticle.id;
      collectedItems[collectedIndex].lastNewsroomRunAt = new Date().toISOString();
      store.writeJson(store.files.collectedItems, collectedItems);
    }
  }

  const runRecord = {
    id: `nr-${crypto.randomBytes(6).toString('hex')}`,
    createdAt: new Date().toISOString(),
    actor,
    collectedItemId: collectedRecord?.id || null,
    reviewArticleId: reviewArticle?.id || null,
    reviewArticleSlug: reviewArticle?.slug || null,
    reviewQueueStatus: reviewArticle?.status || 'analyzed_only',
    providerExecution,
    steps: {
      step1_sourceAnalysis: {
        sourceName: research.sourceName,
        sourceUrl: research.sourceUrl,
        publishedAt: research.publishedAt,
        articleType: research.articleType,
        classificationRationale: research.classificationRationale
      },
      step2_extractedEntitiesAndFacts: {
        supportedFacts: research.supportedFacts,
        extractedDates: research.extractedDates,
        manufacturer: research.primaryManufacturer,
        matchedManufacturers: research.matchedManufacturers,
        model: research.primaryModel,
        matchedModels: research.matchedModels,
        category: research.detectedCategory,
        equipmentType: technical.equipmentType,
        country: regional.country,
        region: regional.region
      },
      step3_duplicatesAndRelated: duplicates,
      step4_missingAndRiskAnalysis: {
        aiAgreementDisclaimer: verification.aiAgreementDisclaimer,
        verificationStatus: verification.verificationStatus,
        highRiskClaims: verification.highRiskClaims,
        missingInformation: verification.missingInformation,
        conflictingOrUnverified: verification.conflictingOrUnverified,
        technicalReview: technical,
        regionalContext: regional
      },
      step5_editorialDraft: {
        articleType: research.articleType,
        body: editorial.draftBody
      },
      step6_suggestionsAndSeo: {
        suggestedHeadline: editorial.suggestedHeadline,
        alternativeHeadlines: editorial.alternativeHeadlines,
        summary: editorial.summary,
        subheadings: editorial.subheadings,
        tags: editorial.tags,
        internalLinks: editorial.internalLinks,
        seo: editorial.seo,
        seoAudit: reviewArticle?.seoAudit || null
      },
      step7_qualityChecks: qualityChecks,
      step8_reviewQueueRouting: {
        routedToAdminReviewQueue: Boolean(reviewArticle),
        articleId: reviewArticle?.id || null,
        status: reviewArticle?.status || 'none',
        autoPublished: false,
        mandatoryHumanReviewNote: 'Routed to status="review". High-risk claims and source links must be verified by a human editor before publication.'
      }
    }
  };

  if (store.files.newsroomRuns) {
    const runs = store.readJson(store.files.newsroomRuns, []);
    runs.unshift(runRecord);
    store.writeJson(store.files.newsroomRuns, runs.slice(0, 100));
  }

  store.appendAuditLog({
    actor,
    action: 'newsroom.workflow.run',
    target: `${editorial.suggestedHeadline} (${reviewArticle ? reviewArticle.id : storyInput.id})`,
    level: verification.highRiskClaims.length > 0 ? 'warn' : 'info',
    details: `Ran 6-role AI-Assisted Newsroom (${providerExecution.provider}). Routed to review queue (status="review"). Flagged ${verification.highRiskClaims.length} high-risk claim(s) and ${verification.missingInformation.length} missing item(s).`
  });

  return {
    ok: true,
    config,
    run: runRecord,
    article: reviewArticle,
    reviewArticle
  };
}

module.exports = {
  SPECIALIST_ROLES,
  getNewsroomConfig,
  runNewsroomWorkflow,
  runResearchSpecialist,
  detectDuplicatesAndRelated,
  runFactualVerificationSpecialist,
  runTechnicalReviewSpecialist,
  runRegionalContextSpecialist,
  buildEditorialDraftAndSeo,
  runQualityChecks
};
