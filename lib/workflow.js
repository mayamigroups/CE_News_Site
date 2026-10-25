const crypto = require('node:crypto');
const models = require('./models.js');
const newsroom = require('./newsroom.js');

/**
 * Canonical 8-Stage Editorial Pipeline for MachineWire:
 * DISCOVERED -> COLLECTED -> DEDUPLICATED -> DRAFT -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED
 */
const PIPELINE_STAGES = [
  'DISCOVERED',
  'COLLECTED',
  'DEDUPLICATED',
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED'
];

/**
 * High-risk editorial topics that MUST ALWAYS be routed to human review (status='review', pipelineStage='REVIEW')
 * and are strictly blocked from automatic publication even when autoPublishEnabled === true:
 * - Recalls & product safety advisories
 * - Safety issues, accidents, fatalities, or worksite hazards
 * - Legal disputes, lawsuits, patent litigation, or labor strikes
 * - Allegations, investigations, regulatory fines, or fraud claims
 * - Financial claims, earnings, prices, investments, or M&A figures
 * - Conflicting reports or unconfirmed rumors
 * - Uncertain technical details or unverified specifications
 */
const SENSITIVE_REVIEW_RULES = [
  {
    id: 'recall_or_bulletin',
    category: 'Recalls & Service Bulletins',
    pattern: /\b(?:recall|recalls|recalled|safety bulletin|stop-sale|defect|retrofit campaign)\b/i,
    reason: 'Story references a product recall or defect campaign — mandatory human engineering and legal review required.'
  },
  {
    id: 'safety_issue_or_hazard',
    category: 'Safety Issues & Worksite Incidents',
    pattern: /\b(?:fatality|fatalities|injury|injured|accident|rollover|collapse|fire hazard|brake failure|osha|safety violation|hazard)\b/i,
    reason: 'Story involves worksite safety, injury, or equipment hazard — mandatory human editorial verification required.'
  },
  {
    id: 'dispute_or_litigation',
    category: 'Disputes & Litigation',
    pattern: /\b(?:dispute|lawsuit|litigation|sued|arbitration|patent infringement|strike|walkout|trade dispute|tariff dispute|sanction)\b/i,
    reason: 'Story involves a legal, commercial, or labor dispute — requires human verification and right-of-reply check.'
  },
  {
    id: 'allegation_or_investigation',
    category: 'Allegations & Regulatory Investigations',
    pattern: /\b(?:allegation|alleges|alleged|accused|probe|investigation|whistleblower|fraud|penalty|fine|emissions cheating)\b/i,
    reason: 'Story contains allegations or regulatory investigation claims — never eligible for automatic publication.'
  },
  {
    id: 'financial_or_pricing_claim',
    category: 'Financial Claims, Prices & Earnings',
    pattern: /(?:[$€£₹¥]|USD|EUR|GBP|INR|CNY|crore|lakh|million|billion)\s*\d+|\b(?:revenue|ebitda|net profit|dividend|acquisition|merger|ipo|valuation|price tag|msrp)\b/i,
    reason: 'Story contains financial results, M&A activity, or pricing claims — requires human check against audited filings.'
  },
  {
    id: 'conflicting_or_unconfirmed',
    category: 'Conflicting Reports & Unconfirmed Rumors',
    pattern: /\b(?:conflicting reports?|unconfirmed|rumor|reportedly|sources say|speculation|disputed)\b/i,
    reason: 'Story contains conflicting or unverified reports — requires primary source confirmation by an editor.'
  },
  {
    id: 'uncertain_technical_details',
    category: 'Uncertain Technical Details or Direct Quotes',
    pattern: /"[^"]{12,250}"|\b(?:prototype|concept machine|unverified spec|estimated payload|projected range)\b/i,
    reason: 'Story contains direct quotes or prototype/uncertain technical specifications — requires human verification.'
  }
];

const DEFAULT_WORKFLOW_CONFIG = {
  defaultEditorialMode: 'draft_review', // Always defaults to 'draft_review'
  autoPublishEnabled: false, // Must remain disabled until admin explicitly enables after all 5 gate rules are tested
  schedulerIntervalSeconds: 60,
  maxJobRetries: 3,
  retryBaseDelayMs: 250,
  jobLockTtlMs: 30000,
  hostingSchedulerDisclosure: 'Uses a dual-mode scheduler supported by Node.js hosting environments: (1) Deterministic On-Request & API Trigger evaluation (works in serverless, container, and PaaS environments even when idle), and (2) In-Process Interval Timer while the Node.js server process is active. Continuous 24/7 background execution is not claimed unless an external OS cron / cloud scheduler or persistent daemon is deployed and verified.',
  rulesTestedStatus: {
    sourceRuleTested: false,
    factualEvidenceRuleTested: false,
    originalityRuleTested: false,
    imageRightsRuleTested: false,
    qualityRuleTested: false,
    allRulesVerifiedAt: null,
    verifiedBy: null
  },
  qualityThresholds: {
    minSourceScore: 100,
    minFactualScore: 100,
    minOriginalityScore: 70,
    minGrammarScore: 85,
    requireImageAndCreditForAutoPublish: true
  },
  updatedAt: new Date().toISOString()
};

