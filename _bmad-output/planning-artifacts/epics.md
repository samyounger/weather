---
title: Storm observatory
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/brainstorming/brainstorm-useful-weather-data-2026-11-09/brainstorm-intent.md
  - _bmad-output/planning-artifacts/prd-storm-observatory.md
  - _bmad-output/planning-artifacts/architecture-storm-observatory.md
  - _bmad-output/planning-artifacts/ux-storm-observatory.md
approval: Sam delegated decisions, implementation and deployment on 2026-11-20; interactive menus waived
---
# Weather — Epics and Stories

## Overview
Deliver one cohesive historical storm experience, joining story, detective and almanac. Existing charts remain available. All source acquisition is free.

## Requirements Inventory
### Functional Requirements
FR1 sourced narrative/lifecycle; FR2 geographic context; FR3 private local observations/coverage; FR4 local peak and threshold exploration; FR5 seasonal reference; FR6 historical local warning context; FR7 forecast-vs-outcome evidence; FR8 evidence and retained trends.
### NonFunctional Requirements
NFR1 free external sources/no new token; NFR2 JWT/private data; NFR3 bounded requests/cache/explicit states; NFR4 responsive/accessibility/UK units/local time; NFR5 lint/build/90% coverage/deploy smoke.
### Additional Requirements
Reuse Lambda/API Gateway/Cognito, no migration. Fixed event windows, strict numeric/interval validation, no invented track, unavailable formation/dissipation labelled; no automatic live monitoring. Full architecture and source decisions in companion documents.
### UX Design Requirements
UX-DR1 story-first navigation; UX-DR2 local/regional distinction; UX-DR3 accessible schematic/timeline/replay table; UX-DR4 loading/error/retry/empty states; UX-DR5 mobile/reduced motion.
### FR Coverage Map
FR1/FR2 → 1.1; FR3 → 1.2; FR4 → 1.3; FR5 → 1.4; FR6/FR7 → 1.5; FR8 → 1.1/1.6.

## Epic List
### Epic 1: Understand Éowyn's journey and what happened at home
Read sourced regional history, connect local observations and explore context without overstating evidence.
**FRs covered:** FR1–FR8.

## Epic 1: Understand Éowyn's journey and what happened at home

### Story 1.1: Read the storm's story and trace its wider journey
As Sam, I want a story and sourced lifecycle, so that I understand how the storm developed and moved.
**Acceptance Criteria:**
- **Given** I am signed in, **when** I open the app, **then** I see Éowyn's historical case and story-first navigation; existing trends are one button away. (FR1/FR8)
- **Given** the evidence covers only regional milestones, **when** I inspect the schematic/timeline, **then** naming, first covered development, regional passage and unknown dissipation are distinct, source links are present and no invented exact track is shown. (FR2)
**Files:** entities/storm/model/storm-evidence.ts, widgets/storm-story, dashboard-shell.
**Depends on:** nothing.

### Story 1.2: Inspect actual local measurements with honest coverage
As Sam, I want my station's measurements, so that I can connect the story to home rather than national peaks.
**Acceptance Criteria:**
- **Given** valid minute reports, **when** the authenticated fixed-case endpoint loads, **then** I see measured gust mph, sampled temperature range °C, interval rain mm and station pressure hPa with local dates and per-metric coverage. (FR3)
- **Given** missing/malformed reports or conflicting duplicates, **when** summarised, **then** no values are invented, intervals are counted once, invalid fields reduce their metric coverage and empty means unavailable rather than zero.
- **Given** no valid JWT, **when** requesting the deployed API route, **then** private data is not returned; upstream token never reaches client output.
- **Given** upstream failure, **when** loaded, **then** public story remains and a sanitized retryable error appears, not mock data.
**Files:** fetch services/storm-observations.ts, storm-handler.ts, index.ts, dashboard template and entities/storm/api.
**Depends on:** 1.1.

### Story 1.3: Replay local weather and investigate gust episodes
As Sam, I want peak timing and hourly evidence, so that I can understand the local sequence.
**Acceptance Criteria:**
- **Given** reports during the case, **when** exploring replay, **then** hourly gust maxima, rain sums, average station pressure and per-metric valid-minute counts are shown without connecting across missing hours; a table exposes exact values.
- **Given** threshold 30/40/50mph, **when** I select it, **then** sampled qualifying minutes, first/last report and longest contiguous run update; missing/invalid minutes break runs. They are not described as sustained wind or exact storm lifetime. (FR4)
**Files:** storm-observations.ts, storm-story UI and tests.
**Depends on:** 1.2.

### Story 1.4: Put the storm in seasonal perspective
As Sam, I want a transparent same-date comparison, so that I can see how this period differed.
**Acceptance Criteria:**
- **Given** 23–25 Jan 2026 data, **when** I inspect the almanac, **then** dates, coverage and measured differences are shown, explicitly not climate normals/full station records. (FR5)
- **Given** comparison fails or has insufficient valid metric coverage, **when** viewed, **then** event remains usable and no unsupported ranking/difference is claimed.
**Files:** storm handler/summary and storm-story.
**Depends on:** 1.2.

### Story 1.5: Distinguish warnings and forecasts from outcomes
As Sam, I want dated official evidence, so that I know what was anticipated and how it relates to my area.
**Acceptance Criteria:**
- **Given** the GOV.UK alert includes Scottish Borders, **when** viewing warnings, **then** issue time/region and official regional validity are visible, with exact station polygon membership unverified. (FR6)
- **Given** 21/23 Jan published forecasts and later report, **when** compared, **then** issue/retrieval dates and predicted regional gusts vs national observed peaks are separate; no local forecast accuracy or predicted record claim is made. (FR7)
- **Given** linked external evidence, **when** reviewed, **then** only free primary sources are used with attribution and uncertainty.
**Files:** storm-evidence.ts and storm-story.
**Depends on:** 1.1.

### Story 1.6: Access a verified production release and its methods
As Sam, I want the experience deployed with an evidence trail, so that I can use it reliably.
**Acceptance Criteria:**
- **Given** mobile/keyboard use, **when** navigating all views, **then** labelled controls, focus, headings and table alternatives work without page overflow. (FR8)
- **Given** completed implementation, **when** release gates run, **then** root build/lint/coverage pass (90% thresholds retained), browser paths pass, a reviewed PR deploys through existing tag-driven CI, and production assets/auth boundaries are verified.
- **Given** a regression, **when** operating the service, **then** documented previous-tag/manual-deployment rollback is available.
**Files:** tests, source/operations docs, existing deployment workflows.
**Depends on:** 1.1–1.5.

## Validation
All eight FRs and five UX requirements map to explicit ACs. One epic avoids independent layers and repeated file churn. No new tables; only previous-story dependencies. Sources/data overlap verified before development; evidence gaps are visible product states, not unresolved build decisions.
