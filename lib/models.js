const crypto = require('node:crypto');

const VALID_ARTICLE_TYPES = ['news', 'company-announcement', 'analysis', 'opinion', 'guide', 'review'];
const VALID_STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected', 'archived'];
const VALID_PIPELINE_STAGES = ['DISCOVERED', 'COLLECTED', 'DEDUPLICATED', 'DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
const VALID_ADMIN_ROLES = ['super_admin', 'managing_editor', 'reviewer', 'author'];

function makeSlug(s, maxLen = 100) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
}

function validHttpUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'unknown';
  }
}

function normalizeSpecs(specs) {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return {};
  const out = {};
  for (const [k, v] of Object.entries(specs)) {
    const key = String(k || '').trim().slice(0, 60);
    const val = String(v ?? '').trim().slice(0, 140);
    if (key && val) out[key] = val;
  }
  return out;
}

function normalizeSeo(seo = {}, defaults = {}) {
  const obj = seo && typeof seo === 'object' && !Array.isArray(seo) ? seo : {};
  const metaTitle = String(obj.metaTitle || defaults.title || '').trim().slice(0, 180);
  const metaDescription = String(obj.metaDescription || defaults.summary || '').trim().slice(0, 320);
  const canonicalUrl = String(obj.canonicalUrl || '').trim().slice(0, 1500);
  const ogImage = String(obj.ogImage || defaults.image || '').trim().slice(0, 1500);
  const noIndex = Boolean(obj.noIndex);
  const rawKeywords = Array.isArray(obj.keywords)
    ? obj.keywords
    : String(obj.keywords || '').split(',');
  const keywords = [...new Set(rawKeywords.map(k => String(k).trim().slice(0, 50)).filter(Boolean))].slice(0, 15);

  if (!validHttpUrl(canonicalUrl) || !validHttpUrl(ogImage)) {
    throw new Error('SEO canonicalUrl and ogImage must be valid http or https URLs.');
  }

  return {
    metaTitle,
    metaDescription,
    canonicalUrl,
    ogImage,
    keywords,
    noIndex
  };
}

// ---------------------------------------------------------------------------
// 1. Region Model
// ---------------------------------------------------------------------------
function createRegionModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 100);
  if (!name) throw new Error('Region name is required.');
  const slug = makeSlug(input.slug || name, 80);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `reg-${slug}`,
    name,
    slug,
    description: String(input.description ?? existing.description ?? '').trim().slice(0, 400),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 2. Country Model
// ---------------------------------------------------------------------------
function createCountryModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 100);
  if (!name) throw new Error('Country name is required.');
  const slug = makeSlug(input.slug || name, 80);
  const region = String(input.region ?? existing.region ?? 'Global').trim().slice(0, 100);
  const regionId = input.regionId || existing.regionId || `reg-${makeSlug(region, 80)}`;
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `cty-${slug}`,
    name,
    slug,
    isoCode: String(input.isoCode ?? existing.isoCode ?? '').trim().toUpperCase().slice(0, 10),
    region,
    regionId,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 3. Category Model
// ---------------------------------------------------------------------------
function createCategoryModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 80);
  if (!name) throw new Error('Category name is required.');
  const slug = makeSlug(input.slug || name, 80);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `cat-${slug}`,
    name,
    slug,
    section: String(input.section ?? existing.section ?? 'industry').trim().slice(0, 60),
    description: String(input.description ?? existing.description ?? '').trim().slice(0, 400),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 4. Author Model
// ---------------------------------------------------------------------------
function createAuthorModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? 'Editorial Desk').trim().slice(0, 100);
  if (!name) throw new Error('Author name is required.');
  const slug = makeSlug(input.slug || name, 80);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `aut-${slug}`,
    name,
    slug,
    role: String(input.role ?? existing.role ?? 'Editorial Desk').trim().slice(0, 100),
    email: String(input.email ?? existing.email ?? '').trim().toLowerCase().slice(0, 140),
    bio: String(input.bio ?? existing.bio ?? '').trim().slice(0, 600),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 5. Manufacturer Model