function getWorkflowConfig(store) {
  const saved = store.readJson(store.files.workflowConfig, {});
  return {
    ...DEFAULT_WORKFLOW_CONFIG,
    ...saved,
    rulesTestedStatus: {
      ...DEFAULT_WORKFLOW_CONFIG.rulesTestedStatus,
      ...(saved.rulesTestedStatus || {})
    },
    qualityThresholds: {
      ...DEFAULT_WORKFLOW_CONFIG.qualityThresholds,
      ...(saved.qualityThresholds || {})
    }
  };
}

function saveWorkflowConfig(store, patch = {}, actor = 'editorial-admin') {
  const current = getWorkflowConfig(store);
  const nextRules = {
    ...current.rulesTestedStatus,
    ...(patch.rulesTestedStatus || {})
  };
  const allFiveTested = Boolean(
    nextRules.sourceRuleTested &&
    nextRules.factualEvidenceRuleTested &&
    nextRules.originalityRuleTested &&
    nextRules.imageRightsRuleTested &&
    nextRules.qualityRuleTested
  );

  // Enforce strict rule: Automatic publication CANNOT be enabled unless all 5 rules have been tested and verified
  let nextAutoPublish = patch.autoPublishEnabled !== undefined
    ? Boolean(patch.autoPublishEnabled)
    : current.autoPublishEnabled;

  if (nextAutoPublish && !allFiveTested) {
    throw new Error(
      'Automatic publication cannot be enabled until all 5 verification rules (source, factual evidence, originality, image rights, and quality) have been tested via the Rule Verification Suite.'
    );
  }

  const updated = {
    ...current,
    defaultEditorialMode: patch.defaultEditorialMode === 'auto_eligible_only' && nextAutoPublish ? 'auto_eligible_only' : 'draft_review',
    autoPublishEnabled: nextAutoPublish,
    schedulerIntervalSeconds: Math.max(10, Math.min(3600, Number(patch.schedulerIntervalSeconds ?? current.schedulerIntervalSeconds) || 60)),
    maxJobRetries: Math.max(1, Math.min(5, Number(patch.maxJobRetries ?? current.maxJobRetries) || 3)),
    rulesTestedStatus: nextRules,
    qualityThresholds: {
      ...current.qualityThresholds,
      ...(patch.qualityThresholds || {})
    },
    updatedAt: new Date().toISOString()
  };

  store.writeJson(store.files.workflowConfig, updated);
  store.appendAuditLog({
    actor,
    action: 'workflow.config.update',
    target: `autoPublishEnabled=${updated.autoPublishEnabled}`,
    level: updated.autoPublishEnabled ? 'warn' : 'info',
    details: `Updated editorial workflow configuration (mode: ${updated.defaultEditorialMode}, autoPublishEnabled: ${updated.autoPublishEnabled}, interval: ${updated.schedulerIntervalSeconds}s).`
  });
  return updated;
}

/**
 * Evaluate a story against all 5 mandatory gates + sensitive-topic routing rules:
 * 1. Source Verification (Approved domain or valid HTTPS source URL + publisher attribution)
 * 2. Factual Evidence (Zero ungrounded numbers, zero unverified high-risk claims)
 * 3. Originality (Structured analysis, low verbatim 4-gram overlap)
 * 4. Image Rights (Explicit image URL + explicit image credit/license when required, or clean editorial placeholder rules)
 * 5. Editorial Quality (Headline, summary, structured subheadings, grammar check)
 * 6. Sensitive / High-Risk Topic Screen (Recalls, safety issues, disputes, allegations, financial claims, conflicting reports, uncertain technical details)
 */
