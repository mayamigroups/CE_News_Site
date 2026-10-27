const models = require('../models.js');

const CANONICAL_REGIONAL_HUBS = [
  {
    slug: 'india',
    title: 'India & South Asia',
    shortName: 'India',
    countries: ['India'],
    regions: ['India', 'Asia-Pacific'],
    currency: 'INR (₹ / Crore)',
    units: 'Metric (tonnes, kW / hp, metres)',
    regulations: 'CEV Stage V (Construction Equipment) & BS-VI Phase 2 (Commercial Vehicles)',
    terminology: 'Backhoe Loaders, Multi-Axle Tippers (28T–55T GVW), Pick-and-Carry Cranes, Tractor Implements',
    events: 'EXCON (Bengaluru), Bauma CONEXPO INDIA (Greater Noida)'
  },
  {
    slug: 'north-america',
    title: 'United States & North America',
    shortName: 'North America',
    countries: ['United States', 'Canada', 'Mexico', 'North America'],
    regions: ['North America'],
    currency: 'USD ($) / CAD ($)',
    units: 'US Customary & Metric (lbs, short tons, hp, ft-lbs)',
    regulations: 'EPA Tier 4 Final (Off-Highway) & EPA 2027 / CARB ACT (Commercial Trucks)',
    terminology: 'Compact Track Loaders (CTLs), Skid-Steers, Class 7 & Class 8 Vocational Dump Trucks, Articulated Haulers',
    events: 'CONEXPO-CON/AGG (Las Vegas), World of Concrete, ACT Expo, Utility Expo (Louisville)'
  },
  {
    slug: 'europe',
    title: 'Europe (EU, UK & EEA)',
    shortName: 'Europe',
    countries: ['Germany', 'United Kingdom', 'Sweden', 'France', 'Italy', 'Europe'],
    regions: ['Europe'],
    currency: 'EUR (€) / GBP (£)',
    units: 'Metric (tonnes, kW, Nm, metres)',
    regulations: 'EU Stage V (Non-Road Mobile Machinery) & Euro 6e / Euro 7 (Heavy-Duty Vehicles)',
    terminology: 'Wheeled Excavators, Tiltrotators, Compact Electric Loaders, 8x4 Rigid Tippers, Telehandlers',
    events: 'Bauma (Munich), IAA Transportation (Hannover), Intermat (Paris), PlantWorx (UK)'
  },
  {
    slug: 'china',
    title: 'China',
    shortName: 'China',
    countries: ['China'],
    regions: ['China'],
    currency: 'CNY (¥ / RMB)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'China NRMM Stage IV (Off-Highway) & China VI-b / NEV Mandates (Commercial Trucks)',
    terminology: 'Battery-Electric Wheel Loaders, NEV Heavy Mining Dump Trucks, Ultra-Large Tonnage All-Terrain Cranes',
    events: 'bauma CHINA (Shanghai), BICES (Beijing)'
  },
  {
    slug: 'japan-south-korea',
    title: 'Japan & South Korea',
    shortName: 'Japan & Korea',
    countries: ['Japan', 'South Korea'],
    regions: ['Japan & South Korea'],
    currency: 'JPY (¥) / KRW (₩)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'MLIT Off-Road Act (Japan) & KMOE Stage V Equivalent (South Korea)',
    terminology: 'Zero-Tail-Swing Mini & Hydraulic Excavators, ICT Smart Construction, Hybrid Earthmoving',
    events: 'CSPI-EXPO (Chiba, Japan), CONEX Korea (Seoul)'
  },
  {
    slug: 'middle-east',
    title: 'Middle East & GCC',
    shortName: 'Middle East',
    countries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Middle East'],
    regions: ['Middle East', 'Middle East & Africa'],
    currency: 'AED / SAR / USD ($)',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'GSO Euro V / VI Heavy Vehicle Standards & High-Ambient Desert Cooling Specs',
    terminology: 'Tower & Heavy Crawler Cranes, 50°C High-Ambient Excavators, Sand & Quarry Articulated Tippers',
    events: 'Big 5 Global Heavy (Dubai), Saudi Infrastructure Expo (Riyadh)'
  },
  {
    slug: 'southeast-asia',
    title: 'Southeast Asia (ASEAN)',
    shortName: 'Southeast Asia',
    countries: ['Indonesia', 'Thailand', 'Vietnam', 'Malaysia', 'Philippines', 'Singapore'],
    regions: ['Southeast Asia'],
    currency: 'IDR / THB / VND / MYR / USD',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'ASEAN Euro 4 / Euro 5 Diesel & Biofuel (B35) Powertrain Compatibility',
    terminology: '20-Tonne Class Forestry & Mining Excavators, Nickel/Coal Overburden Tipper Trucks, Ag Tractors',
    events: 'Mining Indonesia (Jakarta), CONSTECH Thailand (Bangkok), Philconstruct (Manila)'
  },
  {
    slug: 'australia',
    title: 'Australia & Oceania',
    shortName: 'Australia',
    countries: ['Australia', 'New Zealand'],
    regions: ['Australia'],
    currency: 'AUD (A$) / NZD (NZ$)',
    units: 'Metric (tonnes, kW, metres, GCM)',
    regulations: 'ADR 80/04 (Euro VI Heavy Trucks) & Autonomous Mining Haulage Safety Standards (MDG)',
    terminology: 'Autonomous Haulage Systems (AHS), Multi-Combination Road Trains, Ultra-Class Mining Shovels',
    events: 'AIMEX (Sydney), National Diesel Dirt & Turf Expo, Brisbane Truck Show'
  },
  {
    slug: 'latin-america',
    title: 'Latin America',
    shortName: 'Latin America',
    countries: ['Brazil', 'Chile', 'Argentina', 'Mexico', 'Peru', 'Colombia'],
    regions: ['Latin America'],
    currency: 'BRL (R$) / CLP / MXN / USD',
    units: 'Metric (tonnes, kW, cv / hp)',
    regulations: 'PROCONVE MAR-I (Off-Road) & PROCONVE P8 / Euro 6 (Commercial Trucks in Brazil)',
    terminology: 'Copper & Lithium Mining Haul Trucks, High-Horsepower Row-Crop Tractors, Bi-Train Vocational Trucks',
    events: 'M&T Expo (São Paulo), EXPOMIN (Santiago, Chile), Agrishow (Ribeirão Preto)'
  },
  {
    slug: 'africa',
    title: 'Africa',
    shortName: 'Africa',
    countries: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Zambia'],
    regions: ['Africa'],
    currency: 'ZAR (R) / NGN / KES / EGP / USD',
    units: 'Metric (tonnes, kW, metres)',
    regulations: 'Regional Sulphur-Tolerant Tier 2 / Tier 3 & Euro II–V Fleet Specifications',
    terminology: 'Articulated Dump Trucks (ADTs), Open-Pit Mining Excavators, Ruggedized 6x4 Tippers & Utility Backhoes',
    events: 'bauma CONEXPO AFRICA (Johannesburg), Investing in African Mining Indaba (Cape Town)'
  }
];

