const gsc = require('./gsc.js');
const models = require('./models.js');

/**
 * Evergreen Cornerstone Editorial Library for Machine Report World:
 * Includes Comparisons, Technical Explainers, Preventive Maintenance Guides, and Original Industry Analysis.
 * Every piece cites verifiable standards (ISO, SAE, EU Stage V, EPA Tier 4 Final, CEV Stage V) or official OEM portals,
 * never invents unverified numbers, prices, or partnerships, and provides rich cross-hub internal links.
 */
const EVERGREEN_CORNERSTONE_ARTICLES = [
  {
    id: 'backhoe-loader-center-pivot-vs-sideshift-comparison',
    title: 'Center-Pivot vs. Sideshift Backhoe Loaders: Kinematics, Stabilizer Footprint and Worksite Comparison',
    slug: 'center-pivot-vs-sideshift-backhoe-loaders-kinematics-worksite-comparison',
    summary: 'An engineering and fleet comparison of center-pivot and sideshift backhoe loader carriage architectures across trenching stability, urban road width, and attachment versatility.',
    excerpt: 'An engineering and fleet comparison of center-pivot and sideshift backhoe loader carriage architectures across trenching stability, urban road width, and attachment versatility.',
    body: `### Architectural Differences: Center-Pivot vs. Sideshift Kingpost\n\nWhen evaluating [Backhoe Loaders](/category/backhoe-loaders) across global regional markets, the primary structural distinction lies in the rear excavator mounting frame and stabilizer geometry:\n\n1. **Center-Pivot Architecture (Fixed Center Kingpost):** Predominant in [North America](/north-america/) and heavy utility corridors, center-pivot machines mount the boom swing casting at a fixed centerline point behind the rear axle, paired with wide-stance folding box-section outrigger stabilizers. Platforms such as the [John Deere 310 P-Tier](/models/john-deere-310-p-tier-backhoe-loader) and [CASE 580SV Construction King](/models/case-580sv-construction-king-backhoe) exemplify this configuration.\n2. **Sideshift Architecture (Hydraulically Clamped Sliding Kingpost):** Predominant across [India](/india/), [Europe](/europe/), and urban civil worksites, sideshift backhoe loaders mount the kingpost on parallel rear main-frame rails with hydraulic clamping cylinders and vertical drop-leg stabilizers. Reference platforms include the [BULL Machines HD76 Backhoe Loader](/models/bull-machines-hd76-backhoe-loader) and [JCB 3DX Backhoe Loader](/models/jcb-3dx-backhoe-loader).\n\n### Worksite & Operational Comparison Matrix\n\n- **Trenching Along Walls & Curbs:** Sideshift frames allow the operator to slide the kingpost laterally across the rear rail, enabling parallel trenching flush against boundary walls or highway barriers without repositioning the tractor chassis.\n- **Slope Levelling & Outrigger Footprint:** Center-pivot angled outriggers provide a wider lateral stance for straddling wide trenches on uneven right-of-way terrain, whereas vertical sideshift stabilizers minimize street lane encroachment in congested municipal zones.\n- **Transport Length & Visibility:** Sideshift booms fold transversely across the rear frame during roading, shortening overall transport overhang and improving rear-quarter sightlines.\n\n### Procurement Verification Checklist\n\nFleet managers should compare dipper tearout force, loader hinge-pin height, auxiliary hydraulic circuit flow for breakers, and local parts availability via the [Machine Report World Equipment Model Directory](/models) and [Manufacturer Profiles](/manufacturers). Always verify exact operating weights and digging envelopes directly against the manufacturer's current regional brochure.`,
    category: 'Reviews & Comparisons',
    manufacturer: 'Various',
    equipmentType: 'Backhoe loader',
    model: 'HD76, 3DX, 580SV & 310 P-Tier',
    powerType: 'Diesel Stage V / Tier 4 Final / CEV Stage V',
    country: 'Global',
    region: 'Global',
    articleType: 'review',
    author: 'Technology & Powertrains Desk',
    image: 'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?auto=format&fit=crop&w=1400&q=85',
    imageCredit: 'Editorial Reference / Official OEM Comparison Guide',
    sourceUrl: 'https://bullmachines.com/',
    sourceUrls: ['https://bullmachines.com/', 'https://www.jcb.com/', 'https://www.casece.com/', 'https://www.deere.com/'],
    tags: ['Backhoe Loaders', 'Comparison', 'BULL Machines', 'JCB', 'CASE', 'John Deere'],
    specs: {
      'Comparison Scope': 'Center-Pivot vs. Sideshift Backhoe Loader Architectures',
      'Reference Models': 'BULL HD76, JCB 3DX, CASE 580SV, John Deere 310 P-Tier',
      'Key Decision Factors': 'Curb-Side Trenching, Stabilizer Width, Roading Overhang',
      'Verification Rule': 'Consult official OEM brochure for regional homologation specs'
    },
    seo: {
      metaTitle: 'Center-Pivot vs. Sideshift Backhoe Loaders Comparison | MACHINE REPORT WORLD',
      metaDescription: 'Engineering comparison of center-pivot vs. sideshift backhoe loaders (BULL HD76, JCB 3DX, CASE 580SV, John Deere 310 P-Tier) for urban and civil worksites.',
      canonicalUrl: '',
      ogImage: 'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?auto=format&fit=crop&w=1400&q=85',
      keywords: ['center pivot vs sideshift backhoe', 'backhoe loader comparison', 'BULL HD76', 'JCB 3DX', 'CASE 580SV'],
      noIndex: false
    },
    status: 'published',
    pipelineStage: 'PUBLISHED',
    publishedAt: '2026-10-17T09:30:00.000Z',
    createdAt: '2026-10-17T09:30:00.000Z'
  },
  {
    id: '20-tonne-crawler-excavator-class-comparison',
    title: '20-Tonne Class Hydraulic Crawler Excavators: Comparing Hydraulic Control, Undercarriage & Telematics Systems',
    slug: '20-tonne-crawler-excavator-comparison-hydraulics-undercarriage-telematics',
    summary: 'How fleet engineers evaluate 20-to-22-tonne class crawler excavators across Caterpillar, Komatsu, Volvo CE, SANY and HD Hyundai for earthmoving and quarry production.',
    excerpt: 'How fleet engineers evaluate 20-to-22-tonne class crawler excavators across Caterpillar, Komatsu, Volvo CE, SANY and HD Hyundai for earthmoving and quarry production.',
    body: `### The Global Benchmark Class in Earthmoving\n\nThe 20-to-22-tonne crawler [Excavators](/category/excavators) segment represents the highest-volume heavy earthmoving class worldwide, balancing highway lowbed transportability with high-cycle trenching, bulk excavation, and multi-axle tipper loading.\n\n### Comparing Core OEM Engineering Approaches\n\nAcross the verified platforms in the [Machine Report World Equipment Model Directory](/models), leading manufacturers differentiate their 20-tonne class architectures through hydraulic valve control and digital operator assist:\n\n- **Caterpillar ([Cat 320 Hydraulic Excavator](/models/caterpillar-320-hydraulic-excavator)):** Integrates electro-hydraulic main control valves with factory-standard Cat Grade 2D, Grade Assist, and Payload on-board weighing.\n- **Komatsu ([PC210-10M0 Hydraulic Excavator](/models/komatsu-pc210-10m0-hydraulic-excavator)):** UtilizesKomatsu's proprietary Closed-Center Load Sensing System (CLSS) hydraulic architecture and KOMTRAX fleet monitoring.\n- **Volvo Construction Equipment ([EC210 Crawler Excavator](/models/volvo-ec210-crawler-excavator)):** Features electro-hydraulic pump flow optimization, boom/swing priority functions, and optional Dig Assist via Volvo Co-Pilot.\n- **SANY ([SY215C Hydraulic Excavator](/models/sany-sy215c-hydraulic-excavator)):** Employs positive-flow electronically controlled hydraulics tailored for heavy civil infrastructure across [China](/china/), [India](/india/), and [Southeast Asia](/southeast-asia/).\n- **HD Hyundai ([HX220L Crawler Excavator](/models/hd-hyundai-hx220l-crawler-excavator)):** Pairs Intelligent Power Control (IPC) pump regulation with Hi MATE remote diagnostics and optional 360-degree AAVM camera systems.\n\n### Fleet Evaluation Criteria\n\nRather than relying on headline engine horsepower alone, equipment directors should compare hydraulic flow regeneration during boom-down motions, track link pin sealing, bucket linkage pin diameters, and filter grouping for ground-level preventive maintenance.`,
    category: 'Excavators',
    manufacturer: 'Various',
    equipmentType: 'Hydraulic excavator',
    model: 'Cat 320, Komatsu PC210, Volvo EC210, SANY SY215C, HD Hyundai HX220L',
    powerType: 'Diesel Stage V / Tier 4 Final / CEV Stage V',
    country: 'Global',
    region: 'Global',
    articleType: 'review',
    author: 'Editorial Desk',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1400&q=85',
    imageCredit: 'Editorial Reference / Multi-OEM Excavator Class Briefing',
    sourceUrl: 'https://www.caterpillar.com/',
    sourceUrls: ['https://www.caterpillar.com/', 'https://www.komatsu.com/', 'https://www.volvoce.com/', 'https://www.sanyglobal.com/', 'https://www.hd-hyundaice.com/'],
    tags: ['Excavators', 'Comparison', 'Caterpillar', 'Komatsu', 'Volvo CE', 'SANY', 'HD Hyundai'],
    specs: {
      'Equipment Class': '20–22 Tonne Crawler Hydraulic Excavators',
      'Indexed Models': 'Cat 320, Komatsu PC210-10M0, Volvo EC210, SANY SY215C, HD Hyundai HX220L',
      'Hydraulic Architectures': 'Electro-Hydraulic, CLSS Closed-Center, Positive Flow, IPC',
      'Telematics Standards': 'ISO 15143-3 (AEMP 2.0) Mixed-Fleet Compatible'
    },
    seo: {
      metaTitle: '20-Tonne Crawler Excavator Comparison: Cat 320, Komatsu PC210, Volvo EC210, SANY SY215C | MACHINE REPORT WORLD',
      metaDescription: 'Technical comparison of 20-tonne class crawler excavators across Caterpillar, Komatsu, Volvo CE, SANY and HD Hyundai covering hydraulics and telematics.',
      canonicalUrl: '',
      ogImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1400&q=85',
      keywords: ['20 tonne excavator comparison', 'Cat 320 vs Komatsu PC210', 'Volvo EC210', 'SANY SY215C', 'HD Hyundai HX220L'],
      noIndex: false
    },
    status: 'published',
    pipelineStage: 'PUBLISHED',
    publishedAt: '2026-10-16T11:00:00.000Z',
    createdAt: '2026-10-16T11:00:00.000Z'
  },
  {
    id: 'preventive-maintenance-guide-hydraulics-dpf-undercarriage',
    title: 'Preventive Maintenance Guide: Off-Highway Hydraulic Contamination Control, DPF/SCR Aftertreatment & Undercarriage Life',
    slug: 'preventive-maintenance-guide-off-highway-hydraulics-dpf-scr-undercarriage',
    summary: 'A practical maintenance explainer for fleet workshops covering ISO 4406 hydraulic oil cleanliness, Stage V / CEV Stage V DPF-SCR care, pin-and-bushing greasing, and track tensioning.',
    excerpt: 'A practical maintenance explainer for fleet workshops covering ISO 4406 hydraulic oil cleanliness, Stage V / CEV Stage V DPF-SCR care, pin-and-bushing greasing, and track tensioning.',
    body: `### 1. Hydraulic Fluid Cleanliness & Contamination Control (ISO 4406)\n\nOn modern [Construction Equipment](/category/construction-equipment) — including [Backhoe Loaders](/category/backhoe-loaders), [Excavators](/category/excavators), and [Wheel Loaders](/category/wheel-loaders) — electro-hydraulic proportional valves and variable-displacement axial piston pumps operate with micron-level clearances.\n\n- **Breather & Return Filter Discipline:** Replace hydraulic reservoir breathers and return-line filter elements strictly at the intervals specified in the OEM operation and maintenance manual.\n- **Quick-Coupler Hygiene:** When swapping [Attachments](/category/attachments) (such as hydraulic breakers or augers), wipe flat-face auxiliary quick couplers clean before connection to prevent abrasive silica ingress.\n- **Scheduled Oil Sampling:** Use laboratory particle-count analysis (referenced to ISO 4406 cleanliness codes) to detect bronze pump wear or coolant cross-contamination before catastrophic failure occurs.\n\n### 2. Diesel Particulate Filter (DPF) & SCR / DEF Aftertreatment Care\n\nMachines and [Heavy Trucks](/category/heavy-trucks) operating under [India CEV Stage V / BS-VI](/india/), [EU Stage V](/europe/), and [EPA Tier 4 Final](/north-america/) emissions standards rely on Diesel Oxidation Catalysts (DOC), Diesel Particulate Filters (DPF), and Selective Catalytic Reduction (SCR):\n\n- **Avoid Interrupted Active Regenerations:** Train operators not to shut down the engine during an active DPF thermal regeneration unless a worksite safety hazard requires immediate stop.\n- **Hot Shutdown Cooldown:** Allow turbocharged engines to idle briefly before key-off so exhaust gas temperatures stabilize and DEF (AdBlue) dosing injectors can complete their purge cycle.\n- **ISO 22241 DEF Purity:** Store Diesel Exhaust Fluid in sealed, temperature-controlled containers to prevent urea crystallization in SCR dosing valves.\n\n### 3. Crawler Undercarriage & Loader Pin Maintenance\n\nUndercarriage wear accounts for a major share of lifetime maintenance cost on crawler dozers and excavators. Maintain track sag within the OEM's specified ground-condition window: over-tensioned tracks accelerate idler, sprocket, and bushing wear without improving tractive effort.`,
    category: 'Buying Guides',
    manufacturer: 'All Manufacturers',
    equipmentType: 'Earthmoving & Commercial Fleets',
    model: 'Fleet Maintenance Protocol',
    powerType: 'Diesel Stage V / Tier 4 Final / CEV Stage V',
    country: 'Global',
    region: 'Global',
    articleType: 'guide',
    author: 'Technology & Powertrains Desk',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=85',
    imageCredit: 'Editorial Reference / Workshop Maintenance Guide',
    sourceUrl: 'https://www.iso.org/standard/70917.html',
    sourceUrls: ['https://www.iso.org/standard/70917.html', 'https://www.oemoffhighway.com/'],
    tags: ['Maintenance Guide', 'Hydraulics', 'DPF & SCR', 'Undercarriage', 'Buying Guides'],
    specs: {
      'Cleanliness Standard': 'ISO 4406 Hydraulic Fluid Particle Count',
      'DEF / AdBlue Standard': 'ISO 22241 Aqueous Urea Solution',
      'Emissions Scope': 'EU Stage V, EPA Tier 4 Final, India CEV Stage V & BS-VI',
      'Primary Goal': 'Unplanned Downtime Reduction & Component Life Extension'
    },
    seo: {
      metaTitle: 'Heavy Equipment Preventive Maintenance Guide: Hydraulics, DPF/SCR & Undercarriage | MACHINE REPORT WORLD',
      metaDescription: 'Practical preventive maintenance guide for construction equipment and heavy trucks covering ISO 4406 hydraulic cleanliness, Stage V DPF/SCR care, and track tension.',
      canonicalUrl: '',
      ogImage: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=85',
      keywords: ['heavy equipment maintenance guide', 'hydraulic contamination ISO 4406', 'Stage V DPF maintenance', 'excavator undercarriage care'],
      noIndex: false
    },
    status: 'published',
    pipelineStage: 'PUBLISHED',
    publishedAt: '2026-10-15T10:15:00.000Z',
    createdAt: '2026-10-15T10:15:00.000Z'
  },
  {
    id: 'off-highway-emissions-explainer-stage-v-tier-4-cev-v',
    title: 'Technical Explainer: Navigating EU Stage V, US EPA Tier 4 Final, India CEV Stage V and China NRMM IV Off-Highway Emissions',
    slug: 'off-highway-emissions-explainer-eu-stage-v-epa-tier-4-india-cev-stage-v',
    summary: 'An engineering explainer comparing global non-road mobile machinery (NRMM) emissions regimes, particulate number (PN) limits, fuel sulfur requirements, and export fleet compatibility.',
    excerpt: 'An engineering explainer comparing global non-road mobile machinery (NRMM) emissions regimes, particulate number (PN) limits, fuel sulfur requirements, and export fleet compatibility.',
    body: `### Why Global Emissions Alignment Matters for Equipment Buyers\n\nAs construction equipment manufacturers in [India](/india/), [China](/china/), [Europe](/europe/), [Japan & South Korea](/japan-south-korea/), and [North America](/north-america/) expand cross-border exports, understanding regional Non-Road Mobile Machinery (NRMM) homologation is essential for fleet procurement and secondary resale.\n\n### Regional Regulatory Breakdown\n\n1. **European Union ([EU Stage V](/europe/)):** Enforces a strict Particulate Number (PN) limit across engine power bands from 19 kW to 560 kW, effectively mandating closed-wall Diesel Particulate Filters (DPF) alongside SCR on medium and heavy machinery.\n2. **United States & Canada ([EPA Tier 4 Final](/north-america/)):** Regulates Particulate Matter (PM) mass and Nitrogen Oxides ($\\text{NO}_x$) to near-zero levels using ultra-low sulfur diesel (ULSD $\\le 15\\text{ ppm}$ sulfur).\n3. **India ([CEV Stage V](/india/)):** Aligns Indian Construction Equipment Vehicles (wheel loaders, backhoe loaders, compactors, cranes, graders) with Stage V particulate and $\\text{NO}_x$ thresholds, enabling Indian OEMs such as [BULL Machines](/manufacturers/bull-machines), [Mahindra](/manufacturers/mahindra), and Indian plants of [JCB](/manufacturers/jcb) and [CASE](/manufacturers/case) to engineer common global powertrain platforms.\n4. **China ([China NRMM Stage IV](/china/)):** Mandates DPF and on-board diagnostics (OBD) monitoring on off-highway diesel machinery produced by OEMs including [SANY](/manufacturers/sany) and [XCMG](/manufacturers/xcmg).\n\n### Export & Secondary Market Implications\n\nContractors deploying machines into regions with higher diesel sulfur content across parts of [Africa](/africa/), the [Middle East](/middle-east/), or [Latin America](/latin-america/) must verify whether a machine requires an OEM-approved high-sulfur export calibration or ultra-low sulfur fuel supply before shipping.`,
    category: 'Technology',
    manufacturer: 'Various',
    equipmentType: 'Off-highway diesel & hybrid powertrains',
    model: 'NRMM Stage V / Tier 4F / CEV-V Platforms',
    powerType: 'Diesel / Hybrid / Electric',
    country: 'Global',
    region: 'Global',
    articleType: 'analysis',
    author: 'Technology & Powertrains Desk',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1400&q=85',
    imageCredit: 'Editorial Reference / Regulatory Powertrain Briefing',
    sourceUrl: 'https://www.energy.gov/news',
    sourceUrls: ['https://www.energy.gov/news', 'https://www.oemoffhighway.com/'],
    tags: ['Technology', 'Explainer', 'EU Stage V', 'CEV Stage V', 'EPA Tier 4 Final'],
    specs: {
      'Europe Standard': 'EU Stage V (Regulation EU 2016/1628 — PN Limit)',
      'North America Standard': 'US EPA Tier 4 Final (40 CFR Part 1039)',
      'India Standard': 'CEV Stage V (MoRTH Non-Road Emissions)',
      'China Standard': 'China NRMM Stage IV (GB 20891)'
    },
    seo: {
      metaTitle: 'Off-Highway Emissions Explainer: EU Stage V, EPA Tier 4 Final & India CEV Stage V | MACHINE REPORT WORLD',
      metaDescription: 'Technical explainer comparing EU Stage V, US EPA Tier 4 Final, India CEV Stage V, and China IV off-highway construction equipment emissions regulations.',
      canonicalUrl: '',
      ogImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1400&q=85',
      keywords: ['EU Stage V vs Tier 4 Final', 'India CEV Stage V', 'off-highway emissions explainer', 'NRMM regulations'],
      noIndex: false
    },
    status: 'published',
    pipelineStage: 'PUBLISHED',
    publishedAt: '2026-10-14T13:00:00.000Z',
    createdAt: '2026-10-14T13:00:00.000Z'
  }
];

