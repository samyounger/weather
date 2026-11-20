---
title: Historical storm observatory
type: feature
created: 2026-11-20
status: in-review
route: dispatch
review_loop_iteration: 0
baseline_commit: 0d60799415799a157f1fc9fc457a9075501edb3a
context:
  - "{project-root}/_bmad-output/planning-artifacts/epics.md"
---
<frozen-after-approval reason="Sam authorized autonomous planning through deployment">
## Intent
Existing charts do not explain weather events. Deliver the accepted historical-storm prototype joining a readable story, detective evidence and local almanac. Select Éowyn, 23–25 January 2025, because primary sources and actual station history overlap. Implement stories 1.1–1.6, preserving current trends.

## Boundaries & Constraints
Always use free sources. Reuse existing Tempest token server-side and Cognito JWT protection. Fixed-date bounded upstream calls; sanitize errors and never log secrets or credential-bearing URLs. No station observations or coordinates in public frontend bundles. UK units/Europe/London. Do not introduce paid APIs, tiles or subscriptions.
Never infer precise storm track/formation/dissipation from local wind; never label sampled observations climate normals or all-time records. Retrospective publications are not archived forecast snapshots. Keep point warning inclusion unverified when no original polygon is available. No live warning service.

## I/O & Edge-Case Matrix
| Scenario | Input/state | Expected behavior | Error handling |
|---|---|---|---|
| Case load | Configured station and minute history | Measured peak/range/rain/pressure, hourly replay, coverage | No interpolation |
| Duplicate/conflict | Repeated timestamp | Identical copies count once; conflicting copies excluded | Coverage falls |
| Invalid metric | null, non-number, nonfinite, out-of-range | Missing for that metric, not zero | Metric coverage shown |
| Gaps | Missing minutes/hours | Episodes break; missing chart hours null | No implied continuity |
| Bad interval | Non-minute report | Exclude rather than average extrema | Explain discarded reports |
| Comparison failure | Reference absent/error | Case remains usable, no ranking | Visible reference unavailable |
| Upstream failure | Network/status/shape/timeout | Retry UI and public story remain | Sanitized 503 |
| Unauthorized | No JWT at gateway | No station data | 401 |
| Source uncertainty | No exact formation/final dissipation | Explicitly unknown | No invented milestone |
</frozen-after-approval>

## Code Map
- fetch-observations/src/index.ts: route fixed historical case before generic query validation; keep existing routes unchanged.
- fetch-observations/template.yaml: existing server-side Tempest credentials; no new secret/infra.
- weather-dashboard/template.yaml: add JWT GET /storms/eowyn to existing integration.
- weather-dashboard/src/entities/weather/api/weather-api.ts: preserve existing series contract; new case API separate.
- weather-dashboard/src/widgets/dashboard-shell/ui/dashboard-shell.tsx: retain trend controls/chart; new story mode default.
- weather-dashboard/src/entities/storm: typed DTO/API and curated public evidence, public barrel.
- weather-dashboard/src/widgets/storm-story: presentation; use existing app providers.
- store/refine service investigation: raw station columns stored as int; rollups average many fields and UTC days, cannot establish true temperature extremes. New case reads minute Tempest history directly to avoid misleading extrema/truncation and unverified backfill availability; original pipeline unchanged.
- existing GitHub workflow: PR merge tags affected packages, tests, deploys fetch before dashboard.

## Tasks & Acceptance
**Execution:**
- [x] Add sourced lifecycle/forecast/warning evidence with free-source register.
- [x] Add pure summary/interval validation and tests; endpoint with deadlines/cache/independent comparison status.
- [x] Add authenticated API route, DTO/client and tests; mock only when explicit mockMode.
- [x] Build story-first responsive UI, accessible schematic/timeline/replay/threshold/almanac/methods and retain trends.
- [x] Verify root build/lint/coverage; browser happy/error/empty/keyboard/mobile flows.
- [ ] Review diff against sources, merge approved-scope release, verify deploy and production.

**Acceptance Criteria:**
Given the completed case, when Sam explores it, then all stories' Given/When/Then criteria pass with every substantive claim traceable.
Given deployment, when production smoke checks run, then new assets are reachable and station endpoint remains authenticated.

## Implementation Notes
User instruction overrides interactive workflow approval menus. No intent gaps requiring human input remain; finite evidence gaps are explicitly represented. Deployment authorized, no migrations/deletions. Existing-token read-only probe verified station/history; do not commit private fetched data. Local heavy jobs deferred by guard until headroom permits; use CI if necessary, never bypass limits.

## Spec Change Log

## Review Triage Log

## Verification
- Guarded sequential npm build/lint/test:coverage; CI repeats all.
- Browser interactions at mobile and desktop with explicit mock mode; production HTTP/auth/asset/deployment verification.

### Independent review (20 November 2026)
Native read-only reviewer checked the working tree (initial temp diff had not yet been written), traced source contracts, privacy, aggregation and deployment order.
- medium / fixed: episode validation allowed extra malformed entries while Replay assumed all entries were objects. Require exactly three distinct supported thresholds and regress malformed/duplicate arrays.
- medium / fixed verification gap: thirty-second reference retry was untested. Add controlled-clock regression.
- medium / fixed verification gap: aborted network request path was only simulated by immediate rejection. Add shared deadline/abort propagation regression.
- Initial forked research helper could not call tools; source investigation completed directly. Native independent review tooling worked.

### Final three-layer review triage
| Finding | Verdict / evidence / resolution |
|---|---|
| Blind: hourly metric coverage absent | medium, real: raw report count did not establish valid rain minutes. Added per-metric hourly counts and visible valid-minute labels plus regression. |
| Blind: no gust data looked like zero activity | medium, real: qualifying count zero conflated missing measurements. Threshold exploration now unavailable/disabled when gust coverage is zero; regression includes other metrics present. |
| Blind: reference failure had no retry | medium, real: only reload/navigation retried. Added explicit reference retry and keyboard/browser coverage. |
| Blind: keyboard test used programmatic focus and390px | medium verification gap, real: changed to Tab/Enter/Space journeys through navigation, threshold, details and retry;375px boundary. |
| Edge: browser request could stall | medium, real: caller abort only on unmount. Added25second whole-request/body deadline and controlled-abort tests. |
| Edge: reference retry missing | medium, duplicate root cause of blind finding, resolved by same retry control; preserved separate finding. |
| Edge: semantic response consistency weak | medium, real: wrong dates/counts could retain hardcoded case labels. Validate fixed event/reference windows, expected/observed integer bounds, hourly metric counts, temperature ordering and episode bounds/times. |
| Verification: endpoint tests only empty upstream reports | medium verification gap, real: pure summary/browser tests bypassed endpoint plumbing. Added populated event/reference test asserting distinct peaks, interval rain, coverage and hourly values. |
Three reviewers completed independently; no unresolved high/medium finding remains in these reviews. Source PDF claims directly rechecked:50hPa/24h and06UTC Donegal p1;08UTC Argyll p5.

### Release-candidate verification
All six workspaces:374 unit tests passed across the initial full run plus final affected-suite reruns (fetch138, dashboard132; unchanged backfill26, cloud27, refine19, store32). Root build/lint and application type-check passed. Coverage gates unchanged; fetch98.76% statements/94.45% branches, dashboard99.68% statements/98.12% branches before the final semantic additions; see CI for release-head percentages. Browser script expanded to48 journeys with375px boundary and real keyboard activation. Source PDFs were checked directly; raw station fixtures remain out of Git.
Release/production verification remains the only outstanding execution task and will be recorded on the release PR after the tag-driven workflow completes.
