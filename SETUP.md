# Machine Report World (MRW) — THE WORLD OF MACHINES. CONNECTED.

Global construction equipment, backhoe loader, earthmoving machinery, and commercial vehicle intelligence platform. Built on a zero-external-dependency Node.js architecture with normalized JSON data models, SQL migration scripts (`lib/migrations/001_initial_schema.sql`), a 9-screen Role-Based Access Control (RBAC) Admin Dashboard, an approved RSS/Atom News Collection Engine (`lib/collector.js`), and a Configurable 6-Role AI-Assisted Newsroom (`lib/newsroom.js`).

## 1. Requirements

- Node.js 20 or newer
- Windows PowerShell, macOS Terminal, or Linux shell

```bash
node --version
```

## 2. Quick Start

1. Copy `.env.example` to `.env`.
2. Set `ADMIN_PASSWORD`, `SESSION_SECRET`, and (for production) `SITE_URL` in `.env`.
3. Start the server (on first start, any missing files in `data/` are automatically copied from `data.example/`):

```bash
node server.js
```

4. Public Website: `http://localhost:3000`
5. Editorial Admin & Newsroom: `http://localhost:3000/admin.html`
6. Run the automated verification suite:

```bash
node --test test/*.test.js
```

## 3. Data Directory (`data/` vs `data.example/`)

- **`data/` is runtime state and is excluded from git** (`.gitignore` ignores `data/` and `data/backups/`).
- **`data.example/` is tracked in git** and contains clean starter JSON:
  - Empty arrays (`[]`) for runtime collections: `articles.json`, `collected_items.json`, `submissions.json`, `newsletter.json`, `audit_logs.json`, `analytics.json`, `collection_jobs.json`, `distribution_logs.json`, `failure_alerts.json`, `newsroom_runs.json`, `publication_ledger.json`, `seo_tasks.json`, `workflow_locks.json`.
  - Pre-seeded taxonomy and reference catalogs: `categories.json`, `regions.json`, `countries.json`, `manufacturers.json`, `equipment_models.json`, `sources.json`, `source_registry_candidates.json`, `authors.json`, `tags.json`, `images.json`, `settings.json`, `schema_meta.json`.
- On startup, `server.js` checks `DATA_DIR` (defaults to `./data`) and copies any missing `.json` file from `data.example/` before running migrations. Existing files in `data/` are never overwritten.

## 4. Environment Variables, `SITE_URL` & Contact Emails

All secrets and environment settings are loaded server-side from `.env` and are **never exposed in frontend code**:

- `SITE_URL`: Single source of truth for the public origin used in canonical tags, `og:url`, `sitemap.xml`, the `Sitemap:` line in `robots.txt`, RSS feeds, JSON-LD structured data, collector `User-Agent`, and share/newsletter links.
  - **Development** (`NODE_ENV` not `production`): defaults to `http://localhost:3000` when unset.
  - **Production** (`NODE_ENV=production`): **required**. The server refuses to start and prints a clear fatal error if `SITE_URL` is empty, contains `localhost` or `127.0.0.1`, or does not use `https://`.
- `EDITORIAL_EMAIL`, `CORRECTIONS_EMAIL`, `ADVERTISING_EMAIL`, `EMAIL_FROM`: Contact and sender addresses (see `.env.example` for placeholders like `editorial@yourdomain.com`).
- `ADMIN_PASSWORD`: Password for the default `editorial-admin` super_admin account.
- `SESSION_SECRET`: Long random secret used to sign `HttpOnly; SameSite=Strict` admin session cookies.
- `PORT`: HTTP port (default `3000`).
- `AI_PROVIDER`: Optional AI provider for the newsroom (`local-deterministic`, `gemini`, `openai`, or `compatible`).
- `AI_API_KEY`: Optional server-side API key for the external LLM provider.
- `AI_MODEL`: Optional model identifier (e.g., `gemini-2.5-flash` or `gpt-4o-mini`).
- `AI_BASE_URL`: Optional custom OpenAI-compatible or Gemini endpoint URL.
- `AI_TIMEOUT_MS`: Request timeout in milliseconds for optional external LLM calls (default `12000`).
- `GA_MEASUREMENT_ID`: Optional Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`).
- `PLAUSIBLE_DOMAIN`: Optional Plausible Analytics domain.
- `GSC_VERIFICATION_CODE`: Optional Google Search Console `google-site-verification` token.
- `GSC_PROPERTY_URL`: Optional Google Search Console property URL.
- `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_WEBHOOK_URL`, `EMAIL_FROM`: Optional server-side newsletter delivery credentials. If omitted, the signup interface explicitly shows that an external email provider is not yet connected while storing subscriber topic interests, consent timestamps, verification links, and one-click unsubscribe links locally.
- `SOCIAL_LINKEDIN_ACCESS_TOKEN`, `SOCIAL_LINKEDIN_ORG_URN`, `SOCIAL_X_BEARER_TOKEN`, `SOCIAL_WEBHOOK_URL`: Optional social-media distribution credentials. Provider APIs are invoked only after required accounts and permissions are configured.

### Fallback Behavior When No `AI_API_KEY` Is Configured
If `AI_API_KEY` is omitted or empty:
- **Source Collection (`lib/collector.js`)**, **Manual Drafting**, and the **8-Step / 6-Specialist-Role Newsroom (`lib/newsroom.js`)** continue to work seamlessly using Machine Report World's **Deterministic Local Specialist Mode** at **$0.00 API cost**.

### API Cost & Editorial Verification Limitations
- **Low Single-Call Cost**: When an external `AI_API_KEY` is configured, `lib/newsroom.js` executes all 6 specialist logical roles (`research`, `factual_verification`, `technical_review`, `regional_context`, `editorial_quality`, `seo_specialist`) within a single consolidated JSON pass (~900–1,600 tokens per story, typically `<$0.002` on Flash/Mini models) rather than spawning expensive multi-agent loops.
- **AI Agreement Is NOT Proof of Accuracy**: Automated extraction or LLM agreement never proves a claim is true.
- **Mandatory Human Review Queue**: Every newsroom analysis routes its output strictly to the **Admin Review Queue (`status: "review"`)** — never `published`. High-risk claims (direct quotes, numeric machine specifications, prices, financial results, and product launch dates) are automatically flagged for human verification against the primary source link before any `managing_editor` or `super_admin` can publish.

## 5. Key API & Operations Endpoints

- `GET /healthz` — Lightweight liveness check returning `{ ok: true, uptime, version }` with no secrets
- `GET /api/health` — System health & schema status
- `GET /api/articles` & `GET /api/articles/:slug` — Published news feed & article detail
- `GET /api/regions` & `GET /api/regions/:slug` — 10 canonical regional hubs (`/india/`, `/north-america/`, `/europe/`, `/china/`, etc.)
- `GET /api/manufacturers` & `GET /api/manufacturers/:slug` — 14 OEM profiles
- `GET /api/models` & `GET /api/models/:slug` — 14 equipment & commercial vehicle model pages
- `POST /api/admin/sources/:id/check` & `POST /api/admin/sources/check-all` — Respectful RSS/Atom collection engine (`live` & `test` sample modes)
- `GET /api/admin/newsroom/config` — AI-assisted newsroom configuration, 6 specialist roles & cost/limitation disclosures
- `POST /api/admin/newsroom/analyze` — Run the 8-step newsroom workflow on a collected story or raw evidence and route to `status: "review"`
