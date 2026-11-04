# Antigravity Build Prompt: Machine Report World (B2B Machinery Publication + Lead Engine)

Paste everything below the line into Antigravity as the task prompt.

---

## ROLE
You are a senior full-stack engineer and technical SEO lead. You are extending an existing zero-dependency Node.js (>=20) site in `D:\CE_Machines_News_Site`. Read `README.md`, `PRODUCTION_RUNBOOK.md`, `docs/PRODUCTION_DATA_ARCHITECTURE.md` and the tests in `test/` first. Do not rewrite what already works. Keep `node --test test/*.test.js` green after every phase, and add tests for everything you build.

## PRODUCT GOAL
Machine Report World is a B2B publication for construction equipment, agricultural machinery and commercial vehicles. It has two jobs:
1. **Be a credible, easy-to-read publication** that earns search traffic and trust in each country.
2. **Sell leads and visibility to OEM brands and dealers** (sponsored profiles, launch coverage, newsletter slots, cost-per-lead).

It will later be cloned into about 15 more niche sites, so everything must be config-driven, not hardcoded to this niche.

## NON-NEGOTIABLE RULES
- **No fake people.** Never generate invented staff, bylines, bios or "50-member teams". Use real named people (editor-in-chief, contributors, advisors) supplied in config, plus honest desk names. Every AI-assisted article carries a visible "AI-assisted, human-reviewed" disclosure with the reviewer's name.
- **No fabricated news, quotes, numbers, images or sources.** Every claim needs a source URL. Reject drafts whose numbers are not found in the source text (keep the existing number-grounding guard).
- **Sponsored content is always labelled** and kept separate from editorial.
- **Auto-publish stays gated.** Only low-risk, structured content types may auto-publish (spec pages, event listings, press-release summaries with a verified source and a licensed image). Opinion, analysis and anything about people or safety goes to human review.
- Respect robots.txt and copyright: headline, short excerpt and link back only. Never copy full third-party articles or use unlicensed images.
- Do not promise rankings. Ship the mechanisms and report real metrics.

## ALREADY DONE (do not redo, only keep working)
- Article page is server-rendered with the body, key-takeaways box and automatic internal links to OEM and model pages (`lib/article-render.js`, `lib/ssr.js`).
- Article "Updated" date no longer re-stamps on server start.
- Homepage shows each story once; empty desks hidden.
- Categories have `parentSlug` (8 main desks).
- Page titles use "Machine Report World" only.

