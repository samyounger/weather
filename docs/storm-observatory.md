# Historical storm observatory

## Scope and sources
First case: Storm Éowyn, 23–25 January 2025. Agreed planning intent lives under `_bmad-output/brainstorming/brainstorm-useful-weather-data-2026-11-09`; PRD, architecture, UX and six AC-driven stories under `_bmad-output/planning-artifacts`.
The 104 brainstorm suggestions are not an implementation checklist. This release implements the accepted connected historical-storm prototype.

### Free-source register (verified 20 November 2026)
- Met Office official report, pp. 1–5: https://www.metoffice.gov.uk/binaries/content/assets/metofficegovuk/pdf/weather/learn-about/uk-past-events/interesting/2025/2025_02_storm_eowyn.pdf — central pressure 991→941 hPa from 00 UTC 23 to 00 UTC 24 Jan; 06 UTC off Donegal; 08 UTC over Argyll; north-easterly passage and northern Scotland satellite evidence. No terminal dissipation time provided.
- Naming forecast, published 21 Jan 2025 12:16 UTC: https://www.metoffice.gov.uk/about-us/news-and-media/media-centre/weather-and-climate-news/2025/storm-eowyn-named-as-strong-winds-heavy-rain-and-snow-forecast — exposed-site gusts >80mph and northeastward UK passage expected.
- Regional forecast/warnings, published 23 Jan 10:12 UTC: https://www.metoffice.gov.uk/about-us/news-and-media/media-centre/weather-and-climate-news/2025/red-weather-warnings-issued-with-damaging-winds-forecast-for-storm-eowyn — 80–90mph widely in red areas/potential100mph exposed coasts; Scottish red warning 10–17 UTC24Jan; southern Scotland amber06–21UTC24Jan. Do not mistake Northern Ireland's07–14UTC warning for Scotland's.
- GOV.UK alert: https://www.gov.uk/alerts/23-jan-2025-2 — sent23Jan17:50UTC, explicitly includes Scottish Borders; stopped sending24Jan16:20UTC is NOT warning expiry. Original warning polygon membership of the station remains unverified.
- Met Office retrospective, published31Jan: https://www.metoffice.gov.uk/blog/2025/a-look-back-on-storm-eowyn — first warnings20Jan and naming21Jan preceded formation;100mph Drumalbin;15 qualifying stations' January gust records. Not this station's records.
- Terms: https://www.metoffice.gov.uk/policies/legal and https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ — public-sector material under OGL unless marked otherwise; paraphrased factual text, attribution, no copied third-party images.
- Tempest API schema: https://weatherflow.github.io/Tempest/api/swagger/swagger.json — obs_st epoch0, gust3 m/s, station pressure6mb/hPa, temperature7°C, interval rain12mm, report interval17minutes. Existing owner's token; no new paid product. Explicit bucket=a verified to return minute intervals; default3day queries returned5minute aggregate reports and are not suitable for sampled-extrema analysis.

No paid API, subscription, mapping tiles, original archived point forecasts or warning-polygon service is provisioned. Existing AWS request/hosting charges still apply. Public narrative is bundled, so production does not scrape external pages per visit.

## Local data and method
GET /storms/eowyn uses existing JWT-authorized integration and server-side Tempest configuration. It validates station/device membership and Europe/London metadata; requests fixed3day ranges in Jan2025 andJan2026. The winter windows are GMT and explicitly displayed as Europe/London. Do not generalise these UTC constants to summer cases without local-boundary conversion.
Each minute report covers the minute ending at its timestamp. Select start<t<=end, deduplicate relevant measured fields; conflicting timestamp samples are omitted. Reports not exactly one minute or timestamp-aligned are rejected. Invalid values remain null and reduce that metric's coverage. Rain is interval sum; with gaps only an observed subtotal. Temperature extrema are available minute-sample extrema, not continuous instantaneous extrema. Station pressure is not MSLP.
Coverage=valid metric minutes/4320. Observed gust-threshold runs require consecutive minute reports; a high gust in each minute is not sustained40mph wind. No interpolation or exact storm arrival/departure inference.
Jan2026 reference is one equivalent seasonal period. At least95% valid gust minutes in BOTH windows is required for measured-peak difference wording. It cannot establish station-wide/national records or climate normals.

## Operations
- Required existing Lambda env: TEMPEST_HOST, TEMPEST_TOKEN, TEMPEST_DEVICE_ID, TEMPEST_STATION_ID. Credentials never appear in client configuration, raw errors or logs.
- Requests use one20second whole-operation deadline; event failure returns sanitized503; comparison failure keeps event, labels reference unavailable.
- Module cache holds at most one configured case, coalesces concurrency and expires after1hour; reference failures retry after30seconds. API responses use private,no-store; no station readings in static assets.
- Production mockMode must be absent/false. Local demonstration deliberately has NO real station observations. Tests use synthetic fixtures only.
- Existing chart route remains under Explore trends; no raw/refined storage migrations or backfills are performed.
- Deploy: PR→main through existing tag-and-deploy workflow. fetch deploy precedes dashboard. Monitor both GitHub Deployment statuses and public runtime-config/assets.
- Rollback: use Deploy Package (Manual) for fetch-observations/weather-dashboard with their previously successful package tags, backend first where compatible; do not alter data or delete user pools. Existing trend view remains fallback if upstream history unavailable.
- Current warnings are linked separately, never supplied by this historical account.

## Validation
Root build, lint and all workspace coverage suites, with90% thresholds unchanged. Local heavy commands must use openclaw-heavy; exit75 defers, never bypass. Resource-limited browser checks must use one worker; CI repeats build/lint/coverage. See implementation artifact for release-specific results.

### Browser verification command
Install pinned tooling with `npm install --prefix .tools/browser-tooling --no-save --package-lock=false playwright@1.64.1` and its Chromium/WebKit browsers. Run `WEATHER_PLAYWRIGHT_PATH="$PWD/.tools/browser-tooling/node_modules/playwright" node scripts/verify-storm-browser.cjs --workers=1` inside the guarded runner on this VM. The script starts/stops its own Vite server, uses only synthetic JWTs/fixtures and runs each browser/viewport sequentially. Set PLAYWRIGHT_BROWSERS_PATH to an installed browser directory when needed. Viewport screenshots avoid large full-page memory spikes. CI runs the same script after build/typecheck/lint/coverage.

Hourly evidence includes independent valid-minute counts for gust, rain, pressure and temperature, not just raw report counts. No usable gust evidence disables threshold exploration and is labelled unavailable. The browser bounds the full request/body to25seconds, supports reference retry, and validates the fixed windows/counts before rendering. Keyboard acceptance uses real Tab/Enter/Space input and375px mobile viewports.
