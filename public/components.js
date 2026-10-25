/**
 * MachineWire — Reusable UI Components, Category Taxonomy & SEO Helpers
 * Brand: MACHINEWIRE | Tagline: THE WORLD OF MACHINES. CONNECTED.
 */
(function (global) {
  const esc = (s = '') =>
    String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const ARTICLE_TYPE_LABELS = {
    'news': 'News Report',
    'company-announcement': 'OEM Release',
    'analysis': 'Technical Analysis',
    'opinion': 'Editorial Opinion',
    'guide': 'Buyer Guide',
    'review': 'Spec Review'
  };

  // All 26 required category desks + core navigation hubs
  const CATEGORY_DESKS = {
    'construction-equipment': {
      slug: 'construction-equipment',
      title: 'Construction Equipment',
      group: 'Construction & Earthmoving',
      description: 'Backhoe loaders, excavators, wheel loaders, bulldozers, cranes, graders, telehandlers, roadbuilding and heavy civil machinery.',
      matcher: (a, all) => /backhoe|excavat|loader|bulldozer|dozer|crane|grader|telehandler|compactor|paver|machinery|construction equipment/i.test(all)
    },
    'backhoe-loaders': {
      slug: 'backhoe-loaders',
      title: 'Backhoe Loaders',
      group: 'Construction & Earthmoving',
      description: 'Center-pivot and sideshift backhoe loader launches, specifications, hydraulic upgrades and buyer guides.',
      matcher: (a, all) => /backhoe/i.test(all) || a.category === 'Backhoe Loaders'
    },
    'excavators': {
      slug: 'excavators',
      title: 'Excavators',
      group: 'Construction & Earthmoving',
      description: 'Crawler, wheeled, midi and mini hydraulic excavators for earthmoving, trenching, quarry and demolition worksites.',
      matcher: (a, all) => /excavat/i.test(all) || a.category === 'Excavators'
    },
    'wheel-loaders': {
      slug: 'wheel-loaders',
      title: 'Wheel Loaders',
      group: 'Construction & Earthmoving',
      description: 'Articulated, compact and quarry wheel loaders, Z-bar kinematics, bucket payloads and driveline efficiency.',
      matcher: (a, all) => /wheel loader|loader/i.test(all) || a.category === 'Wheel Loaders'
    },
    'bulldozers': {
      slug: 'bulldozers',
      title: 'Bulldozers',
      group: 'Construction & Earthmoving',
      description: 'Crawler dozers, hydrostatic drivelines, 3D grade-control blades and heavy ripping tractors.',
      matcher: (a, all) => /bulldozer|dozer/i.test(all) || a.category === 'Bulldozers'
    },
    'cranes': {
      slug: 'cranes',
      title: 'Cranes',
      group: 'Construction & Earthmoving',
      description: 'All-terrain, crawler, rough-terrain, tower and pick-and-carry cranes for heavy lifting and infrastructure.',
      matcher: (a, all) => /crane|lifting/i.test(all) || a.category === 'Cranes'
    },
    'graders': {
      slug: 'graders',
      title: 'Graders',
      group: 'Construction & Earthmoving',
      description: 'Motor graders, moldboard articulation, automated cross-slope control and haul-road maintenance.',
      matcher: (a, all) => /grader/i.test(all) || a.category === 'Graders'
    },
    'telehandlers': {
      slug: 'telehandlers',
      title: 'Telehandlers',
      group: 'Construction & Earthmoving',
      description: 'Rotating and fixed-boom telescopic handlers for construction sites, logistics yards and agriculture.',
      matcher: (a, all) => /telehandler|telescopic/i.test(all) || a.category === 'Telehandlers'
    },
    'roadbuilding': {
      slug: 'roadbuilding',
      title: 'Roadbuilding',
      group: 'Construction & Earthmoving',
      description: 'Asphalt pavers, soil and tandem vibratory compactors, cold planers, bitumen sprayers and highway machinery.',
      matcher: (a, all) => /roadbuilding|paver|compactor|roller|asphalt|highway/i.test(all) || a.category === 'Roadbuilding'
    },
    'mining-equipment': {
      slug: 'mining-equipment',
      title: 'Mining Equipment',
      group: 'Construction & Earthmoving',
      description: 'Rigid dump trucks, ultra-class hydraulic mining shovels, rotary blast-hole drills and quarry haulers.',
      matcher: (a, all) => /mining|quarry|haulroad|rigid dump/i.test(all) || a.category === 'Mining Equipment'
    },
    'compact-equipment': {
      slug: 'compact-equipment',
      title: 'Compact Equipment',
      group: 'Construction & Earthmoving',
      description: 'Skid-steer loaders, compact track loaders (CTLs), mini excavators and urban utility machinery.',
      matcher: (a, all) => /compact|skid-steer|mini excavat|ctl/i.test(all) || a.category === 'Compact Equipment'
    },
    'attachments': {
      slug: 'attachments',
      title: 'Attachments',
      group: 'Construction & Earthmoving',
      description: 'Hydraulic breakers, quick couplers, tiltrotators, augers, grapples and tractor-mounted loader/backhoe attachments.',
      matcher: (a, all) => /attachment|breaker|bucket|coupler|tiltrotator|auger/i.test(all) || a.category === 'Attachments'
    },
    'tractors': {
      slug: 'tractors',
      title: 'Tractors',
      group: 'Agriculture & Utility',
      description: 'Utility, row-crop and heavy-duty 4WD tractors for agricultural mechanization and municipal haulage.',
      matcher: (a, all) => /tractor/i.test(all) || a.category === 'Tractors'
    },
    'agricultural-machinery': {
      slug: 'agricultural-machinery',
      title: 'Agricultural Machinery',
      group: 'Agriculture & Utility',
      description: 'Combine harvesters, rotavators, balers, precision implements and radial agri-loader platforms.',
      matcher: (a, all) => /agricultural|agri|harvester|implement|tractor/i.test(all) || a.category === 'Agricultural Machinery'
    },
    'heavy-trucks': {
      slug: 'heavy-trucks',
      title: 'Heavy Trucks',
      group: 'Commercial Vehicles',
      description: 'Multi-axle 6x4 and 8x4 tippers, vocational chassis, prime movers, heavy haulers and fleet transport.',
      matcher: (a, all) => /heavy truck|tipper|vocational|commercial vehicle|6x4|8x4|hauler|truck/i.test(all) || ['Commercial Vehicles', 'Heavy Trucks'].includes(a.category)
    },
    'pickups': {
      slug: 'pickups',
      title: 'Pickups',
      group: 'Commercial Vehicles',
      description: '4x4 crew-cab pickups, utility service trucks and worksite support vehicles.',
      matcher: (a, all) => /pickup/i.test(all) || a.category === 'Pickups'
    },
    'vans': {
      slug: 'vans',
      title: 'Vans',
      group: 'Commercial Vehicles',
      description: 'Commercial panel vans, mobile workshop conversions, chassis cabs and last-mile fleet vans.',
      matcher: (a, all) => /\bvan\b|\bvans\b/i.test(all) || a.category === 'Vans'
    },
    'buses': {
      slug: 'buses',
      title: 'Buses',
      group: 'Commercial Vehicles',
      description: 'City transit buses, intercity coaches, workforce transport and zero-emission passenger fleets.',
      matcher: (a, all) => /\bbus\b|\bbuses\b|coach/i.test(all) || a.category === 'Buses'
    },
    'electric-commercial-vehicles': {
      slug: 'electric-commercial-vehicles',
      title: 'Electric Commercial Vehicles',
      group: 'Commercial Vehicles',
      description: 'Battery-electric and hydrogen fuel-cell heavy trucks, electric tippers, e-vans and zero-emission buses.',
      matcher: (a, all) => (/electric|bev|zero-emission|hydrogen/i.test(all) && /truck|van|bus|commercial|vehicle|tipper|loader|excavat/i.test(all)) || a.category === 'Electric Commercial Vehicles'
    },
    'technology': {
      slug: 'technology',
      title: 'Technology',
      group: 'Editorial Desks',
      description: 'Load-sensing hydraulics, ISO 15143-3 telematics, Stage V / CEV-V powertrains, AI grade control and electrification.',
      matcher: (a, all) => /technology|hydraulic|telematics|electr|automation|powertrain|ai/i.test(all) || a.category === 'Technology'
    },
    'business': {
      slug: 'business',
      title: 'Business',
      group: 'Editorial Desks',
      description: 'OEM investments, plant capacity expansions, quarterly market updates, exports and dealer network growth.',
      matcher: (a, all) => /industry|market|business|investment|export|infrastructure/i.test(all) || ['Industry News', 'Business', 'Market Updates', 'Industry & Business'].includes(a.category)
    },
    'reviews': {
      slug: 'reviews',
      title: 'Reviews',
      group: 'Editorial Desks',
      description: 'Specification-led equipment and truck evaluations, driveline analyses and side-by-side model comparisons.',
      matcher: (a, all) => /comparison|review|specification|evaluat/i.test(all) || a.category === 'Reviews & Comparisons' || a.articleType === 'review'
    },
    'guides': {
      slug: 'guides',
      title: 'Guides',
      group: 'Editorial Desks',
      description: 'Practical equipment buying checklists, maintenance explainers and total cost of ownership (TCO) guides.',
      matcher: (a, all) => /guide|maintenance|buyer|compare|checklist/i.test(all) || a.category === 'Buying Guides' || a.articleType === 'guide'
    },
    'projects': {
      slug: 'projects',
      title: 'Projects',
      group: 'Editorial Desks',
      description: 'Highway corridors, port expansions, metro rail tunneling, mining contracts and major civil fleet deployments.',
      matcher: (a, all) => /project|infrastructure|highway|corridor|contract|worksite|earthmoving/i.test(all) || a.category === 'Projects'
    },
    'events': {
      slug: 'events',
      title: 'Events',
      group: 'Editorial Desks',
      description: 'Global trade exhibitions including EXCON (Bengaluru), Bauma (Munich), CONEXPO-CON/AGG (Las Vegas) and IAA Transportation.',
      matcher: (a, all) => /event|exhibition|excon|bauma|conexpo|iaa|show/i.test(all) || a.category === 'Events & Exhibitions'
    },
    'videos': {
      slug: 'videos',
      title: 'Videos',
      group: 'Editorial Desks',
      description: 'Walkaround machine briefings, live worksite demonstrations, operator cab reviews and trade show video dispatches.',
      matcher: (a, all) => /video|walkaround|demonstration|footage/i.test(all) || a.category === 'Videos'
    },
    // Alias hubs for existing navigation compatibility
    'bull-machines': {
      slug: 'bull-machines',
      title: 'Bull Machines',
      group: 'OEM Hubs',
      description: 'Official announcements, backhoe loader updates, attachment launches and verified reports related to Bull Machines.',
      matcher: (a) => /bull machines/i.test(a.manufacturer || '') || a.category === 'Bull Machines'
    },
    'brands': {
      slug: 'brands',
      title: 'Brands & Manufacturers',
      group: 'OEM Hubs',
      description: 'News, specifications and product updates from global construction equipment and commercial vehicle OEMs.',
      matcher: (a) => Boolean(a.manufacturer)
    },
    'regions': {
      slug: 'regions',
      title: 'Global & Regional Desk',
      group: 'OEM Hubs',
      description: 'Equipment, agricultural machinery and commercial vehicle coverage across India, Asia-Pacific, Europe and North America.',
      matcher: (a) => Boolean(a.country || a.region)
    }
  };

  // Alias map so legacy slugs (`equipment`, `commercial-vehicles`, `industry`) resolve cleanly
  const DESK_ALIASES = {
    'equipment': 'construction-equipment',
    'commercial-vehicles': 'heavy-trucks',
    'industry': 'business'
  };

  function resolveDeskSlug(rawSlug) {
    const clean = String(rawSlug || '').toLowerCase().trim();
    const mapped = DESK_ALIASES[clean] || clean;
    return CATEGORY_DESKS[mapped] ? mapped : 'construction-equipment';
  }

  function articleUrl(slug) {
    return `/news/${encodeURIComponent(slug)}`;
  }

  function categoryUrl(slug) {
    return `/category/${encodeURIComponent(slug)}`;
  }

  function makeClientSlug(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function manufacturerUrl(slugOrName) {
    const clean = makeClientSlug(slugOrName);
    const alias = {
      'volvo': 'volvo-construction-equipment',
      'tata': 'tata-motors',
      'bull': 'bull-machines'
    };
    const resolved = alias[clean] || clean;
    if (!resolved || ['all-manufacturers', 'various'].includes(resolved)) return '/manufacturers';
    return `/manufacturers/${encodeURIComponent(resolved)}`;
  }

  function modelUrl(slugOrName, manufacturerName = '') {
    const clean = makeClientSlug(slugOrName);
    if (!clean || ['full-lineup', 'multi-brand-comparison'].includes(clean)) return '/models';
    return `/models/${encodeURIComponent(clean)}`;
  }

  const REGIONAL_HUBS = {
    'india': {
      slug: 'india',
      title: 'India & South Asia',
      shortName: 'India',
      countries: ['India'],
      regions: ['India', 'Asia-Pacific'],
      currency: 'INR (₹ / Crore)',
      units: 'Metric (tonnes, kW / hp, metres)',
      regulations: 'CEV Stage V (Construction Equipment) & BS-VI Phase 2 (Commercial Vehicles)',
      terminology: 'Backhoe Loaders, Multi-Axle Tippers (28T–55T GVW), Pick-and-Carry Cranes, Tractor Implements',
      events: 'EXCON (Bengaluru), Bauma CONEXPO INDIA (Greater Noida)',
      description: 'Backhoe loaders, excavators, multi-axle tipper trucks, tractor attachments and highway infrastructure intelligence across India and South Asia.'
    },
    'north-america': {
      slug: 'north-america',
      title: 'United States & North America',
      shortName: 'North America',
      countries: ['United States', 'Canada', 'Mexico', 'North America'],
      regions: ['North America'],
      currency: 'USD ($) / CAD ($)',
      units: 'US Customary & Metric (lbs, short tons, hp, ft-lbs)',
      regulations: 'EPA Tier 4 Final (Off-Highway) & EPA 2027 / CARB ACT (Commercial Trucks)',
      terminology: 'Compact Track Loaders (CTLs), Skid-Steers, Class 7 & Class 8 Vocational Dump Trucks, Articulated Haulers',
      events: 'CONEXPO-CON/AGG (Las Vegas), World of Concrete, ACT Expo, Utility Expo (Louisville)',
      description: 'Earthmoving machinery, compact track loaders, Class 8 vocational trucks, powertrains and dealer fleet coverage across the United States, Canada and Mexico.'
    },
    'europe': {
      slug: 'europe',
      title: 'Europe (EU, UK & EEA)',
      shortName: 'Europe',
      countries: ['Germany', 'United Kingdom', 'Sweden', 'France', 'Italy', 'Europe'],
      regions: ['Europe'],
      currency: 'EUR (€) / GBP (£)',
      units: 'Metric (tonnes, kW, Nm, metres)',
      regulations: 'EU Stage V (Non-Road Mobile Machinery) & Euro 6e / Euro 7 (Heavy-Duty Vehicles)',
      terminology: 'Wheeled Excavators, Tiltrotators, Compact Electric Loaders, 8x4 Rigid Tippers, Telehandlers',
      events: 'Bauma (Munich), IAA Transportation (Hannover), Intermat (Paris), PlantWorx (UK)',
      description: 'Stage V construction machinery, zero-emission urban worksite equipment, tiltrotators and heavy commercial vehicles across European markets.'
    },
    'china': {
      slug: 'china',
      title: 'China',
      shortName: 'China',
      countries: ['China'],
      regions: ['China'],
      currency: 'CNY (¥ / RMB)',
      units: 'Metric (tonnes, kW, metres)',
      regulations: 'China NRMM Stage IV (Off-Highway) & China VI-b / NEV Mandates (Commercial Trucks)',
      terminology: 'Battery-Electric Wheel Loaders, NEV Heavy Mining Dump Trucks, Ultra-Large Tonnage All-Terrain Cranes',
      events: 'bauma CHINA (Shanghai), BICES (Beijing)',
      description: 'Chinese OEM machinery launches, battery-electric wheel loaders, mega-tonnage cranes, NEV mining haulers and global export developments.'
    },
    'japan-south-korea': {
      slug: 'japan-south-korea',
      title: 'Japan & South Korea',
      shortName: 'Japan & Korea',
      countries: ['Japan', 'South Korea'],
      regions: ['Japan & South Korea'],
      currency: 'JPY (¥) / KRW (₩)',
      units: 'Metric (tonnes, kW, metres)',
      regulations: 'MLIT Off-Road Act (Japan) & KMOE Stage V Equivalent (South Korea)',
      terminology: 'Zero-Tail-Swing Mini & Hydraulic Excavators, ICT Smart Construction, Hybrid Earthmoving',
      events: 'CSPI-EXPO (Chiba, Japan), CONEX Korea (Seoul)',
      description: 'Precision hydraulic excavators, compact equipment, automated i-Construction grading systems and commercial vehicles from Japan and South Korea.'
    },
    'middle-east': {
      slug: 'middle-east',
      title: 'Middle East & GCC',
      shortName: 'Middle East',
      countries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Middle East'],
      regions: ['Middle East', 'Middle East & Africa'],
      currency: 'AED / SAR / USD ($)',
      units: 'Metric (tonnes, kW, metres)',
      regulations: 'GSO Euro V / VI Heavy Vehicle Standards & High-Ambient Desert Cooling Specs',
      terminology: 'Tower & Heavy Crawler Cranes, 50°C High-Ambient Excavators, Sand & Quarry Articulated Tippers',
      events: 'Big 5 Global Heavy (Dubai), Saudi Infrastructure Expo (Riyadh)',
      description: 'Heavy crawler and tower cranes, high-ambient earthmoving fleets and vocational tipper trucks across Saudi Arabia, the UAE and GCC infrastructure projects.'
    },
    'southeast-asia': {
      slug: 'southeast-asia',
      title: 'Southeast Asia (ASEAN)',
      shortName: 'Southeast Asia',
      countries: ['Indonesia', 'Thailand', 'Vietnam', 'Malaysia', 'Philippines', 'Singapore'],
      regions: ['Southeast Asia'],
      currency: 'IDR / THB / VND / MYR / USD',
      units: 'Metric (tonnes, kW, metres)',
      regulations: 'ASEAN Euro 4 / Euro 5 Diesel & Biofuel (B35) Powertrain Compatibility',
      terminology: '20-Tonne Class Forestry & Mining Excavators, Nickel/Coal Overburden Tipper Trucks, Ag Tractors',
      events: 'Mining Indonesia (Jakarta), CONSTECH Thailand (Bangkok), Philconstruct (Manila)',
      description: 'Mining excavators, plantation tractors, biofuel-ready haul trucks and civil infrastructure machinery across Indonesia, Thailand, Vietnam and ASEAN.'
    },
    'australia': {
      slug: 'australia',
      title: 'Australia & Oceania',
      shortName: 'Australia',
      countries: ['Australia', 'New Zealand'],
      regions: ['Australia'],
      currency: 'AUD (A$) / NZD (NZ$)',
      units: 'Metric (tonnes, kW, metres, GCM)',
      regulations: 'ADR 80/04 (Euro VI Heavy Trucks) & Autonomous Mining Haulage Safety Standards (MDG)',
      terminology: 'Autonomous Haulage Systems (AHS), Multi-Combination Road Trains, Ultra-Class Mining Shovels',
      events: 'AIMEX (Sydney), National Diesel Dirt & Turf Expo, Brisbane Truck Show',
      description: 'Autonomous mining haulage systems, ultra-class excavators, road-train prime movers and civil earthmoving across Australia and New Zealand.'
    },
    'latin-america': {
      slug: 'latin-america',
      title: 'Latin America',
      shortName: 'Latin America',
      countries: ['Brazil', 'Chile', 'Argentina', 'Mexico', 'Peru', 'Colombia'],
      regions: ['Latin America'],
      currency: 'BRL (R$) / CLP / MXN / USD',
      units: 'Metric (tonnes, kW, cv / hp)',
      regulations: 'PROCONVE MAR-I (Off-Road) & PROCONVE P8 / Euro 6 (Commercial Trucks in Brazil)',
      terminology: 'Copper & Lithium Mining Haul Trucks, High-Horsepower Row-Crop Tractors, Bi-Train Vocational Trucks',
      events: 'M&T Expo (São Paulo), EXPOMIN (Santiago, Chile), Agrishow (Ribeirão Preto)',
      description: 'Andean copper and lithium mining machinery, Brazilian agribusiness tractors, bi-train heavy trucks and infrastructure fleets across Latin America.'
    },
    'africa': {
      slug: 'africa',
      title: 'Africa',
      shortName: 'Africa',
      countries: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Zambia'],
      regions: ['Africa'],
      currency: 'ZAR (R) / NGN / KES / EGP / USD',
      units: 'Metric (tonnes, kW, metres)',
      regulations: 'Regional Sulphur-Tolerant Tier 2 / Tier 3 & Euro II–V Fleet Specifications',
      terminology: 'Articulated Dump Trucks (ADTs), Open-Pit Mining Excavators, Ruggedized 6x4 Tippers & Utility Backhoes',
      events: 'bauma CONEXPO AFRICA (Johannesburg), Investing in African Mining Indaba (Cape Town)',
      description: 'Articulated dump trucks, open-pit mining shovels, ruggedized 6x4 tippers and utility backhoe loaders across Southern, West, East and North Africa.'
    }
  };

  const REGION_ALIASES = {
    'united-states': 'north-america',
    'usa': 'north-america',
    'us': 'north-america',
    'japan-and-south-korea': 'japan-south-korea',
    'japan-korea': 'japan-south-korea',
    'japan': 'japan-south-korea',
    'south-korea': 'japan-south-korea',
    'asean': 'southeast-asia',
    'oceania': 'australia',
    'latam': 'latin-america',
    'mena': 'middle-east',
    'asia-pacific': 'india'
  };

  function resolveRegionSlug(raw) {
    const clean = String(raw || '').toLowerCase().trim().replace(/^\/+|\/+$/g, '');
    const mapped = REGION_ALIASES[clean] || clean;
    return REGIONAL_HUBS[mapped] ? mapped : 'india';
  }

  function regionUrl(slug) {
    const resolved = resolveRegionSlug(slug);
    return `/${encodeURIComponent(resolved)}/`;
  }

  function safeHttpUrl(url) {
    try {
      const u = new URL(url);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  }

  function responsiveUnsplashSrcset(url) {
    const safe = safeHttpUrl(url);
    if (!safe || !safe.includes('images.unsplash.com')) return '';
    const base = safe.replace(/([?&])w=\d+/, '$1w=800');
    const w480 = base.replace(/([?&])w=\d+/, '$1w=480');
    const w800 = base.replace(/([?&])w=\d+/, '$1w=800');
    const w1200 = base.replace(/([?&])w=\d+/, '$1w=1200');
    return `${esc(w480)} 480w, ${esc(w800)} 800w, ${esc(w1200)} 1200w`;
  }

  function formatDate(d, longMonth = false) {
    if (!d) return 'Unpublished';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return 'Unpublished';
    return date.toLocaleDateString('en-US', {
      month: longMonth ? 'long' : 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function renderBrandPlaceholder(subtitle = 'THE WORLD OF MACHINES. CONNECTED.') {
    return `<div class="image-placeholder" role="img" aria-label="MachineWire editorial placeholder">
      <span>MACHINE<span>WIRE</span></span>
      <small>${esc(subtitle)}</small>
    </div>`;
  }

  function renderEditorialImage({
    url,
    alt,
    credit = '',
    aspect = 'card', // 'hero' (16:9) or 'card' (4:3)
    lazy = true,
    showCreditBadge = false
  }) {
    const safe = safeHttpUrl(url);
    const label = alt || 'Construction equipment and commercial vehicle photograph';
    if (!safe) {
      return renderBrandPlaceholder();
    }
    const srcset = responsiveUnsplashSrcset(safe);
    const sizes = aspect === 'hero'
      ? '(max-width: 1024px) 100vw, 820px'
      : '(max-width: 680px) 100vw, (max-width: 1024px) 50vw, 400px';
    const loadingAttr = lazy ? 'loading="lazy" decoding="async"' : ' fetchpriority="high" decoding="async"';
    const creditBadge = showCreditBadge && credit
      ? `<span class="card-image-credit" title="Image credit: ${esc(credit)}">${esc(credit)}</span>`
      : '';
    return `<img
      src="${esc(safe)}"
      ${srcset ? `srcset="${srcset}" sizes="${sizes}"` : ''}
      alt="${esc(label)}"
      ${loadingAttr}
      onerror="this.outerHTML='<div class=\\'image-placeholder\\'><span>MACHINE<span>WIRE</span></span><small>THE WORLD OF MACHINES. CONNECTED.</small></div>'"
    >${creditBadge}`;
  }

  function renderArticleCard(a, options = {}) {
    const lazy = options.lazy !== false;
    const typeBadge = ARTICLE_TYPE_LABELS[a.articleType] || 'News Report';
    const locationMeta = a.country && a.country !== 'Global' ? ` · ${esc(a.country)}` : '';
    const summaryText = a.summary || a.excerpt || '';
    const href = articleUrl(a.slug);
    const credit = a.imageCredit || (a.image ? 'Editorial / OEM Handout' : '');

    return `<article class="article-card">
      <a class="card-image" href="${href}" aria-label="${esc(a.title)}">
        ${renderEditorialImage({
          url: a.image,
          alt: `${a.title} — ${a.manufacturer || 'MachineWire'}`,
          credit,
          aspect: 'card',
          lazy,
          showCreditBadge: true
        })}
        <span class="image-category">${esc(a.category || 'Industry News')}</span>
      </a>
      <div class="card-copy">
        <div class="card-meta">
          <span>${esc(a.manufacturer || 'Industry Desk')}${locationMeta}</span>
          ${a.publishedAt ? `<time datetime="${esc(a.publishedAt)}">${formatDate(a.publishedAt)}</time>` : ''}
        </div>
        <h3><a href="${href}">${esc(a.title)}</a></h3>
        <p>${esc(summaryText)}</p>
        <div class="card-read">
          <span class="type-pill">${esc(typeBadge)}</span>
          <a href="${href}">Read report <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>`;
  }

  function renderPagination({ totalItems, pageSize, currentPage }) {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return '';
    const buttons = [];
    buttons.push(
      `<button type="button" class="page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Previous page">← Prev</button>`
    );
    for (let p = 1; p <= totalPages; p++) {
      buttons.push(
        `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}" aria-current="${p === currentPage ? 'page' : 'false'}">${p}</button>`
      );
    }
    buttons.push(
      `<button type="button" class="page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Next page">Next →</button>`
    );
    return `<nav class="pagination" aria-label="Article pagination">${buttons.join('')}</nav>`;
  }

  function setJsonLd(id, dataObj) {
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(dataObj);
  }

  /**
   * Pagination SEO Rules:
   * - Updates canonical URL (`?page=N` when N > 1)
   * - Appends `— Page N` to document.title when N > 1
   * - Injects/updates `<link rel="prev">` and `<link rel="next">` in `<head>`
   * - Updates browser URL bar via `history.replaceState` when navigating pages
   */
  function applyPaginationSeo({ currentPage, totalPages, baseUrl, baseTitle }) {
    const cleanBase = baseUrl || `${location.origin}${location.pathname}`;
    const pageNum = Math.max(1, Number(currentPage) || 1);
    const total = Math.max(1, Number(totalPages) || 1);

    const canonicalEl = document.getElementById('canonical-link');
    const pageCanonical = pageNum > 1 ? `${cleanBase}?page=${pageNum}` : cleanBase;
    if (canonicalEl) {
      canonicalEl.href = pageCanonical;
    }

    if (baseTitle) {
      document.title = pageNum > 1 ? `${baseTitle} — Page ${pageNum}` : baseTitle;
    }

    let prevLink = document.getElementById('pagination-prev-link');
    if (pageNum > 1) {
      if (!prevLink) {
        prevLink = document.createElement('link');
        prevLink.id = 'pagination-prev-link';
        prevLink.rel = 'prev';
        document.head.appendChild(prevLink);
      }
      prevLink.href = pageNum === 2 ? cleanBase : `${cleanBase}?page=${pageNum - 1}`;
    } else if (prevLink) {
      prevLink.remove();
    }

    let nextLink = document.getElementById('pagination-next-link');
    if (pageNum < total) {
      if (!nextLink) {
        nextLink = document.createElement('link');
        nextLink.id = 'pagination-next-link';
        nextLink.rel = 'next';
        document.head.appendChild(nextLink);
      }
      nextLink.href = `${cleanBase}?page=${pageNum + 1}`;
    } else if (nextLink) {
      nextLink.remove();
    }
  }

  /**
   * Renders article body text with semantic headings (`<h2>` / `<h3>`),
   * bullet lists (`<ul><li>`), bold text (`<strong>`), and safe internal/external links (`[Anchor](url)`).
   */
  function renderInlineFormatting(escapedLine) {
    return escapedLine
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawHref) => {
        const cleanHref = String(rawHref || '').trim();
        if (cleanHref.startsWith('/') || cleanHref.startsWith('http://') || cleanHref.startsWith('https://')) {
          const isExternal = cleanHref.startsWith('http');
          return `<a class="text-link" href="${cleanHref}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
        }
        return label;
      });
  }

  function renderFormattedBody(rawText = '') {
    const blocks = String(rawText || '').split(/\n\s*\n/);
    return blocks.map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('### ')) {
        const headingText = renderInlineFormatting(esc(trimmed.replace(/^###\s+/, '')));
        return `<h2 class="article-subheading">${headingText}</h2>`;
      }
      if (trimmed.startsWith('## ')) {
        const headingText = renderInlineFormatting(esc(trimmed.replace(/^##\s+/, '')));
        return `<h2 class="article-subheading">${headingText}</h2>`;
      }
      const lines = trimmed.split('\n');
      if (lines.every(l => l.trim().startsWith('- '))) {
        const items = lines
          .map(l => `<li>${renderInlineFormatting(esc(l.trim().replace(/^-\s+/, '')))}</li>`)
          .join('');
        return `<ul class="article-list">${items}</ul>`;
      }
      const formattedLines = lines.map(l => renderInlineFormatting(esc(l))).join('<br>');
      return `<p>${formattedLines}</p>`;
    }).join('');
  }

  function trackTelemetry(payload = {}) {
    if (!payload || !payload.type) return;
    fetch('/api/analytics/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  // Bootstrap configurable search console verification & optional analytics metadata if credentials exist
  if (typeof document !== 'undefined') {
    fetch('/api/analytics/config')
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (!cfg) return;
        if (cfg.googleSearchConsole?.enabled && cfg.googleSearchConsole?.verificationCode) {
          let meta = document.querySelector('meta[name="google-site-verification"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'google-site-verification';
            document.head.appendChild(meta);
          }
          meta.content = cfg.googleSearchConsole.verificationCode;
        }
      })
      .catch(() => {});
  }

  global.MWComponents = {
    esc,
    ARTICLE_TYPE_LABELS,
    CATEGORY_DESKS,
    REGIONAL_HUBS,
    resolveDeskSlug,
    resolveRegionSlug,
    articleUrl,
    categoryUrl,
    regionUrl,
    manufacturerUrl,
    modelUrl,
    safeHttpUrl,
    formatDate,
    renderBrandPlaceholder,
    renderEditorialImage,
    renderArticleCard,
    renderPagination,
    setJsonLd,
    applyPaginationSeo,
    renderFormattedBody,
    trackTelemetry
  };
})(window);