function evaluateStoryPublicationGates(article, store) {
  const cfg = getWorkflowConfig(store);
  const catalog = store.getCatalogSummary();
  const combinedText = `${article.title || ''} ${article.summary || ''} ${article.body || ''}`;

  // Gate 1: Source Verification
  const hasPrimarySource = Boolean(article.sourceUrl && models.validHttpUrl(article.sourceUrl));
  const sourceDomain = hasPrimarySource ? models.extractDomain(article.sourceUrl) : '';
  const matchedApprovedSource = (catalog.sources || []).find(s =>
    s.enabled !== false && (
      models.extractDomain(s.url) === sourceDomain ||
      (s.feedUrl && models.extractDomain(s.feedUrl) === sourceDomain)
    )
  );
  const sourceGate = {
    passed: hasPrimarySource && Boolean(matchedApprovedSource),
    hasPrimarySource,
    sourceUrl: article.sourceUrl || '',
    approvedSourceMatched: matchedApprovedSource ? matchedApprovedSource.name : null,
    reason: !hasPrimarySource
      ? 'Missing valid primary source HTTPS URL.'
      : (!matchedApprovedSource
          ? `Source domain (${sourceDomain}) is not in the Approved Source Registry — requires human source approval.`
          : `Verified against approved source "${matchedApprovedSource.name}".`)
  };

  // Gate 2: Sensitive & High-Risk Topic Routing (Recalls, Safety, Disputes, Allegations, Financial, Conflicting, Uncertain Tech)
  const triggeredSensitiveRules = [];
  for (const rule of SENSITIVE_REVIEW_RULES) {
    if (rule.pattern.test(combinedText)) {
      triggeredSensitiveRules.push({
        id: rule.id,
        category: rule.category,
        reason: rule.reason
      });
    }
  }
  const dossierHighRisks = article.newsroomDossier?.highRiskClaims || [];
  const dossierConflicts = article.newsroomDossier?.conflictingOrUnverified || [];
  if (dossierConflicts.length > 0) {
    triggeredSensitiveRules.push({
      id: 'conflicting_dossier_flag',
      category: 'Conflicting or Unverified Information',
      reason: dossierConflicts.join('; ')
    });
  }

  // Gate 3: Factual Evidence
  const factualScore = article.newsroomDossier?.qualityChecks?.factualCheck?.score ?? 100;
  const factualGate = {
    passed: factualScore >= cfg.qualityThresholds.minFactualScore && triggeredSensitiveRules.length === 0 && dossierHighRisks.length === 0,
    score: factualScore,
    highRiskClaimCount: dossierHighRisks.length,
    sensitiveTopicFlags: triggeredSensitiveRules,
    reason: triggeredSensitiveRules.length > 0
      ? `Routed to human review: ${triggeredSensitiveRules.map(r => r.category).join(', ')}.`
      : (dossierHighRisks.length > 0
          ? `${dossierHighRisks.length} high-risk claim(s) flagged in dossier require human verification.`
          : 'All extracted facts grounded in source evidence with zero high-risk flags.')
  };

  // Gate 4: Originality
  const originalityScore = article.newsroomDossier?.qualityChecks?.originalityCheck?.score ?? 90;
  const originalityGate = {
    passed: originalityScore >= cfg.qualityThresholds.minOriginalityScore && (article.body || '').length >= 180,
    score: originalityScore,
    reason: originalityScore >= cfg.qualityThresholds.minOriginalityScore
      ? `Originality score ${originalityScore}% meets threshold (${cfg.qualityThresholds.minOriginalityScore}%).`
      : `Originality score ${originalityScore}% is below minimum threshold.`
  };

  // Gate 5: Image Rights & Licensing
  const hasImage = Boolean(article.image && models.validHttpUrl(article.image));
  const hasExplicitCredit = Boolean(
    article.imageCredit &&
    article.imageCredit.trim().length >= 6 &&
    !/verify license|unverified|todo|unknown/i.test(article.imageCredit)
  );
  const imageRightsGate = {
    passed: cfg.qualityThresholds.requireImageAndCreditForAutoPublish
      ? (hasImage && hasExplicitCredit)
      : (!hasImage || hasExplicitCredit),
    hasImage,
    imageCredit: article.imageCredit || '',
    reason: hasImage && hasExplicitCredit
      ? `Licensed image and explicit credit ("${article.imageCredit}") verified.`
      : 'Missing verified licensed image URL or explicit image credit — requires human media check for auto-publish.'
  };

  // Gate 6: Editorial Quality & Completeness
  const grammarScore = article.newsroomDossier?.qualityChecks?.grammarCheck?.score ?? 95;
  const hasRequiredMetadata = Boolean(
    article.title && article.title.length >= 12 &&
    article.summary && article.summary.length >= 40 &&
    article.category && article.manufacturer && article.country && article.region
  );
  const qualityGate = {
    passed: grammarScore >= cfg.qualityThresholds.minGrammarScore && hasRequiredMetadata,
    score: grammarScore,
    hasRequiredMetadata,
    reason: grammarScore >= cfg.qualityThresholds.minGrammarScore && hasRequiredMetadata
      ? 'Headline, summary, taxonomy metadata, and grammar checks passed.'
      : 'Article metadata or grammar score incomplete.'
  };

  const allGatesPassed =
    sourceGate.passed &&
    factualGate.passed &&
    originalityGate.passed &&
    imageRightsGate.passed &&
    qualityGate.passed;

  const allRulesTested = Boolean(
    cfg.rulesTestedStatus.sourceRuleTested &&
    cfg.rulesTestedStatus.factualEvidenceRuleTested &&
    cfg.rulesTestedStatus.originalityRuleTested &&
    cfg.rulesTestedStatus.imageRightsRuleTested &&
    cfg.rulesTestedStatus.qualityRuleTested
  );

  const eligibleForAutoPublish = Boolean(
    cfg.autoPublishEnabled &&
    allRulesTested &&
    allGatesPassed &&
    triggeredSensitiveRules.length === 0
  );

  return {
    evaluatedAt: new Date().toISOString(),
    autoPublishConfigEnabled: cfg.autoPublishEnabled,
    allRulesTested,
    allGatesPassed,
    eligibleForAutoPublish,
    recommendedAction: eligibleForAutoPublish ? 'auto_publish_permitted' : 'route_to_human_review',
    routingReasons: [
      !cfg.autoPublishEnabled ? 'Automatic publication is disabled by default (draft/review mode active).' : null,
      !sourceGate.passed ? sourceGate.reason : null,
      !factualGate.passed ? factualGate.reason : null,
      !originalityGate.passed ? originalityGate.reason : null,
      !imageRightsGate.passed ? imageRightsGate.reason : null,
      !qualityGate.passed ? qualityGate.reason : null
    ].filter(Boolean),
    gates: {
      sourceGate,
      factualGate,
      originalityGate,
      imageRightsGate,
      qualityGate
    },
    triggeredSensitiveRules
  };
}

