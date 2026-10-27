const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const models = require('./models.js');
const seoLib = require('./seo.js');

const CURRENT_SCHEMA_VERSION = 2;

const DEFAULT_REGIONS = [
  { name: 'Global', slug: 'global', description: 'Worldwide construction equipment and commercial vehicle markets.' },
  { name: 'India', slug: 'india', description: 'South Asian earthmoving, backhoe loader, tipper truck and highway infrastructure hub.' },
  { name: 'North America', slug: 'north-america', description: 'United States, Canada and Mexico heavy equipment and vocational truck markets.' },
  { name: 'Europe', slug: 'europe', description: 'European Union, UK and EEA Stage V machinery and commercial transport markets.' },
  { name: 'China', slug: 'china', description: 'Chinese domestic and export OEM manufacturing, electrification and mega-project machinery.' },
  { name: 'Japan & South Korea', slug: 'japan-south-korea', description: 'East Asian precision hydraulics, excavator, compact equipment and commercial vehicle OEMs.' },
  { name: 'Middle East', slug: 'middle-east', description: 'GCC giga-projects, desert earthmoving, crane fleets and heavy haulage markets.' },
  { name: 'Southeast Asia', slug: 'southeast-asia', description: 'ASEAN mining, plantation agriculture, civil construction and tipper fleet markets.' },
  { name: 'Australia', slug: 'australia', description: 'Oceania iron-ore and coal mining haulage, road-train transport and civil earthmoving.' },
  { name: 'Latin America', slug: 'latin-america', description: 'South and Central American mining, agribusiness tractor and highway machinery markets.' },
  { name: 'Africa', slug: 'africa', description: 'Pan-African mining corridors, port infrastructure, utility tractors and vocational trucks.' },
  { name: 'Asia-Pacific', slug: 'asia-pacific', description: 'Broader Asia-Pacific industrial and machinery trade corridor.' }
];

const DEFAULT_COUNTRIES = [
  { name: 'Global', isoCode: 'GLB', region: 'Global' },
  { name: 'India', isoCode: 'IND', region: 'India' },
  { name: 'United States', isoCode: 'USA', region: 'North America' },
  { name: 'Canada', isoCode: 'CAN', region: 'North America' },
  { name: 'Mexico', isoCode: 'MEX', region: 'North America' },
  { name: 'China', isoCode: 'CHN', region: 'China' },
  { name: 'Japan', isoCode: 'JPN', region: 'Japan & South Korea' },
  { name: 'South Korea', isoCode: 'KOR', region: 'Japan & South Korea' },
  { name: 'Germany', isoCode: 'DEU', region: 'Europe' },
  { name: 'United Kingdom', isoCode: 'GBR', region: 'Europe' },
  { name: 'Sweden', isoCode: 'SWE', region: 'Europe' },
  { name: 'France', isoCode: 'FRA', region: 'Europe' },
  { name: 'Italy', isoCode: 'ITA', region: 'Europe' },
  { name: 'United Arab Emirates', isoCode: 'ARE', region: 'Middle East' },
  { name: 'Saudi Arabia', isoCode: 'SAU', region: 'Middle East' },
  { name: 'Indonesia', isoCode: 'IDN', region: 'Southeast Asia' },
  { name: 'Thailand', isoCode: 'THA', region: 'Southeast Asia' },
  { name: 'Vietnam', isoCode: 'VNM', region: 'Southeast Asia' },
  { name: 'Australia', isoCode: 'AUS', region: 'Australia' },
  { name: 'Brazil', isoCode: 'BRA', region: 'Latin America' },
  { name: 'Chile', isoCode: 'CHL', region: 'Latin America' },
  { name: 'South Africa', isoCode: 'ZAF', region: 'Africa' },
  { name: 'Europe', isoCode: 'EUR', region: 'Europe' },
  { name: 'North America', isoCode: 'NAM', region: 'North America' }
];

const DEFAULT_CATEGORIES = [
  { name: 'Industry News', section: 'business', description: 'Infrastructure, manufacturing, exports and market intelligence.' },
  { name: 'Bull Machines', section: 'bull-machines', description: 'Official announcements and product coverage related to Bull Machines.' },
  { name: 'Construction Equipment', section: 'construction-equipment', description: 'Earthmoving, lifting, roadbuilding and heavy construction machinery.' },
  { name: 'Backhoe Loaders', section: 'backhoe-loaders', description: 'Center-pivot and sideshift backhoe loader launches and upgrades.' },
  { name: 'Excavators', section: 'excavators', description: 'Crawler, wheeled, midi and mini excavators across global markets.' },
  { name: 'Wheel Loaders', section: 'wheel-loaders', description: 'Articulated and compact wheel loaders for quarries and civil works.' },
  { name: 'Bulldozers', section: 'bulldozers', description: 'Crawler dozers and grade-control earthmoving tractors.' },
  { name: 'Cranes', section: 'cranes', description: 'Mobile, crawler, rough-terrain, tower and pick-and-carry cranes.' },
  { name: 'Graders', section: 'graders', description: 'Motor graders for highway construction, haul roads and fine grading.' },
  { name: 'Telehandlers', section: 'telehandlers', description: 'Telescopic handlers for construction and agricultural material handling.' },
  { name: 'Roadbuilding', section: 'roadbuilding', description: 'Asphalt pavers, soil compactors, tandem rollers and cold planers.' },
  { name: 'Mining Equipment', section: 'mining-equipment', description: 'Rigid haul trucks, hydraulic mining shovels, drills and quarry machinery.' },
  { name: 'Compact Equipment', section: 'compact-equipment', description: 'Skid-steer loaders, compact track loaders and mini excavators.' },
  { name: 'Attachments', section: 'attachments', description: 'Hydraulic breakers, buckets, quick couplers, augers and tractor attachments.' },
  { name: 'Tractors', section: 'tractors', description: 'Utility, row-crop and heavy-duty tractors for agriculture and worksites.' },
  { name: 'Agricultural Machinery', section: 'agricultural-machinery', description: 'Harvesters, implements, radial loaders and farm mechanization.' },
  { name: 'Commercial Vehicles', section: 'heavy-trucks', description: 'Heavy tippers, vocational chassis, prime movers and fleet trucks.' },
  { name: 'Heavy Trucks', section: 'heavy-trucks', description: 'Multi-axle tippers, rigid haulers, tractor-trailers and vocational trucks.' },
  { name: 'Pickups', section: 'pickups', description: '4x4 utility pickups, crew-cab site vehicles and light commercial fleets.' },
  { name: 'Vans', section: 'vans', description: 'Panel vans, service body vehicles and urban delivery fleets.' },
  { name: 'Buses', section: 'buses', description: 'Transit buses, staff coaches and electric passenger transport.' },
  { name: 'Electric Commercial Vehicles', section: 'electric-commercial-vehicles', description: 'Battery-electric, hydrogen fuel-cell and zero-emission trucks, vans and buses.' },
  { name: 'New Launches', section: 'construction-equipment', description: 'New construction machinery and commercial vehicle model releases.' },
  { name: 'Technology', section: 'technology', description: 'Hydraulics, telematics, Stage V/CEV-V engines, AI and electrification.' },
  { name: 'Business', section: 'business', description: 'Corporate strategy, plant investments, exports and market developments.' },
  { name: 'Buying Guides', section: 'guides', description: 'Specification checklists, maintenance explainers and TCO guides.' },
  { name: 'Market Updates', section: 'business', description: 'Financial results, plant investments and regional sales trends.' },
  { name: 'Projects', section: 'projects', description: 'Major highway, railway, port, mining and civil infrastructure deployments.' },
  { name: 'Events & Exhibitions', section: 'events', description: 'EXCON, Bauma, CONEXPO-CON/AGG and IAA Transportation coverage.' },
  { name: 'Videos', section: 'videos', description: 'Walkaround machine briefings, worksite demonstrations and exhibition footage.' },
  { name: 'Reviews & Comparisons', section: 'reviews', description: 'Specification-led machine and truck evaluations.' },
  { name: 'Industry & Business', section: 'business', description: 'Corporate strategy, dealer networks and supply chain news.' }
];

