# Approved Source Registry Pilot

## Purpose

This registry is the evidence foundation for Machine Report World. A source is not treated as an RSS feed unless a working RSS or Atom endpoint has been verified. Official newsroom pages without feeds remain manual newsroom sources until a permitted sitemap or page collector is implemented and tested.

## Collection states

- `live_feed`: A machine-readable RSS or Atom endpoint has been verified and may be polled.
- `manual_newsroom`: An official newsroom has been verified, but no machine-readable feed has been confirmed.
- `manual_reference`: An official product, investor, regulatory, or event page used to support an article.
- `pending_verification`: The source needs a technical and permissions review before use.

## Priority official sources

| Brand | Official source | Classification | Initial collection state | Coverage |
|---|---|---|---|---|
| BULL Machines | https://www.bullindia.com/bull-machines-unveils.php | Official manufacturer announcement | manual_newsroom | Backhoe loaders and company announcements |
| BULL Machines | https://www.bullindia.com/about-us.php | Official company history and event record | manual_reference | Product milestones and exhibitions |
| JCB | https://www.jcb.com/en-GB/explore/newsroom/ | Official manufacturer newsroom | manual_newsroom | Construction equipment, backhoes, compact equipment and technology |
| Caterpillar | https://www.cat.com/en_US/news/press-releases.html | Official industry-release centre | manual_newsroom | Construction, mining, power and technology |
| Komatsu | https://www.komatsu.jp/en/newsroom | Official global newsroom | manual_newsroom | Construction, mining, forestry and corporate releases |
| Volvo Construction Equipment | https://www.volvoce.com/global/en/news-and-events/news-and-stories/ | Official global newsroom | manual_newsroom | Construction equipment, electrification and business updates |
| CASE Construction Equipment | https://www.casece.com/en-us/northamerica/inside-case/articles | Official manufacturer newsroom | manual_newsroom | Construction equipment and product releases |
| SANY | https://www.sanyglobal.com/news_list/ | Official global newsroom | manual_newsroom | Construction, mining, cranes, trucks and international projects |
| XCMG | https://www.xcmgglobal.com/news/news-center.htm | Official global news centre | manual_newsroom | Construction, mining, cranes and road equipment |
| HD Hyundai Construction Equipment | https://www.hyundai-ce.com/en/media/newspress | Official manufacturer press centre | manual_newsroom | Excavators, loaders, technology and corporate updates |
| Tata Motors Commercial Vehicles | https://cv.tatamotors.com/latest-updates | Official commercial-vehicle newsroom | manual_newsroom | Trucks, buses, pickups, electric CVs and fleet news |
| Ashok Leyland | https://ashokleyland.com/ae/newsroom | Official manufacturer newsroom | manual_newsroom | Trucks, buses, LCVs, alternative fuels and business updates |
| Volvo Trucks | https://www.volvotrucks.com/en-en/news-stories/press-releases.html | Official truck press-release centre | manual_newsroom | Heavy trucks, electrification, safety and fleet technology |
| Daimler Truck | https://www.daimlertruck.com/en/newsroom/ | Official corporate newsroom candidate | pending_verification | Mercedes-Benz Trucks, Freightliner, FUSO and group developments |

## Existing machine-readable feed candidates

The current local registry contains five non-empty feed URLs. Each endpoint must pass an HTTP, XML, freshness, canonical URL and duplicate-ingestion test before remaining enabled:

1. OEM Off-Highway
2. For Construction Pros
3. PR Newswire Heavy Industry and Manufacturing
4. PR Newswire Automotive and Transportation
5. United States Department of Energy

These are discovery sources, not automatic proof. Important product and company claims must be checked against a primary manufacturer, regulator, exchange filing or event source.

## Required audit of the current local registry

The current registry contains several records labelled `rss-feed` with an empty `feedUrl`. These records must not be polled as feeds. They should be reclassified as `oem-web-reference`, `event-reference`, `regulatory-reference` or `manual_newsroom` and disabled for automatic collection until an appropriate collector is available.

Duplicate BULL Machines and ISO records should be merged after references from existing articles are checked. No record should be deleted until article and audit-log references have been reviewed.

## Acceptance rules

A source may enter automatic collection only when all checks pass:

1. The domain and publisher identity are confirmed.
2. The endpoint permits the intended access pattern.
3. The endpoint returns a stable success response.
4. RSS or Atom XML is valid when classified as a feed.
5. Publication date, title and canonical URL can be extracted.
6. Duplicate ingestion is prevented.
7. Polling frequency is respectful.
8. Failures are logged and automatically back off.
9. The source does not grant image reuse by implication; image rights are tracked separately.
10. Content is collected into News Inbox and never directly published.

## Pilot completion target

The source pilot is complete when five different brands produce at least one genuine collected item each in News Inbox, with correct source attribution, publication date, manufacturer, category, region, canonical URL, duplicate status and image-rights warning.
