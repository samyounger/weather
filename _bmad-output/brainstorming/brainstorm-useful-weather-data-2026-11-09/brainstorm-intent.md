# Intent: understand a storm from start to finish

## Accepted direction

The existing charts do not help the user understand their weather. They want to connect three experiences: a daily weather story, weather detective exploration and a local almanac. All three should remain connected through meaningful events and their evidence.

The user endorsed a storm lifecycle concept and agreed to start with **one historical storm**, linking its wider journey to local station observations. This is a planning prototype, with no implementation or deployment agreed.

The user wants to understand where a storm formed, how long it has been active, its movement and eventual end; how long local effects lasted; relevant official local warnings, such as Met Office amber warnings; whether observations broke records or were seasonally unusual; and whether forecasts predicted record-breaking conditions beforehand.

## Proposed prototype journey and deliverables

The coach proposes a single event page as the vehicle for testing the accepted concept:

1. Read a short account of the storm and its significance locally: the daily-story entry point.
2. Follow a sourced timeline and map of its wider lifecycle, connecting available milestones to local arrival, peak and departure: the detective journey.
3. Inspect local measurements, location-relevant official warnings, available forecast history and historical comparisons: the almanac context.
4. Open the evidence behind each claim, including source, time, calculation, coverage and uncertainty.

Candidate deliverables are a sourced storm narrative, lifecycle timeline/map, local observation summary and transparent comparison with station history. Their exact presentation and completeness remain proposals to validate, rather than approved build requirements.

## Evidence and accuracy constraints

Separate formation, first identification, naming and first local impacts. Where formation is unknown, say “first identified in available source coverage”; distinguish storm lifetime from duration at the station. Distinguish sourced past positions from forecast track, and do not infer a storm’s track from local wind direction.

Preserve forecast and warning issue times. Archived forecast snapshots are needed to substantiate what was predicted beforehand; their availability is unverified. Station records and seasonal station-history comparisons must be labelled separately from externally verified regional or national records. Short station history cannot establish climate normals.

No live station data has been queried. Raw fields do not establish completeness or query support. Verify units, sampling, gaps, rainfall interval semantics and duplication. Use Europe/London day boundaries, true extrema and appropriate weighting; extrema of averages are not true extremes.

Official Met Office material suggests useful warnings, forecasts, synoptic context and past-event accounts. A complete lifecycle API and global coverage are unverified. The historical prototype is not a live operational warning service.

## Usefulness and next evidence checks

Proposed acceptance signals: the user can explain the storm’s journey, connect it to their station experience, understand whether local conditions were unusual and distinguish prior predictions from observed outcomes, with every substantive claim traceable.

Next select a historical storm, establish station location and usable history, then check overlap with lifecycle evidence, local warnings and archived forecasts. Record gaps before fixing prototype scope.

Automatic live tracking, alerts, broad free-text questions and wider event catalogues remain deferred possibilities. The storm, location, readings and available API coverage remain unresolved.