const REGION_PATH_ALIASES = {
  'united-states': 'north-america',
  'usa': 'north-america',
  'us': 'north-america',
  'na': 'north-america',
  'japan-and-south-korea': 'japan-south-korea',
  'japan-korea': 'japan-south-korea',
  'japan': 'japan-south-korea',
  'south-korea': 'japan-south-korea',
  'asean': 'southeast-asia',
  'sea': 'southeast-asia',
  'oceania': 'australia',
  'latam': 'latin-america',
  'mena': 'middle-east',
  'gcc': 'middle-east',
  'asia-pacific': 'india',
  'apac': 'india',
  'south-asia': 'india',
  'eu': 'europe',
  'uk': 'europe'
};

function resolveRegionHubSlug(raw) {
  if (!raw) return null;
  const clean = String(raw).toLowerCase().replace(/^\/+|\/+$/g, '').trim();
  const direct = CANONICAL_REGIONAL_HUBS.find(h => h.slug === clean);
  if (direct) return direct.slug;
  if (REGION_PATH_ALIASES[clean]) return REGION_PATH_ALIASES[clean];
  return null;
}

class CatalogService {
  constructor({ manufacturerRepository, equipmentModelRepository, taxonomyRepository, articleRepository, analyticsRepository }) {
    this.mfgRepo = manufacturerRepository;
    this.modelRepo = equipmentModelRepository;
    this.taxonomyRepo = taxonomyRepository;
    this.articleRepo = articleRepository;
    this.analyticsRepo = analyticsRepository;
  }

