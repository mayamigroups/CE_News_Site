# MachineWire — Global Construction Equipment & Commercial Vehicle News

A zero-dependency Node.js news and editorial intelligence platform covering global construction equipment, backhoe loaders, Bull Machines updates, commercial vehicles, powertrains, and trade exhibitions.

## Architecture & Features

- **Backend ([`server.js`](file:///d:/CE_Machines_News_Site/server.js))**: Dependency-free Node.js (`>=20`) HTTP server with atomic JSON persistence, HMAC-SHA256 signed session cookies, login rate-limiting, automatic scheduled article promotion, XML sitemap (`GET /sitemap.xml`), RSS 2.0 feed (`GET /rss.xml`), and facet metadata API (`GET /api/meta`).
- **Public Frontend (`public/`)**:
  - [`index.html`](file:///d:/CE_Machines_News_Site/public/index.html) & [`app.js`](file:///d:/CE_Machines_News_Site/public/app.js): Editorial homepage with featured hero story, top stories rail, 6 desk cards (including Commercial Vehicles), category & region/country filters, full-text search, active filter bar, Bull Machines watch feature, global OEM tracker, and newsletter sign-up.
  - [`article.html`](file:///d:/CE_Machines_News_Site/public/article.html) & [`article.js`](file:///d:/CE_Machines_News_Site/public/article.js): Article detail view with structured technical specification datasheet (`specs`), multi-source verification list (`sourceUrls`), story dossier sidebar, clickable tag chips, and related stories.
  - [`section.html`](file:///d:/CE_Machines_News_Site/public/section.html) & [`section.js`](file:///d:/CE_Machines_News_Site/public/section.js): Dedicated section desks (`bull-machines`, `equipment`, `commercial-vehicles`, `brands`, `technology`, `industry`, `reviews`, `guides`, `events`) with instant search and fallback image placeholders.
  - [`contact.html`](file:///d:/CE_Machines_News_Site/public/contact.html): Interactive News Tip, OEM Press Release & Correction submission form (`POST /api/submissions`).
  - [`about.html`](file:///d:/CE_Machines_News_Site/public/about.html): Editorial charter and coverage scope.
- **Editorial Admin ([`admin.html`](file:///d:/CE_Machines_News_Site/public/admin.html) & [`admin.js`](file:///d:/CE_Machines_News_Site/public/admin.js))**:
  - Create, edit, and delete articles across `draft`, `review`, `scheduled`, and `published` states.
  - Manage custom URL slugs, technical specification key-value datasheets, models, powertrains, regions, and multiple source links.
  - Review submitted news tips (with one-click promotion to article draft) and inspect newsletter subscribers.

## Run Locally

1. Ensure Node.js 20 or newer is installed (`node --version`).
2. Copy `.env.example` to `.env` and configure `ADMIN_PASSWORD` and `SESSION_SECRET`.
3. Start the server:
   ```bash
   node server.js
   ```
4. Run the automated test suite:
   ```bash
   node --test test/server.test.js
   ```
5. Open `http://localhost:3000` (public site) and `http://localhost:3000/admin.html` (editorial admin).
