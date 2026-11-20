---
title: Understand a storm, from the Atlantic to home
status: final
created: 2026-11-20
updated: 2026-11-20
---
# Historical storm observatory
## Outcome and scope
Replace a charts-only entry point with the agreed connected weather story, detective journey and local almanac. First cohesive release: Storm Éowyn, 23–25 January 2025, at the configured station. The original 104 ideas remain discovery, not 104 approved features. Sam authorized resolving decisions, implementation and production deployment without further checkpoints; all external data must be free.

## Requirements
- FR1: Read a sourced storm narrative and ordered lifecycle, separating naming, formation/development, local effects and unknown final dissipation.
- FR2: Explore a geographic overview of sourced regional milestones without fabricated centre coordinates or a forecast track presented as observations.
- FR3: See actual station gust, rain, temperature and pressure observations for the event, with period, local times, units, provenance and per-metric coverage.
- FR4: Investigate local peak time and observed gust-threshold minutes/episodes; gaps break continuity and no claim is made about exact meteorological arrival/departure.
- FR5: Compare equivalent 23–25 January observations in 2026, clearly labelled one seasonal comparison, not climate normals or a station record.
- FR6: Inspect location-relevant historical official warning context, issue time and validity, keeping regional applicability distinct from a point-in-polygon determination.
- FR7: Compare dated published pre-event forecasts with observed outcomes and retrospective analysis without claiming an archived point forecast or verified local forecast accuracy.
- FR8: Open the evidence/method behind claims and retain access to the existing trend dashboard.
- NFR1: No paid external sources, subscriptions, map tiles, new API tokens, or client-exposed integration secrets. Existing AWS hosting costs remain unchanged in kind.
- NFR2: Cognito JWT protects station data; no private station observations in frontend assets or repository fixtures.
- NFR3: Bounded fixed-date upstream requests with timeouts, cache, retry UI, explicit missing-data states and no mock fallback in production.
- NFR4: Mobile-first, keyboard-operable navigation, meaningful headings, accessible chart alternatives; wind mph, temperature °C, rainfall mm, station pressure hPa; Europe/London times.
- NFR5: Root lint/build/coverage gates; global coverage at least 90%; resource-guarded local jobs and CI; production smoke verification.

## Resolved unknowns
Station metadata confirmed with existing Tempest access: Huntshaw Mains, Europe/London, created May 2024. Jan 2025 overlaps usable historical observations. Explicit bucket=a returns minute reports; default 3-day historical queries return five-minute aggregates and must not be used for true sampled extrema. Repeated readings and missing metrics require deduplication/coverage. Use raw reported interval rain, not cumulative day rain.
Public Met Office reports and GOV.UK alert provide free evidence under OGL terms; paraphrase/attribute, no third-party imagery copied.
The full storm formation coordinates, terminal dissipation and original warning polygon are not established: display those limits, never manufacture them. A government alert explicitly includes Scottish Borders but does not establish the station's exact polygon inclusion.
2026 same-date comparison is an explicit bounded reference, not full station-history ranking. No historical forecast snapshot existed in this app: use dated published forecast articles, retrieved now and labelled accordingly.

## Success checks
Sam can explain the wider journey, find the local peak, inspect measurement coverage, distinguish forecasts from observations and open a primary source for each substantive external claim.
