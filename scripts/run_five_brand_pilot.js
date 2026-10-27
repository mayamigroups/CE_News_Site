const path = require('path');
const fs = require('fs');
const { createDataStore } = require('../lib/store.js');
const collector = require('../lib/collector.js');

async function runPilot() {
  const dataDir = path.join(__dirname, '..', 'data');
  const store = createDataStore(dataDir);

  console.log('--- Starting Five-Brand Pilot Collection ---');

  // Verify and normalize sources
  collector.importCandidateRegistry(store, null, { actor: 'pilot-runner' });

  // 5 verified brand press releases / announcement URLs:
  // 1. Komatsu
  // 2. Volvo CE
  // 3. SANY
  // 4. BULL Machines (or CASE)
  // 5. JCB (or Ashok Leyland)
  
  // First let's test Komatsu press release URL
  const candidates = [
    {
      brand: 'Komatsu',
      category: 'Construction Equipment',
      country: 'Japan',
      region: 'Global',
      testUrls: [
        'https://www.komatsu.jp/en/newsroom/2024/20241025',
        'https://www.komatsu.jp/en/newsroom'
      ]
    },
    {
      brand: 'Volvo CE',
      category: 'Construction Equipment',
      country: 'Sweden',
      region: 'Global',
      testUrls: [
        'https://www.volvoce.com/global/en/news-and-events/news-and-stories/',
      ]
    },
    {
      brand: 'SANY',
      category: 'Heavy Machinery',
      country: 'China',
      region: 'Global',
      testUrls: [
        'https://www.sanyglobal.com/news_list/'
      ]
    },
    {
      brand: 'BULL Machines',
      category: 'Backhoe Loaders',
      country: 'India',
      region: 'India',
      testUrls: [
        'https://www.bullindia.com/bull-machines-unveils.php'
      ]
    },
    {
      brand: 'JCB',
      category: 'Construction Equipment',
      country: 'United Kingdom',
      region: 'Global',
      testUrls: [
        'https://www.jcb.com/en-GB/explore/newsroom/'
      ]
    }
  ];

  const results = [];

  for (const c of candidates) {
    let ingested = false;
    for (const u of c.testUrls) {
      try {
        console.log(`Trying ${c.brand}: ${u}...`);
        const res = await collector.intakeManualUrl(store, u, {
          manufacturer: c.brand,
          category: c.category,
          country: c.country,
          region: c.region,
          actor: 'Pilot Verification Test'
        });
        const item = res.item || res;
        console.log(`[SUCCESS] Ingested ${c.brand}: "${item.title || item.headline}"`);
        results.push({ brand: c.brand, title: item.title || item.headline, url: item.canonicalUrl, id: item.id });
        ingested = true;
        break;
      } catch (err) {
        console.warn(`[WARN] Failed ${c.brand} at ${u}: ${err.message}`);
      }
    }
    if (!ingested) {
      console.error(`[ERROR] Could not ingest any URL for ${c.brand}`);
    }
  }

  console.log('\n--- Pilot Summary ---');
  console.log(`Ingested ${results.length} of ${candidates.length} brands:`);
  results.forEach(r => console.log(`- [${r.brand}] ${r.title} (${r.url})`));

  const items = store.readJson(store.files.collectedItems, []);
  console.log(`Total items in collected_items.json: ${items.length}`);
}

runPilot().catch(console.error);
