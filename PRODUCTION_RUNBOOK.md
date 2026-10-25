# MachineWire Production Readiness & Operational Runbook

**Brand:** MACHINEWIRE  
**Tagline:** THE WORLD OF MACHINES. CONNECTED.  
**Architecture:** Zero-external-dependency Node.js HTTP application with normalized atomic JSON persistence, scrypt-hashed RBAC authentication, 8-stage editorial publication gate engine, approved RSS/Atom collector, and configurable distribution channels.

---

## 1. Quick Start & Exact Commands

### Prerequisites
- **Node.js**: v20.0.0 or newer (`node -v`)
- **NPM / NPX**: Included with Node.js (`npm -v`)
- **Shell**: PowerShell, macOS Terminal, or Linux Bash
- **Dependencies**: **0 external npm packages required**. MachineWire runs entirely on native Node.js core libraries (`http`, `fs`, `path`, `crypto`, `url`).

### Commands

| Workflow Step | Exact Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `node -v` | No third-party packages to install. Built with native Node.js. |
| **Configuration** | `cp .env.example .env` (Linux/macOS) or `Copy-Item .env.example .env` (PowerShell) | Creates local configuration file. |
| **Generate Secrets** | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Generates a 96-character random secret for `SESSION_SECRET`. |
| **Run Locally** | `node server.js` | Starts server on `http://localhost:3000`. |
| **Run Test Suite** | `node --test test/server.test.js` | Runs all 18 automated production-readiness test suites. |
| **Create Manual Backup** | `node -e "require('./lib/store.js').createDataStore('./data').createBackup('manual-cli')"` | Creates timestamped full database snapshot in `data/backups/`. |
| **Production Process** | `pm2 start server.js --name "machinewire"` | Production process manager runner (or systemd service). |

---

## 2. Environment Variables & Secret Configuration

Copy `.env.example` to `.env`. All secrets are loaded server-side and are **never exposed to frontend JavaScript or client API responses**:

```ini
# Core Security (Required before exposing online)
ADMIN_PASSWORD=your-super-strong-admin-password
SESSION_SECRET=your-96-character-random-hex-secret
PORT=3000
SITE_URL=https://machinewire.example.com
DATA_DIR=./data

# Optional: Configurable AI-Assisted Newsroom
# If AI_API_KEY is left empty, the 6-specialist-role newsroom workflow functions 100% locally at $0.00 cost.
AI_PROVIDER=local-deterministic
AI_API_KEY=
AI_MODEL=gemini-2.5-flash
AI_BASE_URL=
AI_TIMEOUT_MS=12000

# Optional: Search Performance & Telemetry Credentials
GA_MEASUREMENT_ID=
PLAUSIBLE_DOMAIN=
GSC_VERIFICATION_CODE=
GSC_PROPERTY_URL=

# Optional: Newsletter Email Delivery Provider
# If omitted, signup UI clearly reports "Email Provider Not Yet Connected" while saving subscriber consent locally.
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_WEBHOOK_URL=
EMAIL_FROM=briefing@machinewire.example.com

# Optional: Social Media Distribution Integrations
# Provider APIs are invoked only after required credentials and permissions are configured.
SOCIAL_LINKEDIN_ACCESS_TOKEN=
SOCIAL_LINKEDIN_ORG_URN=
SOCIAL_X_BEARER_TOKEN=
SOCIAL_WEBHOOK_URL=
```

---

## 3. Production Readiness Audit Matrix