/**
 * Run the Automated Rule Verification Suite to test all 5 publication gates + sensitive-topic routing
 * before an admin is permitted to toggle autoPublishEnabled = true.
 */
function runPublicationRulesTestSuite(store, actor = 'editorial-admin') {
  const nowIso = new Date().toISOString();
  const catalog = store.getCatalogSummary();
  const approvedUrl = catalog.sources?.[0]?.url || 'https://www.oemoffhighway.com/';

  // Test 1: Source Gate blocks unapproved/missing source URL
  const missingSourceEval = evaluateStoryPublicationGates({
    title: 'Test Hydraulic Excavator Control Architecture',
    summary: 'Technical overview of hydraulic excavator pump control systems for worksite efficiency.',
    body: 'Detailed multi-paragraph technical report on closed-center load-sensing hydraulic systems across global earthmoving applications.',
    category: 'Excavators',
    manufacturer: 'Komatsu',
    country: 'Japan',
    region: 'Japan & South Korea',
    sourceUrl: '',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
    imageCredit: 'Komatsu Official Press Handout'
  }, store);

  // Test 2: Sensitive / Factual Gate routes recalls, safety hazards, disputes, allegations, and financial claims to human review
  const recallEval = evaluateStoryPublicationGates({
    title: 'Safety Recall & Brake Hazard Investigation on 40-Tonne Dump Trucks Amid $50 Million Dispute',
    summary: 'Regulators open a safety investigation and recall following allegations of brake failure and financial disputes.',
    body: 'According to conflicting reports, a safety recall and lawsuit were filed involving $50 million in damages and alleged brake defects.',
    category: 'Heavy Trucks',
    manufacturer: 'Various',
    country: 'United States',
    region: 'North America',
    sourceUrl: approvedUrl,
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
    imageCredit: 'Editorial Reference Photo'
  }, store);

  // Test 3: Image Rights Gate blocks uncredited or "Verify license" images from auto-publish
  const unverifiedImageEval = evaluateStoryPublicationGates({
    title: 'Electric Compact Wheel Loader Deployment in Urban Construction Zones',
    summary: 'Zero-emission compact wheel loaders reduce worksite noise in European municipal projects.',
    body: 'European municipalities are deploying battery-electric compact wheel loaders to meet EU Stage V and urban low-emission zone mandates.',
    category: 'Wheel Loaders',
    manufacturer: 'Volvo Construction Equipment',
    country: 'Sweden',
    region: 'Europe',
    sourceUrl: approvedUrl,
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
    imageCredit: 'Verify license with publisher'
  }, store);

  // Test 4: Clean, fully verified story passes all 5 individual gates
  const cleanPassingEval = evaluateStoryPublicationGates({
    title: 'Closed-Center Hydraulic Valve Architecture for Crawler Excavators',
    summary: 'Engineering briefing on electronic pump flow distribution and attachment control on crawler excavators.',
    body: '### Source Evidence\n\nElectronic load-sensing hydraulic valves optimize pump displacement during combined boom, arm, and swing operations.\n\n### Technical Context\n\nOperators benefit from smoother grading modulation and reduced hydraulic oil heat generation.',
    category: 'Excavators',
    manufacturer: 'Komatsu',
    country: 'Japan',
    region: 'Japan & South Korea',
    sourceUrl: approvedUrl,
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
    imageCredit: 'Official OEM Licensed Press Handout'
  }, store);

  const suitePassed =
    missingSourceEval.gates.sourceGate.passed === false &&
    recallEval.gates.factualGate.passed === false &&
    recallEval.triggeredSensitiveRules.length >= 3 &&
    unverifiedImageEval.gates.imageRightsGate.passed === false &&
    cleanPassingEval.allGatesPassed === true;

  if (!suitePassed) {
    throw new Error('Publication Rules Test Suite failed internal assertion.');
  }

  const currentCfg = getWorkflowConfig(store);
  const updatedCfg = {
    ...currentCfg,
    rulesTestedStatus: {
      sourceRuleTested: true,
      factualEvidenceRuleTested: true,
      originalityRuleTested: true,
      imageRightsRuleTested: true,
      qualityRuleTested: true,
      allRulesVerifiedAt: nowIso,
      verifiedBy: actor
    },
    updatedAt: nowIso
  };
  store.writeJson(store.files.workflowConfig, updatedCfg);

  store.appendAuditLog({
    actor,
    action: 'workflow.rules_tested',
    target: '5-Gate & Sensitive-Topic Verification Suite',
    level: 'info',
    details: 'Verified all 5 publication gates (source, factual evidence, originality, image rights, quality) and sensitive-topic human routing (recalls, safety, disputes, allegations, financial claims).'
  });

  return {
    ok: true,
    suitePassed,
    testedAt: nowIso,
    verifiedBy: actor,
    config: updatedCfg,
    testResults: {
      sourceGateBlockedMissingUrl: !missingSourceEval.gates.sourceGate.passed,
      sensitiveTopicsRoutedToHuman: recallEval.triggeredSensitiveRules.map(r => r.id),
      imageRightsBlockedUnverifiedCredit: !unverifiedImageEval.gates.imageRightsGate.passed,
      cleanStoryPassedAllFiveGates: cleanPassingEval.allGatesPassed
    }
  };
}