## PHASE 0: Production hygiene (do first)
1. Make `SITE_URL` mandatory in production. Canonical URLs, sitemap, robots, RSS, OG tags and JSON-LD must all use it. Fail startup in production mode if it is `localhost`.
2. Pick one brand name from `data/settings.json` and use it everywhere (UI, titles, emails, docs, tests). Remove remaining "MachineWire"/"MACHINEWIRE" strings from user-facing output.
3. Replace `@machinewire.example` addresses with values from env/config.
4. Unpublish placeholder stories ("Welcome to your news desk", demo buyer's guide) and update the tests that depend on them to use test fixtures created inside the test itself, not live `data/` files. Tests must never read or depend on live content.
5. Stop committing live runtime data: move `data/*.json` content out of git (keep `data.example/` seeds), add `data/` to `.gitignore`.
6. Add `/healthz`, structured request logging, and a `Cache-Control` strategy with content-hashed asset filenames so deploys are not stuck behind a 1-hour cache.

## PHASE 1: Reader experience and categories
1. **Navigation:** show the 8 main desks in the header; each desk page lists its sub-categories as chips and a breadcrumb (Home / Desk / Sub-category). Use `parentSlug`. Flatten the duplicate categories (Industry News / Industry & Business / Business; Reviews / Reviews & Comparisons) into single entries with 301 redirects from old slugs.
2. **Article template:** key takeaways, short paragraphs, table of contents for 800+ words, spec table, "Who this matters to" line, author card with real bio, visible published and updated dates, reading time, related stories (3), and a "Brands mentioned" strip linking to OEM profiles.
3. **Content standards enforced in admin:** block publishing guides under 600 words and news under 250 words unless a reviewer overrides with a reason. Require source, image credit and alt text.
4. **Search and filters:** keep existing search; add filters by brand, country and equipment type on desk pages.
5. Accessibility and speed: semantic landmarks, AA contrast, lazy images with width/height, responsive images, Lighthouse mobile performance 90+.

## PHASE 2: SEO and backlink-readiness
1. Schema.org: `NewsArticle`, `BreadcrumbList`, `Organization`/`NewsMediaOrganization`, `Product` (model pages), `Event` (events), `FAQPage` where real FAQs exist. Validate in tests.
2. Sitemaps: split into `sitemap-news.xml` (last 2 days, with `news:` tags), `sitemap-articles.xml`, `sitemap-brands.xml`, `sitemap-models.xml`, `sitemap-regions.xml`, with real `lastmod` from actual edits. Ping on publish.
3. Hreflang and country hubs: `/india/`, `/europe/`, etc. each with a unique intro, top stories, top brands, upcoming events and a local newsletter signup. Prepare language variants but do not machine-translate without human review.
4. **Internal linking engine:** keep the automatic OEM/model linking; add topic hubs (pillar pages) per desk with a curated "start here" list, and an orphan-page report in admin (pages with no inbound internal links).
5. **Link-earning assets (so other sites cite us):**
   - Public OEM directory and model spec comparison tables, each with a stable permalink and "Cite this page" box.
   - Embeddable "Featured on Machine Report World" badge for brands that links to their profile (use `rel="noopener"`, no hidden links).
   - Press page and a press-release submission form for OEMs.
   - Annual data pages (e.g., market snapshot per country) with downloadable CSV.
6. Outgoing links: link to the exact primary source URL, not just the domain. Sponsored links use `rel="sponsored nofollow"`.
7. Add a backlink and ranking tracker: import Google Search Console data (queries, pages, clicks, positions) through the existing `lib/gsc.js` and show it in admin. Add a manual backlink log (URL, domain, date, type) with an outreach status field.

## PHASE 3: Agentic newsroom (safe automation)
Build a real scheduled pipeline, not on-request checks.
1. **Scheduler:** a worker process or cron entry that runs every 15 minutes, with a job table (`jobs`, `job_runs`) storing status, duration and errors. Add retry with backoff and a kill switch in admin.
2. **Discover:** poll approved RSS/Atom feeds and OEM newsroom pages (respect robots.txt and rate limits). Extract article-level items (title, date, canonical URL, excerpt, image URL) instead of landing pages. Reject index pages and logos.
3. **Dedupe and cluster:** fingerprint plus similarity so one event from five sources becomes one story with multiple sources.
4. **Research agent:** for each story cluster, fetch the primary source, extract facts, and build a dossier (claims, numbers, quotes, links). Store the evidence.
5. **Writer agent (LLM via `AI_API_KEY`):** draft from the dossier only, in plain language, with takeaways, a spec table and "why it matters". Every number must exist in the dossier. Output `status=review` by default.
6. **Editor agent:** checks length, readability, duplicate similarity, banned phrases, source coverage and image rights, then assigns a score and reasons.
7. **Publisher:** auto-publishes only eligible low-risk types that pass all gates, otherwise queues for a human with one-click approve/edit/reject. Log every decision to the audit log and `publication_ledger`.
8. **Distribution after publish:** sitemap update, IndexNow ping, newsletter queue, LinkedIn/X queue (only with configured credentials), and RSS.
9. **Daily output target:** 5 to 10 quality items per day across desks; hard cap per day to avoid thin-content spam. Show daily stats and rejection reasons in admin.

## PHASE 4: Lead-generation engine (the revenue core)
1. **Data model:** `brands` (account), `brand_users`, `leads`, `lead_events`, `campaigns`, `packages`, `invoices` (simple). Leads store name, work email, phone, company, country, machine interest, budget range, timeline, source page, UTM, consent text and timestamp, brand routed to, status (new, contacted, qualified, won, lost) and notes.
2. **Lead capture:** "Request a quote", "Contact dealer" and "Download brochure" forms on brand, model and article pages. Spam protection (honeypot, rate limit, email validation), GDPR/DPDP-style consent, and double opt-in for newsletters.
3. **Lead routing and scoring:** route by brand, country and equipment type; score by budget, timeline and company-email domain; instant email/webhook to the brand; deduplicate repeat leads.
4. **Brand portal** (separate login, `/brand/`): leads inbox with status updates and CSV export, performance dashboard (profile views, article views, clicks, leads, cost per lead), campaign calendar, profile editor (logo, description, models, dealers, brochures).
5. **Packages:** sponsored brand profile, launch coverage, newsletter slot, country-hub sponsorship, cost-per-lead. Sponsored items are clearly labelled and stored with `isSponsored`, `sponsorName` and a disclosure line.
6. **Automatic monthly brand report:** share of voice, top stories, leads, rankings for the brand's keywords. Email it as a PDF/HTML to the brand. This is the sales and renewal tool.
7. **Sales page:** rewrite `advertise.html` with audience data (real numbers only, from analytics), package pricing placeholders from config, a media-kit download, and a lead form for brands.
8. **CRM hooks:** webhook and CSV out; optional HubSpot/Zoho connector behind env keys.

## PHASE 5: Team and trust pages (honest)
1. `/team` page driven by `data/team.json` (real names, roles, photos, LinkedIn, expertise). Support "Contributing experts" and "Advisory board" sections.
2. Author pages with bio, topics and article lists, plus `Person` schema.
3. Editorial standards, corrections log (public), AI-use policy, sponsorship policy, ownership and contact details.
4. Contributor and OEM submission workflow: invite contributors, they submit drafts, editors approve. This is how the publication grows its real team and volume.

## PHASE 6: Multi-site readiness (for the next 15 sites)
1. Introduce `site.config.json`: site id, name, domain, niche, tagline, taxonomy file, source registry file, tone guide, languages, themes, feature flags, newsletter and ad settings.
2. Add `site_id` to every table/collection. Keep the repository layer interface; implement a Postgres adapter (use the existing `lib/migrations/001_initial_schema.sql` as a start) alongside the JSON adapter, selectable by env.
3. Split large files (`lib/store.js`, `lib/newsroom.js`, `lib/collector.js`, `lib/seo.js`) into modules by responsibility with no behaviour change; keep tests green.
4. Remove niche text from code (construction/equipment keywords, desk definitions in `components.js`); load them from the taxonomy config.
5. A `scripts/new-site.js` generator that creates a new site folder or config from a template and seeds taxonomy and source registry.
6. A shared "network" layer: cross-site brand directory, shared lead routing across sites, one admin to switch sites, and a combined analytics view.

## PHASE 7: Operations and quality
- CI: run tests, lint, a link checker for internal links, a JSON-LD validator, and a Lighthouse budget.
- Security: CSRF protection on admin and brand portals, strict CSP, rate limits, password hashing (already scrypt), 2FA for admin, secrets only from env, dependency-free where practical.
- Backups: scheduled daily backups with restore test.
- Monitoring: uptime check, error log alerts, job failure alerts.
- Analytics: privacy-safe page views plus GA4/Plausible; track lead funnel events.

## 30-DAY DELIVERY ORDER
- **Week 1:** Phase 0, Phase 1, and real content cleanup. Deploy to the real domain; submit sitemaps to Search Console and Bing.
- **Week 2:** Phase 3 (scheduler, article-level discovery, writer and editor agents, gated publishing) and Phase 2 sitemaps/schema.
- **Week 3:** Phase 4 (lead capture, routing, brand portal basics, advertise page) and Phase 5.
- **Week 4:** newsletter send, social distribution, monthly brand report, country hubs for 3 priority countries, then start Phase 6 refactors.

## DEFINITION OF DONE (for each phase)
- Tests added and `node --test test/*.test.js` passes.
- No console errors; pages work without JavaScript for reading.
- Admin has a screen for the feature, with audit logging.
- A short entry added to `docs/` explaining how to run and configure it.
- Report back: what changed, files touched, what is not done, and how to verify.

## FIRST ACTION
Inspect the repo, then reply with a short plan listing the files you will change for Phase 0 and Phase 1. Implement Phase 0 and Phase 1 completely, run the tests, and stop for review before starting Phase 2.