  getCanonicalRegionalHubs() {
    return CANONICAL_REGIONAL_HUBS;
  }

  getCanonicalHubs() {
    return CANONICAL_REGIONAL_HUBS;
  }

  resolveRegionHubSlug(raw) {
    return resolveRegionHubSlug(raw);
  }

  getRegionsData() {
    return this.computeRegionsPriorityData();
  }

  computeRegionsPriorityData() {
    const articles = this.articleRepo.getAll().filter(a => a.status === 'published');
    const catalog = this.taxonomyRepo.getCatalogSummary();
    const analytics = this.analyticsRepo ? this.analyticsRepo.getAnalytics() : {};

    return CANONICAL_REGIONAL_HUBS.map((hub, idx) => {
      const localArticles = articles.filter(a =>
        hub.countries.some(c => (a.country || '').toLowerCase() === c.toLowerCase()) ||
        hub.regions.some(r => (a.region || '').toLowerCase() === r.toLowerCase())
      );
      const internationalArticles = articles.filter(a =>
        !localArticles.some(loc => loc.id === a.id) &&
        ((a.country || '').toLowerCase() === 'global' || (a.region || '').toLowerCase() === 'global')
      );
      const activeOems = (catalog.manufacturers || []).filter(m =>
        hub.countries.some(c => (m.country || '').toLowerCase() === c.toLowerCase())
      );
      const regionViews = Number(analytics.regionViews?.[hub.slug] || 0);
      const articleViews = localArticles.reduce((sum, a) => sum + Number(analytics.articleViews?.[a.slug] || 0), 0);

      const priorityScore = (localArticles.length * 35) + (activeOems.length * 15) + ((regionViews + articleViews) * 5) + (12 - idx);

      return {
        ...hub,
        canonicalUrl: `/${hub.slug}/`,
        localArticleCount: localArticles.length,
        internationalArticleCount: internationalArticles.length,
        manufacturerCount: activeOems.length,
        activeManufacturers: activeOems.map(m => m.name),
        analyticsViews: regionViews + articleViews,
        priorityScore
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  getCatalogSummary() {
    return this.taxonomyRepo.getCatalogSummary();
  }

  getMeta() {
    const catalog = this.getCatalogSummary();
    return {
      regions: catalog.regions || [],
      countries: catalog.countries || [],
      categories: catalog.categories || [],
      authors: catalog.authors || [],
      manufacturers: (catalog.manufacturers || []).map(m => m.name),
      tags: (catalog.tags || []).map(t => t.name)
    };
  }

  getManufacturers({ q, country, category, equipmentType, modelQuery } = {}) {
    const catalog = this.getCatalogSummary();
    const articles = this.articleRepo.getAll().filter(a => a.status === 'published');
    const allModels = (catalog.equipmentModels || []).filter(m =>
      !['all-manufacturers', 'various'].includes(String(m.manufacturerSlug || '').toLowerCase()) &&
      !['All Manufacturers', 'Various'].includes(m.manufacturer)
    );

    const rawMfgs = (catalog.manufacturers || []).filter(m =>
      !['all-manufacturers', 'various', 'volvo', 'tata'].includes(m.slug)
    );

    const enriched = rawMfgs.map(mfg => {
      const mfgModels = allModels.filter(em =>
        em.manufacturerSlug === mfg.slug ||
        em.manufacturer.toLowerCase() === mfg.name.toLowerCase() ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(em.manufacturer)) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(em.manufacturer))
      );
      const mfgArticles = articles.filter(a =>
        (a.manufacturer || '').toLowerCase() === mfg.name.toLowerCase() ||
        models.makeSlug(a.manufacturer || '', 80) === mfg.slug ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(a.manufacturer || '')) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(a.manufacturer || ''))
      );
      return {
        ...mfg,
        canonicalUrl: `/manufacturers/${mfg.slug}`,
        modelCount: mfgModels.length,
        articleCount: mfgArticles.length,
        models: mfgModels.map(em => ({
          name: em.name,
          slug: em.slug,
          equipmentType: em.equipmentType,
          category: em.category,
          powerType: em.powerType,
          canonicalUrl: `/models/${em.slug}`
        }))
      };
    });

    const filtered = enriched.filter(mfg => {
      if (country && mfg.country.toLowerCase() !== country && !(mfg.regionalFootprint || []).some(r => r.toLowerCase() === country)) {
        return false;
      }
      if (category && !(mfg.equipmentCategories || []).some(c => c.toLowerCase().includes(category)) && !mfg.focus.toLowerCase().includes(category)) {
        return false;
      }
      if (equipmentType && !mfg.models.some(m => m.equipmentType.toLowerCase().includes(equipmentType)) && !mfg.focus.toLowerCase().includes(equipmentType)) {
        return false;
      }
      if (modelQuery && !mfg.models.some(m => m.name.toLowerCase().includes(modelQuery) || m.slug.includes(modelQuery))) {
        return false;
      }
      if (q) {
        const hay = [
          mfg.name,
          mfg.country,
          mfg.headquarters,
          mfg.focus,
          mfg.summary,
          ...(mfg.equipmentCategories || []),
          ...(mfg.regionalFootprint || []),
          ...mfg.models.map(m => `${m.name} ${m.equipmentType} ${m.category}`)
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return {
      disclaimer: 'All manufacturers listed are independent editorial directory candidates. Inclusion does not imply any commercial partnership, sponsorship, or OEM endorsement.',
      total: filtered.length,
      manufacturers: filtered
    };
  }

  getManufacturerBySlug(rawSlug, publicArticleFormatter = a => a) {
    if (!rawSlug) return null;
    const clean = rawSlug.toLowerCase();
    const aliasMap = {
      'volvo': 'volvo-construction-equipment',
      'volvo-ce': 'volvo-construction-equipment',
      'tata': 'tata-motors',
      'bull': 'bull-machines',
      'cat': 'caterpillar',
      'deere': 'john-deere',
      'hyundai': 'hd-hyundai'
    };
    const targetSlug = aliasMap[clean] || clean;
    const catalog = this.getCatalogSummary();
    const mfg = (catalog.manufacturers || []).find(m => m.slug === targetSlug || m.slug === clean);
    if (!mfg || ['all-manufacturers', 'various'].includes(mfg.slug)) {
      return null;
    }

    const articles = this.articleRepo.getAll().filter(a => a.status === 'published');
    const relatedArticles = articles
      .filter(a =>
        (a.manufacturer || '').toLowerCase() === mfg.name.toLowerCase() ||
        models.makeSlug(a.manufacturer || '', 80) === mfg.slug ||
        (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(a.manufacturer || '')) ||
        (mfg.slug === 'tata-motors' && /tata/i.test(a.manufacturer || ''))
      )
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .map(publicArticleFormatter);

    const productModels = (catalog.equipmentModels || []).filter(em =>
      em.manufacturerSlug === mfg.slug ||
      em.manufacturer.toLowerCase() === mfg.name.toLowerCase() ||
      (mfg.slug === 'volvo-construction-equipment' && /volvo/i.test(em.manufacturer)) ||
      (mfg.slug === 'tata-motors' && /tata/i.test(em.manufacturer))
    ).map(em => ({
      ...em,
      canonicalUrl: `/models/${em.slug}`
    }));

    return {
      ...mfg,
      canonicalUrl: `/manufacturers/${mfg.slug}`,
      disclaimer: 'Independent editorial profile. Not an official manufacturer partnership or endorsement.',
      models: productModels,
      relatedArticles
    };
  }

  getModels({ q, manufacturer, equipmentType, category, country, modelFilter } = {}) {
    const catalog = this.getCatalogSummary();
    const allModels = (catalog.equipmentModels || []).filter(em =>
      !['all-manufacturers', 'various'].includes(String(em.manufacturerSlug || '').toLowerCase()) &&
      !['All Manufacturers', 'Various'].includes(em.manufacturer) &&
      em.slug !== 'bull-machines-full-lineup'
    );

    const filtered = allModels.filter(em => {
      if (manufacturer && em.manufacturer.toLowerCase() !== manufacturer && em.manufacturerSlug !== manufacturer) {
        return false;
      }
      if (equipmentType && !em.equipmentType.toLowerCase().includes(equipmentType)) {
        return false;
      }
      if (category && !(em.category || '').toLowerCase().includes(category) && !em.equipmentType.toLowerCase().includes(category)) {
        return false;
      }
      if (country && (em.country || '').toLowerCase() !== country) {
        return false;
      }
      if (modelFilter && !em.name.toLowerCase().includes(modelFilter) && !em.slug.includes(modelFilter)) {
        return false;
      }
      if (q) {
        const hay = [
          em.name,
          em.manufacturer,
          em.equipmentType,
          em.category,
          em.country,
          em.powerType,
          em.summary,
          ...(em.applications || []),
          ...(em.features || []),
          ...Object.entries(em.specs || {}).map(([k, v]) => `${k} ${v}`)
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).map(em => ({
      ...em,
      canonicalUrl: `/models/${em.slug}`,
      manufacturerUrl: `/manufacturers/${em.manufacturerSlug || models.makeSlug(em.manufacturer, 80)}`
    }));

    return {
      disclaimer: 'Specifications are reference summaries from official OEM documentation. Never rely on unverified figures for lift planning or procurement; consult the official manufacturer datasheet.',
      total: filtered.length,
      models: filtered
    };
  }

  getModelBySlug(rawSlug, publicArticleFormatter = a => a) {
    if (!rawSlug) return null;
    const targetSlug = rawSlug.toLowerCase();
    const catalog = this.getCatalogSummary();
    const allModels = catalog.equipmentModels || [];
    const em = allModels.find(m => m.slug === targetSlug || m.id === `mdl-${targetSlug}`);
    if (!em) return null;

    const mfg = (catalog.manufacturers || []).find(m =>
      m.slug === em.manufacturerSlug || m.name.toLowerCase() === em.manufacturer.toLowerCase()
    ) || null;

    const competingModels = (em.competingModels || [])
      .map(compSlug => allModels.find(m => m.slug === compSlug))
      .filter(Boolean)
      .map(comp => ({
        name: comp.name,
        slug: comp.slug,
        manufacturer: comp.manufacturer,
        manufacturerSlug: comp.manufacturerSlug,
        equipmentType: comp.equipmentType,
        category: comp.category,
        powerType: comp.powerType,
        country: comp.country,
        canonicalUrl: `/models/${comp.slug}`
      }));

    const articles = this.articleRepo.getAll().filter(a => a.status === 'published');
    const relatedArticles = articles
      .filter(a =>
        (a.model && a.model.toLowerCase() === em.name.toLowerCase()) ||
        (a.manufacturer && a.manufacturer.toLowerCase() === em.manufacturer.toLowerCase()) ||
        (a.equipmentType && em.equipmentType && a.equipmentType.toLowerCase() === em.equipmentType.toLowerCase()) ||
        (a.category && em.category && a.category.toLowerCase() === em.category.toLowerCase())
      )
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 6)
      .map(publicArticleFormatter);

    return {
      ...em,
      canonicalUrl: `/models/${em.slug}`,
      manufacturerProfile: mfg ? {
        name: mfg.name,
        slug: mfg.slug,
        headquarters: mfg.headquarters,
        country: mfg.country,
        website: mfg.website,
        canonicalUrl: `/manufacturers/${mfg.slug}`
      } : null,
      competingModelsResolved: competingModels,
      disclaimer: 'Official OEM specification summary. Operating limits and configurations vary by region and optional attachments.',
      relatedArticles
    };
  }

  upsertCatalogEntity(type, data, actor = 'Editorial Desk') {
    return this.taxonomyRepo.upsertEntity(type, data);
  }

  deleteCatalogEntity(type, key, actor = 'Editorial Desk') {
    return this.taxonomyRepo.deleteEntity(type, key);
  }
}

module.exports = {
  CatalogService,
  CANONICAL_REGIONAL_HUBS,
  REGION_PATH_ALIASES,
  resolveRegionHubSlug
};