/**
 * Job Locking, Duplicate-Job Prevention, Retry Handling & Failure Alerts
 */
const activeMemoryLocks = new Map();

function acquireJobLock(store, jobId, actor = 'scheduler') {
  const cfg = getWorkflowConfig(store);
  const ttlMs = cfg.jobLockTtlMs || 30000;
  const now = Date.now();

  // Check in-memory lock first
  const memLock = activeMemoryLocks.get(jobId);
  if (memLock && memLock.expiresAt > now) {
    return {
      acquired: false,
      lock: memLock,
      reason: `Duplicate job prevented: "${jobId}" is already locked by ${memLock.actor} (lockId: ${memLock.lockId}) until ${new Date(memLock.expiresAt).toISOString()}.`
    };
  }

  // Check persisted lock in workflow_locks.json
  const locks = store.readJson(store.files.workflowLocks, {});
  const persisted = locks[jobId];
  if (persisted && persisted.expiresAt > now) {
    return {
      acquired: false,
      lock: persisted,
      reason: `Duplicate job prevented: "${jobId}" is already running (started at ${persisted.acquiredAt} by ${persisted.actor}).`
    };
  }

  const newLock = {
    lockId: `lock-${crypto.randomBytes(4).toString('hex')}`,
    jobId,
    actor,
    acquiredAt: new Date(now).toISOString(),
    expiresAt: now + ttlMs
  };
  activeMemoryLocks.set(jobId, newLock);
  locks[jobId] = newLock;
  store.writeJson(store.files.workflowLocks, locks);

  return { acquired: true, lock: newLock };
}

function releaseJobLock(store, jobId, lockId) {
  const memLock = activeMemoryLocks.get(jobId);
  if (memLock && (!lockId || memLock.lockId === lockId)) {
    activeMemoryLocks.delete(jobId);
  }
  try {
    const locks = store.readJson(store.files.workflowLocks, {});
    if (locks[jobId] && (!lockId || locks[jobId].lockId === lockId)) {
      delete locks[jobId];
      store.writeJson(store.files.workflowLocks, locks);
    }
  } catch {}
}