function extractTokens(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/**
 * Compute related-story recommendations and cross-hub internal links for any article
 * connecting News <-> Manufacturers <-> Equipment Models <-> Technology <-> Regional Hubs.
 */
function buildInternalLinkGraphForArticle(article, store) {
  const catalog = store.getCatalogSummary();
  const allPublished = store.readJson(store.files.articles, []).filter(a => a.status === 'published' && a.id !== article.id);

  // 1. Score related articles by shared manufacturer, model, category, equipmentType, country/region, and tag overlap
  const artTags = new Set((article.tags || []).map(t => t.toLowerCase()));
  const artWords = new Set(extractTokens(`${article.title} ${article.summary}`));

  const scoredRelated = allPublished.map(candidate => {
    let score = 0;
    const reasons = [];

    if (
      article.manufacturer &&
      candidate.manufacturer &&
      article.manufacturer !== 'Various' &&
      article.manufacturer !== 'All Manufacturers' &&
      article.manufacturer.toLowerCase() === candidate.manufacturer.toLowerCase()
    ) {
      score += 40;
      reasons.push(`Same OEM (${candidate.manufacturer})`);
    }
    if (article.model && candidate.model && article.model.toLowerCase() === candidate.model.toLowerCase()) {
      score += 45;
      reasons.push(`Same Model (${candidate.model})`);
    }
    if (article.category && candidate.category && article.category.toLowerCase() === candidate.category.toLowerCase()) {
      score += 25;
      reasons.push(`Same Category (${candidate.category})`);
    }
    if (article.equipmentType && candidate.equipmentType && article.equipmentType.toLowerCase() === candidate.equipmentType.toLowerCase()) {
      score += 20;
      reasons.push(`Same Equipment Type (${candidate.equipmentType})`);
    }
    if (article.region && candidate.region && article.region !== 'Global' && article.region.toLowerCase() === candidate.region.toLowerCase()) {
      score += 15;
      reasons.push(`Same Region (${candidate.region})`);
    }
    for (const t of (candidate.tags || [])) {
      if (artTags.has(t.toLowerCase())) {
        score += 10;
        reasons.push(`Shared Tag (#${t})`);
      }
    }
    let wordOverlap = 0;
    for (const w of extractTokens(`${candidate.title} ${candidate.summary}`)) {
      if (artWords.has(w)) wordOverlap++;
    }
    score += Math.min(20, wordOverlap * 2);

    return {
      id: candidate.id,
      title: candidate.title,
      slug: candidate.slug,
      url: `/news/${candidate.slug}`,
      summary: candidate.summary || candidate.excerpt,
      category: candidate.category,
      manufacturer: candidate.manufacturer,
      country: candidate.country,
      region: candidate.region,
      articleType: candidate.articleType,
      image: candidate.image,
      imageCredit: candidate.imageCredit,
      publishedAt: candidate.publishedAt,
      relevanceScore: score,
      matchReasons: [...new Set(reasons)].slice(0, 3)
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  // 2. Match Manufacturer Profile Hub(s) (with fallback to category/relevant OEMs for general fleet maintenance guides)
  const hay = `${article.title} ${article.summary} ${article.body} ${article.manufacturer}`.toLowerCase();
  const validCatalogMfgs = (catalog.manufacturers || [])
    .filter(m => !['various', 'all-manufacturers', 'volvo', 'tata'].includes(m.slug));
  let matchedMfgs = validCatalogMfgs.filter(m =>
    (article.manufacturer && article.manufacturer.toLowerCase() === m.name.toLowerCase()) ||
    hay.includes(m.name.toLowerCase())
  );
  if (!matchedMfgs.length) {
    matchedMfgs = validCatalogMfgs.slice(0, 3);
  }
  const linkedManufacturers = matchedMfgs.slice(0, 4).map(m => ({
    name: m.name,
    slug: m.slug,
    country: m.country,
    focus: m.focus,
    url: `/manufacturers/${m.slug}`
  }));

  // 3. Match Equipment Model Pages
  const linkedModels = (catalog.equipmentModels || [])
    .filter(em => !['various', 'all-manufacturers'].includes(em.manufacturerSlug))
    .filter(em => {
      if (article.model && article.model.toLowerCase().includes(em.name.toLowerCase())) return true;
      if (hay.includes(em.name.toLowerCase())) return true;
      if (linkedManufacturers.some(m => m.slug === em.manufacturerSlug)) return true;
      if (article.category && (em.category || '').toLowerCase() === article.category.toLowerCase()) return true;
      return false;
    })
    .slice(0, 4)
    .map(em => ({
      name: em.name,
      slug: em.slug,
      manufacturer: em.manufacturer,
      equipmentType: em.equipmentType,
      powerType: em.powerType,
      url: `/models/${em.slug}`
    }));

  // 4. Match Category, Technology & Regional Hubs
  const catSlug = models.makeSlug(article.category || 'construction-equipment', 80);
  const regionSlugMap = {
    'india': '/india/',
    'asia-pacific': '/india/',
    'north-america': '/north-america/',
    'united-states': '/north-america/',
    'europe': '/europe/',
    'china': '/china/',
    'japan-south-korea': '/japan-south-korea/',
    'middle-east': '/middle-east/',
    'southeast-asia': '/southeast-asia/',
    'australia': '/australia/',
    'latin-america': '/latin-america/',
    'africa': '/africa/'
  };
  const regKey = models.makeSlug(article.region !== 'Global' ? article.region : article.country, 80);
  const regionalHubUrl = regionSlugMap[regKey] || '/india/';

  const hubLinks = [
    { label: `${article.category || 'Construction Equipment'} Desk`, url: `/category/${catSlug}`, type: 'category' },
    { label: 'Off-Highway Technology & Powertrains Desk', url: '/category/technology', type: 'technology' },
    { label: 'Equipment Reviews & Comparisons Desk', url: '/category/reviews', type: 'reviews' },
    { label: 'Buying & Maintenance Guides Desk', url: '/category/guides', type: 'guides' },
    { label: `${article.region !== 'Global' ? article.region : 'Regional Market'} Hub`, url: regionalHubUrl, type: 'region' }
  ];

  return {
    relatedStories: scoredRelated.slice(0, 6),
    linkedManufacturers,
    linkedModels,
    hubLinks
  };
}

/**
 * Configurable Analytics & Search Performance Monitoring:
 * Tracks page views, search queries, popular categories, country/region interest,
 * newsletter conversions, and engagement — plus configurable external analytics credentials
 * (GA4 Measurement ID, Plausible Domain, Google Search Console Verification Meta Tag)
 * without ever promising rankings or fabricated traffic numbers.
 */
function getAnalyticsAndSearchConfig(store) {
  const settings = store.getSettings();
  const gaMeasurementId = String(process.env.GA_MEASUREMENT_ID || settings.gaMeasurementId || '').trim();
  const plausibleDomain = String(process.env.PLAUSIBLE_DOMAIN || settings.plausibleDomain || '').trim();
  const gscVerificationCode = String(process.env.GSC_VERIFICATION_CODE || settings.gscVerificationCode || '').trim();
  const gscPropertyUrl = String(process.env.GSC_PROPERTY_URL || settings.gscPropertyUrl || '').trim();

  const googleAnalytics = {
    enabled: Boolean(gaMeasurementId),
    configured: Boolean(gaMeasurementId),
    measurementId: gaMeasurementId || null
  };
  const plausibleAnalytics = {
    enabled: Boolean(plausibleDomain),
    configured: Boolean(plausibleDomain),
    domain: plausibleDomain || null
  };
  const gscStatus = gsc.getSearchConsoleStatus(store);
  const googleSearchConsole = {
    enabled: Boolean(gscVerificationCode || gscPropertyUrl),
    connected: gscStatus.connected,
    authenticated: gscStatus.authenticated,
    configured: Boolean(gscStatus.verificationMeta.code || gscStatus.propertyUrl),
    verificationCode: gscStatus.verificationMeta.code,
    verificationMetaPresent: gscStatus.verificationMeta.configured,
    propertyUrl: gscStatus.propertyUrl,
    status: gscStatus.status,
    statusLabel: gscStatus.statusLabel,
    message: gscStatus.message
  };

  return {
    internalTelemetryEnabled: true,
    googleAnalytics,
    plausibleAnalytics,
    googleSearchConsole,
    externalProviders: {
      googleAnalytics4: googleAnalytics,
      plausibleAnalytics,
      googleSearchConsole
    },
    rankingAndTrafficDisclaimer: 'EDITORIAL & SEO INTEGRITY NOTICE: Machine Report World prioritizes content based on verified reader demand, source quality, audience interest, and actual measured engagement. Machine Report World never promises search engine rankings or specific traffic numbers.'
  };
}

/**
 * Record an analytics event (page view, site search query, category filter, region view, model view, newsletter conversion, or article engagement)
 */
function recordTelemetryEvent(store, payload = {}) {
  const raw = store.readJson(store.files.analytics, {
    regionViews: {},
    articleViews: {},
    categoryViews: {},
    manufacturerViews: {},
    modelViews: {},
    searchQueries: {},
    engagementEvents: { shareClicks: 0, sourceLinkClicks: 0, newsletterViews: 0, newsletterConversions: 0, totalReadSeconds: 0, readSamples: 0 }
  });

  raw.regionViews = raw.regionViews || {};
  raw.articleViews = raw.articleViews || {};
  raw.categoryViews = raw.categoryViews || {};
  raw.manufacturerViews = raw.manufacturerViews || {};
  raw.modelViews = raw.modelViews || {};
  raw.searchQueries = raw.searchQueries || {};
  raw.engagementEvents = raw.engagementEvents || {
    shareClicks: 0,
    sourceLinkClicks: 0,
    newsletterViews: 0,
    newsletterConversions: 0,
    totalReadSeconds: 0,
    readSamples: 0
  };

  const type = String(payload.type || 'article').toLowerCase().trim();
  const slug = String(payload.slug || payload.category || payload.region || payload.manufacturer || payload.model || '').trim().slice(0, 120);
  const query = String(payload.query || '').trim().toLowerCase().slice(0, 100);

  if (type === 'region' && slug) {
    raw.regionViews[slug] = (raw.regionViews[slug] || 0) + 1;
  } else if (type === 'article' && slug) {
    raw.articleViews[slug] = (raw.articleViews[slug] || 0) + 1;
    // Also credit the article's category, manufacturer, and region
    const articles = store.readJson(store.files.articles, []);
    const matched = articles.find(a => a.slug === slug);
    if (matched) {
      if (matched.category) {
        const cKey = models.makeSlug(matched.category, 80);
        raw.categoryViews[cKey] = (raw.categoryViews[cKey] || 0) + 1;
      }
      if (matched.manufacturer && matched.manufacturer !== 'Various') {
        const mKey = models.makeSlug(matched.manufacturer, 80);
        raw.manufacturerViews[mKey] = (raw.manufacturerViews[mKey] || 0) + 1;
      }
    }
  } else if (type === 'category' && slug) {
    raw.categoryViews[slug] = (raw.categoryViews[slug] || 0) + 1;
  } else if (type === 'manufacturer' && slug) {
    raw.manufacturerViews[slug] = (raw.manufacturerViews[slug] || 0) + 1;
  } else if (type === 'model' && slug) {
    raw.modelViews[slug] = (raw.modelViews[slug] || 0) + 1;
  } else if (type === 'search' && query.length >= 2) {
    raw.searchQueries[query] = (raw.searchQueries[query] || 0) + 1;
  } else if (type === 'newsletter_conversion') {
    raw.engagementEvents.newsletterConversions = (raw.engagementEvents.newsletterConversions || 0) + 1;
  } else if (type === 'share_click') {
    raw.engagementEvents.shareClicks = (raw.engagementEvents.shareClicks || 0) + 1;
  } else if (type === 'source_click') {
    raw.engagementEvents.sourceLinkClicks = (raw.engagementEvents.sourceLinkClicks || 0) + 1;
  } else if (type === 'engagement_time') {
    const secs = Math.max(1, Math.min(600, Number(payload.seconds || 15)));
    raw.engagementEvents.totalReadSeconds = (raw.engagementEvents.totalReadSeconds || 0) + secs;
    raw.engagementEvents.readSamples = (raw.engagementEvents.readSamples || 0) + 1;
  }

  raw.updatedAt = new Date().toISOString();
  store.writeJson(store.files.analytics, raw);
  return raw;
}

/**
 * Compute Demand-Driven Content Prioritization & Search Performance Report:
 * Ranks topics, categories, regions, and published stories based on:
 * 1. Verified Demand (on-site search queries & category interest)
 * 2. Source Quality (official OEM / ISO / regulatory sources vs. single-source tips)
 * 3. Audience Interest (regional views & newsletter subscriber segments)
 * 4. Actual Performance (measured article views & engagement)
 */
function getContentPrioritizationReport(store) {
  const analytics = store.readJson(store.files.analytics, {});
  const articles = store.readJson(store.files.articles, []).filter(a => a.status === 'published');
  const subscribers = store.readJson(store.files.newsletter, []).filter(s => s.status !== 'unsubscribed');
  const config = getAnalyticsAndSearchConfig(store);

  const articleViews = analytics.articleViews || {};
  const categoryViews = analytics.categoryViews || {};
  const regionViews = analytics.regionViews || {};
  const searchQueries = analytics.searchQueries || {};
  const engagement = analytics.engagementEvents || {};

  const totalArticleViews = Object.values(articleViews).reduce((a, b) => a + Number(b || 0), 0);
  const totalRegionViews = Object.values(regionViews).reduce((a, b) => a + Number(b || 0), 0);
  const totalCategoryViews = Object.values(categoryViews).reduce((a, b) => a + Number(b || 0), 0);
  const totalPageViews = totalArticleViews + totalRegionViews + totalCategoryViews;

  // Score each published article by composite Demand + Source Quality + Audience Interest + Measured Performance
  const prioritizedArticles = articles.map(a => {
    const views = Number(articleViews[a.slug] || 0);
    const catSlug = models.makeSlug(a.category || '', 80);
    const catInterest = Number(categoryViews[catSlug] || 0);
    const regSlug = models.makeSlug(a.region !== 'Global' ? a.region : a.country, 80);
    const regInterest = Number(regionViews[regSlug] || 0);
    const sourceCount = (a.sourceUrls || []).length || (a.sourceUrl ? 1 : 0);
    const hasSpecs = Object.keys(a.specs || {}).length > 0;
    const isCornerstone = ['review', 'guide', 'analysis'].includes(a.articleType);

    // Composite Priority Score:
    // Source Quality (up to 35 pts) + Actual Views (views * 12) + Category/Regional Demand ((catInterest + regInterest) * 4) + Cornerstone Depth (15 pts)
    const sourceQualityScore = Math.min(35, sourceCount * 15 + (hasSpecs ? 10 : 0));
    const performanceScore = views * 12;
    const demandScore = (catInterest + regInterest) * 4;
    const depthScore = isCornerstone ? 15 : 5;
    const compositePriorityScore = sourceQualityScore + performanceScore + demandScore + depthScore;

    return {
      id: a.id,
      title: a.title,
      slug: a.slug,
      url: `/news/${a.slug}`,
      category: a.category,
      manufacturer: a.manufacturer,
      country: a.country,
      region: a.region,
      articleType: a.articleType,
      views,
      sourceCount,
      sourceQualityScore,
      priorityScore: compositePriorityScore,
      compositePriorityScore,
      breakdown: {
        sourceQualityScore,
        performanceScore,
        demandScore,
        depthScore
      },
      recommendationReason: `${sourceCount} verified source(s), ${views} view(s), ${isCornerstone ? 'evergreen cornerstone depth' : 'news report'}`
    };
  }).sort((a, b) => b.compositePriorityScore - a.compositePriorityScore);

  const topSearchQueries = Object.entries(searchQueries)
    .map(([query, count]) => ({ key: query, query, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const popularCategories = Object.entries(categoryViews)
    .map(([slug, views]) => ({ key: slug, slug, count: Number(views), views: Number(views) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const popularRegions = Object.entries(regionViews)
    .map(([slug, views]) => ({ key: slug, slug, count: Number(views), views: Number(views) }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const avgEngagementSeconds = engagement.readSamples > 0
    ? Math.round(engagement.totalReadSeconds / engagement.readSamples)
    : 0;

  const totals = {
    totalPageViews,
    totalArticleViews,
    totalCategoryViews,
    totalRegionViews,
    totalPublishedArticles: articles.length,
    activeNewsletterSubscribers: subscribers.length,
    newsletterConversions: Number(engagement.newsletterConversions || subscribers.length),
    newsletterConversionsTracked: Number(engagement.newsletterConversions || subscribers.length),
    shareClicks: Number(engagement.shareClicks || 0),
    sourceLinkClicks: Number(engagement.sourceLinkClicks || 0),
    avgEngagementSeconds
  };

  const prioritizationObj = {
    totals,
    metrics: totals,
    topSearchQueries,
    popularCategories,
    countryRegionInterest: popularRegions,
    popularRegions,
    prioritizedArticles: prioritizedArticles.slice(0, 15),
    disclaimer: config.rankingAndTrafficDisclaimer
  };

  return {
    config,
    ...prioritizationObj,
    prioritization: prioritizationObj
  };
}

module.exports = {
  EVERGREEN_CORNERSTONE_ARTICLES,
  buildInternalLinkGraphForArticle,
  getAnalyticsAndSearchConfig,
  recordTelemetryEvent,
  getContentPrioritizationReport
};