// ---------------------------------------------------------------------------
function normalizeStringList(raw, maxItems = 25, maxLen = 120) {
  const arr = Array.isArray(raw) ? raw : String(raw || '').split(/,|\n/);
  return [...new Set(arr.map(x => String(x || '').trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems);
}

function createManufacturerModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 100);
  if (!name) throw new Error('Manufacturer name is required.');
  const slug = makeSlug(input.slug || existing.slug || name, 80);
  const website = String(input.website ?? existing.website ?? '').trim().slice(0, 500);
  if (!validHttpUrl(website)) throw new Error('Manufacturer website must be a valid http or https URL.');
  const country = String(input.country ?? existing.country ?? 'Global').trim().slice(0, 100);
  const headquarters = String(input.headquarters ?? existing.headquarters ?? '').trim().slice(0, 180);
  const overview = String(input.overview ?? input.description ?? existing.overview ?? existing.description ?? '').trim().slice(0, 1200);
  const equipmentCategories = normalizeStringList(input.equipmentCategories ?? existing.equipmentCategories, 20, 80);
  const technologyHighlights = normalizeStringList(input.technologyHighlights ?? existing.technologyHighlights, 15, 220);
  const regionalFootprint = normalizeStringList(input.regionalFootprint ?? existing.regionalFootprint, 15, 100);
  const officialSources = normalizeStringList(input.officialSources ?? existing.officialSources, 10, 500).filter(validHttpUrl);
  const verificationStatus = String(input.verificationStatus ?? existing.verificationStatus ?? 'Editorial Directory Candidate — Independent Coverage (No Partnership Claimed)').trim().slice(0, 160);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `mfg-${slug}`,
    name,
    slug,
    country,
    countryId: input.countryId || existing.countryId || `cty-${makeSlug(country, 80)}`,
    headquarters,
    website,
    focus: String(input.focus ?? existing.focus ?? 'Construction equipment & commercial vehicles').trim().slice(0, 250),
    description: overview,
    overview,
    equipmentCategories,
    technologyHighlights,
    regionalFootprint,
    officialSources,
    verificationStatus,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 6. Equipment Model (Machine / Commercial Vehicle Platform)
// ---------------------------------------------------------------------------
function createEquipmentModel(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim().slice(0, 120);
  if (!name) throw new Error('Equipment model name is required.');
  const manufacturer = String(input.manufacturer ?? existing.manufacturer ?? 'Various').trim().slice(0, 100);
  const manufacturerSlug = makeSlug(input.manufacturerSlug || existing.manufacturerSlug || manufacturer, 80);
  const manufacturerId = input.manufacturerId || existing.manufacturerId || `mfg-${manufacturerSlug}`;
  const slug = makeSlug(input.slug || existing.slug || `${manufacturer}-${name}`, 100);
  const equipmentType = String(input.equipmentType ?? existing.equipmentType ?? 'Construction equipment').trim().slice(0, 100);
  const category = String(input.category ?? existing.category ?? equipmentType).trim().slice(0, 80);
  const country = String(input.country ?? existing.country ?? 'Global').trim().slice(0, 100);
  const powerType = String(input.powerType ?? existing.powerType ?? 'Diesel').trim().slice(0, 80);
  const summary = String(input.summary ?? existing.summary ?? '').trim().slice(0, 600);
  const applications = normalizeStringList(input.applications ?? existing.applications, 15, 160);
  const features = normalizeStringList(input.features ?? existing.features, 15, 200);
  const competingModels = normalizeStringList(input.competingModels ?? existing.competingModels, 12, 120);
  const officialSourceUrl = String(input.officialSourceUrl ?? existing.officialSourceUrl ?? '').trim().slice(0, 500);
  if (!validHttpUrl(officialSourceUrl)) throw new Error('Equipment officialSourceUrl must be a valid http or https URL.');
  const image = String(input.image ?? existing.image ?? '').trim().slice(0, 1500);
  if (!validHttpUrl(image)) throw new Error('Equipment image must be a valid http or https URL.');
  const imageCredit = String(input.imageCredit ?? existing.imageCredit ?? 'Editorial / Official OEM Reference').trim().slice(0, 200);
  const specSourceNote = String(input.specSourceNote ?? existing.specSourceNote ?? 'Consult official manufacturer brochure for regional homologation and exact configuration figures.').trim().slice(0, 300);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `mdl-${slug}`,
    name,
    slug,
    manufacturer,
    manufacturerSlug,
    manufacturerId,
    equipmentType,
    category,
    country,
    powerType,
    summary,
    specs: normalizeSpecs(input.specs ?? existing.specs),
    applications,
    features,
    competingModels,
    officialSourceUrl,
    image,
    imageCredit,
    specSourceNote,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 7. Source Model (Admin Source Registry for News Collection Engine)
// ---------------------------------------------------------------------------
function createSourceModel(input = {}, existing = {}) {
  const url = String(input.url ?? input.website ?? existing.url ?? existing.website ?? '').trim().slice(0, 1500);
  if (!url || !validHttpUrl(url)) throw new Error('Source requires a valid http or https URL.');
  const feedUrl = String(input.feedUrl ?? existing.feedUrl ?? '').trim().slice(0, 1500);
  if (feedUrl && !validHttpUrl(feedUrl)) throw new Error('Source feedUrl must be a valid http or https URL.');
  const apiEndpoint = String(input.apiEndpoint ?? existing.apiEndpoint ?? '').trim().slice(0, 1500);
  if (apiEndpoint && !validHttpUrl(apiEndpoint)) throw new Error('Source apiEndpoint must be a valid http or https URL.');
  const domain = extractDomain(url);
  const name = String(input.name ?? input.title ?? existing.name ?? existing.title ?? `${domain} reference`).trim().slice(0, 250);
  const hash = crypto.createHash('sha1').update(feedUrl || apiEndpoint || url).digest('hex').slice(0, 12);
  const pollingIntervalMinutes = Math.max(5, Math.min(1440, Number(input.pollingIntervalMinutes ?? existing.pollingIntervalMinutes ?? 60) || 60));
  const recentErrors = Array.isArray(input.recentErrors)
    ? input.recentErrors.slice(0, 10)
    : (Array.isArray(existing.recentErrors) ? existing.recentErrors.slice(0, 10) : []);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `src-${hash}`,
    name,
    title: name,
    url,
    website: url,
    domain,
    feedUrl,
    apiEndpoint,
    requiresApiKey: input.requiresApiKey !== undefined ? Boolean(input.requiresApiKey) : Boolean(existing.requiresApiKey ?? false),
    apiKeyEnvVar: String(input.apiKeyEnvVar ?? existing.apiKeyEnvVar ?? '').trim().slice(0, 80),
    publisher: String(input.publisher ?? existing.publisher ?? name).trim().slice(0, 140),
    manufacturer: String(input.manufacturer ?? existing.manufacturer ?? 'Various').trim().slice(0, 100),
    category: String(input.category ?? existing.category ?? 'Construction Equipment').trim().slice(0, 80),
    country: String(input.country ?? existing.country ?? 'Global').trim().slice(0, 80),
    region: String(input.region ?? existing.region ?? 'Global').trim().slice(0, 80),
    sourceType: String(input.sourceType ?? existing.sourceType ?? 'rss-feed').trim().slice(0, 60),
    pollingIntervalMinutes,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : (existing.enabled ?? true),
    verified: input.verified !== undefined ? Boolean(input.verified) : (existing.verified ?? true),
    lastSuccessAt: input.lastSuccessAt !== undefined ? input.lastSuccessAt : (existing.lastSuccessAt || null),
    lastCheckedAt: input.lastCheckedAt !== undefined ? input.lastCheckedAt : (existing.lastCheckedAt || null),
    lastItemCount: Number(input.lastItemCount ?? existing.lastItemCount ?? 0),
    recentErrors,
    notes: String(input.notes ?? existing.notes ?? '').trim().slice(0, 500),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 8. Tag Model
// ---------------------------------------------------------------------------
function createTagModel(input = {}, existing = {}) {
  const name = String(typeof input === 'string' ? input : (input.name ?? existing.name ?? '')).trim().slice(0, 50);
  if (!name) throw new Error('Tag name is required.');
  const slug = makeSlug(input.slug || name, 60);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `tag-${slug}`,
    name,
    slug,
    createdAt: existing.createdAt || input.createdAt || now
  };
}

// ---------------------------------------------------------------------------
// 9. Image Model
// ---------------------------------------------------------------------------
function createImageModel(input = {}, existing = {}) {
  const url = String(input.url ?? existing.url ?? '').trim().slice(0, 1500);
  if (!url || !validHttpUrl(url)) throw new Error('Image requires a valid http or https URL.');
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `img-${hash}`,
    url,
    alt: String(input.alt ?? existing.alt ?? '').trim().slice(0, 250),
    caption: String(input.caption ?? existing.caption ?? '').trim().slice(0, 400),
    credit: String(input.credit ?? existing.credit ?? 'Editorial / OEM Press Handout').trim().slice(0, 250),
    license: String(input.license ?? existing.license ?? 'Editorial Use').trim().slice(0, 120),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 10. Newsletter Model
// ---------------------------------------------------------------------------
const VALID_NEWSLETTER_INTERESTS = [
  'construction-equipment',
  'tractors',
  'commercial-vehicles',
  'manufacturers',
  'technology',
  'business',
  'regional-news'
];

function createNewsletterModel(input = {}, existing = {}) {
  const email = String(input.email ?? existing.email ?? '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  const consent = input.consent !== undefined ? Boolean(input.consent) : (existing.consent ?? true);
  if (consent === false) {
    throw new Error('Explicit privacy and email consent is required to subscribe.');
  }
  const status = ['pending_verification', 'active', 'unsubscribed', 'bounced'].includes(input.status || existing.status)
    ? (input.status || existing.status)
    : 'active';
  const frequency = ['daily', 'weekly'].includes(String(input.frequency || existing.frequency || 'weekly').toLowerCase())
    ? String(input.frequency || existing.frequency || 'weekly').toLowerCase()
    : 'weekly';

  const rawInterests = Array.isArray(input.interests)
    ? input.interests
    : (Array.isArray(existing.interests) ? existing.interests : []);
  const interests = [...new Set(
    rawInterests
      .map(x => makeSlug(x, 40))
      .filter(x => VALID_NEWSLETTER_INTERESTS.includes(x))
  )];
  if (!interests.length) {
    interests.push('construction-equipment', 'commercial-vehicles', 'technology');
  }

  const now = new Date().toISOString();
  const verificationToken = existing.verificationToken || input.verificationToken || crypto.randomBytes(18).toString('hex');
  const unsubscribeToken = existing.unsubscribeToken || input.unsubscribeToken || crypto.randomBytes(18).toString('hex');

  return {
    id: existing.id || input.id || crypto.randomUUID(),
    email,
    segment: String(input.segment ?? existing.segment ?? 'Global Briefing').trim().slice(0, 80),
    interests,
    frequency,
    status,
    verified: input.verified !== undefined ? Boolean(input.verified) : (existing.verified ?? (status === 'active')),
    verifiedAt: input.verifiedAt !== undefined ? input.verifiedAt : (existing.verifiedAt || null),
    verificationToken,
    unsubscribeToken,
    consent: true,
    consentTimestamp: existing.consentTimestamp || input.consentTimestamp || now,
    consentPolicyVersion: String(input.consentPolicyVersion || existing.consentPolicyVersion || 'v2026.10').slice(0, 30),
    unsubscribedAt: input.unsubscribedAt !== undefined ? input.unsubscribedAt : (existing.unsubscribedAt || null),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 11. Admin User Model & Password Hashing (scrypt)
// ---------------------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !String(storedHash).startsWith('scrypt:')) return false;
  const parts = String(storedHash).split(':');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  const actualHex = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(actualHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createAdminUserModel(input = {}, existing = {}) {
  const username = String(input.username ?? existing.username ?? 'editorial-admin').trim().toLowerCase().slice(0, 80);
  if (!username) throw new Error('Admin username is required.');
  const email = String(input.email ?? existing.email ?? `${username}@machinewire.local`).trim().toLowerCase().slice(0, 160);
  const role = VALID_ADMIN_ROLES.includes(input.role || existing.role)
    ? (input.role || existing.role)
    : 'managing_editor';
  let passwordHash = existing.passwordHash || input.passwordHash || '';
  if (input.password && String(input.password).trim().length >= 6) {
    passwordHash = hashPassword(String(input.password).trim());
  }
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || `adm-${makeSlug(username, 60)}`,
    username,
    email,
    role,
    passwordHash,
    active: input.active !== undefined ? Boolean(input.active) : (existing.active ?? true),
    lastLoginAt: input.lastLoginAt || existing.lastLoginAt || null,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

// ---------------------------------------------------------------------------
// 12. Article Model (With Full Lifecycle, SEO & Update History)
// ---------------------------------------------------------------------------
function computeDiffFields(prev, next) {
  const tracked = [
    'title', 'slug', 'summary', 'body', 'category', 'manufacturer',
    'equipmentType', 'model', 'powerType', 'country', 'region',
    'author', 'image', 'imageCredit', 'sourceUrl', 'articleType',
    'status', 'featured', 'scheduledAt'
  ];
  const changed = [];
  for (const key of tracked) {
    if (String(prev[key] ?? '') !== String(next[key] ?? '')) {
      changed.push(key);
    }
  }
  if (JSON.stringify(prev.sourceUrls || []) !== JSON.stringify(next.sourceUrls || [])) changed.push('sourceUrls');
  if (JSON.stringify(prev.tags || []) !== JSON.stringify(next.tags || [])) changed.push('tags');
  if (JSON.stringify(prev.specs || {}) !== JSON.stringify(next.specs || {})) changed.push('specs');
  if (JSON.stringify(prev.seo || {}) !== JSON.stringify(next.seo || {})) changed.push('seo');
  return changed;
}

function validateAndNormalizeArticle(input = {}, existing = null, options = {}) {
  const base = existing ? { ...existing, ...input } : { ...input };

  const title = String(base.title || '').trim().slice(0, 180);
  // Support both `summary` and legacy `excerpt` seamlessly
  const summaryInput = String(input.summary ?? input.excerpt ?? existing?.summary ?? existing?.excerpt ?? '').trim().slice(0, 400);
  const summary = summaryInput;
  const excerpt = summaryInput;
  const body = String(base.body || '').trim().slice(0, 50000);

  if (title.length < 8 || !summary || body.length < 20) {
    throw new Error('Add a title (at least 8 characters), an excerpt and article content (at least 20 characters).');
  }

  const category = String(base.category || 'Industry News').trim().slice(0, 80);
  const manufacturer = String(base.manufacturer || 'Various').trim().slice(0, 100);
  const equipmentType = String(base.equipmentType || 'Construction equipment').trim().slice(0, 100);
  const model = String(base.model || '').trim().slice(0, 100);
  const powerType = String(base.powerType || '').trim().slice(0, 60);
  const country = String(base.country || 'Global').trim().slice(0, 100);
  const region = String(base.region || (country === 'India' ? 'Asia-Pacific' : country)).trim().slice(0, 80);
  const author = String(base.author || 'Editorial Desk').trim().slice(0, 100);
  const articleType = VALID_ARTICLE_TYPES.includes(base.articleType) ? base.articleType : 'news';

  const image = String(base.image || '').trim().slice(0, 1500);
  const imageCredit = String(base.imageCredit ?? existing?.imageCredit ?? (image ? 'Editorial / OEM Press Handout' : '')).trim().slice(0, 250);
  const sourceUrl = String(base.sourceUrl || '').trim().slice(0, 1500);

  const rawSources = Array.isArray(base.sourceUrls)
    ? base.sourceUrls
    : String(base.sourceUrls || '').split(/\r?\n/);
  const sourceUrlsList = rawSources.map(x => String(x).trim().slice(0, 1500)).filter(Boolean);

  if (!validHttpUrl(image) || !validHttpUrl(sourceUrl) || sourceUrlsList.some(u => !validHttpUrl(u))) {
    throw new Error('Image and source links must use http or https URLs.');
  }

  const cleanSourceUrls = [...new Set([sourceUrl, ...sourceUrlsList].filter(Boolean))].slice(0, 10);
  const primarySource = sourceUrl || cleanSourceUrls[0] || '';

  const rawTags = Array.isArray(base.tags) ? base.tags : String(base.tags || '').split(',');
  const tags = [...new Set(rawTags.map(x => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, 12);

  const status = VALID_STATUSES.includes(base.status) ? base.status : 'draft';
  const statusToStageMap = {
    draft: 'DRAFT',
    review: 'REVIEW',
    approved: 'APPROVED',
    scheduled: 'SCHEDULED',
    published: 'PUBLISHED',
    rejected: 'REVIEW',
    archived: 'PUBLISHED'
  };
  const pipelineStage = VALID_PIPELINE_STAGES.includes(base.pipelineStage)
    ? base.pipelineStage
    : (statusToStageMap[status] || 'DRAFT');
  const scheduledAtRaw = String(base.scheduledAt || '').trim().slice(0, 40);
  if (status === 'scheduled' && (!scheduledAtRaw || !Number.isFinite(Date.parse(scheduledAtRaw)))) {
    throw new Error('Scheduled articles need a valid publication date and time.');
  }
  const scheduledAt = status === 'scheduled' ? new Date(scheduledAtRaw).toISOString() : scheduledAtRaw;

  const verificationNotes = String(base.verificationNotes || '').trim().slice(0, 1000);
  const rejectionReason = String(base.rejectionReason || '').trim().slice(0, 1000);
  const specs = normalizeSpecs(base.specs);
  const seo = normalizeSeo(base.seo, { title, summary, image });

  const slugInput = makeSlug(input.slug || '', 100);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || existing?.publishedAt || existing?.updatedAt || now;

  let publishedAt = existing?.publishedAt || '';
  if (status === 'published' && !publishedAt) {
    publishedAt = now;
  } else if (status === 'scheduled') {
    publishedAt = scheduledAt;
  } else if (!['published', 'archived'].includes(status)) {
    publishedAt = '';
  }

  // Relational foreign keys for normalized lookups
  const categoryId = `cat-${makeSlug(category, 80)}`;
  const manufacturerId = `mfg-${makeSlug(manufacturer, 80)}`;
  const countryId = `cty-${makeSlug(country, 80)}`;
  const regionId = `reg-${makeSlug(region, 80)}`;
  const authorId = `aut-${makeSlug(author, 80)}`;
  const equipmentModelId = model ? `mdl-${makeSlug(`${manufacturer}-${model}`, 100)}` : null;

  const normalized = {
    id: existing?.id || input.id || crypto.randomUUID(),
    title,
    slugInput,
    slug: existing?.slug || slugInput || makeSlug(title, 100) || 'news-story',
    summary,
    excerpt,
    body,
    category,
    categoryId,
    manufacturer,
    manufacturerId,
    equipmentType,
    model,
    equipmentModelId,
    powerType,
    country,
    countryId,
    region,
    regionId,
    articleType,
    author,
    authorId,
    image,
    imageCredit,
    sourceUrl: primarySource,
    sourceUrls: cleanSourceUrls,
    tags,
    specs,
    seo,
    verificationNotes,
    rejectionReason,
    featured: Boolean(base.featured),
    status,
    pipelineStage,
    scheduledAt,
    publishedAt,
    publicationRecord: base.publicationRecord || existing?.publicationRecord || null,
    newsroomDossier: base.newsroomDossier || existing?.newsroomDossier || null,
    createdAt,
    updatedAt: now
  };

  // Build immutable updateHistory log
  const prevHistory = Array.isArray(existing?.updateHistory) ? [...existing.updateHistory] : [];
  const actor = String(options.actor || input.updatedBy || 'Editorial Desk').trim().slice(0, 100);
  const historyNote = String(options.note || input.revisionNote || '').trim().slice(0, 300);

  if (!existing) {
    prevHistory.push({
      id: crypto.randomUUID(),
      at: createdAt,
      by: actor,
      status,
      action: 'created',
      changedFields: ['initial_create'],
      note: historyNote || `Article created with status "${status}".`
    });
  } else {
    const changedFields = computeDiffFields(existing, normalized);
    if (changedFields.length > 0 || historyNote) {
      prevHistory.push({
        id: crypto.randomUUID(),
        at: now,
        by: actor,
        status,
        action: existing.status !== status ? `status:${existing.status}->${status}` : 'updated',
        changedFields,
        note: historyNote || (existing.status !== status ? `Status changed from ${existing.status} to ${status}` : `Updated ${changedFields.join(', ')}`)
      });
    }
  }

  normalized.updateHistory = prevHistory.slice(-50); // Keep last 50 revisions
  return normalized;
}

module.exports = {
  VALID_ARTICLE_TYPES,
  VALID_STATUSES,
  VALID_PIPELINE_STAGES,
  VALID_ADMIN_ROLES,
  VALID_NEWSLETTER_INTERESTS,
  makeSlug,
  validHttpUrl,
  extractDomain,
  normalizeSpecs,
  normalizeSeo,
  createRegionModel,
  createCountryModel,
  createCategoryModel,
  createAuthorModel,
  createManufacturerModel,
  createEquipmentModel,
  createSourceModel,
  createTagModel,
  createImageModel,
  createNewsletterModel,
  createAdminUserModel,
  hashPassword,
  verifyPassword,
  validateAndNormalizeArticle
};