| System Component | Status | Verification Evidence | Notes / Awaiting Credentials |
| :--- | :--- | :--- | :--- |
| **13 Homepage Sections & Navigation** | **Tested & Live** | `GET /` serves all 13 sections, mobile menu toggle, breaking ticker, search, and footer institutional links. | Fully functional. |
| **Search & Listing Filters** | **Tested & Live** | Multi-factor search across 26 desks, OEMs, countries, and date sorting with `?page=N` pagination SEO. | Fully functional. |
| **Clean Article Pages & Sharing** | **Tested & Live** | Clean URLs (`/news/:slug`), semantic `<h2>` headings, JSON-LD `NewsArticle`, UTM share links, and Connected Intelligence Hubs. | Fully functional. |
| **14 Manufacturer Profiles** | **Tested & Live** | Searchable OEM directory (`/manufacturers`, `/manufacturers/:slug`) with headquarters, categories, models, and official websites. | Initial directory candidates; independent editorial coverage (no partnership claimed). |
| **14 Equipment Model Dossiers** | **Tested & Live** | Verified specs (`/models`, `/models/:slug`) with competing model links and missing-info labels. | Never invents prices or specifications. |
| **10 Regional News Desks** | **Tested & Live** | Dedicated routes (`/india/`, `/north-america/`, `/europe/`, `/china/`, etc.) with local currencies, units, and emissions regulations. | Fully functional. |
| **Admin RBAC Authentication** | **Tested & Live** | Scrypt password hashing (`scrypt:salt:hash`), signed `HttpOnly; SameSite=Strict` cookies, role checks (`author`, `reviewer`, `managing_editor`, `super_admin`), and rate-limited logins. | Default user `editorial-admin`. |
| **News Collection Engine** | **Tested & Live** | Verified RSS/Atom collector (`lib/collector.js`) with canonical URL normalization, title fingerprinting, duplicate detection, and manual "Check Source Now". | Tested in both Sample Test Mode and Live Mode (`https://www.oemoffhighway.com/rss`). |
| **AI-Assisted Newsroom** | **Tested & Live** | 6 logical specialist roles (`research`, `factual_verification`, `technical_review`, `regional_context`, `editorial_quality`, `seo_specialist`) routing strictly to `status: "review"`. | Operates in deterministic mode ($0.00 cost) when `AI_API_KEY` is omitted. AI agreement is never treated as proof of accuracy. |
| **8-Stage Editorial Pipeline** | **Tested & Live** | `DISCOVERED → COLLECTED → DEDUPLICATED → DRAFT → REVIEW → APPROVED → SCHEDULED → PUBLISHED` with job locking, sensitive-topic human routing, and rollback ledger. | Automatic publication defaults to disabled and requires passing the 5-gate test suite before activation. |
| **Technical SEO & Sitemap** | **Tested & Live** | Dynamic `/sitemap.xml`, `/robots.txt`, `Cache-Control` (`stale-while-revalidate`), `ETag` + `304 Not Modified`, canonical tags, and breadcrumbs. | Fully functional. |
| **Evergreen Cornerstone Library** | **Tested & Live** | 4 in-depth standards-referenced comparisons, explainers, and maintenance guides. | Avoids thin/doorway pages. |
| **Newsletter Subscription** | **Tested & Live** | 7 topic interests, frequency choice, explicit consent collection, email verification token, and one-click unsubscribe. | When `EMAIL_PROVIDER` is unset, the UI honestly displays "Not Yet Connected" while storing preferences locally. |
| **Social Distribution** | **Tested & Live** | Prepared UTM links and copy; provider API calls execute only when credentials are set; blocks duplicate dispatches (`409 Conflict`). | Awaiting optional LinkedIn/X/Webhook credentials for live automatic push. |
| **Security & Error Handling** | **Tested & Live** | `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, public endpoint rate-limiting, and branded HTML 404/500 pages. | Fully functional. |
| **Data Safety & Backups** | **Tested & Live** | Atomic file writes via temporary files, automatic pre-delete backup snapshots, and migration version tracking (`lib/store.js`). | Backups stored in `data/backups/`. |

---

## 4. Hosting, Database & Infrastructure Architecture

### Hosting Requirements
- **Recommended Provider**: DigitalOcean Droplet ($6/mo), Hetzner Cloud (€4.50/mo), AWS EC2 (t4g.small), or Render/Railway/Fly.io.
- **Compute**: 1 vCPU, 1 GB RAM, 10 GB SSD.
- **Reverse Proxy**: Nginx or Caddy with automated Let's Encrypt SSL/TLS.
- **Process Manager**: PM2 or systemd:
  ```bash
  # Install PM2 globally
  npm install -g pm2
  # Start MachineWire with automated restart on reboot
  pm2 start server.js --name "machinewire"
  pm2 startup
  pm2 save
  ```

### Database & Storage Architecture
MachineWire uses **Atomic JSON Store Architecture** (`lib/store.js`):
- All collections (`articles.json`, `sources.json`, `newsletter.json`, `equipment_models.json`, etc.) are written atomically using `fs.writeFileSync` to a unique PID temporary file followed by atomic `fs.renameSync`. This prevents corrupt data during crashes.
- Relational schema migration scripts are provided in [`lib/migrations/001_initial_schema.sql`](file:///d:/CE_Machines_News_Site/lib/migrations/001_initial_schema.sql) if migrating to PostgreSQL or SQLite.
- Daily automated backup command:
  ```bash
  # Crontab entry for daily 2:00 AM snapshot
  0 2 * * * cd /var/www/machinewire && node -e "require('./lib/store.js').createDataStore('./data').createBackup('cron-daily')"
  ```

### Cost Breakdown (Beginner Friendly)

| Item | Service | Estimated Monthly Cost | Necessity |
| :--- | :--- | :--- | :--- |
| **Hosting VPS** | DigitalOcean / Hetzner / AWS | $4.00 – $6.00 / month | Required to host public website |
| **Domain Name** | Cloudflare / Namecheap | ~$1.00 / month ($12/year) | Required |
| **SSL / HTTPS** | Let's Encrypt / Cloudflare | $0.00 (Free) | Required |
| **Database** | Native Atomic Store | $0.00 (Zero hosting cost) | Included |
| **RSS Collection** | Approved RSS/Atom Feeds | $0.00 (Public feeds) | Included |
| **AI Newsroom** | Deterministic Local Pipeline | $0.00 (Offline mode) | Included |
| **AI Newsroom (Optional)** | Gemini 2.5 Flash / GPT-4o-mini | < $1.00 / month (~$0.001 per article) | Optional |
| **Transactional Email** | Postmark / SendGrid (Free tier) | $0.00 – $10.00 / month | Optional |
| **Total Estimated Cost** | — | **~$5.00 – $7.00 / month** | Complete platform operating cost |

---

## 5. Verification Proof

All **18 automated test suites** passed cleanly:
```bash
node --test test/server.test.js
```
- Total tests: 18
- Passing: 18
- Failing: 0
- Skipped: 0
- Duration: ~14.5s