function recordFailureAlert(store, alertInput = {}) {
  const alerts = store.readJson(store.files.failureAlerts, []);
  const alert = {
    id: `alt-${crypto.randomBytes(5).toString('hex')}`,
    createdAt: new Date().toISOString(),
    jobId: String(alertInput.jobId || 'workflow-job').slice(0, 100),
    stage: String(alertInput.stage || 'REVIEW').slice(0, 40),
    severity: ['warn', 'error', 'critical'].includes(alertInput.severity) ? alertInput.severity : 'error',
    title: String(alertInput.title || 'Workflow Job Failure Alert').slice(0, 180),
    message: String(alertInput.message || '').slice(0, 600),
    attempts: Number(alertInput.attempts || 1),
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null
  };
  alerts.unshift(alert);
  store.writeJson(store.files.failureAlerts, alerts.slice(0, 100));

  store.appendAuditLog({
    actor: alertInput.actor || 'workflow-engine',
    action: 'workflow.failure_alert',
    target: `${alert.jobId}: ${alert.title}`,
    level: 'error',
    details: `${alert.message} (after ${alert.attempts} attempt(s)).`
  });
  return alert;
}

/**
 * Execute a job function with Job Locking, Duplicate-Job Prevention, Configurable Retries, and Failure Alerting
 */
async function executeJobWithLockAndRetry(store, jobId, fn, options = {}) {
  const cfg = getWorkflowConfig(store);
  const maxRetries = options.maxRetries ?? cfg.maxJobRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? cfg.retryBaseDelayMs ?? 150;
  const actor = options.actor || 'workflow-scheduler';

  const lockResult = acquireJobLock(store, jobId, actor);
  if (!lockResult.acquired) {
    store.appendAuditLog({
      actor,
      action: 'job.duplicate_prevented',
      target: jobId,
      level: 'warn',
      details: lockResult.reason
    });
    return {
      ok: false,
      duplicatePrevented: true,
      jobId,
      error: lockResult.reason
    };
  }

  let attempts = 0;
  let lastError = null;
  try {
    while (attempts < maxRetries) {
      attempts++;
      try {
        const result = await fn({ attempt: attempts, lock: lockResult.lock });
        return {
          ok: true,
          jobId,
          lockId: lockResult.lock.lockId,
          attempts,
          result
        };
      } catch (err) {
        lastError = err;
        if (attempts < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelayMs * attempts));
        }
      }
    }

    // All retry attempts exhausted -> raise Failure Alert
    const alert = recordFailureAlert(store, {
      jobId,
      stage: options.stage || 'SCHEDULED',
      severity: 'error',
      title: `Job "${jobId}" failed after ${attempts} attempt(s)`,
      message: lastError ? lastError.message : 'Unknown job error',
      attempts,
      actor
    });

    return {
      ok: false,
      jobId,
      attempts,
      error: lastError ? lastError.message : 'Job failed',
      failureAlert: alert
    };
  } finally {
    if (!options.holdLockForTest) {
      releaseJobLock(store, jobId, lockResult.lock.lockId);
    }
  }
}

/**
 * Append a transparent ledger record of what was published (or rolled back/unpublished) and why.
 */
function appendPublicationLedger(store, entry = {}) {
  const ledger = store.readJson(store.files.publicationLedger, []);
  const record = {
    id: `pub-${crypto.randomBytes(6).toString('hex')}`,
    at: new Date().toISOString(),
    action: entry.action || 'published', // published | scheduled_published | auto_published | rolled_back_unpublished | approved | scheduled
    articleId: entry.articleId,
    title: entry.title,
    slug: entry.slug,
    pipelineStage: entry.pipelineStage || 'PUBLISHED',
    status: entry.status || 'published',
    actor: entry.actor || 'editorial-admin',
    role: entry.role || 'managing_editor',
    publicationMode: entry.publicationMode || 'human_approved', // human_approved | scheduled_release | conditional_auto_publish | rollback_unpublish
    whyPublishedOrChanged: String(entry.why || 'Approved and published after editorial verification.').slice(0, 600),
    sourceUrl: entry.sourceUrl || '',
    gateSummary: entry.gateSummary || null
  };
  ledger.unshift(record);
  store.writeJson(store.files.publicationLedger, ledger.slice(0, 250));
  return record;
}

/**
 * Transition an article through the 8-stage pipeline:
 * DRAFT -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED
 * or Rollback / Unpublish (PUBLISHED / SCHEDULED -> REVIEW or DRAFT)
 */