const DEFAULT_MANUFACTURERS = [
  {
    name: 'BULL Machines',
    slug: 'bull-machines',
    country: 'India',
    headquarters: 'Coimbatore, Tamil Nadu, India',
    website: 'https://bullmachines.com/',
    focus: 'Backhoe loaders, construction equipment, skid-steer loaders & tractor attachments',
    overview: 'BULL Machines Pvt. Ltd. is an Indian construction equipment and agricultural attachment manufacturer headquartered in Coimbatore, Tamil Nadu. The company designs and manufactures backhoe loaders, skid-steer loaders, wheel loaders, telehandlers, and tractor-mounted front-end loader and backhoe attachments for domestic infrastructure, rural engineering, and international export markets.',
    equipmentCategories: ['Backhoe Loaders', 'Compact Equipment', 'Wheel Loaders', 'Telehandlers', 'Attachments', 'Tractors'],
    technologyHighlights: [
      'CEV Stage IV / Stage V compliant earthmoving diesel powertrains',
      'Smart hydraulic load-distribution and fuel-economy modes on backhoe loader platforms',
      'Quick-attach tractor loader and radial backhoe implement engineering'
    ],
    regionalFootprint: ['India', 'Middle East', 'Africa', 'Southeast Asia', 'Latin America'],
    officialSources: ['https://bullmachines.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'JCB',
    slug: 'jcb',
    country: 'United Kingdom',
    headquarters: 'Rocester, Staffordshire, United Kingdom',
    website: 'https://www.jcb.com/',
    focus: 'Backhoe loaders, excavators, telehandlers, wheel loaders & site dumpers',
    overview: 'J.C. Bamford Excavators Limited (JCB) is a British multinational manufacturer of earthmoving, construction, agricultural, and material-handling equipment founded in 1945. Headquartered in Rocester, Staffordshire, JCB operates major manufacturing plants across the United Kingdom, India (Ballabgarh, Pune, Jaipur, Vadodara), North America, and Brazil.',
    equipmentCategories: ['Backhoe Loaders', 'Excavators', 'Telehandlers', 'Wheel Loaders', 'Compact Equipment', 'Tractors'],
    technologyHighlights: [
      'JCB LiveLink fleet telematics and remote diagnostics architecture',
      'E-TECH battery-electric compact excavators, telehandlers, and site dumpers',
      'Hydrogen internal combustion engine (H2 ICE) development for off-highway machinery'
    ],
    regionalFootprint: ['Europe', 'India', 'North America', 'Middle East', 'Australia', 'Latin America'],
    officialSources: ['https://www.jcb.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Caterpillar',
    slug: 'caterpillar',
    country: 'United States',
    headquarters: 'Irving, Texas, United States',
    website: 'https://www.caterpillar.com/',
    focus: 'Earthmoving, mining, roadbuilding, bulldozers, excavators & industrial power systems',
    overview: 'Caterpillar Inc. is a global manufacturer of construction and mining equipment, off-highway diesel and natural gas engines, industrial gas turbines, and diesel-electric locomotives. Through its global Cat dealer network, the company supplies excavators, crawler dozers, wheel loaders, motor graders, articulated trucks, and ultra-class mining haulers.',
    equipmentCategories: ['Excavators', 'Bulldozers', 'Wheel Loaders', 'Graders', 'Backhoe Loaders', 'Mining Equipment', 'Roadbuilding', 'Compact Equipment'],
    technologyHighlights: [
      'Cat Command remote and autonomous haulage and dozing systems',
      'Cat Grade 2D/3D factory-integrated electro-hydraulic grade control',
      'VisionLink mixed-fleet telematics and Condition Monitoring services'
    ],
    regionalFootprint: ['North America', 'Europe', 'China', 'Australia', 'Latin America', 'Middle East', 'India', 'Africa'],
    officialSources: ['https://www.caterpillar.com/', 'https://www.cat.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Komatsu',
    slug: 'komatsu',
    country: 'Japan',
    headquarters: 'Minato-ku, Tokyo, Japan',
    website: 'https://www.komatsu.com/',
    focus: 'Hydraulic excavators, bulldozers, wheel loaders, motor graders & rigid mining dump trucks',
    overview: 'Komatsu Ltd., founded in 1921 and headquartered in Tokyo, Japan, is one of the world’s largest manufacturers of construction, mining, forestry, and utility equipment. Komatsu develops in-house engines, closed-center load-sensing hydraulic components, axles, and autonomous mining haulage systems.',
    equipmentCategories: ['Excavators', 'Bulldozers', 'Wheel Loaders', 'Mining Equipment', 'Graders', 'Compact Equipment'],
    technologyHighlights: [
      'Smart Construction digital worksite and Intelligent Machine Control (iMC 2.0)',
      'Autonomous Haulage System (AHS) FrontRunner for surface mining dump trucks',
      'KOMTRAX satellite and cellular machine health monitoring'
    ],
    regionalFootprint: ['Japan & South Korea', 'North America', 'Europe', 'Southeast Asia', 'Australia', 'China', 'India', 'Latin America'],
    officialSources: ['https://www.komatsu.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Volvo Construction Equipment',
    slug: 'volvo-construction-equipment',
    country: 'Sweden',
    headquarters: 'Eskilstuna / Gothenburg, Sweden',
    website: 'https://www.volvoce.com/',
    focus: 'Articulated haulers, wheel loaders, excavators, road compactors & electric machinery',
    overview: 'Volvo Construction Equipment (Volvo CE), part of the Volvo Group, is a Swedish manufacturer of articulated haulers, wheel loaders, hydraulic excavators, and roadbuilding machinery. Alongside Volvo Trucks, the group covers heavy earthmoving, quarry haulage, and commercial vocational transport.',
    equipmentCategories: ['Excavators', 'Wheel Loaders', 'Mining Equipment', 'Roadbuilding', 'Compact Equipment', 'Heavy Trucks', 'Electric Commercial Vehicles'],
    technologyHighlights: [
      'Articulated hauler driveline engineering and OptiShift torque-converter lockup',
      'Commercial battery-electric compact and mid-size excavators and wheel loaders',
      'Volvo ActiveCare Direct telematics and Co-Pilot on-board weighing/dig assist'
    ],
    regionalFootprint: ['Europe', 'North America', 'China', 'Japan & South Korea', 'India', 'Middle East', 'Australia', 'Latin America'],
    officialSources: ['https://www.volvoce.com/', 'https://www.volvotrucks.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'CASE',
    slug: 'case',
    country: 'United States',
    headquarters: 'Racine, Wisconsin, United States',
    website: 'https://www.casece.com/',
    focus: 'Backhoe loaders, vibratory compactors, motor graders, skid-steer loaders & excavators',
    overview: 'CASE Construction Equipment, a brand of CNH Industrial founded in 1842 in Racine, Wisconsin, manufactures loader backhoes, excavators, motor graders, wheel loaders, vibratory soil and asphalt compactors, crawler dozers, and compact track loaders across North America, Europe, India (Pithampur), and Latin America.',
    equipmentCategories: ['Backhoe Loaders', 'Roadbuilding', 'Excavators', 'Wheel Loaders', 'Graders', 'Compact Equipment', 'Bulldozers'],
    technologyHighlights: [
      'Integrated factory loader-backhoe geometry and Pro Control swing dampening',
      'CASE SiteWatch telematics and SiteConnect remote dealer diagnostics',
      'Soil and tandem vibratory compaction technologies for highway corridors'
    ],
    regionalFootprint: ['North America', 'Europe', 'India', 'Latin America', 'Middle East', 'Africa'],
    officialSources: ['https://www.casece.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'John Deere',
    slug: 'john-deere',
    country: 'United States',
    headquarters: 'Moline, Illinois, United States',
    website: 'https://www.deere.com/',
    focus: 'Tractors, agricultural machinery, backhoe loaders, motor graders, crawler dozers & forestry',
    overview: 'Deere & Company (John Deere), headquartered in Moline, Illinois, is a leading global manufacturer of agricultural tractors, harvesting machinery, construction earthmoving equipment, roadbuilding machinery (via the Wirtgen Group), and commercial power systems.',
    equipmentCategories: ['Tractors', 'Agricultural Machinery', 'Backhoe Loaders', 'Graders', 'Bulldozers', 'Wheel Loaders', 'Excavators', 'Compact Equipment'],
    technologyHighlights: [
      'John Deere Operations Center & JDLink cloud telematics for agriculture and construction',
      'SmartGrade mastless 3D grade control on crawler dozers and motor graders',
      'E-Drive hybrid-electric and autonomous tillage/tractor guidance systems'
    ],
    regionalFootprint: ['North America', 'Latin America', 'Europe', 'India', 'Australia'],
    officialSources: ['https://www.deere.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Kubota',
    slug: 'kubota',
    country: 'Japan',
    headquarters: 'Naniwa-ku, Osaka, Japan',
    website: 'https://www.kubota.com/',
    focus: 'Compact excavators, compact track loaders, utility tractors & industrial engines',
    overview: 'Kubota Corporation, founded in 1890 in Osaka, Japan, is a premier global manufacturer of compact construction equipment (mini excavators, track loaders, compact wheel loaders), utility and agricultural tractors, combine harvesters, and off-highway diesel and spark-ignited engines.',
    equipmentCategories: ['Compact Equipment', 'Excavators', 'Tractors', 'Agricultural Machinery', 'Wheel Loaders'],
    technologyHighlights: [
      'Zero-tail and ultra-tight tail-swing hydraulic mini excavator engineering',
      'Load-sensing 3-pump hydraulic systems for smooth simultaneous attachment operation',
      'Stage V / Tier 4 Final industrial diesel and hybrid powertrain platforms'
    ],
    regionalFootprint: ['Japan & South Korea', 'North America', 'Europe', 'Southeast Asia', 'India', 'Australia'],
    officialSources: ['https://www.kubota.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Mahindra',
    slug: 'mahindra',
    country: 'India',
    headquarters: 'Mumbai / Pune, Maharashtra, India',
    website: 'https://www.mahindraconstructionequipment.com/',
    focus: 'Tractors, backhoe loaders, motor graders, heavy commercial trucks & utility pickups',
    overview: 'Mahindra & Mahindra Ltd. (Farm Equipment, Construction Equipment, and Truck & Bus divisions), headquartered in Mumbai with manufacturing at Chakan (Pune), is the world’s largest tractor manufacturer by volume and produces EarthMaster backhoe loaders, RoadMaster motor graders, Blazo X heavy tippers, and 4x4 pickups.',
    equipmentCategories: ['Tractors', 'Agricultural Machinery', 'Backhoe Loaders', 'Graders', 'Heavy Trucks', 'Pickups'],
    technologyHighlights: [
      'DiGiSENSE cellular telematics for backhoe loaders, tractors, and commercial trucks',
      'mPower FuelSmart multi-mode diesel engines for heavy tippers and haulers',
      'Compact motor grader engineering tailored for rural and district road corridors'
    ],
    regionalFootprint: ['India', 'North America', 'Africa', 'Southeast Asia', 'Latin America'],
    officialSources: ['https://www.mahindraconstructionequipment.com/', 'https://www.mahindratruckandbus.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Tata Motors',
    slug: 'tata-motors',
    country: 'India',
    headquarters: 'Mumbai, Maharashtra, India',
    website: 'https://www.tatamotors.com/',
    focus: 'Heavy tipper trucks, prime movers, pickups, vans, transit buses & construction equipment',
    overview: 'Tata Motors Limited is India’s largest commercial vehicle manufacturer, producing Prima and Signa multi-axle tippers, tractor-trailers, light commercial pickups, vans, and electric transit buses. Through Tata Hitachi (a joint venture with Hitachi Construction Machinery), the group also serves the hydraulic excavator and wheel loader sectors.',
    equipmentCategories: ['Heavy Trucks', 'Pickups', 'Vans', 'Buses', 'Electric Commercial Vehicles', 'Excavators'],
    technologyHighlights: [
      'Tata Fleet Edge connected vehicle telematics and fuel-efficiency analytics',
      'Prima and Signa BS-VI Phase 2 heavy tipper chassis with hub-reduction axles',
      'Battery-electric and hydrogen fuel-cell commercial buses and urban logistics trucks'
    ],
    regionalFootprint: ['India', 'Africa', 'Middle East', 'Southeast Asia', 'Latin America'],
    officialSources: ['https://www.tatamotors.com/', 'https://cv.tatamotors.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'SANY',
    slug: 'sany',
    country: 'China',
    headquarters: 'Changsha, Hunan / Beijing, China',
    website: 'https://www.sanyglobal.com/',
    focus: 'Hydraulic excavators, mobile & crawler cranes, road machinery, port equipment & electric heavy trucks',
    overview: 'SANY Group is a Chinese multinational heavy machinery manufacturer with major R&D and manufacturing centers in Changsha, Kunshan, Beijing, Germany (Bedburg), India (Chakan, Pune), and the United States (Peachtree City, Georgia). SANY produces full-line hydraulic excavators, cranes, concrete pumps, road rollers, and battery-electric mining/port trucks.',
    equipmentCategories: ['Excavators', 'Cranes', 'Roadbuilding', 'Wheel Loaders', 'Mining Equipment', 'Electric Commercial Vehicles', 'Heavy Trucks'],
    technologyHighlights: [
      'Positive-flow and electronically controlled hydraulic excavator architectures',
      'Battery-electric heavy tippers, concrete mixers, and crawler cranes',
      'EVI cloud telematics and automated lighthouse manufacturing facilities'
    ],
    regionalFootprint: ['China', 'Southeast Asia', 'India', 'Middle East', 'Africa', 'Europe', 'Latin America', 'North America'],
    officialSources: ['https://www.sanyglobal.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'XCMG',
    slug: 'xcmg',
    country: 'China',
    headquarters: 'Xuzhou, Jiangsu, China',
    website: 'https://www.xcmg.com/',
    focus: 'All-terrain & crawler cranes, excavators, wheel loaders, road machinery & mining trucks',
    overview: 'Xuzhou Construction Machinery Group (XCMG), headquartered in Xuzhou, Jiangsu Province, China, is one of the top global construction machinery manufacturers, best known for ultra-tonnage mobile and crawler cranes, wheel loaders, roadbuilding machinery, hydraulic excavators, and mining haulage equipment.',
    equipmentCategories: ['Cranes', 'Excavators', 'Wheel Loaders', 'Roadbuilding', 'Mining Equipment', 'Graders', 'Electric Commercial Vehicles'],
    technologyHighlights: [
      'Ultra-large tonnage all-terrain and wind-power crawler crane engineering',
      'Battery-swap and pure-electric wheel loaders and mining dump trucks',
      'Xrea global industrial IoT fleet management platform'
    ],
    regionalFootprint: ['China', 'Southeast Asia', 'Middle East', 'Latin America', 'Africa', 'Europe', 'Australia'],
    officialSources: ['https://www.xcmg.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'HD Hyundai',
    slug: 'hd-hyundai',
    country: 'South Korea',
    headquarters: 'Bundang-gu, Seongnam / Seoul, South Korea',
    website: 'https://www.hd-hyundaice.com/',
    focus: 'Crawler & wheeled excavators, wheel loaders, articulated dump trucks & skid-steer loaders',
    overview: 'HD Hyundai Construction Equipment (part of HD Hyundai XiteSolution alongside Develon) is a South Korean manufacturer of crawler and wheeled hydraulic excavators, wheel loaders, backhoe loaders, and material-handling machinery with plants in Ulsan (South Korea), Pune (India), China, and Brazil.',
    equipmentCategories: ['Excavators', 'Wheel Loaders', 'Backhoe Loaders', 'Mining Equipment', 'Compact Equipment'],
    technologyHighlights: [
      'Hi MATE remote fleet management and AAVM 360-degree surround-view safety',
      'EPIC elektronically controlled independent pump hydraulic systems',
      'Hydrogen fuel-cell wheeled excavator and smart XiteCloud autonomous earthmoving'
    ],
    regionalFootprint: ['Japan & South Korea', 'North America', 'Europe', 'India', 'Middle East', 'Southeast Asia', 'Latin America'],
    officialSources: ['https://www.hd-hyundaice.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'Liebherr',
    slug: 'liebherr',
    country: 'Germany',
    headquarters: 'Bulle, Switzerland / Biberach an der Riß, Germany',
    website: 'https://www.liebherr.com/',
    focus: 'Mobile & crawler cranes, tower cranes, earthmoving excavators, wheel loaders & mining trucks',
    overview: 'The Liebherr Group, founded in 1949 in Kirchdorf an der Iller, Germany, and holding-headquartered in Bulle, Switzerland, is a family-owned technology and machinery manufacturer producing mobile, crawler, and tower cranes, hydrostatic wheel loaders, crawler dozers, and ultra-class mining excavators and trolley-assist haul trucks.',
    equipmentCategories: ['Cranes', 'Excavators', 'Wheel Loaders', 'Bulldozers', 'Mining Equipment', 'Telehandlers'],
    technologyHighlights: [
      'XPower power-split drivelines on large wheel loaders and hydrostatic crawler dozers',
      'LICCON3 crane control and VarioBase variable outrigger support technology',
      'Trolley-Assist electric mining haul trucks and hydrogen-injection internal combustion engines'
    ],
    regionalFootprint: ['Europe', 'North America', 'Australia', 'Middle East', 'Latin America', 'China', 'India'],
    officialSources: ['https://www.liebherr.com/'],
    verificationStatus: 'Initial Directory Candidate — Independent Editorial Coverage (No Partnership Claimed)'
  },
  {
    name: 'All Manufacturers',
    slug: 'all-manufacturers',
    country: 'Global',
    headquarters: 'Global Editorial Reference',
    website: '',
    focus: 'Cross-brand industry comparisons and buyer guides',
    overview: 'Cross-manufacturer reference category used by Machine Report World editors for multi-brand specification guides, exhibition calendars, and regulatory explainers.',
    equipmentCategories: ['Construction Equipment', 'Backhoe Loaders', 'Heavy Trucks', 'Buying Guides'],
    technologyHighlights: [],
    regionalFootprint: ['Global'],
    officialSources: [],
    verificationStatus: 'Editorial Reference Category'
  },
  {
    name: 'Various',
    slug: 'various',
    country: 'Global',
    headquarters: 'Global Editorial Reference',
    website: '',
    focus: 'Multi-OEM industry coverage',
    overview: 'Multi-OEM editorial reference used for industry-wide technical architecture and fleet engineering reports.',
    equipmentCategories: ['Construction Equipment', 'Commercial Vehicles', 'Technology'],
    technologyHighlights: [],
    regionalFootprint: ['Global'],
    officialSources: [],
    verificationStatus: 'Editorial Reference Category'
  }
];

const DEFAULT_EQUIPMENT_MODELS = [
  {
    name: 'HD76 / HD96 Backhoe Loader Series',
    slug: 'bull-machines-hd76-hd96-backhoe-loader',
    manufacturer: 'BULL Machines',
    manufacturerSlug: 'bull-machines',
    equipmentType: 'Backhoe loader',
    category: 'Backhoe Loaders',
    country: 'India',
    powerType: 'Diesel (CEV Stage IV / V)',
    summary: 'Center-pivot and sideshift backhoe loader series engineered by BULL Machines in Coimbatore for trenching, utility loading, road works, and rural civil construction.',
    specs: {
      'Equipment Class': 'Backhoe Loader (2WD / 4WD Options)',
      'Manufacturer': 'BULL Machines Pvt. Ltd.',
      'Manufacturing Origin': 'Coimbatore, Tamil Nadu, India',
      'Emission Regime': 'India CEV Stage IV / Stage V (Export configurations vary)',
      'Exact Bucket / Dig Depth Figures': 'Consult official BULL Machines brochure for specific variant (HD76, HD96, Challenger)'
    },
    applications: [
      'Urban water, telecom, and drainage pipeline trenching',
      'Highway shoulder grading and aggregate truck loading',
      'Rural civil works, canal desilting, and building site preparation'
    ],
    features: [
      'Heavy-duty box-section boom and dipperstick geometry',
      'ROPS/FOPS operator cabin with ergonomic dual-direction seating',
      'Compatibility with rock breaker and quick-coupler attachments'
    ],
    competingModels: ['jcb-3dx-backhoe-loader', 'case-770-ex-backhoe-loader', 'caterpillar-424-backhoe-loader', 'mahindra-earthmaster-sx-backhoe-loader'],
    officialSourceUrl: 'https://bullmachines.com/',
    image: 'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official BULL Machines Documentation',
    specSourceNote: 'Verified against official BULL Machines product portfolio. Exact operating weight, horsepower, and breakout force depend on variant and regional emission package; never assume unverified brochure figures.'
  },
  {
    name: '3DX Backhoe Loader Platform',
    slug: 'jcb-3dx-backhoe-loader',
    manufacturer: 'JCB',
    manufacturerSlug: 'jcb',
    equipmentType: 'Backhoe loader',
    category: 'Backhoe Loaders',
    country: 'United Kingdom',
    powerType: 'Diesel (JCB EcoMAX / Stage V / CEV Stage V)',
    summary: 'Flagship sideshift backhoe loader platform widely deployed across civil construction, utility trenching, and plant hire fleets in India, Europe, and global markets.',
    specs: {
      'Equipment Class': 'Sideshift Backhoe Loader',
      'Manufacturer': 'JCB (J.C. Bamford Excavators)',
      'Telematics System': 'JCB LiveLink Standard',
      'Drive Configurations': '2WD / 4WD Powershift & Synchroshuttle (Market Dependent)',
      'Detailed Variant Specs': 'Refer to official JCB regional specification sheet (3DX, 3DX Plus, 3DX Super)'
    },
    applications: [
      'Municipal utility trenching and road reinstatement',
      'Material rehandling, hopper feeding, and tipper loading',
      'Plant hire and multi-purpose civil contractor operations'
    ],
    features: [
      'JCB LiveLink remote fleet monitoring and geofencing',
      'Multi-mode engine fuel-saving electronics and auto-idle',
      'Sideshift kingpost for excavating flush along walls and curbs'
    ],
    competingModels: ['bull-machines-hd76-hd96-backhoe-loader', 'case-770-ex-backhoe-loader', 'caterpillar-424-backhoe-loader', 'john-deere-310-p-tier-backhoe-loader'],
    officialSourceUrl: 'https://www.jcb.com/',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official JCB Documentation',
    specSourceNote: 'Model family overview based on official JCB product lines. Regional specifications (UK/EU Stage V vs. India CEV Stage V) differ by engine rating and dipper option.'
  },
  {
    name: '320 Hydraulic Crawler Excavator',
    slug: 'caterpillar-320-hydraulic-excavator',
    manufacturer: 'Caterpillar',
    manufacturerSlug: 'caterpillar',
    equipmentType: 'Hydraulic excavator',
    category: 'Excavators',
    country: 'United States',
    powerType: 'Diesel (Cat C4.4 / Electro-Hydraulic)',
    summary: '20-tonne class medium hydraulic crawler excavator featuring factory-integrated Cat Grade 2D, Payload on-board weighing, and electro-hydraulic main control valves.',
    specs: {
      'Equipment Class': 'Medium Crawler Excavator (20-Tonne Class)',
      'Manufacturer': 'Caterpillar Inc.',
      'Hydraulic Architecture': 'Electro-Hydraulic Main Control Valve (No Pilot Lines)',
      'On-Board Technology': 'Cat Grade with 2D, Cat Payload, 2D E-Fence',
      'Regional Engine Package': 'Consult official Cat documentation for Tier 4 Final / Stage V / Stage IIIA equivalents'
    },
    applications: [
      'Bulk earthmoving, foundation excavation, and trenching',
      'Quarry bench loading and highway cut-and-fill operations',
      'Demolition and hydraulic breaker/grapple attachment work'
    ],
    features: [
      'Electro-hydraulic system with Smart Mode engine-to-pump matching',
      'Standard Cat Grade 2D depth and slope guidance in cab monitor',
      'Extended maintenance intervals with grouped ground-level filters'
    ],
    competingModels: ['komatsu-pc210-10m0-hydraulic-excavator', 'volvo-ec210-crawler-excavator', 'sany-sy215c-hydraulic-excavator', 'hd-hyundai-hx220l-crawler-excavator'],
    officialSourceUrl: 'https://www.cat.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Caterpillar Documentation',
    specSourceNote: 'Verified platform capabilities from official Caterpillar documentation. Exact operating weight and net power depend on undercarriage, boom/stick, and regional emissions tier.'
  },
  {
    name: 'PC210 Hydraulic Excavator Series',
    slug: 'komatsu-pc210-10m0-hydraulic-excavator',
    manufacturer: 'Komatsu',
    manufacturerSlug: 'komatsu',
    equipmentType: 'Hydraulic excavator',
    category: 'Excavators',
    country: 'Japan',
    powerType: 'Diesel (Komatsu SAA6D107E Series)',
    summary: '20-tonne class crawler excavator engineered by Komatsu with Closed-Center Load Sensing System (CLSS) hydraulics and KOMTRAX fleet monitoring.',
    specs: {
      'Equipment Class': '20-Tonne Class Hydraulic Crawler Excavator',
      'Manufacturer': 'Komatsu Ltd.',
      'Hydraulic System': 'HydrauMind Closed-Center Load Sensing System (CLSS)',
      'Telematics': 'KOMTRAX Remote Fleet Management',
      'Configuration Note': 'Consult official Komatsu regional datasheet for PC210-10M0 / PC210LC-11 specifications'
    },
    applications: [
      'Heavy civil earthmoving and highway corridor construction',
      'Quarry overburden removal and aggregate loading',
      'Deep trenching and infrastructure pipe laying'
    ],
    features: [
      'Six working modes (P, E, L, B, ATT/P, ATT/E) to match hydraulic flow to jobsite',
      'KOMTRAX equipment management and Energy Saving guidance on cab monitor',
      'Reinforced revolving frame and high-rigidity work equipment'
    ],
    competingModels: ['caterpillar-320-hydraulic-excavator', 'volvo-ec210-crawler-excavator', 'sany-sy215c-hydraulic-excavator', 'hd-hyundai-hx220l-crawler-excavator'],
    officialSourceUrl: 'https://www.komatsu.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Komatsu Documentation',
    specSourceNote: 'Overview derived from official Komatsu product documentation. Verify LC/standard undercarriage and regional emission package with local Komatsu distributor.'
  },
  {
    name: 'EC210 / A40G Heavy Earthmoving Platforms',
    slug: 'volvo-ec210-crawler-excavator',
    manufacturer: 'Volvo Construction Equipment',
    manufacturerSlug: 'volvo-construction-equipment',
    equipmentType: 'Hydraulic excavator',
    category: 'Excavators',
    country: 'Sweden',
    powerType: 'Diesel (Volvo D5 / D6 Series)',
    summary: 'Volvo Construction Equipment 20-tonne class crawler excavator platform designed for quarry, roadbuilding, and general civil engineering.',
    specs: {
      'Equipment Class': '20-Tonne Class Crawler Excavator',
      'Manufacturer': 'Volvo Construction Equipment',
      'Hydraulic Control': 'Electro-Hydraulic Positive Control with ECO Mode',
      'Telematics': 'Volvo CareTrack / ActiveCare Direct',
      'Specification Reference': 'Consult official Volvo CE regional specification sheet for exact boom/arm weights'
    },
    applications: [
      'Road construction, trenching, and general earthmoving',
      'Quarry material handling and truck loading',
      'Site preparation and utility installation'
    ],
    features: [
      'Integrated Volvo ECO mode for fuel efficiency without loss of breakout force',
      'ROPS-certified Volvo Care Cab with high-visibility glazing',
      'Dig Assist compatibility on supported regional configurations'
    ],
    competingModels: ['caterpillar-320-hydraulic-excavator', 'komatsu-pc210-10m0-hydraulic-excavator', 'sany-sy215c-hydraulic-excavator'],
    officialSourceUrl: 'https://www.volvoce.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Volvo CE Documentation',
    specSourceNote: 'Verified platform family from Volvo CE. Regional specifications and emission tiers vary by market.'
  },
  {
    name: '770 EX / 580N Backhoe Loader Series',
    slug: 'case-770-ex-backhoe-loader',
    manufacturer: 'CASE',
    manufacturerSlug: 'case',
    equipmentType: 'Backhoe loader',
    category: 'Backhoe Loaders',
    country: 'United States',
    powerType: 'Diesel (FPT Industrial S8000 / F34)',
    summary: 'Loader backhoe series engineered by CASE Construction Equipment featuring S-styled curved boom geometry and FPT Industrial diesel powertrains.',
    specs: {
      'Equipment Class': 'Loader Backhoe (Sideshift 770 EX / Center-Pivot 580N)',
      'Manufacturer': 'CASE Construction Equipment (CNH Industrial)',
      'Boom Design': 'Curved Over-Center Backhoe Boom',
      'Telematics': 'CASE SiteWatch',
      'Regional Variants': '770 EX / 770 EX Plus (India/MEA) and 580N / 580SV (Americas/Europe)'
    },
    applications: [
      'Utility trenching, excavating over obstacles, and close-to-truck loading',
      'Road base grading, material dozing, and site backfilling',
      'Municipal maintenance and agricultural land development'
    ],
    features: [
      'Curved boom geometry for deeper trenching clearance and easier truck loading',
      'Variable-volume or dual-gear hydraulic pump options by market',
      'Heavy-duty front axle oscillation for uneven worksite terrain'
    ],
    competingModels: ['bull-machines-hd76-hd96-backhoe-loader', 'jcb-3dx-backhoe-loader', 'john-deere-310-p-tier-backhoe-loader'],
    officialSourceUrl: 'https://www.casece.com/',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official CASE Documentation',
    specSourceNote: 'Compiled from official CASE Construction Equipment lineups. Confirm local variant (770 EX vs. 580 series) for exact dimensions and power ratings.'
  },
  {
    name: '310 P-Tier Backhoe Loader',
    slug: 'john-deere-310-p-tier-backhoe-loader',
    manufacturer: 'John Deere',
    manufacturerSlug: 'john-deere',
    equipmentType: 'Backhoe loader',
    category: 'Backhoe Loaders',
    country: 'United States',
    powerType: 'Diesel (John Deere PowerTech)',
    summary: 'Center-pivot production-tier backhoe loader from John Deere with powershift transmission, JDLink connectivity, and heavy-duty loader linkage.',
    specs: {
      'Equipment Class': 'Center-Pivot Backhoe Loader',
      'Manufacturer': 'John Deere (Deere & Company)',
      'Tier Designation': 'P-Tier (Production Tier)',
      'Telematics': 'JDLink / John Deere Operations Center',
      'Specification Note': 'Consult official John Deere datasheet for EPA Tier 4 Final / export engine specs'
    },
    applications: [
      'Street and underground utility repair',
      'Site preparation, trenching, and truck loading',
      'Snow removal and municipal fleet operations'
    ],
    features: [
      'AutoShift transmission and Eco Mode for reduced fuel consumption during roading',
      'Single-pin loader bucket linkage for parallel visibility',
      'Optional Extendahoe dipperstick for extended digging reach'
    ],
    competingModels: ['jcb-3dx-backhoe-loader', 'case-770-ex-backhoe-loader', 'bull-machines-hd76-hd96-backhoe-loader'],
    officialSourceUrl: 'https://www.deere.com/',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official John Deere Documentation',
    specSourceNote: 'Based on John Deere P-Tier backhoe loader architecture. Verify exact horsepower and dipper configuration with authorized John Deere dealer.'
  },
  {
    name: 'KX040-4 / U55-4 Compact Excavator Series',
    slug: 'kubota-kx040-4-compact-excavator',
    manufacturer: 'Kubota',
    manufacturerSlug: 'kubota',
    equipmentType: 'Mini / compact excavator',
    category: 'Compact Equipment',
    country: 'Japan',
    powerType: 'Diesel (Kubota Direct-Injection)',
    summary: 'Compact 4-to-5.5 tonne hydraulic mini excavator series from Kubota designed for urban utilities, landscaping, and confined worksite trenching.',
    specs: {
      'Equipment Class': 'Compact / Mini Hydraulic Excavator (4–5.5 Tonne Class)',
      'Manufacturer': 'Kubota Corporation',
      'Tail Swing Options': 'Conventional (KX Series) & Tight Tail Swing (U Series)',
      'Hydraulic System': 'Load-Sensing Hydraulic System with Auxiliary Proportional Flow',
      'Official Brochure': 'Consult local Kubota distributor for regional ROPS/cab and blade options'
    },
    applications: [
      'Confined urban fiber-optic, water, and gas trenching',
      'Residential foundation excavation and landscaping',
      'Roadside drainage and tiltrotator/auger attachment work'
    ],
    features: [
      'Proportional thumb-switch auxiliary hydraulic flow control on joystick',
      'Auto-idle and Eco Plus mode to minimize fuel consumption',
      ' optional 6-in-1 hydraulic angle dozer blade for rapid backfilling'
    ],
    competingModels: ['jcb-3dx-backhoe-loader'],
    officialSourceUrl: 'https://www.kubota.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Kubota Documentation',
    specSourceNote: 'Verified compact excavator series from Kubota Corporation. Exact operating weight varies by rubber vs. steel tracks and canopy vs. enclosed cab.'
  },
  {
    name: 'EarthMaster SX / VX Backhoe Loader',
    slug: 'mahindra-earthmaster-sx-backhoe-loader',
    manufacturer: 'Mahindra',
    manufacturerSlug: 'mahindra',
    equipmentType: 'Backhoe loader',
    category: 'Backhoe Loaders',
    country: 'India',
    powerType: 'Diesel (Mahindra CEV Stage IV / V)',
    summary: 'Indian-built backhoe loader platform from Mahindra Construction Equipment featuring banana boom geometry, joystick controls on VX trims, and DiGiSENSE telematics.',
    specs: {
      'Equipment Class': 'Sideshift Backhoe Loader',
      'Manufacturer': 'Mahindra Construction Equipment',
      'Manufacturing Plant': 'Chakan, Pune, Maharashtra, India',
      'Telematics': 'Mahindra DiGiSENSE Connected Fleet System',
      'Trim Variants': 'EarthMaster SX, VX, and SX IV (Verify current CEV Stage V datasheet)'
    },
    applications: [
      'Rural road construction, canal excavation, and pond desilting',
      'Brick kiln, crusher plant, and building material loading',
      'Municipal utility trenching and pipeline laying'
    ],
    features: [
      'DiGiSENSE SMS and app-based fuel, location, and utilization tracking',
      'Curved banana boom for clearance over high-sided tipper trucks',
      'Extended service intervals designed for remote Indian worksites'
    ],
    competingModels: ['bull-machines-hd76-hd96-backhoe-loader', 'jcb-3dx-backhoe-loader', 'case-770-ex-backhoe-loader'],
    officialSourceUrl: 'https://www.mahindraconstructionequipment.com/',
    image: 'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Mahindra Documentation',
    specSourceNote: 'Compiled from official Mahindra Construction Equipment product range. Verify CEV Stage V engine power and bucket sizes with authorized dealer.'
  },
  {
    name: 'Signa & Prima 2830.K / 3530.K Heavy Tipper Series',
    slug: 'tata-motors-signa-prima-heavy-tipper',
    manufacturer: 'Tata Motors',
    manufacturerSlug: 'tata-motors',
    equipmentType: 'Heavy tipper truck',
    category: 'Heavy Trucks',
    country: 'India',
    powerType: 'Diesel (BS-VI Phase 2)',
    summary: 'Multi-axle 6x4 (28-tonne GVW) and 8x4 (35-tonne GVW) heavy construction and mining tipper trucks built by Tata Motors for surface mining, quarry haulage, and highway earthworks.',
    specs: {
      'Equipment Class': 'Multi-Axle Heavy Tipper Truck (6x4 & 8x4)',
      'Manufacturer': 'Tata Motors Limited',
      'GVW Classes': '28-Tonne (6x4) and 35-Tonne (8x4) Gross Vehicle Weight Categories',
      'Telematics': 'Tata Fleet Edge Standard',
      'Body Options': 'Box Body & Rock Scoop Body (Consult Tata Motors body-builder datasheet)'
    },
    applications: [
      'Overburden and coal haulage in open-cast mining corridors',
      'Aggregate transport from stone crushers and quarries',
      'National highway embankment earthmoving and port infrastructure'
    ],
    features: [
      'Heavy-duty hub-reduction rear axles and multi-mode fuel economy switch (Light/Medium/Heavy)',
      'Hill Start Aid (HSA), Engine Brake, and iCGT brake technology',
      'Ergonomic Signa and Prima cabins with HVAC and suspension seating'
    ],
    competingModels: ['various-6x4-8x4-vocational-platforms'],
    officialSourceUrl: 'https://cv.tatamotors.com/',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Tata Motors Documentation',
    specSourceNote: 'Platform overview based on Tata Motors Commercial Vehicles tipper range. Exact horsepower, gearbox (G1150 / automated), and body cubic capacity depend on model code.'
  },
  {
    name: 'SY215C Medium Hydraulic Excavator',
    slug: 'sany-sy215c-hydraulic-excavator',
    manufacturer: 'SANY',
    manufacturerSlug: 'sany',
    equipmentType: 'Hydraulic excavator',
    category: 'Excavators',
    country: 'China',
    powerType: 'Diesel (Electronically Controlled Positive Flow)',
    summary: '21.5-tonne class crawler hydraulic excavator manufactured by SANY for general earthmoving, quarry loading, and infrastructure projects across Asia, MEA, and global markets.',
    specs: {
      'Equipment Class': '21-Tonne Class Hydraulic Crawler Excavator',
      'Manufacturer': 'SANY Group',
      'Hydraulic Architecture': 'Positive Flow Electronically Controlled Hydraulics',
      'Manufacturing Hubs': 'Kunshan (China), Chakan Pune (India), Bedburg (Germany)',
      'Regional Specs': 'Consult SANY regional brochure for China NR IV, India CEV, or EU Stage V package'
    },
    applications: [
      'General earthmoving, road cut-and-fill, and foundation digging',
      'Stone quarry excavation and hydraulic rock breaker tasks',
      'Municipal pipeline and water conservancy projects'
    ],
    features: [
      'Dynamic optimization matching between engine speed and main hydraulic pump flow',
      'Reinforced boom, arm, and X-frame lower undercarriage',
      '10-inch touchscreen cab display with working mode and attachment presets'
    ],
    competingModels: ['caterpillar-320-hydraulic-excavator', 'komatsu-pc210-10m0-hydraulic-excavator', 'volvo-ec210-crawler-excavator', 'hd-hyundai-hx220l-crawler-excavator'],
    officialSourceUrl: 'https://www.sanyglobal.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official SANY Documentation',
    specSourceNote: 'Verified from official SANY Global excavator portfolio. Engine brand and emission certification vary by regional market.'
  },
  {
    name: 'XCT / XCA All-Terrain & Truck Crane Series',
    slug: 'xcmg-xct-xca-mobile-crane-series',
    manufacturer: 'XCMG',
    manufacturerSlug: 'xcmg',
    equipmentType: 'Mobile / all-terrain crane',
    category: 'Cranes',
    country: 'China',
    powerType: 'Diesel / Hybrid Multi-Axle Carrier',
    summary: 'Telescopic boom truck crane (XCT) and all-terrain crane (XCA) series engineered by XCMG for bridge erection, petrochemical plant lifting, and wind turbine installation.',
    specs: {
      'Equipment Class': 'Telescopic Truck Cranes & All-Terrain Cranes',
      'Manufacturer': 'XCMG (Xuzhou Construction Machinery Group)',
      'Boom Profile': 'U-Shaped High-Tensile Steel Telescopic Boom with Single-Cylinder Pinning',
      'Telematics': 'XCMG Xrea Crane Fleet Management',
      'Load Chart Notice': 'Always consult certified load charts for specific counterweight and outrigger span'
    },
    applications: [
      'Highway viaduct and metro bridge precast girder lifting',
      'Industrial plant, refinery, and steel structure erection',
      'Wind farm maintenance and heavy infrastructure hoisting'
    ],
    features: [
      'Single-cylinder automatic pinning telescoping system on medium and large tonnage models',
      'Multi-axle all-wheel steering and hydro-pneumatic suspension on XCA all-terrain carriers',
      'Intelligent boom deflection compensation and load moment limiter (LML)'
    ],
    competingModels: ['liebherr-ltm-all-terrain-mobile-crane'],
    officialSourceUrl: 'https://www.xcmg.com/',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official XCMG Documentation',
    specSourceNote: 'Series overview from XCMG Hoisting Machinery division. Never perform lift planning without the serial-specific OEM load chart.'
  },
  {
    name: 'LTM Mobile All-Terrain Crane Series',
    slug: 'liebherr-ltm-all-terrain-mobile-crane',
    manufacturer: 'Liebherr',
    manufacturerSlug: 'liebherr',
    equipmentType: 'All-terrain mobile crane',
    category: 'Cranes',
    country: 'Germany',
    powerType: 'Diesel / ECOmode Single-Engine Concept',
    summary: 'All-terrain telescopic mobile crane family manufactured by Liebherr-Werk Ehingen GmbH in Germany, featuring Telematik pinning booms, VarioBase outrigger monitoring, and LICCON crane control.',
    specs: {
      'Equipment Class': 'All-Terrain Mobile Crane (LTM Series)',
      'Manufacturer': 'Liebherr Group (Ehingen, Germany)',
      'Control System': 'LICCON2 / LICCON3 with VarioBase & VarioBallast',
      'Telescoping System': 'Telematik Single-Cylinder Automatic Pinning',
      'Load Chart Notice': 'Refer to official Liebherr LICCON load planner for exact radius and boom configuration'
    },
    applications: [
      'Heavy industrial erection, tower crane assembly, and bridge construction',
      'Constrained urban lifts utilizing asymmetrical VarioBase outrigger extensions',
      'Energy infrastructure, petrochemical, and wind power rigging'
    ],
    features: [
      'VarioBase individual outrigger length and load capacity calculation in real time',
      'ECOmode and ECOdrive for reduced fuel consumption and lower jobsite noise',
      'VarioBallast adjustable counterweight radius for tight worksites'
    ],
    competingModels: ['xcmg-xct-xca-mobile-crane-series'],
    officialSourceUrl: 'https://www.liebherr.com/',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official Liebherr Documentation',
    specSourceNote: 'Verified technical systems from Liebherr-Werk Ehingen GmbH. Specific axle loads and road homologation depend on national transport regulations.'
  },
  {
    name: 'HX220L Crawler Hydraulic Excavator',
    slug: 'hd-hyundai-hx220l-crawler-excavator',
    manufacturer: 'HD Hyundai',
    manufacturerSlug: 'hd-hyundai',
    equipmentType: 'Hydraulic excavator',
    category: 'Excavators',
    country: 'South Korea',
    powerType: 'Diesel (Cummins / HD Hyundai Stage V)',
    summary: '22-tonne class crawler hydraulic excavator from HD Hyundai Construction Equipment equipped with IPC (Intelligent Power Control), Hi MATE telematics, and optional AAVM 360-degree camera safety.',
    specs: {
      'Equipment Class': '22-Tonne Class Hydraulic Crawler Excavator',
      'Manufacturer': 'HD Hyundai Construction Equipment',
      'Hydraulic Control': 'IPC (Intelligent Power Control) & EPIC System',
      'Telematics': 'Hi MATE Remote Management System',
      'Regional Note': 'Consult HD Hyundai regional dealer for HX220L / R210 SMART Plus India specs'
    },
    applications: [
      'Heavy earthmoving, civil engineering, and road corridor excavation',
      'Quarry aggregate extraction and truck loading',
      'Demolition and multi-attachment utility contracting'
    ],
    features: [
      'Intelligent Power Control (IPC) regulates pump flow based on operator lever inputs',
      'Optional Advanced Around View Monitoring (AAVM) with Intelligent Moving Object Detection (IMOD)',
      'Reinforced durable X-chassis and heavy-duty boom/arm structures'
    ],
    competingModels: ['caterpillar-320-hydraulic-excavator', 'komatsu-pc210-10m0-hydraulic-excavator', 'volvo-ec210-crawler-excavator', 'sany-sy215c-hydraulic-excavator'],
    officialSourceUrl: 'https://www.hd-hyundaice.com/',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Editorial Reference / Consult Official HD Hyundai Documentation',
    specSourceNote: 'Compiled from official HD Hyundai Construction Equipment documentation. Verify local model designation (HX series vs. SMART Plus series in India).'
  }
];

function createDataStore(dataDir) {
  const files = {
    meta: path.join(dataDir, 'schema_meta.json'),
    articles: path.join(dataDir, 'articles.json'),
    authors: path.join(dataDir, 'authors.json'),
    categories: path.join(dataDir, 'categories.json'),
    regions: path.join(dataDir, 'regions.json'),
    countries: path.join(dataDir, 'countries.json'),
    manufacturers: path.join(dataDir, 'manufacturers.json'),
    equipmentModels: path.join(dataDir, 'equipment_models.json'),
    sources: path.join(dataDir, 'sources.json'),
    tags: path.join(dataDir, 'tags.json'),
    images: path.join(dataDir, 'images.json'),
    newsletter: path.join(dataDir, 'newsletter.json'),
    adminUsers: path.join(dataDir, 'admin_users.json'),
    submissions: path.join(dataDir, 'submissions.json'),
    analytics: path.join(dataDir, 'analytics.json'),
    settings: path.join(dataDir, 'settings.json'),
    jobs: path.join(dataDir, 'collection_jobs.json'),
    auditLogs: path.join(dataDir, 'audit_logs.json'),
    collectedItems: path.join(dataDir, 'collected_items.json'),
    newsroomRuns: path.join(dataDir, 'newsroom_runs.json'),
    workflowConfig: path.join(dataDir, 'workflow_config.json'),
    workflowLocks: path.join(dataDir, 'workflow_locks.json'),
    publicationLedger: path.join(dataDir, 'publication_ledger.json'),
    failureAlerts: path.join(dataDir, 'failure_alerts.json'),
    distributionLogs: path.join(dataDir, 'distribution_logs.json'),
    seoTasks: path.join(dataDir, 'seo_tasks.json')
  };

  const DEFAULT_APPROVED_SOURCES = [
    {
      name: 'OEM Off-Highway — Global Equipment & Drivetrain Feed',
      url: 'https://www.oemoffhighway.com/',
      feedUrl: 'https://www.oemoffhighway.com/rss',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'Various',
      category: 'Technology',
      country: 'United States',
      region: 'North America',
      sourceType: 'rss-feed',
      pollingIntervalMinutes: 60,
      enabled: true,
      notes: 'Works without API key. Verified RSS 2.0 XML feed covering off-highway engines, hydraulics, drivetrains, and electrification.'
    },
    {
      name: 'For Construction Pros — Heavy Equipment & Fleet Feed',
      url: 'https://www.forconstructionpros.com/',
      feedUrl: 'https://www.forconstructionpros.com/rss',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'Various',
      category: 'Construction Equipment',
      country: 'United States',
      region: 'North America',
      sourceType: 'rss-feed',
      pollingIntervalMinutes: 60,
      enabled: true,
      notes: 'Works without API key. Verified RSS 2.0 XML feed covering earthmoving machinery, asphalt/roadbuilding, and vocational trucks.'
    },
    {
      name: 'PR Newswire — Heavy Industry & Manufacturing Wire',
      url: 'https://www.prnewswire.com/news-releases/heavy-industry-manufacturing-latest-news/',
      feedUrl: 'https://www.prnewswire.com/rss/heavy-industry-manufacturing-latest-news/heavy-industry-manufacturing-latest-news-list.rss',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'Various',
      category: 'Industry News',
      country: 'Global',
      region: 'Global',
      sourceType: 'rss-feed',
      pollingIntervalMinutes: 45,
      enabled: true,
      notes: 'Works without API key. Official corporate wire releases from global machinery and industrial manufacturers.'
    },
    {
      name: 'PR Newswire — Commercial Vehicles & Automotive Wire',
      url: 'https://www.prnewswire.com/news-releases/automotive-transportation-latest-news/',
      feedUrl: 'https://www.prnewswire.com/rss/automotive-transportation-latest-news/automotive-transportation-latest-news-list.rss',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'Various',
      category: 'Commercial Vehicles',
      country: 'Global',
      region: 'Global',
      sourceType: 'rss-feed',
      pollingIntervalMinutes: 45,
      enabled: true,
      notes: 'Works without API key. Official corporate releases for heavy trucks, commercial vehicles, and fleet powertrains.'
    },
    {
      name: 'U.S. Department of Energy (DOE) — Clean Transport & Industrial Wire',
      url: 'https://www.energy.gov/news',
      feedUrl: 'https://www.energy.gov/rss.xml',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'Various',
      category: 'Electric Commercial Vehicles',
      country: 'United States',
      region: 'North America',
      sourceType: 'regulatory-rss',
      pollingIntervalMinutes: 120,
      enabled: true,
      notes: 'Works without API key. Public-domain government RSS feed for hydrogen, battery-electric, and industrial energy dispatches.'
    },
    {
      name: 'BULL Machines Official Press & Product Reference',
      url: 'https://bullmachines.com/',
      feedUrl: '',
      apiEndpoint: '',
      requiresApiKey: false,
      manufacturer: 'BULL Machines',
      category: 'Backhoe Loaders',
      country: 'India',
      region: 'India',
      sourceType: 'oem-web-reference',
      pollingIntervalMinutes: 240,
      enabled: true,
      notes: 'Official OEM website reference (no public RSS XML endpoint exposed; use Test Mode or manual tip submission).'
    },
    {
      name: 'Authorized OEM Partner Newsroom API (Template)',
      url: 'https://api.oem-partner.example/v1/releases',
      feedUrl: '',
      apiEndpoint: 'https://api.oem-partner.example/v1/releases',
      requiresApiKey: true,
      apiKeyEnvVar: 'OEM_PARTNER_API_KEY',
      manufacturer: 'Various',
      category: 'Industry News',
      country: 'Global',
      region: 'Global',
      sourceType: 'authorized-api',
      pollingIntervalMinutes: 120,
      enabled: false,
      notes: 'Requires OEM_PARTNER_API_KEY in .env before enabling live polling.'
    }
  ];

  const DEFAULT_SETTINGS = {
    siteName: 'MACHINEWIRE',
    tagline: 'THE WORLD OF MACHINES. CONNECTED.',
    defaultMetaTitle: 'MACHINEWIRE — Global Construction Equipment & Commercial Vehicle Intelligence',
    defaultMetaDescription: 'Verified global news, machine specifications, OEM profiles, and commercial vehicle intelligence across construction, mining, and agriculture.',
    canonicalBaseUrl: 'http://localhost:3000',
    editorialContactEmail: 'editorial@machinewire.example',
    correctionsEmail: 'corrections@machinewire.example',
    defaultOgImage: 'https://images.unsplash.com/photo-1580901368919-7738efb0f87e?auto=format&fit=crop&w=1400&q=85',
    robotsIndexing: true,
    requireSourceForPublish: true,
    updatedAt: new Date().toISOString()
  };

  const DEFAULT_JOBS = [
    {
      id: 'job-scheduled-publisher',
      name: 'Scheduled Article Auto-Publisher',
      jobType: 'scheduler',
      target: 'articles.json (status=scheduled)',
      schedule: 'On-demand & Every Request Check',
      lastRunAt: new Date().toISOString(),
      lastStatus: 'healthy',
      itemsProcessed: 0,
      lastError: '',
      description: 'Automatically transitions scheduled articles to published status when scheduledAt <= current UTC time.'
    },
    {
      id: 'job-catalog-entity-sync',
      name: 'Catalog & OEM Entity Synchronizer',
      jobType: 'indexer',
      target: 'manufacturers, equipment_models, sources, images, tags',
      schedule: 'Automatic on Article Save + Manual Run',
      lastRunAt: new Date().toISOString(),
      lastStatus: 'healthy',
      itemsProcessed: 14,
      lastError: '',
      description: 'Extracts and normalizes manufacturers, equipment models, approved sources, and image credits from published articles.'
    },
    {
      id: 'job-source-integrity-audit',
      name: 'Approved Source & Image Credit Auditor',
      jobType: 'validator',
      target: 'sources.json & images.json',
      schedule: 'Manual Trigger / Pre-Publish Audit',
      lastRunAt: new Date().toISOString(),
      lastStatus: 'healthy',
      itemsProcessed: 5,
      lastError: '',
      description: 'Checks all articles and approved news sources for valid HTTPS URLs, domain attribution, and explicit image credits.'
    }
  ];

  const backupsDir = path.join(dataDir, 'backups');

  function readJson(filePath, fallback = []) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, filePath);
  }

  // Upsert helpers that prevent duplicate records by slug, email, or URL
  function upsertByKey(collection, newItem, keyField = 'slug') {
    const keyVal = String(newItem[keyField] || '').toLowerCase();
    const idx = collection.findIndex(x => String(x[keyField] || '').toLowerCase() === keyVal || x.id === newItem.id);
    if (idx >= 0) {
      collection[idx] = { ...collection[idx], ...newItem, id: collection[idx].id, createdAt: collection[idx].createdAt };
      return collection[idx];
    }
    collection.push(newItem);
    return newItem;
  }

  function syncEntitiesFromArticle(article) {
    // 1. Region
    if (article.region) {
      const regions = readJson(files.regions, []);
      upsertByKey(regions, models.createRegionModel({ name: article.region }), 'slug');
      writeJson(files.regions, regions);
    }
    // 2. Country
    if (article.country) {
      const countries = readJson(files.countries, []);
      upsertByKey(countries, models.createCountryModel({ name: article.country, region: article.region || 'Global' }), 'slug');
      writeJson(files.countries, countries);
    }
    // 3. Category
    if (article.category) {
      const categories = readJson(files.categories, []);
      upsertByKey(categories, models.createCategoryModel({ name: article.category }), 'slug');
      writeJson(files.categories, categories);
    }
    // 4. Author
    if (article.author) {
      const authors = readJson(files.authors, []);
      upsertByKey(authors, models.createAuthorModel({ name: article.author }), 'slug');
      writeJson(files.authors, authors);
    }
    // 5. Manufacturer
    if (article.manufacturer && article.manufacturer !== 'To be confirmed') {
      const manufacturers = readJson(files.manufacturers, []);
      const existingMfg = manufacturers.find(x =>
        String(x.slug || '').toLowerCase() === models.makeSlug(article.manufacturer, 80) ||
        String(x.name || '').toLowerCase() === String(article.manufacturer).toLowerCase()
      );
      if (!existingMfg) {
        upsertByKey(manufacturers, models.createManufacturerModel({ name: article.manufacturer, country: article.country || 'Global' }), 'slug');
        writeJson(files.manufacturers, manufacturers);
      }
    }
    // 6. Equipment Model
    if (article.model) {
      const eqModels = readJson(files.equipmentModels, []);
      const candidateSlug = models.makeSlug(`${article.manufacturer || 'Various'}-${article.model}`, 100);
      const existingEq = eqModels.find(x => String(x.slug || '').toLowerCase() === candidateSlug);
      upsertByKey(eqModels, models.createEquipmentModel({
        name: article.model,
        manufacturer: article.manufacturer || 'Various',
        equipmentType: article.equipmentType || 'Construction equipment',
        category: article.category || article.equipmentType || 'Construction Equipment',
        country: article.country || 'Global',
        powerType: article.powerType || 'Diesel',
        specs: { ...(existingEq?.specs || {}), ...(article.specs || {}) },
        officialSourceUrl: existingEq?.officialSourceUrl || article.sourceUrl || '',
        image: existingEq?.image || article.image || '',
        imageCredit: existingEq?.imageCredit || article.imageCredit || 'Editorial / OEM Press Handout'
      }, existingEq || {}), 'slug');
      writeJson(files.equipmentModels, eqModels);
    }
    // 7. Sources
    const allUrls = [...new Set([article.sourceUrl, ...(article.sourceUrls || [])].filter(Boolean))];
    if (allUrls.length) {
      const sources = readJson(files.sources, []);
      for (const u of allUrls) {
        try {
          const existingSrc = sources.find(x => String(x.url || '').toLowerCase() === String(u).toLowerCase());
          if (!existingSrc) {
            upsertByKey(sources, models.createSourceModel({ url: u }), 'url');
          }
        } catch {}
      }
      writeJson(files.sources, sources);
    }
    // 8. Tags
    if (Array.isArray(article.tags) && article.tags.length) {
      const tags = readJson(files.tags, []);
      for (const t of article.tags) {
        try {
          upsertByKey(tags, models.createTagModel({ name: t }), 'slug');
        } catch {}
      }
      writeJson(files.tags, tags);
    }
    // 9. Image
    if (article.image) {
      const images = readJson(files.images, []);
      try {
        upsertByKey(images, models.createImageModel({
          url: article.image,
          alt: article.title,
          credit: article.imageCredit || 'Editorial / OEM Press Handout'
        }), 'url');
        writeJson(files.images, images);
      } catch {}
    }
  }

  // Run idempotent migrations to initialize all 12 entity collections and upgrade existing articles
  function migrate() {
    fs.mkdirSync(dataDir, { recursive: true });
    const meta = readJson(files.meta, { version: 0, migrations: [] });
    if (meta.version < CURRENT_SCHEMA_VERSION && fs.existsSync(files.articles)) {
      try {
        createBackup(`pre-migration-v${meta.version}-to-v${CURRENT_SCHEMA_VERSION}`);
      } catch {}
    }

    // Seed default catalogs without duplicating existing records
    const regions = readJson(files.regions, []);
    for (const r of DEFAULT_REGIONS) upsertByKey(regions, models.createRegionModel(r), 'slug');
    writeJson(files.regions, regions);

    const countries = readJson(files.countries, []);
    for (const c of DEFAULT_COUNTRIES) upsertByKey(countries, models.createCountryModel(c), 'slug');
    writeJson(files.countries, countries);

    const categories = readJson(files.categories, []);
    for (const cat of DEFAULT_CATEGORIES) upsertByKey(categories, models.createCategoryModel(cat), 'slug');
    writeJson(files.categories, categories);

    const manufacturers = readJson(files.manufacturers, []);
    for (const m of DEFAULT_MANUFACTURERS) upsertByKey(manufacturers, models.createManufacturerModel(m), 'slug');
    writeJson(files.manufacturers, manufacturers);

    const equipmentModels = readJson(files.equipmentModels, []);
    for (const em of DEFAULT_EQUIPMENT_MODELS) upsertByKey(equipmentModels, models.createEquipmentModel(em), 'slug');
    writeJson(files.equipmentModels, equipmentModels);

    const authors = readJson(files.authors, []);
    upsertByKey(authors, models.createAuthorModel({ name: 'Editorial Desk', role: 'Chief Editorial Desk' }), 'slug');
    upsertByKey(authors, models.createAuthorModel({ name: 'Commercial Vehicles Desk', role: 'Transport & Fleet Editor' }), 'slug');
    upsertByKey(authors, models.createAuthorModel({ name: 'Technology & Powertrains Desk', role: 'Technical Editor' }), 'slug');
    writeJson(files.authors, authors);

    const adminUsers = readJson(files.adminUsers, []);
    upsertByKey(adminUsers, models.createAdminUserModel({
      username: 'editorial-admin',
      email: 'editor@machinewire.local',
      role: 'super_admin'
    }), 'username');
    writeJson(files.adminUsers, adminUsers);

    const sources = readJson(files.sources, []);
    for (const s of DEFAULT_APPROVED_SOURCES) upsertByKey(sources, models.createSourceModel(s), 'url');
    writeJson(files.sources, sources);

    // Normalize and enrich all existing articles in articles.json while preserving IDs and slugs
    const rawArticles = readJson(files.articles, []);
    for (const cornerstone of seoLib.EVERGREEN_CORNERSTONE_ARTICLES) {
      if (!rawArticles.some(a => a.id === cornerstone.id || a.slug === cornerstone.slug)) {
        rawArticles.push(cornerstone);
      }
    }
    const seenSlugs = new Set();
    const migratedArticles = [];

    for (const raw of rawArticles) {
      try {
        const normalized = models.validateAndNormalizeArticle(raw, raw, {
          actor: 'System Migration',
          note: 'Normalized to v2 content architecture schema'
        });
        // Preserve original updateHistory if already populated without endlessly appending migration entries
        if (Array.isArray(raw.updateHistory) && raw.updateHistory.length > 0) {
          normalized.updateHistory = raw.updateHistory;
        }
        let slug = normalized.slug;
        let n = 2;
        while (seenSlugs.has(slug)) slug = `${normalized.slug}-${n++}`;
        normalized.slug = slug;
        seenSlugs.add(slug);
        delete normalized.slugInput;
        migratedArticles.push(normalized);
        syncEntitiesFromArticle(normalized);
      } catch {
        migratedArticles.push(raw);
      }
    }
    writeJson(files.articles, migratedArticles);

    // Re-apply DEFAULT_APPROVED_SOURCES after article sync so feedUrl/sourceType are never overwritten by generic article URLs
    const finalSources = readJson(files.sources, []);
    for (const s of DEFAULT_APPROVED_SOURCES) upsertByKey(finalSources, models.createSourceModel(s), 'url');
    writeJson(files.sources, finalSources);

    // Ensure other entity files exist
    for (const key of ['equipmentModels', 'sources', 'tags', 'images', 'newsletter', 'submissions', 'collectedItems', 'newsroomRuns', 'publicationLedger', 'failureAlerts', 'distributionLogs', 'seoTasks']) {
      if (!fs.existsSync(files[key])) writeJson(files[key], []);
    }
    if (!fs.existsSync(files.workflowLocks)) {
      writeJson(files.workflowLocks, {});
    }
    if (!fs.existsSync(files.analytics)) {
      writeJson(files.analytics, { regionViews: {}, articleViews: {}, updatedAt: new Date().toISOString() });
    }
    if (!fs.existsSync(files.settings)) {
      writeJson(files.settings, DEFAULT_SETTINGS);
    }
    if (!fs.existsSync(files.jobs)) {
      writeJson(files.jobs, DEFAULT_JOBS);
    }
    if (!fs.existsSync(files.auditLogs)) {
      writeJson(files.auditLogs, [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          actor: 'system',
          role: 'super_admin',
          action: 'system.migrate',
          target: 'schema_v2',
          level: 'info',
          details: 'Initialized normalized content store, OEM directory, and admin audit log.'
        }
      ]);
    }

    // Normalize newsletter records
    const rawNewsletter = readJson(files.newsletter, []);
    const seenEmails = new Set();
    const migratedNewsletter = [];
    for (const row of rawNewsletter) {
      try {
        const item = models.createNewsletterModel(row, row);
        if (!seenEmails.has(item.email)) {
          seenEmails.add(item.email);
          migratedNewsletter.push(item);
        }
      } catch {}
    }
    writeJson(files.newsletter, migratedNewsletter);

    if (meta.version < CURRENT_SCHEMA_VERSION) {
      meta.version = CURRENT_SCHEMA_VERSION;
      meta.updatedAt = new Date().toISOString();
      meta.migrations = meta.migrations || [];
      meta.migrations.push({
        version: CURRENT_SCHEMA_VERSION,
        appliedAt: meta.updatedAt,
        description: 'Normalized 12 entity models, article SEO, imageCredit, 6 statuses, and updateHistory'
      });
      writeJson(files.meta, meta);
    }

    return meta;
  }

  function createBackup(reason = 'manual') {
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `backup-${stamp}-${crypto.randomBytes(2).toString('hex')}`;
    const snapshot = {
      id,
      createdAt: new Date().toISOString(),
      reason,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      counts: {},
      data: {}
    };
    for (const [key, filePath] of Object.entries(files)) {
      const content = readJson(filePath, key === 'meta' ? {} : []);
      snapshot.data[key] = content;
      if (Array.isArray(content)) snapshot.counts[key] = content.length;
    }
    const backupFile = path.join(backupsDir, `${id}.json`);
    writeJson(backupFile, snapshot);
    return {
      id,
      file: backupFile,
      createdAt: snapshot.createdAt,
      reason,
      counts: snapshot.counts
    };
  }

  function listBackups() {
    if (!fs.existsSync(backupsDir)) return [];
    return fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const full = path.join(backupsDir, f);
          const stat = fs.statSync(full);
          const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
          return {
            id: parsed.id || f.replace(/\.json$/, ''),
            createdAt: parsed.createdAt || stat.mtime.toISOString(),
            reason: parsed.reason || 'snapshot',
            sizeBytes: stat.size,
            counts: parsed.counts || {}
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function getCatalogSummary() {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      authors: readJson(files.authors, []),
      categories: readJson(files.categories, []),
      regions: readJson(files.regions, []),
      countries: readJson(files.countries, []),
      manufacturers: readJson(files.manufacturers, []),
      equipmentModels: readJson(files.equipmentModels, []),
      sources: readJson(files.sources, []),
      tags: readJson(files.tags, []),
      images: readJson(files.images, []),
      adminUsers: readJson(files.adminUsers, []).map(({ passwordHash, ...u }) => u)
    };
  }

  function upsertCatalogEntity(entityType, payload) {
    const map = {
      authors: [files.authors, models.createAuthorModel, 'slug'],
      categories: [files.categories, models.createCategoryModel, 'slug'],
      regions: [files.regions, models.createRegionModel, 'slug'],
      countries: [files.countries, models.createCountryModel, 'slug'],
      manufacturers: [files.manufacturers, models.createManufacturerModel, 'slug'],
      equipmentModels: [files.equipmentModels, models.createEquipmentModel, 'slug'],
      sources: [files.sources, models.createSourceModel, 'url'],
      tags: [files.tags, models.createTagModel, 'slug'],
      images: [files.images, models.createImageModel, 'url'],
      adminUsers: [files.adminUsers, models.createAdminUserModel, 'username']
    };
    const cfg = map[entityType];
    if (!cfg) throw new Error(`Unsupported entity type: ${entityType}`);
    const [filePath, factory, uniqueKey] = cfg;
    const rows = readJson(filePath, []);
    const item = factory(payload);
    const saved = upsertByKey(rows, item, uniqueKey);
    writeJson(filePath, rows);
    return saved;
  }

  function deleteCatalogEntity(entityType, idOrSlug) {
    const map = {
      authors: [files.authors, 'slug'],
      categories: [files.categories, 'slug'],
      regions: [files.regions, 'slug'],
      countries: [files.countries, 'slug'],
      manufacturers: [files.manufacturers, 'slug'],
      equipmentModels: [files.equipmentModels, 'slug'],
      sources: [files.sources, 'id'],
      tags: [files.tags, 'slug'],
      images: [files.images, 'id'],
      adminUsers: [files.adminUsers, 'username']
    };
    const cfg = map[entityType];
    if (!cfg) throw new Error(`Unsupported entity type: ${entityType}`);
    const [filePath, keyField] = cfg;
    const rows = readJson(filePath, []);
    const target = String(idOrSlug || '').toLowerCase();
    const next = rows.filter(x =>
      String(x.id || '').toLowerCase() !== target &&
      String(x[keyField] || '').toLowerCase() !== target
    );
    if (next.length === rows.length) return false;
    writeJson(filePath, next);
    return true;
  }

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...readJson(files.settings, DEFAULT_SETTINGS) };
  }

  function updateSettings(patch = {}) {
    const current = getSettings();
    const updated = {
      ...current,
      siteName: String(patch.siteName ?? current.siteName).trim().slice(0, 80) || 'MACHINEWIRE',
      tagline: String(patch.tagline ?? current.tagline).trim().slice(0, 140) || 'THE WORLD OF MACHINES. CONNECTED.',
      defaultMetaTitle: String(patch.defaultMetaTitle ?? current.defaultMetaTitle).trim().slice(0, 180),
      defaultMetaDescription: String(patch.defaultMetaDescription ?? current.defaultMetaDescription).trim().slice(0, 320),
      canonicalBaseUrl: String(patch.canonicalBaseUrl ?? current.canonicalBaseUrl).trim().slice(0, 300),
      editorialContactEmail: String(patch.editorialContactEmail ?? current.editorialContactEmail).trim().slice(0, 160),
      correctionsEmail: String(patch.correctionsEmail ?? current.correctionsEmail).trim().slice(0, 160),
      defaultOgImage: String(patch.defaultOgImage ?? current.defaultOgImage).trim().slice(0, 1000),
      robotsIndexing: patch.robotsIndexing !== undefined ? Boolean(patch.robotsIndexing) : current.robotsIndexing,
      requireSourceForPublish: patch.requireSourceForPublish !== undefined ? Boolean(patch.requireSourceForPublish) : current.requireSourceForPublish,
      gaMeasurementId: String(patch.gaMeasurementId ?? current.gaMeasurementId ?? '').trim().slice(0, 80),
      plausibleDomain: String(patch.plausibleDomain ?? current.plausibleDomain ?? '').trim().slice(0, 120),
      gscVerificationCode: String(patch.gscVerificationCode ?? current.gscVerificationCode ?? '').trim().slice(0, 140),
      gscPropertyUrl: String(patch.gscPropertyUrl ?? current.gscPropertyUrl ?? '').trim().slice(0, 300),
      updatedAt: new Date().toISOString()
    };
    writeJson(files.settings, updated);
    return updated;
  }

  function appendAuditLog(entry = {}) {
    const logs = readJson(files.auditLogs, []);
    const item = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: String(entry.actor || 'editorial-admin').slice(0, 80),
      role: String(entry.role || 'super_admin').slice(0, 40),
      action: String(entry.action || 'admin.action').slice(0, 100),
      target: String(entry.target || '').slice(0, 180),
      level: ['info', 'warn', 'error'].includes(entry.level) ? entry.level : 'info',
      details: String(entry.details || '').slice(0, 500)
    };
    logs.unshift(item);
    writeJson(files.auditLogs, logs.slice(0, 250));
    return item;
  }

  function getAuditLogs(limit = 100) {
    return readJson(files.auditLogs, []).slice(0, limit);
  }

  function getJobs() {
    const stored = readJson(files.jobs, []);
    return stored.length ? stored : DEFAULT_JOBS;
  }

  function runJob(jobId, actor = 'editorial-admin') {
    const jobs = getJobs();
    const idx = jobs.findIndex(j => j.id === jobId);
    if (idx < 0) throw new Error(`Collection job not found: ${jobId}`);
    const now = new Date().toISOString();
    const articles = readJson(files.articles, []);
    let itemsProcessed = 0;
    let lastError = '';
    let lastStatus = 'healthy';

    if (jobId === 'job-scheduled-publisher') {
      const nowMs = Date.now();
      for (const a of articles) {
        if (a.status === 'scheduled' && a.scheduledAt && Date.parse(a.scheduledAt) <= nowMs) {
          a.status = 'published';
          a.publishedAt = a.scheduledAt;
          a.updatedAt = now;
          itemsProcessed++;
        }
      }
      if (itemsProcessed > 0) writeJson(files.articles, articles);
    } else if (jobId === 'job-catalog-entity-sync') {
      for (const a of articles) {
        syncEntitiesFromArticle(a);
        itemsProcessed++;
      }
    } else if (jobId === 'job-source-integrity-audit') {
      const missingSource = articles.filter(a => a.status === 'published' && !a.sourceUrl && !(a.sourceUrls && a.sourceUrls.length));
      itemsProcessed = articles.length;
      if (missingSource.length > 0) {
        lastStatus = 'warning';
        lastError = `${missingSource.length} published article(s) missing primary source URL attribution.`;
      }
    } else {
      itemsProcessed = articles.length;
    }

    jobs[idx] = {
      ...jobs[idx],
      lastRunAt: now,
      lastStatus,
      itemsProcessed,
      lastError
    };
    writeJson(files.jobs, jobs);
    appendAuditLog({
      actor,
      action: 'job.run',
      target: jobs[idx].name,
      level: lastError ? 'warn' : 'info',
      details: lastError || `Completed successfully (${itemsProcessed} items inspected/synced).`
    });
    return jobs[idx];
  }

  return {
    files,
    readJson,
    writeJson,
    migrate,
    syncEntitiesFromArticle,
    createBackup,
    listBackups,
    getCatalogSummary,
    upsertCatalogEntity,
    deleteCatalogEntity,
    getSettings,
    updateSettings,
    appendAuditLog,
    getAuditLogs,
    getJobs,
    runJob,
    recordAnalyticsView(type, slug) {
      if (!slug) return;
      const analytics = readJson(files.analytics, { regionViews: {}, articleViews: {} });
      const bucket = type === 'region' ? 'regionViews' : 'articleViews';
      analytics[bucket] = analytics[bucket] || {};
      analytics[bucket][slug] = (analytics[bucket][slug] || 0) + 1;
      analytics.updatedAt = new Date().toISOString();
      try { writeJson(files.analytics, analytics); } catch {}
    },
    getAnalytics() {
      return readJson(files.analytics, { regionViews: {}, articleViews: {} });
    },
    getSeoTasks() {
      return readJson(files.seoTasks, []);
    },
    saveSeoTask(task) {
      const list = readJson(files.seoTasks, []);
      const idx = list.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...task, updatedAt: new Date().toISOString() };
      } else {
        list.unshift(task);
      }
      writeJson(files.seoTasks, list);
      return task;
    },
    deleteSeoTask(taskId) {
      const list = readJson(files.seoTasks, []);
      const next = list.filter(t => t.id !== taskId);
      writeJson(files.seoTasks, next);
      return next.length !== list.length;
    }
  };
}

module.exports = { createDataStore, CURRENT_SCHEMA_VERSION };
