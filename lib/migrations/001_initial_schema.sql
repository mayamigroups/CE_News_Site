-- =============================================================================
-- MachineWire — Global Construction Equipment & Commercial Vehicle Platform
-- Relational Database Schema Migration (PostgreSQL 15+ Compatible)
-- =============================================================================

BEGIN;

-- 1. Regions
CREATE TABLE IF NOT EXISTS regions (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Countries
CREATE TABLE IF NOT EXISTS countries (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  iso_code VARCHAR(10) DEFAULT '',
  region_id VARCHAR(80) REFERENCES regions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  section VARCHAR(60) NOT NULL DEFAULT 'industry',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Authors
CREATE TABLE IF NOT EXISTS authors (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  role VARCHAR(120) NOT NULL DEFAULT 'Editorial Desk',
  email VARCHAR(160) DEFAULT '',
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Manufacturers (OEMs)
CREATE TABLE IF NOT EXISTS manufacturers (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  country_id VARCHAR(80) REFERENCES countries(id) ON DELETE SET NULL,
  website VARCHAR(500) DEFAULT '',
  focus TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Equipment & Commercial Vehicle Models
CREATE TABLE IF NOT EXISTS equipment_models (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  manufacturer_id VARCHAR(80) REFERENCES manufacturers(id) ON DELETE CASCADE,
  equipment_type VARCHAR(100) NOT NULL,
  power_type VARCHAR(80) DEFAULT 'Diesel',
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manufacturer_id, name)
);

-- 7. Sources (Primary OEM, Regulatory & Trade Sources)
CREATE TABLE IF NOT EXISTS sources (
  id VARCHAR(80) PRIMARY KEY,
  url VARCHAR(1500) NOT NULL UNIQUE,
  domain VARCHAR(255) NOT NULL,
  title VARCHAR(255) DEFAULT '',
  publisher VARCHAR(160) DEFAULT '',
  source_type VARCHAR(60) NOT NULL DEFAULT 'oem-release',
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tags
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Images (Media Library with Licensing & Credit Tracking)
CREATE TABLE IF NOT EXISTS images (
  id VARCHAR(80) PRIMARY KEY,
  url VARCHAR(1500) NOT NULL UNIQUE,
  alt VARCHAR(300) NOT NULL DEFAULT '',
  caption TEXT DEFAULT '',
  credit VARCHAR(255) NOT NULL DEFAULT 'Editorial / OEM Press Handout',
  license VARCHAR(120) DEFAULT 'Editorial Use',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Admin Users (Role-Based Editorial Accounts)
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(80) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  role VARCHAR(40) NOT NULL DEFAULT 'managing_editor'
    CHECK (role IN ('super_admin', 'managing_editor', 'reviewer', 'author')),
  password_hash VARCHAR(255) DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Articles (Core Editorial Entity)
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(80) PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  summary VARCHAR(400) NOT NULL,
  excerpt VARCHAR(400) NOT NULL,
  body TEXT NOT NULL,
  category_id VARCHAR(80) REFERENCES categories(id) ON DELETE SET NULL,
  manufacturer_id VARCHAR(80) REFERENCES manufacturers(id) ON DELETE SET NULL,
  equipment_type VARCHAR(100) NOT NULL DEFAULT 'Construction equipment',
  equipment_model_id VARCHAR(100) REFERENCES equipment_models(id) ON DELETE SET NULL,
  model_name VARCHAR(120) DEFAULT '',
  power_type VARCHAR(80) DEFAULT '',
  country_id VARCHAR(80) REFERENCES countries(id) ON DELETE SET NULL,
  region_id VARCHAR(80) REFERENCES regions(id) ON DELETE SET NULL,
  author_id VARCHAR(80) REFERENCES authors(id) ON DELETE SET NULL,
  image_id VARCHAR(80) REFERENCES images(id) ON DELETE SET NULL,
  image_url VARCHAR(1500) DEFAULT '',
  image_credit VARCHAR(255) DEFAULT '',
  article_type VARCHAR(40) NOT NULL DEFAULT 'news'
    CHECK (article_type IN ('news', 'company-announcement', 'analysis', 'opinion', 'guide', 'review')),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'rejected', 'archived')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_notes TEXT DEFAULT '',
  rejection_reason TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Article <-> Sources Junction
CREATE TABLE IF NOT EXISTS article_sources (
  article_id VARCHAR(80) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_id VARCHAR(80) NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, source_id)
);

-- 13. Article <-> Tags Junction
CREATE TABLE IF NOT EXISTS article_tags (
  article_id VARCHAR(80) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id VARCHAR(80) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- 14. Article Update History (Audit Log)
CREATE TABLE IF NOT EXISTS article_revisions (
  id VARCHAR(80) PRIMARY KEY,
  article_id VARCHAR(80) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  changed_by VARCHAR(120) NOT NULL DEFAULT 'Editorial Desk',
  status VARCHAR(30) NOT NULL,
  note TEXT DEFAULT '',
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Newsletters (Subscribers & Digests)
CREATE TABLE IF NOT EXISTS newsletters (
  id VARCHAR(80) PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  segment VARCHAR(80) NOT NULL DEFAULT 'Global Briefing',
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-throughput editorial queries
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_manufacturer ON articles(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_articles_country ON articles(country_id);
CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region_id);

COMMIT;