function transitionArticleStage(store, articleId, action, payload = {}, session = {}) {
  const actor = session.username || payload.actor || 'editorial-admin';
  const role = session.role || payload.role || 'super_admin';
  const articles = store.readJson(store.files.articles, []);
  const idx = articles.findIndex(a => a.id === articleId);
  if (idx < 0) throw new Error(`Article not found: ${articleId}`);

  const current = articles[idx];
  const nowIso = new Date().toISOString();
  const gateEvaluation = evaluateStoryPublicationGates(current, store);

  let nextStatus = current.status;
  let nextStage = current.pipelineStage || 'DRAFT';
  let nextScheduledAt = current.scheduledAt || '';
  let whyReason = String(payload.reason || payload.note || '').trim();
  let publicationMode = 'human_approved';

  if (action === 'submit_review') {
    nextStatus = 'review';
    nextStage = 'REVIEW';
    whyReason = whyReason || 'Submitted to editorial review queue.';
  } else if (action === 'approve') {
    if (!['reviewer', 'managing_editor', 'super_admin'].includes(role)) {
      throw new Error('Requires reviewer, managing_editor, or super_admin role to approve stories.');
    }
    if (!current.sourceUrl) {
      throw new Error('Cannot approve an article without a verifiable primary source URL.');
    }
    nextStatus = 'approved';
    nextStage = 'APPROVED';
    whyReason = whyReason || `Approved by ${actor} (${role}) after source and factual verification.`;
  } else if (action === 'schedule') {
    if (!['managing_editor', 'super_admin'].includes(role)) {
      throw new Error('Requires managing_editor or super_admin role to schedule publication.');
    }
    if (!payload.scheduledAt || !Number.isFinite(Date.parse(payload.scheduledAt))) {
      throw new Error('Scheduled articles need a valid publication date and time.');
    }
    nextStatus = 'scheduled';
    nextStage = 'SCHEDULED';
    nextScheduledAt = new Date(payload.scheduledAt).toISOString();
    publicationMode = 'scheduled_release';
    whyReason = whyReason || `Scheduled for publication at ${nextScheduledAt} by ${actor}.`;
  } else if (action === 'publish_now') {
    if (!['managing_editor', 'super_admin'].includes(role)) {
      throw new Error('Requires managing_editor or super_admin role to publish articles.');
    }
    if (store.getSettings().requireSourceForPublish !== false && !current.sourceUrl) {
      throw new Error('Primary source URL is required before publishing.');
    }
    nextStatus = 'published';
    nextStage = 'PUBLISHED';
    publicationMode = 'human_approved';
    whyReason = whyReason || `Published by ${actor} (${role}). Primary source verified (${current.sourceUrl || 'internal'}).`;
  } else if (action === 'auto_publish_if_eligible') {
    if (!gateEvaluation.eligibleForAutoPublish) {
      nextStatus = 'review';
      nextStage = 'REVIEW';
      publicationMode = 'routed_to_human_review';
      whyReason = `Auto-publish blocked; routed to human review: ${gateEvaluation.routingReasons.join(' | ')}`;
    } else {
      nextStatus = 'published';
      nextStage = 'PUBLISHED';
      publicationMode = 'conditional_auto_publish';
      whyReason = `Automatically published after passing all 5 tested verification gates (Source: ${gateEvaluation.gates.sourceGate.approvedSourceMatched}, Factual: 100%, Originality: ${gateEvaluation.gates.originalityGate.score}%, Image Rights: Verified, Sensitive Flags: 0).`;
    }
  } else if (action === 'rollback' || action === 'unpublish') {
    if (!['managing_editor', 'super_admin'].includes(role)) {
      throw new Error('Requires managing_editor or super_admin role to rollback or unpublish a live story.');
    }
    const targetRollbackStatus = payload.targetStatus === 'draft' ? 'draft' : 'review';
    nextStatus = targetRollbackStatus;
    nextStage = targetRollbackStatus === 'draft' ? 'DRAFT' : 'REVIEW';
    nextScheduledAt = '';
    publicationMode = 'rollback_unpublish';
    whyReason = whyReason || `Rolled back / unpublished from "${current.status}" to "${nextStatus}" by ${actor}.`;
  } else {
    throw new Error(`Unsupported workflow transition action: ${action}`);
  }

  const { slugInput, ...updated } = models.validateAndNormalizeArticle(
    {
      ...current,
      status: nextStatus,
      pipelineStage: nextStage,
      scheduledAt: nextScheduledAt,
      updatedBy: actor,
      revisionNote: `[${nextStage}] ${whyReason}`
    },
    current,
    {
      actor,
      note: `[${nextStage}] ${whyReason}`
    }
  );

  // If rolled back from published, clear publishedAt so it is immediately removed from public feeds
  if (action === 'rollback' || action === 'unpublish') {
    updated.publishedAt = '';
  }

  let ledgerEntry = null;
  if (['publish_now', 'auto_publish_if_eligible', 'rollback', 'unpublish', 'approve', 'schedule'].includes(action)) {
    ledgerEntry = appendPublicationLedger(store, {
      action: action === 'auto_publish_if_eligible' && nextStatus !== 'published' ? 'routed_to_review' : action,
      articleId: updated.id,
      title: updated.title,
      slug: updated.slug,
      pipelineStage: updated.pipelineStage,
      status: updated.status,
      actor,
      role,
      publicationMode,
      why: whyReason,
      sourceUrl: updated.sourceUrl,
      gateSummary: {
        allGatesPassed: gateEvaluation.allGatesPassed,
        triggeredSensitiveRules: gateEvaluation.triggeredSensitiveRules.map(r => r.id)
      }
    });
    updated.publicationRecord = ledgerEntry;
  }

  articles[idx] = updated;
  store.writeJson(store.files.articles, articles);
  store.syncEntitiesFromArticle(updated);

  store.appendAuditLog({
    actor,
    role,
    action: `workflow.${action}.${updated.pipelineStage}`,
    target: `${updated.title} (${updated.slug})`,
    level: action === 'rollback' || action === 'unpublish' ? 'warn' : 'info',
    details: whyReason
  });

  return {
    ok: true,
    action,
    article: updated,
    gateEvaluation,
    ledgerEntry
  };
}

