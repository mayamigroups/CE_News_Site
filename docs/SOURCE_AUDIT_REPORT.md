# Machine Report World — Source Registry Audit Report

**Date of Audit**: October 27, 2026  
**Auditor**: Machine Report World Editorial & Systems Desk  
**Scope**: Inspection of all 25 active records in `data/sources.json`  

---

## 1. Executive Summary

A comprehensive audit of all 25 entries in the active source registry (`data/sources.json`) was conducted. 

### Critical Findings:
1. **Misclassified Feed Records**: 19 out of 25 existing records had an empty `feedUrl` (`feedUrl: ""`) yet were labelled as `sourceType: "rss-feed"`. A web page without an XML RSS/Atom endpoint must never be classified as an RSS feed or submitted to automated XML polling.
2. **Valid Machine-Readable RSS Endpoints**: Exactly **5** sources possess verified, functioning RSS 2.0 or Atom endpoints that return HTTP 200 with valid XML:
   - OEM Off-Highway (`https://www.oemoffhighway.com/rss`)
   - For Construction Pros (`https://www.forconstructionpros.com/rss`)
   - PR Newswire — Heavy Industry & Manufacturing (`https://www.prnewswire.com/rss/heavy-industry-manufacturing-latest-news/heavy-industry-manufacturing-latest-news-list.rss`)
   - PR Newswire — Commercial Vehicles & Automotive (`https://www.prnewswire.com/rss/automotive-transportation-latest-news/automotive-transportation-latest-news-list.rss`)
   - U.S. Department of Energy (DOE) Clean Transport (`https://www.energy.gov/rss.xml`)
3. **Official OEM Web Newsrooms**: 8 sources represent genuine primary OEM web domains (JCB, Caterpillar, Komatsu, Volvo CE, SANY, HD Hyundai, CASE, BULL Machines), but their endpoints are HTML frontends without public RSS feeds. These have been reclassified as `newsroom_page` or `manual_url` with automatic collection disabled.
4. **Duplicate Records**:
   - Multiple `bullindia.com` records (`src-f09ebfb81c15`, `src-5e05a6c2259d`, `src-25b517270120`, `src-0f337859c957`, `src-9a6571240680`) cover individual pages.
   - Duplicate `iso.org` standard references (`src-91ea6d64be20` and `src-1c3bb49d02db`), both returning HTTP 403.
   - Historical IDs are preserved to maintain backward compatibility, and their collection modes are set to `manual_url` / `disabled`.
5. **Disabled Mock Template**: `src-4a341972ede2` (Authorized OEM Partner Newsroom API) is a template specification pointing to an unresolvable example domain and is set to `disabled`.

---

## 2. Detailed Source Audit Table

