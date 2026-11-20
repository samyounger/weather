# Live weather

The default home view fetches the configured Tempest device's latest report through `GET /live`. API Gateway requires the existing Cognito JWT. The Tempest credential stays in Lambda; neither responses nor error logs include upstream URLs or tokens.

The live path bypasses Athena and the archive: collection intentionally fetches yesterday at 04:00 UTC and refinement runs at 05:00 UTC. Those historical trend charts remain overnight datasets, not live graphs. Storm Éowyn remains an explicitly historical case study.

The server coalesces concurrent requests and caches successful reports for at most 30 seconds. Failures are immediately retryable. Browser polling runs every 60 seconds while visible, refreshes on visibility restoration, prevents overlapping requests and aborts at 15 seconds. Requests stop on unmount. Existing readings stay visible after failures with a warning; no synthetic or archive readings are substituted. Demo mode explicitly says live readings are unavailable.

The observation timestamp is supplied by the station, not the API retrieval time. Readings older than five minutes are labelled delayed. The displayed age updates every ten seconds. Null/invalid measurements are unavailable, not zero. Wind and gusts are converted from m/s to mph. Pressure is station pressure, and rain is the reported interval total, not today's cumulative total. Authentication refreshes before expiry for a long-running PWA.

No additional subscription or paid external data source is introduced; this reuses existing Tempest access. Existing AWS request/hosting charges still apply.