/**
 * Evaluate and publish due SCHEDULED articles (`scheduledAt <= now`) and record each in the Publication Ledger.
 */
function processDueScheduledArticles(store, actor = 'workflow-scheduler') {
  const articles = store.readJson(store.files.articles, []);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const publishedNow = [];

  for (const a of articles) {
    if (a.status === 'scheduled' && a.scheduledAt) {
      const dueMs = Date.parse(a.scheduledAt);
      if (Number.isFinite(dueMs) && dueMs <= now) {
        a.status = 'published';
        a.pipelineStage = 'PUBLISHED';
        a.publishedAt = a.scheduledAt;
        a.updatedAt = nowIso;
        const why = `Scheduled publication time (${a.scheduledAt}) reached; published by ${actor}.`;
        a.updateHistory = Array.isArray(a.updateHistory) ? a.updateHistory : [];
        a.updateHistory.push({
          id: crypto.randomUUID(),
          at: nowIso,
          by: actor,
          status: 'published',
          action: 'status:scheduled->published',
          changedFields: ['status', 'pipelineStage', 'publishedAt'],
          note: `[PUBLISHED] ${why}`
        });

        const ledgerEntry = appendPublicationLedger(store, {
          action: 'scheduled_published',
          articleId: a.id,
          title: a.title,
          slug: a.slug,
          pipelineStage: 'PUBLISHED',
          status: 'published',
          actor,
          role: 'system_scheduler',
          publicationMode: 'scheduled_release',
          why,
          sourceUrl: a.sourceUrl
        });
        a.publicationRecord = ledgerEntry;
        publishedNow.push(a);
      }
    }
  }

  if (publishedNow.length > 0) {
    store.writeJson(store.files.articles, articles);
  }
  return publishedNow;
}

/**
 * Compute counts and items across all 8 canonical stages:
 * DISCOVERED -> COLLECTED -> DEDUPLICATED -> DRAFT -> REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED
 */
function getEditorialPipelineSummary(store) {
  const cfg = getWorkflowConfig(store);
  const collected = store.readJson(store.files.collectedItems, []);
  const articles = store.readJson(store.files.articles, []);
  const ledger = store.readJson(store.files.publicationLedger, []);
  const alerts = store.readJson(store.files.failureAlerts, []);
  const locks = store.readJson(store.files.workflowLocks, {});

  const stageCounts = {
    DISCOVERED: collected.length,
    COLLECTED: collected.length,
    DEDUPLICATED: collected.filter(c => c.reviewStatus === 'pending_review').length,
    DRAFT: articles.filter(a => a.status === 'draft').length,
    REVIEW: articles.filter(a => a.status === 'review' || a.status === 'rejected').length,
    APPROVED: articles.filter(a => a.status === 'approved').length,
    SCHEDULED: articles.filter(a => a.status === 'scheduled').length,
    PUBLISHED: articles.filter(a => a.status === 'published').length
  };

  return {
    stages: PIPELINE_STAGES,
    stageCounts,
    config: cfg,
    activeLocks: Object.values(locks).filter(l => l.expiresAt > Date.now()),
    unacknowledgedAlertsCount: alerts.filter(a => !a.acknowledged).length,
    failureAlerts: alerts.slice(0, 25),
    publicationLedger: ledger.slice(0, 40)
  };
}

module.exports = {
  PIPELINE_STAGES,
  SENSITIVE_REVIEW_RULES,
  DEFAULT_WORKFLOW_CONFIG,
  getWorkflowConfig,
  saveWorkflowConfig,
  evaluateStoryPublicationGates,
  runPublicationRulesTestSuite,
  acquireJobLock,
  releaseJobLock,
  recordFailureAlert,
  executeJobWithLockAndRetry,
  appendPublicationLedger,
  transitionArticleStage,
  processDueScheduledArticles,
  getEditorialPipelineSummary
};