| Source Name | Source ID | Current Classification | Correct Classification | Endpoint Tested | HTTP Result | Feed Validity | Duplicate Status | Recommended Action | Reason | Last Test Time |
|---|---|---|---|---|---|---|---|---|---|---|
| **BULL Machines Official Press & Product Reference** | `src-9a6571240680` | `oem-web-reference` | `manual_url` | `https://bullmachines.com/` | 200 OK | None (HTML) | Duplicate domain (`bullindia.com`) | Retain as manual reference; disable auto-collection | Official OEM portal, but exposes no public RSS feed | 2026-10-27T19:10:00+05:30 |
| **acea.auto reference** | `src-fa02628e7f9d` | `rss-feed` | `manual_url` | `https://www.acea.auto/` | 200 OK | None (HTML) | Unique domain | Reclassify to manual_url; disable auto-collection | Industry association webpage; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **iso.org reference** | `src-91ea6d64be20` | `rss-feed` | `manual_url` | `https://www.iso.org/standard/66768.html` | 403 Forbidden | None (HTML/Paywall) | Duplicate domain (`src-1c3bb49d02db`) | Reclassify to manual_url; disable auto-collection | Standards paywall page; automated requests blocked | 2026-10-27T19:10:00+05:30 |
| **excon.in reference** | `src-613de69c39b4` | `rss-feed` | `manual_url` | `https://www.excon.in/` | 200 OK | None (HTML) | Unique domain | Reclassify to manual_url; disable auto-collection | Trade exhibition event homepage; not a feed | 2026-10-27T19:10:00+05:30 |
| **bauma.de reference** | `src-30577d7f8873` | `rss-feed` | `manual_url` | `https://bauma.de/` | 200 OK | None (HTML) | Unique domain | Reclassify to manual_url; disable auto-collection | Trade exhibition portal; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **conexpoconagg.com reference** | `src-69a1117f62a0` | `rss-feed` | `manual_url` | `https://www.conexpoconagg.com/` | 200 OK | None (HTML) | Unique domain | Reclassify to manual_url; disable auto-collection | Trade exhibition portal; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **bullindia.com reference (unveils)** | `src-f09ebfb81c15` | `rss-feed` | `newsroom_page` | `https://www.bullindia.com/bull-machines-unveils.php` | 200 OK | None (HTML) | Duplicate domain with other bull records | Reclassify to newsroom_page; manual only | Official product release page; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **bullindia.com reference (reveals)** | `src-5e05a6c2259d` | `rss-feed` | `newsroom_page` | `https://www.bullindia.com/bull-machines-reveals-120cr.php` | 200 OK | None (HTML) | Duplicate domain with other bull records | Reclassify to newsroom_page; manual only | Official press release page; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **bullindia.com reference (about)** | `src-25b517270120` | `rss-feed` | `manual_url` | `https://www.bullindia.com/about-us.php` | 200 OK | None (HTML) | Duplicate domain with other bull records | Reclassify to manual_url; disable auto-collection | Corporate overview page; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **bullindia.com reference (home)** | `src-0f337859c957` | `rss-feed` | `manual_url` | `https://www.bullindia.com/` | 200 OK | None (HTML) | Duplicate domain with other bull records | Reclassify to manual_url; disable auto-collection | OEM homepage; not an RSS feed | 2026-10-27T19:10:00+05:30 |
| **OEM Off-Highway — Global Equipment & Drivetrain Feed** | `src-8e85540c8bc8` | `rss-feed` | `rss` | `https://www.oemoffhighway.com/rss` | 200 OK | Valid RSS 2.0 XML | Unique | Keep enabled for automatic polling | Active machine-readable RSS feed | 2026-10-27T19:10:00+05:30 |
| **For Construction Pros — Heavy Equipment & Fleet Feed** | `src-72134c768b96` | `rss-feed` | `rss` | `https://www.forconstructionpros.com/rss` | 200 OK | Valid RSS 2.0 XML | Unique | Keep enabled for automatic polling | Active machine-readable RSS feed | 2026-10-27T19:10:00+05:30 |
| **PR Newswire — Heavy Industry & Manufacturing Wire** | `src-88c0afd2299b` | `rss-feed` | `rss` | `https://www.prnewswire.com/rss/heavy-industry-manufacturing-latest-news/heavy-industry-manufacturing-latest-news-list.rss` | 200 OK | Valid RSS 2.0 XML | Unique | Keep enabled for automatic polling | Active machine-readable commercial wire | 2026-10-27T19:10:00+05:30 |
| **PR Newswire — Commercial Vehicles & Automotive Wire** | `src-4c3199937110` | `rss-feed` | `rss` | `https://www.prnewswire.com/rss/automotive-transportation-latest-news/automotive-transportation-latest-news-list.rss` | 200 OK | Valid RSS 2.0 XML | Unique | Keep enabled for automatic polling | Active machine-readable commercial wire | 2026-10-27T19:10:00+05:30 |
| **U.S. Department of Energy (DOE) — Clean Transport Wire** | `src-62eb9b776f90` | `regulatory-rss` | `rss` | `https://www.energy.gov/rss.xml` | 200 OK | Valid Atom/RSS XML | Unique | Keep enabled for automatic polling | Official regulatory agency feed | 2026-10-27T19:10:00+05:30 |
| **Authorized OEM Partner Newsroom API (Template)** | `src-4a341972ede2` | `authorized-api` | `disabled` | `https://api.oem-partner.example/v1/releases` | N/A (unresolvable) | None | Unique | Keep disabled | Mock specification template; unresolvable endpoint | 2026-10-27T19:10:00+05:30 |
| **jcb.com reference** | `src-0edd36efec0a` | `rss-feed` | `newsroom_page` | `https://www.jcb.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **casece.com reference** | `src-e0908bf51b27` | `rss-feed` | `newsroom_page` | `https://www.casece.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **deere.com reference** | `src-8f1ae98a0d5e` | `rss-feed` | `newsroom_page` | `https://www.deere.com/` | 200 OK | None (HTML) | Unique | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **caterpillar.com reference** | `src-783ff094dd1f` | `rss-feed` | `newsroom_page` | `https://www.caterpillar.com/` | Timeout (anti-bot/slow) | None (HTML) | Update to official release center | Reclassify to newsroom_page; manual only | Corporate portal blocks automated scanners | 2026-10-27T19:10:00+05:30 |
| **komatsu.com reference** | `src-288952bb0ff1` | `rss-feed` | `newsroom_page` | `https://www.komatsu.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **volvoce.com reference** | `src-db0b47f78e92` | `rss-feed` | `newsroom_page` | `https://www.volvoce.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **sanyglobal.com reference** | `src-2b37762314ad` | `rss-feed` | `newsroom_page` | `https://www.sanyglobal.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **hd-hyundaice.com reference** | `src-46864865f70b` | `rss-feed` | `newsroom_page` | `https://www.hd-hyundaice.com/` | 200 OK | None (HTML) | Update to official newsroom path | Reclassify to newsroom_page; manual only | Official OEM portal; no public RSS XML endpoint | 2026-10-27T19:10:00+05:30 |
| **iso.org reference** | `src-1c3bb49d02db` | `rss-feed` | `manual_url` | `https://www.iso.org/standard/70917.html` | 403 Forbidden | None (HTML/Paywall) | Duplicate domain (`src-91ea6d64be20`) | Reclassify to manual_url; disable auto-collection | Standards paywall page; automated requests blocked | 2026-10-27T19:10:00+05:30 |

---

## 3. Recommended Actions Summary

1. **Reclassify All Empty Feeds**:
   - Reclassify all 19 sources with empty `feedUrl` to `collectionMode: "manual_url"` or `collectionMode: "newsroom_page"`.
   - Set `automaticCollectionApproved: false`.
2. **Preserve Valid Automated Feeds**:
   - Keep the 5 verified RSS/Atom sources enabled for automatic polling (`collectionMode: "rss"`, `automaticCollectionApproved: true`).
3. **Preserve Historical IDs**:
   - Retain all 25 original source IDs so existing articles and references remain intact.
4. **Import Candidate Registry**:
   - Merge the verified official candidates from `data/source_registry_candidates.json` (such as Tata Motors CV, Ashok Leyland, Volvo Trucks, Daimler Truck).
   - Set Daimler Truck to `collectionMode: "disabled"` and `sourceType: "pending_verification"`.
